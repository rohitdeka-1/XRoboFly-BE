import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    createShipment,
    assignCourier,
    schedulePickup,
    trackShipment,
    cancelShipment,
    generateLabel,
    generateInvoice,
    checkServiceability,
    shiprocketWebhook
} from '../controller/shiprocket.controller.js';
import { protectRoute, adminRoute } from '../middleware/auth.middleware.js';

const shiprocketRoutes = express.Router();

// SECURITY: Rate limiting for Shiprocket operations
const shiprocketLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: 'Too many shipment requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// SECURITY: Stricter rate limiting for webhook (prevent spam)
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Shiprocket may send multiple updates
    message: 'Too many webhook requests',
    standardHeaders: true,
    legacyHeaders: false,
});

// SECURITY: Public endpoint rate limiting
const publicLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute for serviceability check
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin routes - require authentication and admin role
shiprocketRoutes.post('/create-shipment', protectRoute, adminRoute, shiprocketLimiter, createShipment);
shiprocketRoutes.post('/assign-courier', protectRoute, adminRoute, shiprocketLimiter, assignCourier);
shiprocketRoutes.post('/schedule-pickup', protectRoute, adminRoute, shiprocketLimiter, schedulePickup);
shiprocketRoutes.post('/cancel-shipment', protectRoute, adminRoute, shiprocketLimiter, cancelShipment);
shiprocketRoutes.post('/generate-label', protectRoute, adminRoute, shiprocketLimiter, generateLabel);
shiprocketRoutes.post('/generate-invoice', protectRoute, adminRoute, shiprocketLimiter, generateInvoice);

// User routes - require authentication
shiprocketRoutes.get('/track/:orderId', protectRoute, trackShipment);

// Public routes
shiprocketRoutes.get('/check-serviceability', publicLimiter, checkServiceability);

// Webhook route - NO AUTHENTICATION, NO RATE LIMITING (Shiprocket will call this)
// Note: Rate limiting can block legitimate Shiprocket webhooks
shiprocketRoutes.post('/webhook', shiprocketWebhook);

// Test endpoint to verify webhook is accessible (GET request for testing)
shiprocketRoutes.get('/webhook', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'Shiprocket webhook endpoint is accessible. Use POST method to send webhook data.',
        endpoint: '/api/v1/shiprocket/webhook',
        method: 'POST',
        expectedPayload: {
            shipment_id: 'required',
            current_status: 'optional',
            awb: 'optional'
        },
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'Optional - configure in Shiprocket dashboard and .env'
        },
        configured: {
            webhook_secret: !!process.env.SHIPROCKET_WEBHOOK_SECRET
        }
    });
});

export default shiprocketRoutes;
