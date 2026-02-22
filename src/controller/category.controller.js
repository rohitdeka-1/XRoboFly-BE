import { Category } from "../models/Category.model.js";
import { Product } from "../models/Product.model.js";
import cloudinary from "../lib/cloudinary.js";

// Get all categories with product counts
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean();
        
        // Get product counts for each category/subcategory
        for (const category of categories) {
            const categoryCount = await Product.countDocuments({ category: category.id });
            category.count = categoryCount;
            
            for (const subcategory of category.subcategories) {
                const subCount = await Product.countDocuments({ 
                    category: category.id, 
                    subcategory: subcategory.id 
                });
                subcategory.count = subCount;
            }
        }
        
        res.status(200).json({ categories });
    } catch (error) {
        console.error("Error in getAllCategories:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all categories (admin - includes inactive)
export const getAllCategoriesAdmin = async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1 }).lean();
        
        // Get product counts
        for (const category of categories) {
            const categoryCount = await Product.countDocuments({ category: category.id });
            category.count = categoryCount;
            
            for (const subcategory of category.subcategories) {
                const subCount = await Product.countDocuments({ 
                    category: category.id, 
                    subcategory: subcategory.id 
                });
                subcategory.count = subCount;
            }
        }
        
        res.status(200).json({ categories });
    } catch (error) {
        console.error("Error in getAllCategoriesAdmin:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get single category
export const getCategory = async (req, res) => {
    try {
        const category = await Category.findOne({ id: req.params.id });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        
        res.status(200).json({ category });
    } catch (error) {
        console.error("Error in getCategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Create category
export const createCategory = async (req, res) => {
    try {
        const { id, name, description, icon, order, subcategories, coverImage } = req.body;
        
        // Check if category already exists
        const existingCategory = await Category.findOne({ id });
        if (existingCategory) {
            return res.status(400).json({ message: "Category ID already exists" });
        }
        
        let coverImageUrl = null;
        
        // Upload cover image if provided
        if (coverImage) {
            const cloudinaryResponse = await cloudinary.uploader.upload(coverImage, { 
                folder: "categories",
                transformation: [
                    { width: 1200, height: 600, crop: "fill" },
                    { quality: "auto" },
                    { fetch_format: "auto" }
                ]
            });
            coverImageUrl = cloudinaryResponse.secure_url;
        }
        
        const category = await Category.create({
            id,
            name,
            description,
            icon: icon || '📦',
            coverImage: coverImageUrl,
            order: order || 0,
            subcategories: subcategories || [],
        });
        
        res.status(201).json({ category, message: "Category created successfully" });
    } catch (error) {
        console.error("Error in createCategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update category
export const updateCategory = async (req, res) => {
    try {
        const { name, description, icon, order, isActive, coverImage, subcategories } = req.body;
        const category = await Category.findOne({ id: req.params.id });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        
        // Update fields
        if (name) category.name = name;
        if (description !== undefined) category.description = description;
        if (icon) category.icon = icon;
        if (order !== undefined) category.order = order;
        if (isActive !== undefined) category.isActive = isActive;
        if (subcategories) category.subcategories = subcategories;
        
        // Upload new cover image if provided
        if (coverImage && coverImage.startsWith('data:image')) {
            // Delete old image from cloudinary if exists
            if (category.coverImage) {
                const publicId = category.coverImage.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`categories/${publicId}`);
            }
            
            const cloudinaryResponse = await cloudinary.uploader.upload(coverImage, { 
                folder: "categories",
                transformation: [
                    { width: 1200, height: 600, crop: "fill" },
                    { quality: "auto" },
                    { fetch_format: "auto" }
                ]
            });
            category.coverImage = cloudinaryResponse.secure_url;
        }
        
        await category.save();
        
        res.status(200).json({ category, message: "Category updated successfully" });
    } catch (error) {
        console.error("Error in updateCategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete category
export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findOne({ id: req.params.id });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        
        // Check if there are products using this category
        const productCount = await Product.countDocuments({ category: category.id });
        if (productCount > 0) {
            return res.status(400).json({ 
                message: `Cannot delete category. ${productCount} products are using this category.` 
            });
        }
        
        // Delete cover image from cloudinary if exists
        if (category.coverImage) {
            const publicId = category.coverImage.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`categories/${publicId}`);
        }
        
        await Category.deleteOne({ id: req.params.id });
        
        res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error in deleteCategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Add subcategory
export const addSubcategory = async (req, res) => {
    try {
        const { id, name, description, order, coverImage } = req.body;
        const category = await Category.findOne({ id: req.params.id });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        
        // Check if subcategory ID already exists
        const existingSubcategory = category.subcategories.find(sub => sub.id === id);
        if (existingSubcategory) {
            return res.status(400).json({ message: "Subcategory ID already exists in this category" });
        }
        
        let coverImageUrl = null;
        
        // Upload cover image if provided
        if (coverImage) {
            const cloudinaryResponse = await cloudinary.uploader.upload(coverImage, { 
                folder: "categories/subcategories",
                transformation: [
                    { width: 800, height: 400, crop: "fill" },
                    { quality: "auto" },
                    { fetch_format: "auto" }
                ]
            });
            coverImageUrl = cloudinaryResponse.secure_url;
        }
        
        category.subcategories.push({
            id,
            name,
            description,
            coverImage: coverImageUrl,
            order: order || 0,
            isActive: true,
        });
        
        await category.save();
        
        res.status(200).json({ category, message: "Subcategory added successfully" });
    } catch (error) {
        console.error("Error in addSubcategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update subcategory
export const updateSubcategory = async (req, res) => {
    try {
        const { name, description, order, isActive, coverImage } = req.body;
        const category = await Category.findOne({ id: req.params.categoryId });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        
        const subcategory = category.subcategories.find(sub => sub.id === req.params.subcategoryId);
        if (!subcategory) {
            return res.status(404).json({ message: "Subcategory not found" });
        }
        
        // Update fields
        if (name) subcategory.name = name;
        if (description !== undefined) subcategory.description = description;
        if (order !== undefined) subcategory.order = order;
        if (isActive !== undefined) subcategory.isActive = isActive;
        
        // Upload new cover image if provided
        if (coverImage && coverImage.startsWith('data:image')) {
            // Delete old image from cloudinary if exists
            if (subcategory.coverImage) {
                const publicId = subcategory.coverImage.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`categories/subcategories/${publicId}`);
            }
            
            const cloudinaryResponse = await cloudinary.uploader.upload(coverImage, { 
                folder: "categories/subcategories",
                transformation: [
                    { width: 800, height: 400, crop: "fill" },
                    { quality: "auto" },
                    { fetch_format: "auto" }
                ]
            });
            subcategory.coverImage = cloudinaryResponse.secure_url;
        }
        
        await category.save();
        
        res.status(200).json({ category, message: "Subcategory updated successfully" });
    } catch (error) {
        console.error("Error in updateSubcategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete subcategory
export const deleteSubcategory = async (req, res) => {
    try {
        const category = await Category.findOne({ id: req.params.categoryId });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        
        const subcategoryIndex = category.subcategories.findIndex(
            sub => sub.id === req.params.subcategoryId
        );
        
        if (subcategoryIndex === -1) {
            return res.status(404).json({ message: "Subcategory not found" });
        }
        
        // Check if there are products using this subcategory
        const productCount = await Product.countDocuments({ 
            category: category.id,
            subcategory: req.params.subcategoryId 
        });
        
        if (productCount > 0) {
            return res.status(400).json({ 
                message: `Cannot delete subcategory. ${productCount} products are using this subcategory.` 
            });
        }
        
        const subcategory = category.subcategories[subcategoryIndex];
        
        // Delete cover image from cloudinary if exists
        if (subcategory.coverImage) {
            const publicId = subcategory.coverImage.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`categories/subcategories/${publicId}`);
        }
        
        category.subcategories.splice(subcategoryIndex, 1);
        await category.save();
        
        res.status(200).json({ message: "Subcategory deleted successfully" });
    } catch (error) {
        console.error("Error in deleteSubcategory:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
