import mongoose from "mongoose";

const fileHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    fileId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    fileUrl: {
        type: String,
        required: true,
    },
    tableName: {
        type: String,
        required: true,
    },
    fileSchema: {
        headers: [String],
        columnTypes: {
            type: Map,
            of: String,
        },
        schemaString: String,
    },
    rowCount: {
        type: Number,
        default: 0,
    },
    lastActive: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Index for cron cleanup queries
fileHistorySchema.index({ lastActive: 1 });
// Index for user-specific lookups
fileHistorySchema.index({ userId: 1, fileId: 1 });

const FileHistory = mongoose.model("FileHistory", fileHistorySchema);
export default FileHistory;
