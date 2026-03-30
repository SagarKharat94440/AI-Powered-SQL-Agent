import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoute.js";
import aiRoutes from "./routes/aiRoute.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { authLimiter } from "./middlewares/rateLimiter.js";

const app = express();
const PORT = process.env.PORT || 8080;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Welcome route
app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: "Welcome to SQL AI Agent Server",
        version: "1.0.0"
    });
});

// Auth routes with rate limiting
app.use('/auth', authLimiter, authRoutes);

// AI routes
app.use('/api/ai', aiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server is running on Port ${PORT}`);
});