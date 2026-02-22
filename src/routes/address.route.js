import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
	getAddresses,
	addAddress,
	updateAddress,
	deleteAddress,
	setDefaultAddress,
} from "../controller/address.controller.js";

const addressRouter = express.Router();

addressRouter.get("/", protectRoute, getAddresses);
addressRouter.post("/", protectRoute, addAddress);
addressRouter.put("/:addressId", protectRoute, updateAddress);
addressRouter.delete("/:addressId", protectRoute, deleteAddress);
addressRouter.patch("/:addressId/default", protectRoute, setDefaultAddress);

export default addressRouter;
