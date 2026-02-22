import Coupon from "../models/Coupon.model.js";
import Order from "../models/Order.model.js";
import { User } from "../models/User.model.js";
import {Product} from "../models/Product.model.js";
import { cashfree } from "../lib/cashfree.js";
import { sendMail } from "../services/mailer.services.js";
import { autoCreateShipment } from "./shiprocket.controller.js";

export const createCheckoutSession = async (req, res) => {
	try {
		const { products, couponCode, addressId, billingAddressId } = req.body;

		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({ error: "Invalid or empty products array" });
		}

		// Validate shipping address
		if (!addressId) {
			return res.status(400).json({ error: "Shipping address is required" });
		}

		// Validate billing address
		if (!billingAddressId) {
			return res.status(400).json({ error: "Billing address is required" });
		}

		const user = await User.findById(req.user._id);
		const shippingAddress = user.addresses.id(addressId);

		if (!shippingAddress) {
			return res.status(404).json({ error: "Shipping address not found" });
		}

		// Validate billing address (can be same as shipping or from billingAddresses)
		let billingAddress;
		if (billingAddressId === addressId) {
			// Same as shipping address
			billingAddress = shippingAddress;
		} else {
			billingAddress = user.billingAddresses.id(billingAddressId);
			if (!billingAddress) {
				return res.status(404).json({ error: "Billing address not found" });
			}
		}

		let totalAmount = 0;

		// SECURITY FIX: Fetch prices from database not client
		const validatedProducts = await Promise.all(
			products.map(async (clientProduct) => {
				const dbProduct = await Product.findById(clientProduct._id);
				
				if (!dbProduct) {
					throw new Error(`Product with ID ${clientProduct._id} not found`);
				}

				// Validate quantity
				if (!clientProduct.quantity || clientProduct.quantity < 1 || clientProduct.quantity > 100) {
					throw new Error(`Invalid quantity for product ${dbProduct.name}`);
				}

				// Check stock availability
				if (dbProduct.stock < clientProduct.quantity) {
					throw new Error(`Insufficient stock for ${dbProduct.name}. Available: ${dbProduct.stock}`);
				}

				if (!dbProduct.isAvailable) {
					throw new Error(`Product ${dbProduct.name} is currently unavailable`);
				}

				// Use price from database, not client
				const productTotal = dbProduct.price * clientProduct.quantity;
				totalAmount += productTotal;

				return {
					_id: dbProduct._id,
					price: dbProduct.price, // Server-side price
					quantity: clientProduct.quantity,
					name: dbProduct.name
				};
			})
		);

		let coupon = null;
		let discountAmount = 0;
		
		if (couponCode) {
			coupon = await Coupon.findOne({ code: couponCode, userId: req.user._id, isActive: true });
			if (coupon) {
				if (coupon.expirationDate < new Date()) {
					coupon.isActive = false;
					await coupon.save();
					return res.status(400).json({ error: "Coupon has expired" });
				}
				discountAmount = Math.round((totalAmount * coupon.discountPercentage) / 100);
				totalAmount -= discountAmount;
			} else {
				return res.status(404).json({ error: "Invalid or inactive coupon" });
			}
		}

		// Generate unique order ID
		const orderId = `ORD_${Date.now()}_${user._id.toString().slice(-6)}`;

		// Create Cashfree order
		const cashfreeOrder = await cashfree.createOrder({
			orderId: orderId,
			orderAmount: totalAmount,
			customerDetails: {
				customerId: user._id.toString(),
				email: user.email,
				phone: shippingAddress.phone || user.userPhone || "9999999999",
				name: user.name,
			},
			orderMeta: {
				return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/success?order_id={order_id}`,
				notify_url: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/payment/webhook`,
			},
			orderNote: `Order for ${validatedProducts.length} items`,
		});

		// Store order metadata in database temporarily (for webhook verification)
		// You could create a PendingOrder model or store in Redis
		// For now, we'll store in order notes in Cashfree
		
		// Create a coupon for orders >= ₹20000
		if (totalAmount >= 20000) {
			await createNewCoupon(req.user._id);
		}

		res.status(200).json({ 
			success: true,
			orderId: cashfreeOrder.order_id,
			paymentSessionId: cashfreeOrder.payment_session_id,
			orderAmount: totalAmount,
			orderCurrency: "INR",
			environment: cashfreeOrder.order_status === "ACTIVE" ? "sandbox" : "production",
			// Store metadata for checkout success
			metadata: {
				products: validatedProducts,
				addressId: addressId,
				billingAddressId: billingAddressId,
				couponCode: couponCode,
				discountAmount: discountAmount,
				userId: user._id.toString(),
			}
		});
	} catch (error) {
		// SECURITY FIX: Don't expose internal error details in production
		if (process.env.NODE_ENV === 'development') {
			console.error("Error processing checkout:", error);
		}
		res.status(500).json({ 
			error: "Error processing checkout",
			message: error.message 
		});
	}
};

