import axios from "axios";

const CASHFREE_CONFIG = {
	appId: process.env.CASHFREE_APP_ID,
	secretKey: process.env.CASHFREE_SECRET_KEY,
	apiVersion: "2023-08-01",
	// Test environment
	baseUrl: process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg"
};

// For production, use: https://api.cashfree.com/pg

class CashfreeClient {
	constructor() {
		this.appId = CASHFREE_CONFIG.appId;
		this.secretKey = CASHFREE_CONFIG.secretKey;
		this.apiVersion = CASHFREE_CONFIG.apiVersion;
		this.baseUrl = CASHFREE_CONFIG.baseUrl;

		// Create axios instance with default headers
		this.client = axios.create({
			baseURL: this.baseUrl,
			headers: {
				"Content-Type": "application/json",
				"x-api-version": this.apiVersion,
				"x-client-id": this.appId,
				"x-client-secret": this.secretKey,
			},
		});

		console.log("Cashfree Config:", {
			appId: this.appId ? "✅ Set" : "❌ Missing",
			secretKey: this.secretKey ? "✅ Set" : "❌ Missing",
			environment: this.baseUrl.includes("sandbox") ? "🧪 TEST/SANDBOX" : "🚀 PRODUCTION",
			baseUrl: this.baseUrl
		});
	}

	/**
	 * Create a new payment order
	 * @param {Object} orderData - Order details
	 * @returns {Promise<Object>} - Cashfree order response
	 */
	async createOrder(orderData) {
		try {
			const {
				orderId,
				orderAmount,
				customerDetails,
				orderMeta = {},
				orderNote = ""
			} = orderData;

			const payload = {
				order_id: orderId,
				order_amount: orderAmount,
				order_currency: "INR",
				customer_details: {
					customer_id: customerDetails.customerId,
					customer_email: customerDetails.email,
					customer_phone: customerDetails.phone,
					customer_name: customerDetails.name,
				},
				order_meta: orderMeta,
				order_note: orderNote,
			};

			const response = await this.client.post("/orders", payload);
			
			if (response.data) {
				console.log("✅ Cashfree order created:", response.data.order_id);
				return response.data;
			}

			throw new Error("Invalid response from Cashfree");
		} catch (error) {
			console.error("❌ Cashfree createOrder error:", error.response?.data || error.message);
			throw new Error(error.response?.data?.message || "Failed to create Cashfree order");
		}
	}

	/**
	 * Get order details
	 * @param {string} orderId - Cashfree order ID
	 * @returns {Promise<Object>} - Order details
	 */
	async getOrder(orderId) {
		try {
			const response = await this.client.get(`/orders/${orderId}`);
			return response.data;
		} catch (error) {
			console.error("❌ Cashfree getOrder error:", error.response?.data || error.message);
			throw new Error(error.response?.data?.message || "Failed to fetch order details");
		}
	}

	/**
	 * Get payment details for an order
	 * @param {string} orderId - Cashfree order ID
	 * @returns {Promise<Array>} - Payment details
	 */
	async getPayments(orderId) {
		try {
			const response = await this.client.get(`/orders/${orderId}/payments`);
			return response.data;
		} catch (error) {
			console.error("❌ Cashfree getPayments error:", error.response?.data || error.message);
			throw new Error(error.response?.data?.message || "Failed to fetch payment details");
		}
	}

	/**
	 * Verify payment signature (for webhooks)
	 * @param {Object} postData - Webhook post data
	 * @param {string} signature - Signature from header
	 * @param {number} timestamp - Timestamp from header
	 * @returns {boolean} - Signature validity
	 */
	verifyWebhookSignature(postData, signature, timestamp) {
		try {
			const crypto = require("crypto");
			const signatureData = timestamp + JSON.stringify(postData);
			
			const computedSignature = crypto
				.createHmac("sha256", this.secretKey)
				.update(signatureData)
				.digest("base64");

			return computedSignature === signature;
		} catch (error) {
			console.error("❌ Webhook signature verification error:", error.message);
			return false;
		}
	}

	/**
	 * Initiate refund
	 * @param {string} orderId - Cashfree order ID
	 * @param {Object} refundData - Refund details
	 * @returns {Promise<Object>} - Refund response
	 */
	async createRefund(orderId, refundData) {
		try {
			const {
				refundId,
				refundAmount,
				refundNote = ""
			} = refundData;

			const payload = {
				refund_id: refundId,
				refund_amount: refundAmount,
				refund_note: refundNote,
			};

			const response = await this.client.post(`/orders/${orderId}/refunds`, payload);
			
			if (response.data) {
				console.log("✅ Refund initiated:", response.data.cf_refund_id);
				return response.data;
			}

			throw new Error("Invalid response from Cashfree");
		} catch (error) {
			console.error("❌ Cashfree createRefund error:", error.response?.data || error.message);
			throw new Error(error.response?.data?.message || "Failed to create refund");
		}
	}

	/**
	 * Get refund details
	 * @param {string} orderId - Cashfree order ID
	 * @param {string} refundId - Refund ID
	 * @returns {Promise<Object>} - Refund details
	 */
	async getRefund(orderId, refundId) {
		try {
			const response = await this.client.get(`/orders/${orderId}/refunds/${refundId}`);
			return response.data;
		} catch (error) {
			console.error("❌ Cashfree getRefund error:", error.response?.data || error.message);
			throw new Error(error.response?.data?.message || "Failed to fetch refund details");
		}
	}
}

// Export singleton instance
export const cashfree = new CashfreeClient();

// Export config for direct access if needed
export const cashfreeConfig = CASHFREE_CONFIG;
