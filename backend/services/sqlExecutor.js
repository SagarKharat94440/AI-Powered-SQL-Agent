import { getConnection, getDbName } from "./dbService.js";
import { downloadFromSpaces } from "./spacesService.js";
import FileHistory from "../models/fileHistory.js";
import XLSX from "xlsx";

/**
 * Ensure the MySQL table for an uploaded file exists.
 * If not, recreate it from the DO Spaces backup using the stored schema.
 */
export const ensureUploadTable = async (dataset) => {
    const pool = getConnection();

    // Find the file history in MongoDB
    const doc = await FileHistory.findOne({ fileId: dataset });
    if (!doc) {
        throw new Error("Upload session not found. Please re-upload your file.");
    }

    // Check if MySQL table exists
    await pool.query(`CREATE DATABASE IF NOT EXISTS sql_agent_uploads`);
    const [tables] = await pool.query(
        `SHOW TABLES FROM \`sql_agent_uploads\` LIKE ?`,
        [doc.tableName]
    );

    if (tables.length > 0) {
        // Table exists — update lastActive and proceed
        await FileHistory.updateOne({ fileId: dataset }, { lastActive: new Date() });
        return doc.tableName;
    }

    // Table was dropped (by cron or restart) — recreate from DO Spaces file
    console.log(`[RECREATE] Table ${doc.tableName} not found. Downloading from DO Spaces...`);

    const fileBuffer = await downloadFromSpaces(doc.fileUrl);

    // Re-parse the file (same logic as upload)
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawData.length === 0) {
        throw new Error("Downloaded file is empty.");
    }

    // Smart header detection (same as uploadService)
    let headerRowIndex = 0;
    let maxCols = 0;
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
        if (!rawData[i]) continue;
        const numCols = rawData[i].filter(cell => cell !== null && cell !== undefined && cell !== "").length;
        if (numCols > maxCols) {
            maxCols = numCols;
            headerRowIndex = i;
        }
    }

    const rawHeaders = rawData[headerRowIndex] || [];
    const headers = rawHeaders.map((h, i) => h ? String(h).trim() : `Column_${i + 1}`);

    // Parse data rows
    const data = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const rowArray = rawData[i];
        if (!rowArray || rowArray.length === 0 || rowArray.every(cell => cell == null || cell === "")) continue;

        let obj = {};
        for (let col = 0; col < headers.length; col++) {
            obj[headers[col]] = rowArray[col] !== undefined ? rowArray[col] : null;
        }
        data.push(obj);
    }

    // Use the stored schema for column types and safe headers
    const safeHeaders = doc.fileSchema.headers;
    const columnTypes = Object.fromEntries(doc.fileSchema.columnTypes);

    // Recreate the MySQL table
    await pool.query(`USE sql_agent_uploads`);
    const columns = safeHeaders.map((h, i) => `\`${h}\` ${columnTypes[headers[i]] || "TEXT"}`).join(", ");

    await pool.query(`DROP TABLE IF EXISTS \`${doc.tableName}\``);
    await pool.query(`CREATE TABLE \`${doc.tableName}\` (id INT AUTO_INCREMENT PRIMARY KEY, ${columns})`);

    // Insert all rows
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        for (const row of batch) {
            const values = headers.map(h => row[h] ?? null);
            const placeholders = values.map(() => "?").join(", ");
            const cols = safeHeaders.map(h => `\`${h}\``).join(", ");
            await pool.query(`INSERT INTO \`${doc.tableName}\` (${cols}) VALUES (${placeholders})`, values);
        }
    }

    // Update lastActive
    await FileHistory.updateOne({ fileId: dataset }, { lastActive: new Date() });

    console.log(`[RECREATE] Table ${doc.tableName} recreated with ${data.length} rows.`);
    return doc.tableName;
};

/**
 * Execute a SQL query against MySQL for the given dataset
 */
export const executeQuery = async (dataset, query) => {
    try {
        const pool = getConnection();
        const dbName = getDbName(dataset);

        if (!dbName && !dataset.startsWith("upload_")) {
            return { success: false, error: "Unknown dataset", data: null };
        }

        // For uploaded files, ensure the table exists (recreate if needed)
        if (dataset.startsWith("upload_")) {
            await ensureUploadTable(dataset);
        }

        // Use the correct database for the dataset
        const db = dataset.startsWith("upload_") ? "sql_agent_uploads" : dbName;
        await pool.query(`USE \`${db}\``);

        const [rows, fields] = await pool.query(query);

        return {
            success: true,
            data: rows,
            rowCount: rows.length,
            fields: fields?.map(f => f.name) || [],
        };
    } catch (error) {
        console.error("Query execution error:", error.message);
        return {
            success: false,
            error: error.message,
            data: null,
        };
    }
};

/**
 * Validate that a SQL query is safe to execute (SELECT only)
 */
export const validateQuery = (query) => {
    if (!query || typeof query !== "string") {
        return { valid: false, error: "Invalid query" };
    }

    const trimmed = query.trim();

    // Block dangerous operations
    const dangerous = [
        /\bdrop\s+(table|database|schema|index|view)/i,
        /\btruncate\b/i,
        /\bdelete\s+from\b/i,
        /\bupdate\s+\w+\s+set\b/i,
        /\balter\s+(table|database|schema)/i,
        /\bcreate\s+(table|database|schema)/i,
        /\binsert\s+into\b/i,
        /\bgrant\b/i,
        /\brevoke\b/i,
        /\bexec(ute)?\b/i,
    ];

    for (const pattern of dangerous) {
        if (pattern.test(trimmed)) {
            return { valid: false, error: `Dangerous operation detected. Only SELECT queries are allowed.` };
        }
    }

    // Must start with SELECT, WITH, or EXPLAIN
    const lower = trimmed.toLowerCase();
    if (!lower.startsWith("select") && !lower.startsWith("with") && !lower.startsWith("explain")) {
        return { valid: false, error: "Only SELECT queries are allowed. Your query must start with SELECT." };
    }

    return { valid: true };
};

export default { executeQuery, validateQuery, ensureUploadTable };
