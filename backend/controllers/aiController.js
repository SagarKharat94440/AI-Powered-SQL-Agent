import { createSQLAgent } from "../agents/sqlAgent.js";
import { getSchema, getDatasetList } from "../services/dbService.js";
import { parseAndStoreFile, upload, getUploadSession } from "../services/uploadService.js";
import FileHistory from "../models/fileHistory.js";
import Conversation from "../models/conversation.js";

// Store active agents per user session
const agentSessions = new Map();

// Get or create agent for a session
const getAgent = (userId, dataset) => {
    const sessionKey = `${userId}-${dataset}`;
    if (!agentSessions.has(sessionKey)) {
        agentSessions.set(sessionKey, createSQLAgent(dataset));
    }
    return agentSessions.get(sessionKey);
};

// Send a chat message to the SQL Agent
export const chat = async (req, res) => {
    try {
        const { message, dataset = "ecommerce", conversationId } = req.body;
        const userId = req.user.userId;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message is required",
            });
        }

        // Validate dataset (allow sample DBs + uploaded sessions)
        const validDatasets = ["ecommerce", "HR", "students"];
        const isUpload = dataset.startsWith("upload_");
        if (!validDatasets.includes(dataset) && !isUpload) {
            return res.status(400).json({
                success: false,
                message: `Invalid dataset. Choose from: ${validDatasets.join(", ")} or use an uploaded file.`,
            });
        }

        if (isUpload) {
            // Check MongoDB for the upload session instead of in-memory Map
            const session = await getUploadSession(dataset);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Upload session expired or not found. Please re-upload your file.",
                });
            }

            // Update lastActive timestamp on every query
            await FileHistory.updateOne(
                { fileId: dataset },
                { lastActive: new Date() }
            );
        }

        // Get or create conversation
        let conversation;
        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, userId });
            if (!conversation) {
                return res.status(404).json({ success: false, message: "Conversation not found" });
            }
        } else {
            conversation = new Conversation({
                userId,
                dataset,
                title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
            });
        }

        // Get agent and process message
        const agent = getAgent(userId, dataset);
        const result = await agent.processMessage(message, conversation.messages);

        // Add messages to conversation
        conversation.messages.push({ role: "user", content: message });
        conversation.messages.push({
            role: "assistant",
            content: result.response,
            sqlQuery: result.sqlQuery,
            queryResult: result.queryResult,
        });

        await conversation.save();

        res.json({
            success: true,
            data: {
                conversationId: conversation._id,
                response: result.response,
                sqlQuery: result.sqlQuery,
                queryResult: result.queryResult,
            },
        });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
        });
    }
};

// Upload a file for querying
export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded. Please upload a CSV or Excel file.",
            });
        }

        // Pass userId so the file is associated with the authenticated user
        const userId = req.user.userId;
        const session = await parseAndStoreFile(req.file, userId);

        res.json({
            success: true,
            data: {
                sessionId: session.sessionId,
                fileName: session.fileName,
                rowCount: session.rowCount,
                columns: session.headers,
                message: `File "${session.fileName}" uploaded successfully with ${session.rowCount} rows. You can now query this data!`,
            },
        });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to process the uploaded file.",
        });
    }
};

// Get schema for a dataset
export const getSchemaInfo = async (req, res) => {
    try {
        const { dataset } = req.params;

        let schema;
        if (dataset.startsWith("upload_")) {
            // Fetch schema from MongoDB instead of in-memory Map
            const session = await getUploadSession(dataset);
            if (!session) {
                return res.status(404).json({ success: false, message: "Upload session not found." });
            }
            schema = session.schema;
        } else {
            schema = await getSchema(dataset);
        }

        res.json({ success: true, data: { dataset, schema } });
    } catch (error) {
        console.error("Schema Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get conversation history
export const getConversations = async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversations = await Conversation.find({ userId })
            .select("_id title dataset createdAt updatedAt")
            .sort({ updatedAt: -1 })
            .limit(50);

        res.json({ success: true, data: conversations });
    } catch (error) {
        console.error("Get Conversations Error:", error);
        res.status(500).json({ success: false, message: "Unable to load conversations." });
    }
};

// Get single conversation with messages
export const getConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const conversation = await Conversation.findOne({ _id: id, userId });
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        res.json({ success: true, data: conversation });
    } catch (error) {
        console.error("Get Conversation Error:", error);
        res.status(500).json({ success: false, message: "Unable to load conversation." });
    }
};

// Delete conversation
export const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const result = await Conversation.findOneAndDelete({ _id: id, userId });
        if (!result) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        res.json({ success: true, message: "Conversation deleted" });
    } catch (error) {
        console.error("Delete Conversation Error:", error);
        res.status(500).json({ success: false, message: "Unable to delete conversation." });
    }
};

// Get available uploaded files
export const getUploadedFiles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const uploadedFiles = await FileHistory.find({ userId })
            .select("fileId fileName rowCount fileSchema createdAt")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: uploadedFiles });
    } catch (error) {
        console.error("Get Uploaded Files Error:", error);
        res.status(500).json({ success: false, message: "Unable to load uploaded files." });
    }
};

// Get available datasets
export const getDatasets = async (req, res) => {
    const datasets = getDatasetList();
    res.json({ success: true, data: datasets });
};

export { upload as multerUpload };

export default { chat, getConversations, getConversation, deleteConversation, getDatasets, uploadFile, getSchemaInfo, getUploadedFiles };
