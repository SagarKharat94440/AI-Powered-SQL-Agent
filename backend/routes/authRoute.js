import express from "express";
import { 
    register, 
    login, 
    getProfile, 
    updateProfile, 
    updatePassword, 
    logout,
    refreshToken
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);

// Protected routes (require authentication)
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, updatePassword);
router.post("/logout", protect, logout);

export default router;
