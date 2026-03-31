import multer from "multer";
import XLSX from "xlsx";
import { getConnection } from "./dbService.js";
import { uploadToSpaces } from "./spacesService.js";
import FileHistory from "../models/fileHistory.js";
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

/**
 * Parse uploaded file, store in DO Spaces, save schema to MongoDB, and create MySQL table.
 * @param {Object} file - The multer file object
 * @param {string} userId - The authenticated user's ID
 */
export const parseAndStoreFile = async (file, userId) => {
    const sessionId = `upload_${randomBytes(8).toString("hex")}`;
    const tableName = `user_upload_${sessionId.replace(/[^a-z0-9_]/g, "_")}`;

    let data = [];
    let headers = [];

    // Parse file based on type (unchanged logic)
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
        const sampleValues = data.map(row => row[header]).filter(v => v != null && v !== "");

        if (sampleValues.length > 0 && sampleValues.every(v => typeof v === "number" && Number.isInteger(v))) {
            columnTypes[header] = "INT";
        } else if (sampleValues.length > 0 && sampleValues.every(v => typeof v === "number")) {
            columnTypes[header] = "DECIMAL(15,2)";
        } else {
            columnTypes[header] = "TEXT";
        }
    }

    // Sanitize headers for MySQL column names
    const safeHeaders = headers.map(h => h.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase());

    // --- Step 1: Upload raw file to DO Spaces ---
    const fileUrl = await uploadToSpaces(file.buffer, file.originalname, sessionId);

    // --- Step 2: Create MySQL table and insert rows ---
    const pool = getConnection();

    await pool.query(`CREATE DATABASE IF NOT EXISTS sql_agent_uploads`);
    await pool.query(`USE sql_agent_uploads`);

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

    // Build schema string for Gemini prompt
    const schemaString = `Uploaded file table:\n- ${tableName}: ${safeHeaders.map((h, i) => `${h} (${columnTypes[headers[i]]})`).join(", ")}`;

    // --- Step 3: Save schema and metadata to MongoDB ---
    const fileHistory = await FileHistory.create({
        userId,
        fileId: sessionId,
        fileName: file.originalname,
        fileUrl,
        tableName,
        fileSchema: {
            headers: safeHeaders,
            columnTypes,
            schemaString,
        },
        rowCount: data.length,
        lastActive: new Date(),
    });

    console.log(`File stored: ${file.originalname} → DO Spaces + MongoDB + MySQL (${data.length} rows)`);

    return {
        sessionId,
        tableName,
        schema: schemaString,
        headers: safeHeaders,
        rowCount: data.length,
        fileName: file.originalname,
        createdAt: fileHistory.createdAt,
    };
};

/**
 * Get upload session by ID — now from MongoDB instead of in-memory Map
 */
export const getUploadSession = async (sessionId) => {
    const doc = await FileHistory.findOne({ fileId: sessionId });
    if (!doc) return null;

    return {
        sessionId: doc.fileId,
        tableName: doc.tableName,
        schema: doc.fileSchema.schemaString,
        headers: doc.fileSchema.headers,
        rowCount: doc.rowCount,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        createdAt: doc.createdAt,
    };
};

/**
 * Get schema for an upload session — now from MongoDB
 */
export const getUploadSchema = async (sessionId) => {
    const doc = await FileHistory.findOne({ fileId: sessionId });
    return doc ? doc.fileSchema.schemaString : null;
};

export default { upload, parseAndStoreFile, getUploadSession, getUploadSchema };
