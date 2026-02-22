import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Product } from "../src/models/Product.model.js";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const sampleProducts = [
  {
    name: "DJI Mini 4K Frame",
    description: "Ultra-lightweight carbon fiber frame designed for racing drones. Features a compact design with maximum durability and minimal weight.",
    price: 2499,
    originalPrice: 2899,
    category: "fpv-gears",
    subcategory: "frames",
    brand: "DJI",
    images: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500",
    rating: 4.9,
    reviewCount: 156,
    stock: 25,
    soldCount: 89,
    isAvailable: true,
    isFeatured: true,
    features: [
      "Carbon fiber construction",
      "Ultra-lightweight design",
      "Racing optimized geometry",
      "Durable build quality"
    ],
    specifications: {
      weight: "45g",
      material: "Carbon Fiber",
      propSize: "5 inch",
      motorMount: "16x16mm"
    },
    tags: ["racing", "carbon-fiber", "lightweight", "durable"]
  },
  {
    name: "Pro Racing Motor 2306",
    description: "High-performance brushless motor designed for racing applications. Delivers exceptional power and efficiency.",
    price: 1899,
    originalPrice: 2199,
    category: "fpv-gears",
    subcategory: "motors",
    brand: "RacingPro",
    images: [
      "https://images.unsplash.com/photo-1518685101044-1c0c3d5a4c3f?w=500",
      "https://images.unsplash.com/photo-1518685101044-1c0c3d5a4c3f?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1518685101044-1c0c3d5a4c3f?w=500",
    rating: 4.8,
    reviewCount: 203,
    stock: 40,
    soldCount: 127,
    isAvailable: true,
    isFeatured: true,
    features: [
      "2306 size",
      "High KV rating",
      "Precision balanced",
      "Titanium shaft"
    ],
    specifications: {
      size: "2306",
      kv: "2300KV",
      voltage: "3-6S",
      weight: "32g"
    },
    tags: ["motor", "brushless", "racing", "high-performance"]
  },
  {
    name: "Smart ESC 35A 4-in-1",
    description: "Advanced 4-in-1 ESC with telemetry support and smart features. Perfect for racing and freestyle drones.",
    price: 3299,
    originalPrice: 3799,
    category: "fpv-gears",
    subcategory: "esc",
    brand: "SmartFly",
    images: [
      "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=500",
      "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=500",
    rating: 4.7,
    reviewCount: 89,
    stock: 18,
    soldCount: 45,
    isAvailable: true,
    isFeatured: true,
    features: [
      "4-in-1 design",
      "35A continuous current",
      "Telemetry support",
      "Dshot protocol"
    ],
    specifications: {
      current: "35A",
      voltage: "2-6S",
      protocol: "Dshot600/1200",
      size: "36x36mm"
    },
    tags: ["esc", "4in1", "telemetry", "racing"]
  },
  {
    name: "HD Camera Module",
    description: "Ultra-compact HD camera module with excellent low-light performance. Perfect for FPV recording and live streaming.",
    price: 4299,
    originalPrice: 4899,
    category: "fpv-gears",
    subcategory: "fpv-cameras",
    brand: "VisionTech",
    images: [
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500",
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500",
    rating: 4.6,
    reviewCount: 67,
    stock: 22,
    soldCount: 33,
    isAvailable: true,
    isFeatured: false,
    features: [
      "1080p HD recording",
      "Low latency",
      "Wide dynamic range",
      "Compact design"
    ],
    specifications: {
      resolution: "1080p",
      fps: "60fps",
      latency: "<20ms",
      weight: "8g"
    },
    tags: ["camera", "hd", "fpv", "recording"]
  },
  {
    name: "Premium Propellers 5043",
    description: "High-quality tri-blade propellers designed for maximum efficiency and thrust. Perfect for racing and freestyle.",
    price: 599,
    originalPrice: 799,
    category: "fpv-gears",
    subcategory: "propellers",
    brand: "PropMaster",
    images: [
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500",
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500",
    rating: 4.8,
    reviewCount: 284,
    stock: 100,
    soldCount: 456,
    isAvailable: true,
    isFeatured: true,
    features: [
      "Tri-blade design",
      "Durable PC material",
      "Balanced props",
      "Set of 4"
    ],
    specifications: {
      size: "5043",
      blades: "3",
      material: "Polycarbonate",
      pitch: "4.3 inch"
    },
    tags: ["propellers", "racing", "tri-blade", "durable"]
  },
  {
    name: "Advanced Flight Controller",
    description: "State-of-the-art flight controller with advanced stabilization and customization options. Supports latest flight modes.",
    price: 5499,
    originalPrice: 6199,
    category: "fpv-gears",
    subcategory: "flight-controllers",
    brand: "FlightTech",
    images: [
      "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=500",
      "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=500",
    rating: 4.9,
    reviewCount: 145,
    stock: 15,
    soldCount: 78,
    isAvailable: true,
    isFeatured: true,
    features: [
      "Advanced stabilization",
      "Multiple flight modes",
      "USB connectivity",
      "Open source firmware"
    ],
    specifications: {
      processor: "STM32F7",
      gyro: "ICM-42688-P",
      size: "20x20mm",
      weight: "5g"
    },
    tags: ["flight-controller", "advanced", "stabilization", "open-source"]
  },
  {
    name: "Long Range Antenna Set",
    description: "High-gain antenna set designed for long-range FPV flights. Includes both transmitter and receiver antennas.",
    price: 1799,
    originalPrice: 2199,
    category: "fpv-gears",
    subcategory: "antennas",
    brand: "RangeMaster",
    images: [
      "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=500",
      "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=500",
    rating: 4.7,
    reviewCount: 92,
    stock: 35,
    soldCount: 67,
    isAvailable: true,
    isFeatured: false,
    features: [
      "High-gain design",
      "Long range capability",
      "RHCP/LHCP options",
      "Durable construction"
    ],
    specifications: {
      frequency: "5.8GHz",
      gain: "3dBi",
      polarization: "RHCP",
      connector: "SMA"
    },
    tags: ["antenna", "long-range", "fpv", "high-gain"]
  },
  {
    name: "Professional Battery 6S 1500mAh",
    description: "High-performance LiPo battery with excellent power delivery and cycle life. Perfect for racing and acrobatic flights.",
    price: 2899,
    originalPrice: 3399,
    category: "fpv-gears",
    subcategory: "batteries",
    brand: "PowerCell",
    images: [
      "https://images.unsplash.com/photo-1609592046371-d4904d8b5cd9?w=500",
      "https://images.unsplash.com/photo-1609592046371-d4904d8b5cd9?w=500"
    ],
    coverImage: "https://images.unsplash.com/photo-1609592046371-d4904d8b5cd9?w=500",
    rating: 4.8,
    reviewCount: 178,
    stock: 28,
    soldCount: 234,
    isAvailable: true,
    isFeatured: true,
    features: [
      "6S configuration",
      "1500mAh capacity",
      "High discharge rate",
      "Long cycle life"
    ],
    specifications: {
      voltage: "22.2V",
      capacity: "1500mAh",
      discharge: "100C",
      weight: "280g"
    },
    tags: ["battery", "lipo", "6s", "high-discharge"]
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/xrobofly");
    console.log("Connected to MongoDB");

    // Clear existing products
    await Product.deleteMany({});
    console.log("Cleared existing products");

    // Insert sample products
    const insertedProducts = await Product.insertMany(sampleProducts);
    console.log(`Inserted ${insertedProducts.length} products`);

    // Print some ObjectIds for testing
    console.log("\nSample Product IDs for testing:");
    insertedProducts.slice(0, 3).forEach(product => {
      console.log(`${product.name}: ${product._id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();