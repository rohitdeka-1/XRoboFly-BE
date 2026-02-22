import mongoose from "mongoose";
import bcrypt from "bcryptjs";



const userSchema = new mongoose.Schema(
    {

        name: {
            type: String,
            required: [true, "Name is required"]
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            lowercase: true,
            trim: true,
            unique: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
        },
        cartItems: [
            {
                quantity: {
                    type: Number,
                    default: 1,
                },
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                }
            }
        ],
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        userPhone: {
            type: String,
            required: false,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationOTP: {
            type: String,
        },
        otpExpires: {
            type: Date,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        image: {
            type: String,
        },
        addresses: [
            {
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
                },
                isDefault: {
                    type: Boolean,
                    default: false,
                }
            }
        ],
        billingAddresses: [
            {
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
                },
                isDefault: {
                    type: Boolean,
                    default: false,
                }
            }
        ]
    },
    {
        timestamps: true,

    }
)
// Hashing 
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});


userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
}


export const User = mongoose.model("User", userSchema);
