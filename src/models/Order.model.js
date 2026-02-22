import mongoose from "mongoose";


const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
            },
            price: {
                type: Number,
                required: true,

                min: 0,
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    shippingAddress: {
        fullName: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        addressLine1: {
            type: String,
            required: true,
        },
        addressLine2: {
            type: String,
        },
        city: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            required: true,
        },
        pincode: {
            type: String,
            required: true,
        },
        country: {
            type: String,
            required: true,
            default: "India",
        }
    },
    billingAddress: {
        fullName: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        addressLine1: {
            type: String,
            required: true,
        },
        addressLine2: {
            type: String,
        },
        city: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            required: true,
        },
        pincode: {
            type: String,
            required: true,
        },
        country: {
            type: String,
            required: true,
            default: "India",
        }
    },
    orderStatus: {
        type: String,
        enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
        default: "pending",
    },
    razorpayOrderId: {
        type: String,
    },
    razorpayPaymentId: {
        type: String,
    },
    cashfreeOrderId: {
        type: String,
    },
    cashfreePaymentId: {
        type: String,
    },
    shipment: {
        shiprocketOrderId: {
            type: String,
        },
        shipmentId: {
            type: String,
        },
        awbCode: {
            type: String,
        },
        courierId: {
            type: Number,
        },
        courierName: {
            type: String,
        },
        status: {
            type: String,
        },
        statusCode: {
            type: Number,
        },
        currentStatus: {
            type: String,
        },
        pickupScheduled: {
            type: Boolean,
            default: false,
        },
        cancelled: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
        },
        awbAssignedAt: {
            type: Date,
        },
        pickupScheduledAt: {
            type: Date,
        },
        cancelledAt: {
            type: Date,
        },
        lastUpdatedAt: {
            type: Date,
        }
    },

}, { timestamps: true, });

const Order = mongoose.model("Order", orderSchema);
export default Order;