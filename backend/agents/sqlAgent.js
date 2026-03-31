import { createLLM } from "../config/langchain.js";
import { getSchema } from "../services/dbService.js";
import { getUploadSchema } from "../services/uploadService.js";
import { executeQuery, validateQuery } from "../services/sqlExecutor.js";
import { SQL_AGENT_SYSTEM_PROMPT, QUERY_GENERATION_PROMPT, RESPONSE_FORMAT_PROMPT, RETRY_PROMPT } from "./promptTemplates.js";

export class SQLAgent {
    constructor(dataset) {
        this.dataset = dataset;
        this.llm = createLLM();
        this.schemaCache = null;
    }

    async getSchemaString() {
        if (this.schemaCache) return this.schemaCache;

        if (this.dataset.startsWith("upload_")) {
            this.schemaCache = await getUploadSchema(this.dataset);
        } else {
            this.schemaCache = await getSchema(this.dataset);
        }
        return this.schemaCache;
    }

    async processMessage(userMessage, conversationHistory = []) {
        try {
            const schema = await this.getSchemaString();
            if (!schema) {
                return {
                    response: "I couldn't find the database schema. Please make sure the database is set up correctly.",
                    sqlQuery: null,
                    queryResult: null,
                };
            }

            // Skip query execution for general questions
            if (this.isGeneralQuestion(userMessage)) {
                return {
                    response: await this.handleGeneralQuestion(userMessage, schema),
                    sqlQuery: null,
                    queryResult: null,
                };
            }

            // Build conversation context
            const historyContext = conversationHistory
                .slice(-6)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join("\n");

            // Step 1: Generate SQL query
            const queryPrompt = QUERY_GENERATION_PROMPT
                .replace("{schema}", schema)
                .replace("{question}", userMessage)
                .replace("{history}", historyContext || "No previous context");

            const queryResponse = await this.llm.invoke([
                { role: "system", content: "You are a MySQL query generator. Output only valid SQL SELECT queries. No markdown, no explanation." },
                { role: "user", content: queryPrompt },
            ]);

            let sqlQuery = this.cleanSQL(queryResponse.content);

            // Step 2: Validate the query
            const validation = validateQuery(sqlQuery);
            if (!validation.valid) {
                return {
                    response: `I cannot execute that type of query. ${validation.error} Please ask questions that require reading data.`,
                    sqlQuery,
                    queryResult: null,
                    error: validation.error,
                };
            }

            // Step 3: Execute the query
            let queryResult = await executeQuery(this.dataset, sqlQuery);

            // Step 3b: Retry on failure
            if (!queryResult.success && queryResult.error) {
                console.log("First attempt failed, retrying with error context...");
                const retryResult = await this.retryWithError(userMessage, sqlQuery, queryResult.error, schema);
                if (retryResult) {
                    sqlQuery = retryResult.sqlQuery;
                    queryResult = retryResult.queryResult;
                }
            }

            if (!queryResult.success) {
                return {
                    response: "I had trouble executing that query. Could you try rephrasing your question? Here's what went wrong internally: the SQL didn't match the database structure.",
                    sqlQuery,
                    queryResult: null,
                    error: queryResult.error,
                };
            }

            // Step 4: Format the response
            const formatPrompt = RESPONSE_FORMAT_PROMPT
                .replace("{question}", userMessage)
                .replace("{query}", sqlQuery)
                .replace("{results}", JSON.stringify(queryResult.data?.slice(0, 50), null, 2));

            const formatResponse = await this.llm.invoke([
                { role: "system", content: "You are a helpful data analyst. Explain query results clearly and conversationally." },
                { role: "user", content: formatPrompt },
            ]);

            return {
                response: formatResponse.content,
                sqlQuery,
                queryResult,
            };
        } catch (error) {
            console.error("SQL Agent Error:", error);
            return {
                response: this.getFriendlyErrorMessage(error),
                sqlQuery: null,
                queryResult: null,
            };
        }
    }

    async retryWithError(question, failedQuery, errorMsg, schema) {
        try {
            const retryPrompt = RETRY_PROMPT
                .replace("{error}", errorMsg)
                .replace("{question}", question)
                .replace("{schema}", schema);

            const retryResponse = await this.llm.invoke([
                { role: "system", content: "You are a MySQL query fixer. Output only the corrected SQL SELECT query." },
                { role: "user", content: retryPrompt },
            ]);

            const retrySql = this.cleanSQL(retryResponse.content);
            const validation = validateQuery(retrySql);
            if (!validation.valid) return null;

            const retryResult = await executeQuery(this.dataset, retrySql);
            if (retryResult.success) {
                return { sqlQuery: retrySql, queryResult: retryResult };
            }
            return null;
        } catch (err) {
            console.error("Retry failed:", err.message);
            return null;
        }
    }

    cleanSQL(raw) {
        let sql = raw.trim();
        sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();
        // Remove leading comments
        sql = sql.replace(/^--.*\n/gm, "").trim();
        return sql;
    }

    getFriendlyErrorMessage(error) {
        const errorMsg = error.message || "";

        if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Too Many Requests")) {
            return "I'm currently experiencing high demand. Please wait a moment and try again.";
        }
        if (errorMsg.includes("401") || errorMsg.includes("API key") || errorMsg.includes("unauthorized")) {
            return "I'm having trouble connecting to my AI service. Please contact support.";
        }
        if (errorMsg.includes("404") || errorMsg.includes("not found")) {
            return "I'm temporarily unavailable. Please try again in a few moments.";
        }
        if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("network") || errorMsg.includes("timeout")) {
            return "I'm having trouble connecting. Please check your internet connection and try again.";
        }
        return "I couldn't process your request right now. Please try rephrasing your question or try again later.";
    }

    isGeneralQuestion(message) {
        const generalPatterns = [
            /^(hi|hello|hey|greetings)/i,
            /^what can you do/i,
            /^help$/i,
            /^how do (i|you) use/i,
            /what (tables|data|databases)/i,
        ];
        return generalPatterns.some(pattern => pattern.test(message.trim()));
    }

    async handleGeneralQuestion(message, schema) {
        if (/^(hi|hello|hey|greetings)/i.test(message)) {
            return `Hello! I'm your SQL Agent assistant. I can help you query the **${this.dataset}** database using natural language. Just ask me questions about the data and I'll generate and execute the appropriate SQL queries for you.\n\nFor example, you can ask:\n- "Show me the top 10 customers"\n- "What's the average order amount?"\n- "List all employees in Engineering"`;
        }

        if (/what (tables|data)/i.test(message)) {
            return `Here's the schema for the **${this.dataset}** database:\n\n${schema}\n\nYou can ask me questions about any of these tables!`;
        }

        return `I can help you query the **${this.dataset}** database. Here's the available schema:\n\n${schema}\n\nJust ask your question in plain English and I'll handle the SQL for you!`;
    }
}

export const createSQLAgent = (dataset) => new SQLAgent(dataset);

export default { SQLAgent, createSQLAgent };
