import Cashfree from "../lib/cashfree.js";
import Order from "../models/Order.model.js";
import { Product } from "../models/Product.model.js";
import { User } from "../models/User.model.js";
import { sendMail } from "../services/mailer.services.js";
import Coupon from "../models/Coupon.model.js";
import { createShipment } from "./shiprocket.controller.js";

// Normalize Cashfree payment_group to our payment method
const normalizePaymentMethod = (paymentGroup) => {
  if (!paymentGroup) return "online";
  
  const normalized = paymentGroup.toLowerCase();
  
  if (normalized.includes('upi')) return 'upi';
  if (normalized.includes('card') || normalized.includes('credit') || normalized.includes('debit')) return 'card';
  if (normalized.includes('net') || normalized.includes('bank')) return 'netbanking';
  if (normalized.includes('wallet')) return 'wallet';
  
  return "online";
};

/**
 * Create Checkout Session
 * Creates a Cashfree order and returns payment_session_id for frontend
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { customerDetails, shippingAddress, products, couponCode } = req.body;

    // Validate request
    if (!customerDetails || !shippingAddress || !products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Fetch products from database to validate and get actual prices
    // productId should be MongoDB ObjectId (_id)
    const dbProducts = [];
    
    for (const item of products) {
      let product;
      
      // Check if it's a valid MongoDB ObjectId format (24 hex characters)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(item.productId);
      
      if (isValidObjectId) {
        // Search by _id
        product = await Product.findById(item.productId);
      }
      
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.productId}. Please ensure you're using valid product IDs from the database.`,
        });
      }
      
      dbProducts.push(product);
    }

    if (dbProducts.length !== products.length) {
      return res.status(400).json({
        success: false,
        message: "Some products not found",
      });
    }

    // Check stock availability
    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      const product = dbProducts[i];
      
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }
    }

    // Calculate order amount
    let subtotal = 0;
    const orderProducts = [];

    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      const product = dbProducts[i]; // Use index since we validated order above
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderProducts.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images?.[0] || "",
      });
    }

    // Calculate shipping
    const shipping = subtotal > 5000 ? 0 : 99;

    // Calculate tax (18% GST)
    const tax = Math.round(subtotal * 0.18);

    // Apply coupon if provided
    let discount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        expiryDate: { $gt: new Date() },
      });

      if (coupon) {
        if (coupon.userId && req.user && coupon.userId.toString() !== req.user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: "This coupon is not valid for your account",
          });
        }

        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
          return res.status(400).json({
            success: false,
            message: "Coupon usage limit exceeded",
          });
        }

        // Calculate discount
        discount = Math.round((subtotal * coupon.discountPercentage) / 100);
        appliedCoupon = {
          code: coupon.code,
          discountPercentage: coupon.discountPercentage,
          discountAmount: discount,
        };

        // Increment usage count
        coupon.usageCount += 1;
        await coupon.save();
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired coupon code",
        });
      }
    }

    const totalAmount = subtotal + shipping + tax - discount;

    // Generate unique order ID
    const orderId = `XRF_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Prepare Cashfree order request
    const orderRequest = {
      order_amount: totalAmount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: req.user?._id?.toString() || `guest_${Date.now()}`,
        customer_name: customerDetails.name,
        customer_email: customerDetails.email,
        customer_phone: customerDetails.phone,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/payment-success?order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/payment/webhook`,
      },
      order_note: `XRoboFly Order - ${orderProducts.length} items`,
    };

    console.log("Creating Cashfree order:", orderId);

    // Create order in Cashfree
    const cashfreeResponse = await Cashfree.PGCreateOrder(orderRequest);

    console.log("✅ Cashfree order created successfully");

    // Store order metadata temporarily (to be used in checkout-success)
    // In production, consider using Redis or similar for temporary storage
    global.pendingOrders = global.pendingOrders || {};
    global.pendingOrders[orderId] = {
      userId: req.user?._id,
      customerDetails,
      shippingAddress,
      products: orderProducts,
      subtotal,
      shipping,
      tax,
      discount,
      totalAmount,
      appliedCoupon,
      createdAt: new Date(),
    };

    // Clean up old pending orders (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    Object.keys(global.pendingOrders).forEach(key => {
      if (global.pendingOrders[key].createdAt < oneHourAgo) {
        delete global.pendingOrders[key];
      }
    });

    return res.status(200).json({
      success: true,
      message: "Checkout session created",
      paymentSessionId: cashfreeResponse.data.payment_session_id,
      orderId: cashfreeResponse.data.order_id || orderId,
      orderAmount: totalAmount,
    });

  } catch (error) {
    console.error("❌ Create checkout session error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create checkout session",
    });
  }
};

/**
 * Checkout Success
 * Verify payment with Cashfree and create order in database
 */
