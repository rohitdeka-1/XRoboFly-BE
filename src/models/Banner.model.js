import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        highlight: {
            type: String,
            default: "",
            trim: true,
        },
        badge: {
            type: String,
            default: "",
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
        image: {
            type: String,
            default: null,
        },
        link: {
            type: String,
            default: "/",
        },
        order: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export const Banner = mongoose.model("Banner", bannerSchema);
