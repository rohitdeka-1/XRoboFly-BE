import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addToCart, getCartProducts, removeAllFromCart, updateQuantity } from "../controller/cart.controller.js";

const cartRoute = express.Router();

cartRoute.get("/", protectRoute, getCartProducts);
cartRoute.post("/", protectRoute, addToCart);
cartRoute.delete("/", protectRoute, removeAllFromCart);
cartRoute.put("/:id", protectRoute, updateQuantity);

export default cartRoute;