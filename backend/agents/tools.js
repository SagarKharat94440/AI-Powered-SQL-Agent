import { z } from "zod";
import { executeQuery, validateQuery } from "../services/sqlExecutor.js";
import { getSchema } from "../services/dbService.js";

// Tool for executing SQL queries
export const createSQLQueryTool = (dataset) => ({
    name: "execute_sql_query",
    description: "Execute a SQL SELECT query against the MySQL database and return results",
    schema: z.object({
        query: z.string().describe("The SQL SELECT query to execute")
    }),
    func: async ({ query }) => {
        const validation = validateQuery(query);
        if (!validation.valid) {
            return JSON.stringify({ error: validation.error });
        }
        const result = await executeQuery(dataset, query);
        return JSON.stringify(result);
    }
});

// Tool for getting database schema
export const createSchemaInfoTool = (dataset) => ({
    name: "get_schema_info",
    description: "Get information about tables and columns in the database",
    schema: z.object({
        tableName: z.string().optional().describe("Optional specific table name to get info for")
    }),
    func: async ({ tableName }) => {
        try {
            const schema = await getSchema(dataset);
            return schema;
        } catch (error) {
            return JSON.stringify({ error: error.message });
        }
    }
});

// Tool for listing available tables
export const createListTablesTool = (dataset) => ({
    name: "list_tables",
    description: "List all available tables in the database",
    schema: z.object({}),
    func: async () => {
        const result = await executeQuery(dataset, "SHOW TABLES");
        return JSON.stringify(result);
    }
});

export const createTools = (dataset) => [
    createSQLQueryTool(dataset),
    createSchemaInfoTool(dataset),
    createListTablesTool(dataset)
];

export default { createTools };
