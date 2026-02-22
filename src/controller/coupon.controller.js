import Coupon from "../models/Coupon.model.js";
import { User } from "../models/User.model.js";

export const getCoupon = async (req, res) => {
	try {
		const coupon = await Coupon.findOne({ userId: req.user._id, isActive: true });
		res.json(coupon || null);
	} catch (error) {
		console.log("Error in getCoupon controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const validateCoupon = async (req, res) => {
	try {
		const { code } = req.body;
		const coupon = await Coupon.findOne({ code: code, userId: req.user._id, isActive: true });

		if (!coupon) {
			return res.status(404).json({ message: "Coupon not found" });
		}

		if (coupon.expirationDate < new Date()) {
			coupon.isActive = false;
			await coupon.save();
			return res.status(404).json({ message: "Coupon expired" });
		}

		res.json({
			message: "Coupon is valid",
			code: coupon.code,
			discountPercentage: coupon.discountPercentage,
		});
	} catch (error) {
		console.log("Error in validateCoupon controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Admin: Get all coupons
export const getAllCoupons = async (req, res) => {
	try {
		const { page = 1, limit = 20, active, userId } = req.query;
		
		const safeLimit = Math.min(parseInt(limit), 100);
		const safePage = Math.max(parseInt(page), 1);
		
		const query = {};
		if (active !== undefined) query.isActive = active === 'true';
		if (userId) query.userId = userId;
		
		const coupons = await Coupon.find(query)
			.populate('userId', 'name email')
			.sort({ createdAt: -1 })
			.limit(safeLimit)
			.skip((safePage - 1) * safeLimit);
		
		const total = await Coupon.countDocuments(query);
		
		res.json({
			success: true,
			coupons,
			totalPages: Math.ceil(total / safeLimit),
			currentPage: safePage,
			total
		});
	} catch (error) {
		console.log("Error in getAllCoupons controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Admin: Create coupon
export const createCoupon = async (req, res) => {
	try {
		const { code, discountPercentage, expirationDate, userId } = req.body;
		
		if (!code || !discountPercentage || !expirationDate || !userId) {
			return res.status(400).json({ message: "All fields are required" });
		}
		
		// Check if user exists
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}
		
		// Check if coupon code already exists
		const existingCoupon = await Coupon.findOne({ code });
		if (existingCoupon) {
			return res.status(400).json({ message: "Coupon code already exists" });
		}
		
		// Check if user already has an active coupon
		const userActiveCoupon = await Coupon.findOne({ userId, isActive: true });
		if (userActiveCoupon) {
			return res.status(400).json({ 
				message: "User already has an active coupon. Deactivate it first." 
			});
		}
		
		const coupon = await Coupon.create({
			code: code.toUpperCase(),
			discountPercentage,
			expirationDate,
			userId,
			isActive: true
		});
		
		const populatedCoupon = await Coupon.findById(coupon._id).populate('userId', 'name email');
		
		res.status(201).json({
			success: true,
			message: "Coupon created successfully",
			coupon: populatedCoupon
		});
	} catch (error) {
		console.log("Error in createCoupon controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Admin: Update coupon
export const updateCoupon = async (req, res) => {
	try {
		const { id } = req.params;
		const { discountPercentage, expirationDate, isActive } = req.body;
		
		const coupon = await Coupon.findById(id);
		if (!coupon) {
			return res.status(404).json({ message: "Coupon not found" });
		}
		
		if (discountPercentage !== undefined) coupon.discountPercentage = discountPercentage;
		if (expirationDate !== undefined) coupon.expirationDate = expirationDate;
		if (isActive !== undefined) coupon.isActive = isActive;
		
		await coupon.save();
		
		const populatedCoupon = await Coupon.findById(coupon._id).populate('userId', 'name email');
		
		res.json({
			success: true,
			message: "Coupon updated successfully",
			coupon: populatedCoupon
		});
	} catch (error) {
		console.log("Error in updateCoupon controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Admin: Delete coupon
export const deleteCoupon = async (req, res) => {
	try {
		const { id } = req.params;
		
		const coupon = await Coupon.findByIdAndDelete(id);
		if (!coupon) {
			return res.status(404).json({ message: "Coupon not found" });
		}
		
		res.json({
			success: true,
			message: "Coupon deleted successfully"
		});
	} catch (error) {
		console.log("Error in deleteCoupon controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};