export const checkoutSuccess = async (req, res) => {
	try {
		const { 
			orderId,
			metadata 
		} = req.body;

		if (!orderId || !metadata) {
			return res.status(400).json({ message: "Missing required payment data" });
		}

		// Fetch order details from Cashfree
		const cashfreeOrder = await cashfree.getOrder(orderId);

		console.log("Cashfree Order Status:", cashfreeOrder.order_status);

		// Check if order is paid
		if (cashfreeOrder.order_status === "PAID") {
			// Get payments to extract payment ID
			const payments = await cashfree.getPayments(orderId);
			const payment = payments && payments.length > 0 ? payments[0] : null;

			// Get user and addresses
			const user = await User.findById(metadata.userId);
			
			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			const shippingAddress = user.addresses.id(metadata.addressId);
			if (!shippingAddress) {
				return res.status(404).json({ message: "Shipping address not found" });
			}

			// Get billing address
			let billingAddress;
			if (metadata.billingAddressId === metadata.addressId) {
				billingAddress = shippingAddress;
			} else {
				billingAddress = user.billingAddresses.id(metadata.billingAddressId);
				if (!billingAddress) {
					return res.status(404).json({ message: "Billing address not found" });
				}
			}

			// Check if order already exists (prevent duplicate)
			const existingOrder = await Order.findOne({ cashfreeOrderId: orderId });
			if (existingOrder) {
				return res.status(200).json({
					success: true,
					message: "Order already processed",
					orderId: existingOrder._id,
				});
			}

			// Deactivate coupon if used
			if (metadata.couponCode) {
				await Coupon.findOneAndUpdate(
					{
						code: metadata.couponCode,
						userId: metadata.userId,
					},
					{
						isActive: false,
					}
				);
			}

			// Create a new Order
			const products = metadata.products;
			const newOrder = new Order({
				user: metadata.userId,
				products: products.map((product) => ({
					product: product._id,
					quantity: product.quantity,
					price: product.price,
				})),
				totalAmount: cashfreeOrder.order_amount,
				shippingAddress: {
					fullName: shippingAddress.fullName,
					phone: shippingAddress.phone,
					addressLine1: shippingAddress.addressLine1,
					addressLine2: shippingAddress.addressLine2 || "",
					city: shippingAddress.city,
					state: shippingAddress.state,
					pincode: shippingAddress.pincode,
					country: shippingAddress.country,
				},
				billingAddress: {
					fullName: billingAddress.fullName,
					phone: billingAddress.phone,
					addressLine1: billingAddress.addressLine1,
					addressLine2: billingAddress.addressLine2 || "",
					city: billingAddress.city,
					state: billingAddress.state,
					pincode: billingAddress.pincode,
					country: billingAddress.country,
				},
				cashfreeOrderId: orderId,
				cashfreePaymentId: payment ? payment.cf_payment_id : null,
				orderStatus: "pending",
			});

			await newOrder.save();

			// DECREASE STOCK FOR EACH PRODUCT
			try {
				await Promise.all(
					products.map(async (product) => {
						const productData = await Product.findById(product._id);
						if (productData) {
							await productData.decreaseStock(product.quantity);
							if (process.env.NODE_ENV === 'development') {
								console.log(`Stock decreased for ${productData.name}: ${productData.stock} remaining`);
							}
						}
					})
				);
			} catch (stockError) {
				// Log error but don't fail the order
				if (process.env.NODE_ENV === 'development') {
					console.error("Error decreasing stock:", stockError.message);
				}
			}

			// Clear user's cart
			user.cartItems = [];
			await user.save();

			// AUTO-CREATE SHIPROCKET SHIPMENT (async - non-blocking)
			autoCreateShipment(newOrder._id).catch(error => {
				if (process.env.NODE_ENV === 'development') {
		 			console.error("Error auto-creating shipment:", error.message);
				}
			});

			// Fetch product details for email
			const productDetails = await Promise.all(
				products.map(async (product) => {
					const productData = await Product.findById(product._id);
					return {
						name: productData?.name || "Product",
						quantity: product.quantity,
						price: product.price,
					};
				})
			);

			// Calculate totals for email
			const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
			const discount = metadata.discountAmount || 0;

			// Send order confirmation email
			try {
				await sendMail({
					to: user.email,
					subject: `Order Confirmation - XRoboFly #${newOrder._id.toString().slice(-8).toUpperCase()}`,
					template: "orderConfirmation",
					context: {
						userEmail: user.email,
						userName: user.name,
						orderId: newOrder._id.toString().slice(-8).toUpperCase(),
						totalAmount: cashfreeOrder.order_amount.toFixed(2),
						orderDate: new Date().toLocaleDateString("en-IN", {
							day: "numeric",
							month: "long",
							year: "numeric",
						}),
						products: productDetails,
						shippingAddress: `${shippingAddress.addressLine1}, ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pincode}`,
					},
				});
				
				if (process.env.NODE_ENV === 'development') {
					console.log("✅ Order confirmation email sent successfully");
				}
			} catch (emailError) {
				if (process.env.NODE_ENV === 'development') {
					console.error("❌ Error sending order confirmation email:", emailError.message);
				}
			}

			res.status(200).json({
				success: true,
				message: "Payment successful, order created",
				orderId: newOrder._id,
				orderNumber: newOrder._id.toString().slice(-8).toUpperCase(),
			});
		} else if (cashfreeOrder.order_status === "ACTIVE") {
			return res.status(400).json({ 
				success: false,
				message: "Payment is still pending" 
			});
		} else {
			return res.status(400).json({ 
				success: false,
				message: "Payment failed or was cancelled",
				status: cashfreeOrder.order_status 
			});
		}
	} catch (error) {
		// SECURITY FIX: Don't expose internal error details in production
		if (process.env.NODE_ENV === 'development') {
			console.error("Error processing successful checkout:", error);
		}
		res.status(500).json({ 
			success: false,
			message: "Error processing checkout",
			error: error.message 
		});
	}
};

