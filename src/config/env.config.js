import dotenv from "dotenv";
dotenv.config();

const envConfig = {
    FRONTEND: process.env.FRONTEND || process.env.FRONT_END,
    FRONT_END: process.env.FRONTEND || process.env.FRONT_END,
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    ACCESS_TOKEN: process.env.ACCESS_TOKEN || process.env.JWT_SECRET,
    REFRESH_TOKEN: process.env.REFRESH_TOKEN, 
    GOOGLE_APP_GMAIL: process.env.GOOGLE_APP_GMAIL || process.env.SMTP_USER || process.env.EMAIL_USER,
    GOOGLE_APP_PASSWORD: process.env.GOOGLE_APP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS,
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
    CLOUDI_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
	CLOUDI_API_KEY: process.env.CLOUDINARY_API_KEY,
	CLOUDI_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL
}

export default envConfig;