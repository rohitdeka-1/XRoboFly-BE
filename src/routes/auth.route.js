import express from "express";
import { login, signup, logout, refreshToken, getProfile, verifyOTP, resendOTP, updateProfile, changePassword, forgotPassword, verifyResetOTP, resetPassword, googleAuth } from "../controller/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { signupValidation } from "../middleware/authValidation.middleware.js";

const authRoutes = express.Router();

// Apply rate limiters - get from app settings
const applyAuthLimiter = (req, res, next) => {
    const limiter = req.app.get('authLimiter');
    if (limiter) return limiter(req, res, next);
    next();
};

const applyOtpLimiter = (req, res, next) => {
    const limiter = req.app.get('otpLimiter');
    if (limiter) return limiter(req, res, next);
    next();
};

authRoutes.post("/signup", signupValidation, signup);
authRoutes.post("/verify-otp", applyOtpLimiter, verifyOTP);
authRoutes.post("/resend-otp", applyOtpLimiter, resendOTP);
authRoutes.post("/login", applyAuthLimiter, login);
authRoutes.post("/logout", logout);
authRoutes.post("/refresh-token", refreshToken);
authRoutes.post("/forgot-password", applyAuthLimiter, forgotPassword);
authRoutes.post("/verify-reset-otp", applyOtpLimiter, verifyResetOTP);
authRoutes.post("/reset-password", applyAuthLimiter, resetPassword);
authRoutes.post("/google", googleAuth);
authRoutes.get("/profile", protectRoute, getProfile);
authRoutes.put("/profile", protectRoute, updateProfile);
authRoutes.put("/change-password", protectRoute, changePassword);

export default authRoutes;