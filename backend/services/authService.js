import User from "../models/userModel.js";
import { generateToken, generateRefreshToken, verifyToken } from "./jwtService.js";

// Register a new user
export const registerUser = async (name, email, password) => {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw new Error("User already exists with this email");
    }

    const token = generateToken({ tempId: Date.now() });
    const refreshToken = generateRefreshToken({ tempId: Date.now() });

    // Create user with refresh token to avoid double save
    const user = await User.create({ 
        name, 
        email: email.toLowerCase(), 
        password,
        refreshToken 
    });

    // Update token with actual user ID
    const finalToken = generateToken({ userId: user._id, email: user.email });
    const finalRefreshToken = generateRefreshToken({ userId: user._id });

    // Update refresh token with correct user ID
    await User.findByIdAndUpdate(user._id, { refreshToken: finalRefreshToken });

    return {
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        },
        token: finalToken,
        refreshToken: finalRefreshToken
    };
};

// Login user
export const loginUser = async (email, password) => {
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
        throw new Error("Invalid email or password");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new Error("Invalid email or password");
    }

    const token = generateToken({ userId: user._id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user._id });

    // Store refresh token in database using findByIdAndUpdate to avoid triggering pre-save hook
    await User.findByIdAndUpdate(user._id, { refreshToken });

    return {
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        },
        token,
        refreshToken
    };
};

// Refresh token
export const refreshUserToken = async (refreshToken) => {
    try {
        const decoded = verifyToken(refreshToken);
        
        const user = await User.findById(decoded.userId);
        if (!user || user.refreshToken !== refreshToken) {
            throw new Error("Invalid refresh token");
        }

        const newToken = generateToken({ userId: user._id, email: user.email });
        const newRefreshToken = generateRefreshToken({ userId: user._id });

        // Update refresh token in database
        user.refreshToken = newRefreshToken;
        await user.save();

        return {
            token: newToken,
            refreshToken: newRefreshToken
        };
    } catch (error) {
        throw new Error("Invalid or expired refresh token");
    }
};

// Logout user
export const logoutUser = async (userId) => {
    const user = await User.findById(userId);
    if (user) {
        user.refreshToken = null;
        await user.save();
    }
    return { message: "Logged out successfully" };
};

// Get user by ID
export const getUserById = async (userId) => {
    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
        throw new Error("User not found");
    }
    return user;
};

// Update user profile
export const updateUserProfile = async (userId, updates) => {
    const allowedUpdates = ["name", "email"];
    const filteredUpdates = {};

    Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
            filteredUpdates[key] = key === "email" ? updates[key].toLowerCase() : updates[key];
        }
    });

    const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
        new: true,
        runValidators: true
    }).select("-password -refreshToken");

    if (!user) {
        throw new Error("User not found");
    }

    return user;
};

// Change password
export const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new Error("Current password is incorrect");
    }

    user.password = newPassword;
    await user.save();

    return { message: "Password changed successfully" };
};

export default {
    registerUser,
    loginUser,
    refreshUserToken,
    logoutUser,
    getUserById,
    updateUserProfile,
    changePassword
};
