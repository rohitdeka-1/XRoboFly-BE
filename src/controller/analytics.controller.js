import Order from "../models/Order.model.js";
import {Product} from "../models/Product.model.js";
import { User } from "../models/User.model.js";

export const getAnalyticsData = async (req, res) => {
	try {
		const totalUsers = await User.countDocuments();
		const totalProducts = await Product.countDocuments();

		const salesData = await Order.aggregate([
			{
				$group: {
					_id: null, // it groups all documents together,
					totalSales: { $sum: 1 },
					totalRevenue: { $sum: "$totalAmount" },
				},
			},
		]);

		const { totalSales, totalRevenue } = salesData[0] || { totalSales: 0, totalRevenue: 0 };

		// Get order status breakdown
		const orderStatusData = await Order.aggregate([
			{
				$group: {
					_id: "$orderStatus",
					count: { $sum: 1 },
				},
			},
		]);

		// Get recent orders
		const recentOrders = await Order.find()
			.populate('user', 'name email')
			.populate('products.product', 'name coverImage')
			.sort({ createdAt: -1 })
			.limit(10);

		// Get top selling products
		const topProducts = await Order.aggregate([
			{ $unwind: "$products" },
			{
				$group: {
					_id: "$products.product",
					totalQuantity: { $sum: "$products.quantity" },
					totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
				},
			},
			{ $sort: { totalQuantity: -1 } },
			{ $limit: 5 },
		]);

		// Populate product details
		const topProductsWithDetails = await Product.populate(topProducts, {
			path: '_id',
			select: 'name coverImage price',
		});

		res.status(200).json({
			success: true,
			data: {
				users: totalUsers,
				products: totalProducts,
				totalSales,
				totalRevenue,
				orderStatusData,
				recentOrders,
				topProducts: topProductsWithDetails,
			},
		});
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error("Error in getAnalyticsData:", error);
		}
		res.status(500).json({
			success: false,
			message: "Failed to fetch analytics data",
		});
	}
};

export const getDailySalesData = async (req, res) => {
	try {
		const { startDate, endDate } = req.query;

		const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const end = endDate ? new Date(endDate) : new Date();

		const dailySalesData = await Order.aggregate([
			{
				$match: {
					createdAt: {
						$gte: start,
						$lte: end,
					},
				},
			},
			{
				$group: {
					_id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
					sales: { $sum: 1 },
					revenue: { $sum: "$totalAmount" },
				},
			},
			{ $sort: { _id: 1 } },
		]);

		const dateArray = getDatesInRange(start, end);

		const result = dateArray.map((date) => {
			const foundData = dailySalesData.find((item) => item._id === date);

			return {
				date,
				sales: foundData?.sales || 0,
				revenue: foundData?.revenue || 0,
			};
		});

		res.status(200).json({
			success: true,
			data: result,
		});
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error("Error in getDailySalesData:", error);
		}
		res.status(500).json({
			success: false,
			message: "Failed to fetch daily sales data",
		});
	}
};

// Get all orders with filters
export const getAllOrders = async (req, res) => {
	try {
		const { status, page = 1, limit = 20 } = req.query;

		// SECURITY FIX: Cap maximum limit to prevent DoS
		const safeLimit = Math.min(parseInt(limit), 100);
		const safePage = Math.max(parseInt(page), 1);

		const query = status && status !== 'all' ? { orderStatus: status } : {};

		const orders = await Order.find(query)
			.populate('user', 'name email userPhone')
			.populate('products.product', 'name coverImage price')
			.sort({ createdAt: -1 })
			.limit(safeLimit)
			.skip((safePage - 1) * safeLimit);

		const total = await Order.countDocuments(query);

		res.status(200).json({
			success: true,
			data: {
				orders,
				totalPages: Math.ceil(total / safeLimit),
				currentPage: safePage,
				total,
			},
		});
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error("Error in getAllOrders:", error);
		}
		res.status(500).json({
			success: false,
			message: "Failed to fetch orders",
		});
	}
};

// Update order status
export const updateOrderStatus = async (req, res) => {
	try {
		const { orderId } = req.params;
		const { status } = req.body;

		const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
		
		if (!validStatuses.includes(status)) {
			return res.status(400).json({
				success: false,
				message: "Invalid order status",
			});
		}

		const order = await Order.findByIdAndUpdate(
			orderId,
			{ orderStatus: status },
			{ new: true }
		).populate('user', 'name email');

		if (!order) {
			return res.status(404).json({
				success: false,
				message: "Order not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Order status updated successfully",
			data: order,
		});
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error("Error in updateOrderStatus:", error);
		}
		res.status(500).json({
			success: false,
			message: "Failed to update order status",
		});
	}
};

// Get all users
export const getAllUsers = async (req, res) => {
	try {
		const { page = 1, limit = 20 } = req.query;

		// SECURITY FIX: Cap maximum limit to prevent DoS
		const safeLimit = Math.min(parseInt(limit), 100);
		const safePage = Math.max(parseInt(page), 1);

		const users = await User.find()
			.select('-password -verificationOTP')
			.sort({ createdAt: -1 })
			.limit(safeLimit)
			.skip((safePage - 1) * safeLimit);

		const total = await User.countDocuments();

		res.status(200).json({
			success: true,
			data: {
				users,
				totalPages: Math.ceil(total / safeLimit),
				currentPage: safePage,
				total,
			},
		});
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error("Error in getAllUsers:", error);
		}
		res.status(500).json({
			success: false,
			message: "Failed to fetch users",
		});
	}
};

function getDatesInRange(startDate, endDate) {
	const dates = [];
	let currentDate = new Date(startDate);

	while (currentDate <= endDate) {
		dates.push(currentDate.toISOString().split("T")[0]);
		currentDate.setDate(currentDate.getDate() + 1);
	}

	return dates;
}