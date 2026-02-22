import express from "express";
import {
    getBillingAddresses,
    addBillingAddress,
    updateBillingAddress,
    deleteBillingAddress,
    setDefaultBillingAddress
} from "../controller/billingAddress.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getBillingAddresses);
router.post("/", protectRoute, addBillingAddress);
router.put("/:id", protectRoute, updateBillingAddress);
router.delete("/:id", protectRoute, deleteBillingAddress);
router.patch("/:id/default", protectRoute, setDefaultBillingAddress);

export default router;
