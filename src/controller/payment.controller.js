import Cashfree from "../lib/cashfree.js";
import Order from "../models/Order.model.js";
import { Product } from "../models/Product.model.js";
import { sendMail } from "../services/mailer.services.js";
import { createShipmentForOrder } from "./shiprocket.controller.js";
import { redis } from "../lib/redis.js";
import crypto from "crypto";

const PENDING_ORDER_TTL = 3600; // 1 hour in seconds
const PENDING_KEY = (id) => `pending_order:${id}`;

// Verify Cashfree webhook HMAC-SHA256 signature
const verifyCashfreeWebhook = (rawBody, timestamp, signature) => {
  if (!process.env.CASHFREE_SECRET_KEY || !rawBody || !timestamp || !signature) return false;
  const payload = timestamp + rawBody;
  const expected = crypto
    .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
    .update(payload)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

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
    const { customerDetails, shippingAddress, products } = req.body;

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

    // Prices stored in DB are GST-inclusive (5%).
    // Extract base + GST for display; total charged = incl-GST price + shipping.
    const subtotalInclGST = subtotal; // subtotal = sum of product.price * qty (GST-inclusive)
    const shipping = subtotalInclGST > 5000 ? 0 : 99;
    const baseSubtotal = Math.round(subtotalInclGST / 1.05); // pre-GST amount
    const tax = subtotalInclGST - baseSubtotal;               // 5% GST already included
    const discount = 0;
    const totalAmount = subtotalInclGST + shipping;           // no extra tax added

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
        return_url: `${(process.env.FRONTEND_URL || 'http://localhost:8080').split(',').find(u => u.startsWith('https://')) || (process.env.FRONTEND_URL || 'http://localhost:8080').split(',')[0].trim()}/payment-success?order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/payment/webhook`,
      },
      order_note: `XRoboFly Order - ${orderProducts.length} items`,
    };

    console.log("Creating Cashfree order:", orderId);

    // Create order in Cashfree
    const cashfreeResponse = await Cashfree.PGCreateOrder(orderRequest);

    console.log("✅ Cashfree order created successfully");

    // Store order metadata in Redis (survives PM2 cluster restarts)
    await redis.set(
      PENDING_KEY(orderId),
      JSON.stringify({
        userId: req.user?._id?.toString(),
        customerDetails,
        shippingAddress,
        products: orderProducts,
        subtotal: baseSubtotal,   // pre-GST base for display in email
        shipping,
        tax,                      // 5% GST extracted from inclusive price
        discount,
        totalAmount,
        createdAt: Date.now(),
      }),
      'EX',
      PENDING_ORDER_TTL
    );

    // Legacy in-memory cleanup (no longer used for storage)
    if (global.pendingOrders) {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      Object.keys(global.pendingOrders).forEach(key => {
        if (global.pendingOrders[key]?.createdAt < oneHourAgo) delete global.pendingOrders[key];
      });
    }

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

    // Get pending order data from Redis
    const raw = await redis.get(PENDING_KEY(orderId));
    const orderData = raw ? JSON.parse(raw) : null;
    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: "Order data not found. Session may have expired.",
      });
    }

    // Ownership check — prevent one user claiming another user's pending order
    if (orderData.userId && req.user?._id?.toString() !== orderData.userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
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

    // Atomically decrement stock only if sufficient quantity remains
    for (const item of orderData.products) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        // Roll back the order — stock ran out between checkout init and confirmation
        await Order.findByIdAndDelete(newOrder._id);
        await redis.del(PENDING_KEY(orderId));
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${item.name}. Please update your cart and try again.`,
        });
      }
    }

    // Send order confirmation email
    try {
      await sendMail(
        orderData.customerDetails.email,
        "Order Confirmed - XRoboFly #" + newOrder._id,
        "orderConfirmation",
        {
          customerName: orderData.customerDetails.name,
          orderId: newOrder._id,
          orderDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
          paymentId: latestPayment.cf_payment_id || orderId,
          products: orderData.products.map(p => ({
            name: p.name,
            quantity: p.quantity,
            price: p.price.toLocaleString('en-IN'),
            image: p.image,
          })),
          shippingAddress: orderData.shippingAddress,
          billingAddress: orderData.shippingAddress,
          subtotal: orderData.subtotal.toLocaleString('en-IN'),
          tax: orderData.tax.toLocaleString('en-IN'),
          shipping: orderData.shipping === 0 ? 'FREE' : '₹' + orderData.shipping,
          discount: orderData.discount > 0 ? orderData.discount.toLocaleString('en-IN') : null,
          totalAmount: orderData.totalAmount.toLocaleString('en-IN'),
          frontendUrl: process.env.FRONTEND_URL?.split(',').find(u => u.startsWith('https://'))?.trim() || 'https://xrobofly.com',
        }
      );
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

    // Create Shiprocket shipment
    try {
      await createShipmentForOrder(newOrder._id);
    } catch (shipmentError) {
      console.error("Failed to create Shiprocket shipment:", shipmentError);
    }

    // Clean up Redis pending order
    await redis.del(PENDING_KEY(orderId));

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
    // Verify Cashfree webhook signature
    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    if (timestamp && signature) {
      if (!verifyCashfreeWebhook(req.rawBody || '', timestamp, signature)) {
        console.warn('❌ Webhook signature mismatch — rejecting request');
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

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
        if (order.orderStatus === 'pending') {
          order.orderStatus = 'processing';
          order.cashfreePaymentId = data.payment?.cf_payment_id || order.cashfreePaymentId;
          await order.save();
          console.log("✅ Payment success webhook processed");
        }
        break;

      case "PAYMENT_FAILED_WEBHOOK":
        order.orderStatus = 'cancelled';
        await order.save();
        console.log("❌ Payment failed webhook processed");
        break;

      case "PAYMENT_USER_DROPPED_WEBHOOK":
        order.orderStatus = 'cancelled';
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


