import { redis } from "../lib/redis.js";
import { User } from "../models/User.model.js";
import jwt from "jsonwebtoken";
import { sendMail } from "../services/mailer.services.js";
import { getClientIp, parseUserAgent, getLocationFromIp, formatDate } from "../services/getIP.js";
import envConfig from "../config/env.config.js";
import { generateOTP, getOTPExpiry } from "../utils/otp.js";
import { logger } from "../utils/logger.js";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

const client = new OAuth2Client(envConfig.GOOGLE_CLIENT_ID);

// Hash OTP before storing — prevents plaintext exposure if DB is compromised
const hashOTP = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// Shared cookie options
const cookieOpts = () => ({
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
});

const generateTokens = (userId) => {

    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m",
    });

    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d",
    });

    return { accessToken, refreshToken };
    
};

const storeRefreshToken = async (userId, refreshToken) => {
    await redis.set(`refresh_token:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60); // 7 days
};

const isSecure = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

export const signup = async (req, res) => {
    const { email, password, name,userPhone } = req.body;
    try {
        const userExists = await User.findOne({ email });

        // If user exists and is already verified, return error
        if (userExists && userExists.isVerified) {
            return res.status(400).json({ message: "User already exists. Please login instead." });
        }

        if (userExists && !userExists.isVerified) {
            
            const otp = generateOTP();
            const otpExpires = getOTPExpiry();

            userExists.name = name;
            userExists.password = password; // Will be hashed by pre-save middleware
            userExists.verificationOTP = hashOTP(otp);
            userExists.userPhone = userPhone;
            userExists.otpExpires = otpExpires;
            userExists.otpAttempts = 0;
            await userExists.save();

            
            try {
                await sendMail(
                    userExists.email,
                    "Verify Your Email - New OTP Code",
                    "otp",
                    {
                        name: userExists.name,
                        otp: otp,
                        expiryMinutes: 15,
                        year: new Date().getFullYear()
                    }
                );
                logger.secure("New OTP email sent to existing unverified user");
            } catch (emailError) {
                logger.error("Failed to send OTP email", emailError);
                // Don't block user, continue with signup
            }

            return res.status(200).json({
                message: "You have an unverified account. A new OTP has been sent to your email.",
                email: userExists.email
            });
        }

         
        const otp = generateOTP();
        const otpExpires = getOTPExpiry();

        const user = await User.create({ 
            name, 
            email, 
            userPhone,
            password,
            isVerified: false,
            verificationOTP: hashOTP(otp),
            otpExpires: otpExpires,
            otpAttempts: 0
        });

        try {
            await sendMail(
                user.email,
                "Verify Your Email - OTP Code",
                "otp",
                {
                    name: user.name,
                    otp: otp,
                    expiryMinutes: 15,
                    year: new Date().getFullYear()
                }
            );
            logger.secure("OTP email sent successfully");
        } catch (emailError) {
            logger.error("Failed to send OTP email", emailError);
            // Don't delete user, allow them to resend OTP
        }

        res.status(201).json({
            message: "OTP sent to your email. Please verify to complete registration.",
            email: user.email
        });
    } catch (error) {
        logger.error("Error in signup controller", error);
        res.status(500).json({ message: "Registration failed. Please try again." });
    }
};

export const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User is already verified" });
        }

        // Check OTP attempt lockout (max 5)
        if ((user.otpAttempts || 0) >= 5) {
            return res.status(429).json({ message: "Too many incorrect OTP attempts. Please request a new OTP." });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        // Compare against stored hash
        if (user.verificationOTP !== hashOTP(otp)) {
            user.otpAttempts = (user.otpAttempts || 0) + 1;
            await user.save();
            const remaining = 5 - user.otpAttempts;
            return res.status(400).json({ message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
        }

        user.isVerified = true;
        user.verificationOTP = undefined;
        user.otpExpires = undefined;
        user.otpAttempts = 0;
        await user.save();

        const { accessToken, refreshToken } = generateTokens(user._id);
        await storeRefreshToken(user._id, refreshToken);
        setCookies(res, accessToken, refreshToken);

        // Fire-and-forget welcome email — don't block the verify response
        sendMail(
            user.email,
            "Welcome to XRoboFly - Your Account is Ready! 🎉",
            "welcome",
            {
                name: user.name,
                email: user.email,
                registrationDate: formatDate(),
                role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
                frontendUrl: envConfig.FRONT_END || "http://localhost:5173",
                year: new Date().getFullYear()
            }
        ).catch(err => logger.error("Failed to send welcome email", err));

        res.status(200).json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            message: "Email verified successfully! Welcome aboard!"
        });
    } catch (error) {
        logger.error("Error in verifyOTP controller", error);
        res.status(500).json({ message: "Verification failed. Please try again." });
    }
};

export const resendOTP = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User is already verified" });
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpExpires = getOTPExpiry();

        user.verificationOTP = hashOTP(otp);
        user.otpExpires = otpExpires;
        user.otpAttempts = 0;
        await user.save();

        // Send OTP email
        try {
            await sendMail(
                user.email,
                "Verify Your Email - New OTP Code",
                "otp",
                {
                    name: user.name,
                    otp: otp,
                    expiryMinutes: 15,
                    year: new Date().getFullYear()
                }
            );
            logger.success("New OTP email sent successfully");
        } catch (emailError) {
            logger.error("Failed to send OTP email", emailError);
            // Don't block user, allow them to try again
        }

        res.status(200).json({
            message: "New OTP sent to your email",
            email: user.email
        });
    } catch (error) {
        logger.error("Error in resendOTP controller", error);
        res.status(500).json({ message: "Failed to resend OTP. Please try again." });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            // Check if user is verified
            if (!user.isVerified) {
                return res.status(403).json({ 
                    message: "Please verify your email before logging in. Check your inbox for the OTP code.",
                    requiresVerification: true
                });
            }

            const { accessToken, refreshToken } = generateTokens(user._id);
            await storeRefreshToken(user._id, refreshToken);
            setCookies(res, accessToken, refreshToken);

            // Fire-and-forget — don't block the login response
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const { browser, os, deviceInfo } = parseUserAgent(userAgent);
            const location = getLocationFromIp(ipAddress);
            sendMail(
                user.email,
                "🔐 New Login Alert - XRoboFly Account",
                "login",
                {
                    name: user.name,
                    email: user.email,
                    loginTime: formatDate(),
                    ipAddress: ipAddress,
                    deviceInfo: deviceInfo,
                    browser: browser,
                    os: os,
                    location: location,
                    frontendUrl: envConfig.FRONT_END || "http://localhost:5173",
                    year: new Date().getFullYear()
                }
            ).catch(err => logger.error("Failed to send login notification:", err.message));

            res.json({
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                message: "Login successful"
            });
        } else {
            res.status(400).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({ message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            await redis.del(`refresh_token:${decoded.userId}`);
        }

        const opts = cookieOpts();
        res.clearCookie("accessToken", opts);
        res.clearCookie("refreshToken", opts);
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: "No refresh token provided" });
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

        if (storedToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Rotate both tokens — invalidates the old refresh token
        const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
        const newRefreshToken = jwt.sign({ userId: decoded.userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
        await storeRefreshToken(decoded.userId, newRefreshToken);

        const base = cookieOpts();
        res.cookie("accessToken", newAccessToken, { ...base, maxAge: 15 * 60 * 1000 });
        res.cookie("refreshToken", newRefreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });

        res.json({ message: "Token refreshed successfully" });
    } catch (error) {
        console.log("Error in refreshToken controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, userPhone } = req.body;
        const userId = req.user._id;

        const updateData = {};
        if (name) updateData.name = name;
        if (userPhone) updateData.userPhone = userPhone;

        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ 
            message: "Profile updated successfully",
            user 
        });
    } catch (error) {
        console.log("Error in updateProfile controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Please provide current and new password" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "New password must be at least 8 characters long" });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ message: "New password must be different from your current password" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        user.password = newPassword;
        await user.save();

        // Fire-and-forget — don't block the response
        sendMail(
            user.email,
            "Password Changed Successfully - XRoboFly",
            "password-reset-success",
            {
                name: user.name,
                resetTime: formatDate(),
                frontendUrl: envConfig.FRONT_END || "http://localhost:5173",
                year: new Date().getFullYear()
            }
        ).catch(err => logger.error("Failed to send password change confirmation", err));

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.log("Error in changePassword controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Please provide your email address" });
        }

        const user = await User.findOne({ email });
        // Generic response — never reveal whether this email is registered (prevents enumeration)
        if (!user || !user.isVerified) {
            return res.status(200).json({
                message: "If an account exists with this email, you will receive an OTP shortly.",
                email
            });
        }

        // Generate OTP for password reset
        const otp = generateOTP();
        const otpExpires = getOTPExpiry();

        user.verificationOTP = hashOTP(otp);
        user.otpExpires = otpExpires;
        user.otpAttempts = 0;
        await user.save();

        // Send OTP email
        try {
            await sendMail(
                user.email,
                "Reset Your Password - OTP Code",
                "forgot-password",
                {
                    name: user.name,
                    otp: otp,
                    expiryMinutes: 15,
                    year: new Date().getFullYear()
                }
            );
            logger.secure("Password reset OTP sent");
        } catch (emailError) {
            logger.error("Failed to send password reset email", emailError);
            // Don't block user, allow them to try again
        }

        res.status(200).json({
            message: "Password reset OTP sent to your email",
            email: user.email
        });
    } catch (error) {
        logger.error("Error in forgotPassword controller", error);
        res.status(500).json({ message: "Failed to process password reset request." });
    }
};

export const verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: "Please provide email and OTP" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check OTP attempt lockout
        if ((user.otpAttempts || 0) >= 5) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        if (user.verificationOTP !== hashOTP(otp)) {
            user.otpAttempts = (user.otpAttempts || 0) + 1;
            await user.save();
            const remaining = 5 - user.otpAttempts;
            return res.status(400).json({ message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
        }

        // Clear OTP after verified — prevents replay
        user.verificationOTP = undefined;
        user.otpExpires = undefined;
        user.otpAttempts = 0;
        await user.save();

        // Issue a short-lived signed reset token — client must present this to reset password
        const resetToken = jwt.sign(
            { email: user.email, purpose: 'password_reset' },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '10m' }
        );

        res.status(200).json({
            message: "OTP verified successfully. You can now reset your password.",
            resetToken
        });
    } catch (error) {
        logger.error("Error in verifyResetOTP controller", error);
        res.status(500).json({ message: "OTP verification failed." });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ message: "Please provide a reset token and new password" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }

        // Verify the signed reset token issued after OTP verification
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.ACCESS_TOKEN_SECRET);
        } catch {
            return res.status(400).json({ message: "Invalid or expired reset token. Please start over." });
        }

        if (decoded.purpose !== 'password_reset') {
            return res.status(400).json({ message: "Invalid reset token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Reset password
        user.password = newPassword;
        await user.save();

        // Fire-and-forget — don't block the response
        sendMail(
            user.email,
            "Password Reset Successful",
            "password-reset-success",
            {
                name: user.name,
                resetTime: formatDate(),
                frontendUrl: envConfig.FRONT_END || "http://localhost:5173",
                year: new Date().getFullYear()
            }
        ).catch(err => logger.error("Failed to send confirmation email", err));

        res.status(200).json({
            message: "Password reset successfully. You can now login with your new password."
        });
    } catch (error) {
        logger.error("Error in resetPassword controller", error);
        res.status(500).json({ message: "Password reset failed. Please try again." });
    }
};

// Google OAuth handler
export const googleAuth = async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: "Google token is required" });
        }

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: envConfig.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        // Check if user exists
        let user = await User.findOne({ email });

        if (!user) {
            // Create new user with Google data
            user = new User({
                name,
                email,
                googleId,
                isVerified: true, // Google users are pre-verified
                image: picture,
                password: crypto.randomBytes(16).toString('hex') + "!A1a", // Cryptographically secure random password
            });
            await user.save();

            logger.success(`New Google user created: ${email}`);

            // Fire-and-forget welcome email
            sendMail(email, "Welcome to XRoboFly - Your Account is Ready! 🎉", "welcome", {
                name: user.name,
                email: user.email,
                registrationDate: formatDate(),
                role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
                frontendUrl: envConfig.FRONT_END || "http://localhost:5173",
                year: new Date().getFullYear()
            }).catch(err => logger.error("Failed to send welcome email", err));
        } else {
            // User exists - just log them in, don't modify their data
            // If they signed up with email/password, keep their original data
            // If they don't have googleId, link it
            if (!user.googleId) {
                user.googleId = googleId;
                user.image = picture;
                user.isVerified = true;
                await user.save();
                logger.success(`Google account linked to existing user: ${email}`);
            } else {
                logger.success(`Existing Google user logged in: ${email}`);
            }
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        await storeRefreshToken(user._id, refreshToken);

        // Set cookies
        setCookies(res, accessToken, refreshToken);

        // Send login notification for all Google logins
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        const { browser, os, deviceInfo } = parseUserAgent(userAgent);
        const location = getLocationFromIp(ipAddress);

        // Fire-and-forget — don't block the Google login response
        sendMail(
            user.email,
            "🔐 New Login Alert - XRoboFly Account",
            "login",
            {
                name: user.name,
                email: user.email,
                loginTime: formatDate(),
                ipAddress: ipAddress,
                deviceInfo: deviceInfo,
                browser: browser,
                os: os,
                location: location,
                frontendUrl: envConfig.FRONT_END || "http://localhost:5173",
                year: new Date().getFullYear()
            }
        ).catch(err => logger.error("Failed to send Google login notification:", err.message));

        res.status(200).json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
            },
            message: "Logged in successfully with Google",
        });
    } catch (error) {
        logger.error("Error in googleAuth controller", error);
        res.status(500).json({ message: "Google authentication failed. Please try again." });
    }
};