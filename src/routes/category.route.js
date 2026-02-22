import express from "express";
import {
    getAllCategories,
    getAllCategoriesAdmin,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
} from "../controller/category.controller.js";
import { protectRoute, adminRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCategories);
router.get("/:id", getCategory);

// Admin routes
router.get("/admin/all", protectRoute, adminRoute, getAllCategoriesAdmin);
router.post("/", protectRoute, adminRoute, createCategory);
router.put("/:id", protectRoute, adminRoute, updateCategory);
router.delete("/:id", protectRoute, adminRoute, deleteCategory);

// Subcategory routes
router.post("/:id/subcategory", protectRoute, adminRoute, addSubcategory);
router.put("/:categoryId/subcategory/:subcategoryId", protectRoute, adminRoute, updateSubcategory);
router.delete("/:categoryId/subcategory/:subcategoryId", protectRoute, adminRoute, deleteSubcategory);

export default router;
