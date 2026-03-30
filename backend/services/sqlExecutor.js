import { getConnection, getDbName } from "./dbService.js";

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

export default { executeQuery, validateQuery };
