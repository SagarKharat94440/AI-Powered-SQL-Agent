import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: false,
});

// Dataset to MySQL database name mapping
const datasetDbMap = {
    ecommerce: "sql_agent_ecommerce",
    HR: "sql_agent_hr",
    students: "sql_agent_students",
};

/**
 * Dynamically extract schema from MySQL using information_schema
 */
export const getSchema = async (dataset) => {
    const dbName = datasetDbMap[dataset];
    if (!dbName) throw new Error("Unknown dataset: " + dataset);

    const [rows] = await pool.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = ?
         ORDER BY table_name, ordinal_position`,
        [dbName]
    );

    if (rows.length === 0) {
        throw new Error(`No tables found for dataset: ${dataset}. Run the seed script first.`);
    }

    // Group by table
    const tables = {};
    for (const row of rows) {
        const tName = row.TABLE_NAME || row.table_name;
        const cName = row.COLUMN_NAME || row.column_name;
        const dType = row.DATA_TYPE || row.data_type;
        const nullable = (row.IS_NULLABLE || row.is_nullable) === "YES";

        if (!tables[tName]) tables[tName] = [];
        tables[tName].push({
            column: cName,
            type: dType,
            nullable,
        });
    }

    // Format as readable string for LLM prompt
    let schemaStr = `Tables in ${dataset} database (MySQL database: ${dbName}):\n\n`;
    for (const [tableName, columns] of Object.entries(tables)) {
        const colDefs = columns.map(c => `${c.column} (${c.type}${c.nullable ? ", nullable" : ""})`).join(", ");
        schemaStr += `- ${tableName}: ${colDefs}\n`;
    }

    return schemaStr;
};

/**
 * Get a MySQL connection pool
 */
export const getConnection = () => {
    return pool;
};

/**
 * Get the database name for a dataset
 */
export const getDbName = (dataset) => {
    return datasetDbMap[dataset] || null;
};

/**
 * Get list of available datasets with their descriptions
 */
export const getDatasetList = () => {
    return [
        { id: "ecommerce", name: "E-Commerce", description: "Customers, products, orders, reviews data", tables: "customers, products, orders, order_items, categories, reviews" },
        { id: "HR", name: "Human Resources", description: "Employees, departments, salary, leave records", tables: "employees, departments, salary, leaves" },
        { id: "students", name: "Students", description: "Students, courses, enrollment, grades data", tables: "students, courses, enrollment, grades" },
    ];
};

export default { getSchema, getConnection, getDbName, getDatasetList };
