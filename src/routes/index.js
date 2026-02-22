import { Router } from "express";
import authRoutes from "./auth.route.js";
import prodRoute from "./product.route.js";
import cartRoute from "./cart.route.js";
import couponRoute from "./coupon.route.js";
import payRouter from "./payment.route.js";
import addressRouter from "./address.route.js";
import billingAddressRouter from "./billingAddress.route.js";
import orderRouter from "./order.route.js";
import analyticsRouter from "./analytics.route.js";
import shiprocketRoutes from "./shiprocket.route.js";
import userRoutes from "./user.route.js";
import categoryRoutes from "./category.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/product", prodRoute);
router.use("/cart", cartRoute);
router.use("/payment", payRouter);
router.use("/coupon", couponRoute);
router.use("/address", addressRouter);
router.use("/billing-address", billingAddressRouter);
router.use("/orders", orderRouter);
router.use("/analytics", analyticsRouter);
router.use("/shipping", shiprocketRoutes);
router.use("/user", userRoutes);
router.use("/category", categoryRoutes);

export default router;




