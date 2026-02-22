import Order from "../models/Order.model.js";
import { Product } from "../models/Product.model.js";
import { User } from "../models/User.model.js";
import { sendMail } from "../services/mailer.services.js";

// Note: Primary order creation is handled in payment.controller.js after successful payment
// This function is kept for admin manual order creation or testing purposes
export const createOrder = async (req, res) => {
	try {
		const {
			products,
			totalAmount,
			shippingAddress,
			billingAddress,
			paymentId,
			paymentGateway = "cashfree",
		} = req.body;

		// Validate required fields
		if (!products || products.length === 0) {
			return res.status(400).json({ message: "No products in order" });
		}

		if (!shippingAddress || !billingAddress) {
			return res.status(400).json({ message: "Shipping and billing addresses are required" });
		}

		// Verify product availability and prices
		const productIds = products.map((p) => p.product);
		const dbProducts = await Product.find({ _id: { $in: productIds } });

		if (dbProducts.length !== products.length) {
			return res.status(400).json({ message: "Some products not found" });
		}

		// Check stock availability
		for (const orderProduct of products) {
			const dbProduct = dbProducts.find(
				(p) => p._id.toString() === orderProduct.product.toString()
			);

			if (!dbProduct) {
				return res.status(400).json({
					message: `Product ${orderProduct.product} not found`,
				});
			}

			if (dbProduct.stock < orderProduct.quantity) {
				return res.status(400).json({
					message: `Insufficient stock for product ${dbProduct.name}. Available: ${dbProduct.stock}`,
				});
			}

			if (!dbProduct.isAvailable) {
				return res.status(400).json({
					message: `Product ${dbProduct.name} is currently unavailable`,
				});
			}
		}

		// Create the order
		const orderData = {
			user: req.user._id,
			products: products.map((p) => ({
				product: p.product,
				quantity: p.quantity,
				price: p.price,
			})),
			totalAmount,
			shippingAddress,
			billingAddress,
			orderStatus: "pending",
		};

		// Set payment gateway fields
		if (paymentGateway === "cashfree") {
			orderData.cashfreeOrderId = paymentId;
		} else if (paymentGateway === "razorpay") {
			orderData.razorpayOrderId = paymentId;
		}

		const order = await Order.create(orderData);

		// Update product stock and sold count
		for (const orderProduct of products) {
			const product = await Product.findById(orderProduct.product);
			if (product) {
				product.stock -= orderProduct.quantity;
				product.soldCount = (product.soldCount || 0) + orderProduct.quantity;
				if (product.stock === 0) {
					product.isAvailable = false;
				}
				await product.save();
			}
		}

		// Clear user's cart
		const user = await User.findById(req.user._id);
		user.cartItems = [];
		await user.save();

		// Populate order for response
		const populatedOrder = await Order.findById(order._id)
			.populate("products.product", "name coverImage price")
			.populate("user", "name email");

		// Send order confirmation email
		try {
			await sendMail({
				to: req.user.email,
				subject: "Order Confirmation - XRoboFly",
				template: "orderConfirmation",
				context: {
					userName: req.user.name,
					orderId: order._id.toString(),
					totalAmount: totalAmount.toFixed(2),
					orderDate: new Date().toLocaleDateString("en-IN"),
					products: populatedOrder.products.map((p) => ({
						name: p.product.name,
						quantity: p.quantity,
						price: p.price,
					})),
					shippingAddress: `${shippingAddress.addressLine1}, ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pincode}`,
				},
			});
		} catch (emailError) {
			console.error("Failed to send order confirmation email:", emailError);
			// Don't fail the order if email fails
		}

		res.status(201).json({
			success: true,
			message: "Order created successfully",
			order: populatedOrder,
		});
	} catch (error) {
		console.error("Error creating order:", error);
		res.status(500).json({ message: "Error creating order", error: error.message });
	}
};

// Get all orders for the logged-in user (last 15 days)
export const getUserOrders = async (req, res) => {
	try {
		const fifteenDaysAgo = new Date();
		fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

		const orders = await Order.find({ 
			user: req.user._id,
			createdAt: { $gte: fifteenDaysAgo }
		})
			.populate("products.product", "name coverImage price")
			.sort({ createdAt: -1 });

		res.json(orders);
	} catch (error) {
		console.error("Error fetching orders:", error);
		res.status(500).json({ message: "Error fetching orders", error: error.message });
	}
};

// Get a single order by ID
export const getOrderById = async (req, res) => {
	try {
		const { orderId } = req.params;

		const order = await Order.findOne({ _id: orderId, user: req.user._id })
			.populate("products.product", "name coverImage price description");

		if (!order) {
			return res.status(404).json({ message: "Order not found" });
		}

		res.json(order);
	} catch (error) {
		console.error("Error fetching order:", error);
		res.status(500).json({ message: "Error fetching order", error: error.message });
	}
};

// Get all orders (Admin only)
export const getAllOrders = async (req, res) => {
	try {
		const orders = await Order.find()
			.populate("user", "name email")
			.populate("products.product", "name coverImage price")
			.sort({ createdAt: -1 });

		res.json(orders);
	} catch (error) {
		console.error("Error fetching all orders:", error);
		res.status(500).json({ message: "Error fetching orders", error: error.message });
	}
};

// Update order status (Admin only)
export const updateOrderStatus = async (req, res) => {
	try {
		const { orderId } = req.params;
		const { orderStatus } = req.body;

		const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
		if (!validStatuses.includes(orderStatus)) {
			return res.status(400).json({ message: "Invalid order status" });
		}

		const order = await Order.findByIdAndUpdate(
			orderId,
			{ orderStatus },
			{ new: true }
		).populate("products.product", "name coverImage price");

		if (!order) {
			return res.status(404).json({ message: "Order not found" });
		}

		res.json({
			message: "Order status updated successfully",
			order,
		});
	} catch (error) {
		console.error("Error updating order status:", error);
		res.status(500).json({ message: "Error updating order status", error: error.message });
	}
};
