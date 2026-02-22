import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    icon: {
        type: String,
        default: '📦',
    },
    coverImage: {
        type: String,
        default: null,
    },
    order: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    subcategories: [{
        id: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        coverImage: {
            type: String,
            default: null,
        },
        order: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    }],
}, {
    timestamps: true,
});

// Add indexes (id already indexed via unique: true)
categorySchema.index({ order: 1 });
categorySchema.index({ 'subcategories.id': 1 });

export const Category = mongoose.model("Category", categorySchema);
