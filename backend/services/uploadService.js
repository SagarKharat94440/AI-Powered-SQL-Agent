import multer from "multer";
import XLSX from "xlsx";
import { getConnection } from "./dbService.js";
import { randomBytes } from "crypto";

// Configure multer for file uploads
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = [
            "text/csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/plain",
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
            cb(null, true);
        } else {
            cb(new Error("Only CSV and Excel files are supported"), false);
        }
    },
});

// Store uploaded sessions
const uploadSessions = new Map();

/**
 * Parse uploaded file and create a temporary MySQL table
 */
export const parseAndStoreFile = async (file) => {
    const sessionId = `upload_${randomBytes(8).toString("hex")}`;
    const tableName = `user_upload_${sessionId.replace(/[^a-z0-9_]/g, "_")}`;

    let data = [];
    let headers = [];

    // Parse file based on type
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Read as array of arrays to find the actual header row
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (rawData.length === 0) {
        throw new Error("The uploaded file is empty.");
    }

    // Smart header detection: find the row in the first 20 rows with the maximum non-empty columns
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

    if (maxCols === 0) {
        throw new Error("No recognizable data columns found in the file.");
    }

    // Extract headers and ensure they are unique/strings
    const rawHeaders = rawData[headerRowIndex] || [];
    headers = rawHeaders.map((h, i) => h ? String(h).trim() : `Column_${i + 1}`);

    // Parse the rest of the rows into objects using the detected headers
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const rowArray = rawData[i];
        if (!rowArray || rowArray.length === 0 || rowArray.every(cell => cell == null || cell === "")) continue;

        let obj = {};
        for (let col = 0; col < headers.length; col++) {
            obj[headers[col]] = rowArray[col] !== undefined ? rowArray[col] : null;
        }
        data.push(obj);
    }

    // Infer column types from data
    const columnTypes = {};
    for (const header of headers) {
        // Check all rows for inference to avoid mixed-type errors later down the file
        const sampleValues = data.map(row => row[header]).filter(v => v != null && v !== "");
        
        if (sampleValues.length > 0 && sampleValues.every(v => typeof v === "number" && Number.isInteger(v))) {
            columnTypes[header] = "INT";
        } else if (sampleValues.length > 0 && sampleValues.every(v => typeof v === "number")) {
            columnTypes[header] = "DECIMAL(15,2)";
        } else {
            columnTypes[header] = "TEXT";
        }
    }

    // Create table in MySQL uploads database
    const pool = getConnection();

    // Ensure the uploads database exists
    await pool.query(`CREATE DATABASE IF NOT EXISTS sql_agent_uploads`);
    await pool.query(`USE sql_agent_uploads`);

    const safeHeaders = headers.map(h => h.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase());
    const columns = safeHeaders.map((h, i) => `\`${h}\` ${columnTypes[headers[i]]}`).join(", ");

    await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    await pool.query(`CREATE TABLE \`${tableName}\` (id INT AUTO_INCREMENT PRIMARY KEY, ${columns})`);

    // Insert data in batches
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        for (const row of batch) {
            const values = headers.map(h => row[h] ?? null);
            const placeholders = values.map(() => "?").join(", ");
            const cols = safeHeaders.map(h => `\`${h}\``).join(", ");
            await pool.query(`INSERT INTO \`${tableName}\` (${cols}) VALUES (${placeholders})`, values);
        }
    }

    // Build schema string
    const schema = `Uploaded file table:\n- ${tableName}: ${safeHeaders.map((h, i) => `${h} (${columnTypes[headers[i]]})`).join(", ")}`;

    const session = {
        sessionId,
        tableName,
        schema,
        headers: safeHeaders,
        rowCount: data.length,
        fileName: file.originalname,
        createdAt: new Date(),
    };

    uploadSessions.set(sessionId, session);

    // Auto-cleanup after 30 minutes
    setTimeout(async () => {
        try {
            await pool.query(`DROP TABLE IF EXISTS sql_agent_uploads.\`${tableName}\``);
            uploadSessions.delete(sessionId);
        } catch (e) {
            console.error("Cleanup error:", e.message);
        }
    }, 30 * 60 * 1000);

    return session;
};

/**
 * Get upload session by ID
 */
export const getUploadSession = (sessionId) => {
    return uploadSessions.get(sessionId) || null;
};

/**
 * Get schema for an upload session
 */
export const getUploadSchema = (sessionId) => {
    const session = uploadSessions.get(sessionId);
    return session ? session.schema : null;
};

export default { upload, parseAndStoreFile, getUploadSession, getUploadSchema };
