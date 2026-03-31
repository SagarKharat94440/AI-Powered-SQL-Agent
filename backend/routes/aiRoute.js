import express from "express";
import { chat, getConversations, getConversation, deleteConversation, getDatasets, uploadFile, getSchemaInfo, multerUpload, getUploadedFiles } from "../controllers/aiController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Chat endpoint
router.post("/chat", chat);

// File upload endpoint
router.post("/upload", multerUpload.single("file"), uploadFile);

// Get schema for a dataset
router.get("/schema/:dataset", getSchemaInfo);

// Get available datasets
router.get("/datasets", getDatasets);

// Get available uploaded files
router.get("/uploads", getUploadedFiles);

// Conversation management
router.get("/conversations", getConversations);
router.get("/conversations/:id", getConversation);
router.delete("/conversations/:id", deleteConversation);

export default router;
