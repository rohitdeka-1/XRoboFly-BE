import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import Redis from "ioredis";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

// Seed product IDs to delete (all IDs from the seeder run)
const SEED_IDS = [
    "6996d9d7ab1e88828e199b7a",
    "6996d9d7ab1e88828e199b7b",
    "6996d9d7ab1e88828e199b7c",
    "6996d9d7ab1e88828e199b7d",
    "6996d9d7ab1e88828e199b7e",
    "6996d9d7ab1e88828e199b7f",
    "6996d9d7ab1e88828e199b80",
    "6996d9d7ab1e88828e199b81",
    "6996d9d7ab1e88828e199b82",
    "6996d9d7ab1e88828e199b83",
    "6996d9d7ab1e88828e199b84",
    "6996d9d7ab1e88828e199b85",
];

async function cleanup() {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const collection = mongoose.connection.collection("products");

    // Delete all products whose coverImage is an Unsplash URL (seed data pattern)
    const result = await collection.deleteMany({
        coverImage: { $regex: "unsplash.com", $options: "i" }
    });
    console.log(`🗑️  Deleted ${result.deletedCount} seed products from MongoDB`);

    // Print remaining featured products so we can confirm real ones are there
    const remaining = await collection.find({ isFeatured: true }).toArray();
    console.log(`\n✨ Remaining featured products (${remaining.length}):`);
    remaining.forEach(p => console.log(`   - ${p.name} [${p._id}]`));

    // Clear Redis featured cache
    const redis = new Redis(process.env.UPSTASH_REDIS_URL);
    await redis.del("featured_products");
    console.log("\n🔴 Cleared Redis featured_products cache");
    redis.disconnect();

    await mongoose.disconnect();
    console.log("✅ Done. Refresh the homepage — your real products will now show.");
    process.exit(0);
}

cleanup().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
