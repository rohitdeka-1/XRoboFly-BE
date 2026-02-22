import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { checkoutSuccess, createCheckoutSession, cashfreeWebhook } from "../controller/payment.controller.js";

const payRouter = express.Router();

payRouter.post("/create-checkout-session", protectRoute, createCheckoutSession);
payRouter.post("/checkout-success", protectRoute, checkoutSuccess);
payRouter.post("/webhook", cashfreeWebhook); // No auth - Cashfree calls this

export default payRouter;