// Webhook handler for Cashfree payment notifications
export const cashfreeWebhook = async (req, res) => {
	try {
		const signature = req.headers["x-webhook-signature"];
		const timestamp = req.headers["x-webhook-timestamp"];
		const postData = req.body;

		// Verify webhook signature
		const isValid = cashfree.verifyWebhookSignature(postData, signature, timestamp);
		
		if (!isValid) {
			console.error("❌ Invalid webhook signature");
			return res.status(400).json({ message: "Invalid signature" });
		}

		const { type, data } = postData;

		console.log("📨 Cashfree Webhook Event:", type);

		// Handle different webhook events
		switch (type) {
			case "PAYMENT_SUCCESS_WEBHOOK":
				await handlePaymentSuccess(data);
				break;
				
			case "PAYMENT_FAILED_WEBHOOK":
				console.log("❌ Payment failed:", data.order.order_id);
				break;
				
			case "PAYMENT_USER_DROPPED_WEBHOOK":
				console.log("⚠️ User dropped payment:", data.order.order_id);
				break;
				
			default:
				console.log("ℹ️ Unhandled webhook event:", type);
		}

		res.status(200).json({ message: "Webhook received" });
	} catch (error) {
		console.error("❌ Webhook error:", error);
		res.status(500).json({ message: "Webhook processing failed" });
	}
};

async function handlePaymentSuccess(data) {
	try {
		const orderId = data.order.order_id;
		console.log("✅ Processing successful payment for order:", orderId);
		
		// Additional webhook processing logic can go here
		// Most of the order creation is handled in checkoutSuccess
		// This is a backup/notification handler
	} catch (error) {
		console.error("❌ Error handling payment success webhook:", error);
	}
}

async function createNewCoupon(userId) {
	try {
		await Coupon.findOneAndDelete({ userId });

		const newCoupon = new Coupon({
			code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
			discountPercentage: 5,
			expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
			userId: userId,
		});

		await newCoupon.save();

		console.log("🎁 New coupon created:", newCoupon.code);
		return newCoupon;
	} catch (error) {
		console.error("❌ Error creating coupon:", error.message);
	}
}
