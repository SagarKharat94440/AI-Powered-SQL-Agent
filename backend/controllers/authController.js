import { 
    registerUser, 
    loginUser, 
    getUserById, 
    updateUserProfile, 
    changePassword,
    refreshUserToken,
    logoutUser
} from "../services/authService.js";

// Register new user
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, email and password"
            });
        }

        // Validate email format
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email"
            });
        }

        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const result = await registerUser(name, email, password);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            ...result
        });
    } catch (error) {
        console.error("Register error:", error);
        const statusCode = error.message.includes("already exists") ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// Login user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password"
            });
        }

        const result = await loginUser(email, password);

        res.status(200).json({
            success: true,
            message: "Login successful",
            ...result
        });
    } catch (error) {
        const statusCode = error.message.includes("Invalid") ? 401 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// Refresh token
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const result = await refreshUserToken(refreshToken);

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            ...result
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

// Get current user profile
export const getProfile = async (req, res) => {
    try {
        const user = await getUserById(req.user.userId);

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// Update user profile
export const updateProfile = async (req, res) => {
    try {
        const user = await updateUserProfile(req.user.userId, req.body);

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user
        });
    } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// Change password
export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Please provide current and new password"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters"
            });
        }

        const result = await changePassword(req.user.userId, currentPassword, newPassword);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        const statusCode = error.message.includes("incorrect") ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// Logout
export const logout = async (req, res) => {
    try {
        await logoutUser(req.user.userId);

        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
