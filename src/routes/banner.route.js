import express from "express";
import { protectRoute, adminRoute } from "../middleware/auth.middleware.js";
import { getBanners, createBanner, updateBanner, deleteBanner } from "../controller/banner.controller.js";

const bannerRouter = express.Router();

bannerRouter.get("/", getBanners);
bannerRouter.post("/", protectRoute, adminRoute, createBanner);
bannerRouter.put("/:id", protectRoute, adminRoute, updateBanner);
bannerRouter.delete("/:id", protectRoute, adminRoute, deleteBanner);

export default bannerRouter;
