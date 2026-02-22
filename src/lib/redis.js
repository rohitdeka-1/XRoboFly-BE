import Redis from "ioredis";
import envConfig from "../config/env.config.js";


export const redis = new Redis(envConfig.UPSTASH_REDIS_URL);

// Handle connection events
redis.on("connect", () => {
    console.log("Redis connected successfully");
});

redis.on("error", (error) => {
    console.error(" Redis connection error:", error);
});



