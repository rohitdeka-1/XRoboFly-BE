import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import router from "./routes/index.js";
import { connectDb } from "./database/db.js";
import envConfig from './config/env.config.js';
import { startCleanupJob } from './jobs/cleanupUnverified.js';
dotenv.config();


const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - Required for Heroku/behind reverse proxy
app.set('trust proxy', 1);

// Apply Helmet conditionally - skip for webhook endpoint
app.use((req, res, next) => {
    // Skip Helmet for shipping webhook to avoid blocking
    if (req.originalUrl === '/api/v1/shipping/webhook') {
        return next();
    }
    
    // Security Middleware - Helmet for security headers
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                frameSrc: ["'self'", "https://accounts.google.com"],
                connectSrc: ["'self'", "https://accounts.google.com"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false, // Disable COOP for Google OAuth
    })(req, res, next);
});

// Rate limiting - Global (COMMENTED OUT FOR DEVELOPMENT)
// const globalLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // Limit each IP to 100 requests per windowMs
//     message: "Too many requests from this IP, please try again later.",
//     standardHeaders: true,
//     legacyHeaders: false,
//     // Skip rate limiting for shipping webhook
//     skip: (req) => req.originalUrl === '/api/v1/shipping/webhook'
// });

// Rate limiting - Auth routes (stricter) (COMMENTED OUT FOR DEVELOPMENT)
// const authLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 5, // Limit each IP to 5 login attempts per windowMs
//     message: "Too many login attempts, please try again after 15 minutes.",
//     skipSuccessfulRequests: true,
// });

// Rate limiting - OTP routes (very strict) (COMMENTED OUT FOR DEVELOPMENT)
// const otpLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 3, // Only 3 OTP attempts
//     message: "Too many OTP attempts, please try again after 15 minutes.",
// });

// Apply global rate limiter (COMMENTED OUT FOR DEVELOPMENT)
// app.use(globalLimiter);

// Body parser with size limits (prevent DoS attacks)
// Note: Increased to 50mb to support product uploads with images
app.use(bodyParser.json({ 
    limit: '50mb',
    verify: (req, res, buf) => {
        if (req.originalUrl === '/api/v1/shipping/webhook') {
            return true;
        }
    }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Prevent HTTP Parameter Pollution
app.use(hpp());

app.use(cookieParser());

// CORS Configuration - Allow Shiprocket webhooks


// app.use(cors({
//     origin:["localhost:5173","http://localhost:5173","https://red-claw.vercel.app","https://www.redclaw.in","http://127.0.0.1:5173"]
// }));

// CORS Configuration - Must be before routes
const getAllowedOrigins = () => {
    const origins = [
        // Local development
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        // Production
        "https://xrobofly.com",
        "https://www.xrobofly.com",
    ];

    // Add production frontend URLs from env
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONT_END;
    if (frontendUrl) {
        frontendUrl.split(',').map(u => u.trim()).forEach(u => {
            if (u && !origins.includes(u)) origins.push(u);
        });
    }

    return origins;
};

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (Postman, curl, mobile apps, server-to-server)
        if (!origin) return callback(null, true);

        const allowedOrigins = getAllowedOrigins();

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow all Vercel preview/deployment URLs for this project
        if (origin.match(/^https:\/\/x-robo.*\.vercel\.app$/) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        // Allow Shiprocket & Cashfree webhook domains
        if (origin.includes('shiprocket') || origin.includes('cashfree')) {
            return callback(null, true);
        }

        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Store rate limiters for use in routes (COMMENTED OUT FOR DEVELOPMENT)
// app.set('authLimiter', authLimiter);
// app.set('otpLimiter', otpLimiter);


app.get("/health-check", (req, res) => {
    res.send("Rohit Deka Rhd");
});

// Routes
app.use("/api/v1", router);



connectDb().then(() => {
    // Start cleanup job after database connection
    startCleanupJob();
    
    app.listen(PORT, () => {
        console.log(`Server running : http://localhost:${PORT}`);
    });
}).catch((error) => {
    console.error("Failed to connect to database:", error);
    process.exit(1);
});