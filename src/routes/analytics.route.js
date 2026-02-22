import express from "express";
import { protectRoute, adminRoute } from "../middleware/auth.middleware.js";
import {
    getAnalyticsData,
    getDailySalesData,
    getAllOrders,
    updateOrderStatus,
    getAllUsers,
} from "../controller/analytics.controller.js";

const router = express.Router();

// All routes require admin access
router.get("/", protectRoute, adminRoute, getAnalyticsData);
router.get("/sales", protectRoute, adminRoute, getDailySalesData);
router.get("/orders", protectRoute, adminRoute, getAllOrders);
router.get("/users", protectRoute, adminRoute, getAllUsers);
router.put("/orders/:orderId/status", protectRoute, adminRoute, updateOrderStatus);

export default router;
