import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    originalPrice: {
        type: Number,
        min: 0,
    },
    category: {
        type: String,
        required: true,
        trim: true,
        enum: ['fpv-gears', 'electronics'],
    },
    subcategory: {
        type: String,
        required: true,
        trim: true,
        enum: [
            // FPV Gears subcategories
            'frames', 'motors', 'esc', 'flight-controllers', 'stack', 
            'propellers', 'batteries', 'gps', 'fpv-cameras', 'antennas', 
            'goggles', 'rc-controllers',
            // Electronics subcategories
            'microcontrollers', 'sbc', 'sensors', 'displays', 'relays'
        ],
    },
    brand: {
        type: String,
        required: true,
        trim: true,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    coverImage: {
        type: String,
        required: [true, "Cover image is required"],
    },
    images: {
        type: [String],
        default: [],
        validate: {
            validator: function(images) {
                return images.length <= 10; // Max 10 images
            },
            message: "Cannot upload more than 10 images"
        }
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
    },
    reviewCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    soldCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    specs: {
        type: Map,
        of: String,
        default: {},
    },
    tags: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true,
});

// Virtual field to check if product is in stock
productSchema.virtual('inStock').get(function() {
    return this.stock > 0;
});

// Method to decrease stock when product is purchased
productSchema.methods.decreaseStock = async function(quantity) {
    if (this.stock < quantity) {
        throw new Error(`Insufficient stock. Only ${this.stock} items available`);
    }
    this.stock -= quantity;
    this.soldCount += quantity;
    
    // Auto mark as unavailable if out of stock
    if (this.stock === 0) {
        this.isAvailable = false;
    }
    
    await this.save();
    return this;
};

// Method to increase stock (for admin restocking)
productSchema.methods.increaseStock = async function(quantity) {
    this.stock += quantity;
    
    // Auto mark as available if stock is added
    if (this.stock > 0 && !this.isAvailable) {
        this.isAvailable = true;
    }
    
    await this.save();
    return this;
};

export const Product = mongoose.model("Product", productSchema);