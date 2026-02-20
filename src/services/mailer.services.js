import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from 'url';
import envConfig from "../config/env.config.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if email credentials are configured
const isEmailConfigured = envConfig.GOOGLE_APP_GMAIL && envConfig.GOOGLE_APP_PASSWORD;

export const transporter = isEmailConfigured 
    ? nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: envConfig.GOOGLE_APP_GMAIL,
            pass: envConfig.GOOGLE_APP_PASSWORD
        }
    })
    : null;

// Configure Handlebars with the Email directory
if (transporter) {
    const handlebarOptions = {
        viewEngine: {
            extName: ".handlebars",
            partialsDir: path.resolve(__dirname, '../Email/partials'),
            defaultLayout: false,
        },
        viewPath: path.resolve(__dirname, '../Email'),
        extName: ".handlebars",
    };
    
    transporter.use('compile', hbs(handlebarOptions));
    logger.success("Email transporter configured with Handlebars templates");
}

// Email service with proper template usage
export const sendMail = async (to, subject, template, context = {}) => {
    // If email is not configured, just log and skip
    if (!isEmailConfigured || !transporter) {
        logger.warn(`[DEV MODE] Email sending skipped - Email not configured. Would send to: ${to}, Subject: ${subject}`);
        return Promise.resolve({ 
            messageId: 'dev-mode-skip',
            accepted: [to]
        });
    }
    
    try {
        const info = await transporter.sendMail({
            from: `XRoboFly <${envConfig.GOOGLE_APP_GMAIL}>`,
            to,
            subject,
            template,
            context
        });
        
        logger.success(`Email sent successfully to ${to} - ${subject}`);
        return info;
    } catch (error) {
        const errMsg = error?.message || String(error) || 'Unknown error';
        logger.error(`Failed to send email to ${to}:`, errMsg);
        // Don't throw error in development - just log it
        if (process.env.NODE_ENV !== 'production') {
            logger.warn('[DEV MODE] Email sending failed but continuing...');
            return Promise.resolve({ 
                messageId: 'dev-mode-error',
                accepted: [to]
            });
        }
        throw error;
    }
};


