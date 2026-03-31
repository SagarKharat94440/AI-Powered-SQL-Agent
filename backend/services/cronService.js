import cron from "node-cron";
import FileHistory from "../models/fileHistory.js";
import { getConnection } from "./dbService.js";

const INACTIVE_THRESHOLD_MINUTES = 30;

/**
 * Start the cleanup cron job that runs every 30 minutes.
 * Drops MySQL tables for file uploads that haven't been active recently.
 * MongoDB documents and DO Spaces files are NEVER deleted.
 */
export const startCleanupCron = () => {
    // Run every 30 minutes
    cron.schedule("*/30 * * * *", async () => {
        console.log(`[CRON] Running cleanup job at ${new Date().toISOString()}`);

        try {
            const cutoff = new Date(Date.now() - INACTIVE_THRESHOLD_MINUTES * 60 * 1000);

            // Find all file history documents that haven't been active recently
            const inactiveDocs = await FileHistory.find({
                lastActive: { $lt: cutoff },
            });

            if (inactiveDocs.length === 0) {
                console.log("[CRON] No inactive tables to clean up.");
                return;
            }

            const pool = getConnection();

            for (const doc of inactiveDocs) {
                try {
                    // Check if the table still exists before trying to drop
                    const [tables] = await pool.query(
                        `SHOW TABLES FROM \`sql_agent_uploads\` LIKE ?`,
                        [doc.tableName]
                    );

                    if (tables.length > 0) {
                        await pool.query(`DROP TABLE IF EXISTS \`sql_agent_uploads\`.\`${doc.tableName}\``);
                        console.log(`[CRON] Dropped inactive table: ${doc.tableName} (last active: ${doc.lastActive.toISOString()})`);
                    }
                } catch (err) {
                    console.error(`[CRON] Error dropping table ${doc.tableName}:`, err.message);
                }
            }

            console.log(`[CRON] Cleanup complete. Processed ${inactiveDocs.length} inactive entries.`);
        } catch (error) {
            console.error("[CRON] Cleanup job failed:", error.message);
        }
    });

    console.log("[CRON] Cleanup cron job scheduled (every 30 minutes).");
};

export default { startCleanupCron };
