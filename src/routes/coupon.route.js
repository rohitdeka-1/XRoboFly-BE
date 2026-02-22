import express from "express";
import { 
	getCoupon, 
	validateCoupon,
	getAllCoupons,
	createCoupon,
	updateCoupon,
	deleteCoupon
} from "../controller/coupon.controller.js";
import { protectRoute, adminRoute } from "../middleware/auth.middleware.js";

const couponRoute = express.Router();

// User routes
couponRoute.get("/", protectRoute, getCoupon);
couponRoute.post("/validate", protectRoute, validateCoupon);

// Admin routes
couponRoute.get("/admin/all", protectRoute, adminRoute, getAllCoupons);
couponRoute.post("/admin", protectRoute, adminRoute, createCoupon);
couponRoute.patch("/admin/:id", protectRoute, adminRoute, updateCoupon);
couponRoute.delete("/admin/:id", protectRoute, adminRoute, deleteCoupon);

export default couponRoute;