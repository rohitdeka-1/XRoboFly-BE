import express from "express";
import { protectRoute, adminRoute } from "../middleware/auth.middleware.js";
import { 
	createProduct, 
	deleteProduct, 
	getAllProducts, 
	getFeaturedProducts, 
	getProductsByCategory,
	getProductsBySubcategory,
	getProductsByCategoryAndSubcategory,
	getAllCategories,
	getRecommendedProducts, 
	toggleFeaturedProduct,
	updateProduct,
	updateStock,
	addProductImages,
	removeProductImage,
	updateCoverImage,
	searchProducts,
	getProductById,
	bulkUpdateStock
} from "../controller/product.controller.js";

const prodRoute = express.Router();

prodRoute.get("/", getAllProducts);
prodRoute.get("/search", searchProducts);
prodRoute.get("/featured", getFeaturedProducts);
prodRoute.get("/categories", getAllCategories);
prodRoute.get("/category/:category", getProductsByCategory);
prodRoute.get("/subcategory/:subcategory", getProductsBySubcategory);
prodRoute.get("/category/:category/:subcategory", getProductsByCategoryAndSubcategory);
prodRoute.get("/recommendations", getRecommendedProducts);
prodRoute.get("/:id", getProductById);

prodRoute.post("/", protectRoute, adminRoute, createProduct);
prodRoute.patch("/:id", protectRoute, adminRoute, updateProduct);
prodRoute.delete("/:id", protectRoute, adminRoute, deleteProduct);
prodRoute.patch("/:id/featured", protectRoute, adminRoute, toggleFeaturedProduct);

prodRoute.patch("/:id/stock", protectRoute, adminRoute, updateStock);
prodRoute.post("/bulk-stock", protectRoute, adminRoute, bulkUpdateStock);

prodRoute.post("/:id/images", protectRoute, adminRoute, addProductImages);
prodRoute.delete("/:id/images", protectRoute, adminRoute, removeProductImage);
prodRoute.patch("/:id/cover-image", protectRoute, adminRoute, updateCoverImage);

export default prodRoute;