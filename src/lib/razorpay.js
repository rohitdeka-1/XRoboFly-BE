import Razorpay from "razorpay";
import envConfig from "../config/env.config.js";

export const razorpayInstance = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID,
	key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const razorpay = razorpayInstance;

console.log("Razorpay Config:", {
	key_id: process.env.RAZORPAY_KEY_ID ? "✅ Set" : "❌ Missing",
	key_secret: process.env.RAZORPAY_KEY_SECRET ? "✅ Set" : "❌ Missing"
});