export const checkoutSuccess = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    console.log("Verifying payment for order:", orderId);

    // Get payment details from Cashfree
    const paymentsResponse = await Cashfree.PGOrderFetchPayments(orderId);
    const payments = paymentsResponse.data || paymentsResponse;

    if (!payments || payments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No payment information found",
      });
    }

    const latestPayment = payments[0];

    // Check if payment is successful
    if (latestPayment.payment_status !== "SUCCESS") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        status: latestPayment.payment_status,
      });
    }

    // Check if order already exists
    const existingOrder = await Order.findOne({ cashfreeOrderId: orderId });
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: "Order already processed",
        order: existingOrder,
      });
    }

    // Get pending order data
    const orderData = global.pendingOrders?.[orderId];
    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: "Order data not found. Session may have expired.",
      });
    }

    // Create order in database
    const newOrder = await Order.create({
      user: orderData.userId,
      products: orderData.products.map(p => ({
        product: p.productId,
        quantity: p.quantity,
        price: p.price,
      })),
      totalAmount: orderData.totalAmount,
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.shippingAddress,
      orderStatus: "pending",
      cashfreeOrderId: orderId,
      cashfreePaymentId: latestPayment.cf_payment_id,
    });

    // Decrease product stock
    for (const item of orderData.products) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // Auto-generate coupon for orders >= ₹20,000
    if (orderData.totalAmount >= 20000) {
      await createNewCoupon(orderData.userId, orderData.customerDetails.email, newOrder._id);
    }

    // Send order confirmation email
    try {
      await sendMail({
        to: orderData.customerDetails.email,
        subject: "Order Confirmation - XRoboFly",
        template: "orderConfirmation",
        context: {
          customerName: orderData.customerDetails.name,
          orderId: newOrder._id,
          orderDate: new Date().toLocaleDateString(),
          products: orderData.products,
          subtotal: orderData.subtotal,
          shipping: orderData.shipping,
          tax: orderData.tax,
          discount: orderData.discount,
          totalAmount: orderData.totalAmount,
          shippingAddress: orderData.shippingAddress,
        },
      });
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

    // Create Shiprocket shipment
    try {
      await createShipment(newOrder._id);
    } catch (shipmentError) {
      console.error("Failed to create Shiprocket shipment:", shipmentError);
    }

    // Clean up pending order
    delete global.pendingOrders[orderId];

    console.log("✅ Order created successfully:", newOrder._id);

    return res.status(200).json({
      success: true,
      message: "Payment verified and order created",
      order: newOrder,
    });

  } catch (error) {
    console.error("❌ Checkout success error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};

/**
 * Cashfree Webhook Handler
 * Handles payment status updates from Cashfree
 */
export const cashfreeWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;

    console.log("📥 Webhook received:", type);

    // Basic validation
    if (!data || !data.order || !data.order.order_id) {
      console.log("Webhook test or invalid payload");
      return res.status(200).json({ success: true, message: "Webhook acknowledged" });
    }

    const orderId = data.order.order_id;
    const order = await Order.findOne({ cashfreeOrderId: orderId });

    if (!order) {
      console.log(`Order not found for: ${orderId}`);
      return res.status(200).json({ success: true, message: "Order not found" });
    }

    // Update order status based on webhook type
    switch (type) {
      case "PAYMENT_SUCCESS_WEBHOOK":
        if (order.paymentStatus !== "paid") {
          order.paymentStatus = "paid";
          order.paymentMethod = normalizePaymentMethod(data.payment.payment_group);
          order.cashfreePaymentId = data.payment.cf_payment_id;
          await order.save();
          console.log("✅ Payment success webhook processed");
        }
        break;

      case "PAYMENT_FAILED_WEBHOOK":
        order.paymentStatus = "failed";
        order.status = "cancelled";
        await order.save();
        console.log("❌ Payment failed webhook processed");
        break;

      case "PAYMENT_USER_DROPPED_WEBHOOK":
        order.paymentStatus = "failed";
        order.status = "cancelled";
        await order.save();
        console.log("⚠️ Payment dropped webhook processed");
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    // Always return 200 to Cashfree to prevent retries
    return res.status(200).json({ success: true, message: "Webhook received" });
  }
};

/**
 * Helper function to create coupon for high-value orders
 */
async function createNewCoupon(userId, email, orderId) {
  try {
    const couponCode = `XRF${Date.now().toString().slice(-6)}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days validity

    await Coupon.create({
      code: couponCode,
      discountPercentage: 5,
      expiryDate,
      isActive: true,
      userId,
      usageLimit: 1,
      usageCount: 0,
    });

    // Send coupon email
    await sendMail({
      to: email,
      subject: "You've Earned a Discount Coupon! - XRoboFly",
      template: "coupon",
      context: {
        couponCode,
        discountPercentage: 5,
        expiryDate: expiryDate.toLocaleDateString(),
        orderId,
      },
    });

    console.log("✅ Coupon created and sent:", couponCode);
  } catch (error) {
    console.error("Failed to create coupon:", error);
  }
}
