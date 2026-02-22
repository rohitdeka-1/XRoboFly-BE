import { v2 as cloudinary } from "cloudinary";
import envConfig from "../config/env.config.js";

cloudinary.config({
	cloud_name: envConfig.CLOUDI_CLOUD_NAME,
	api_key: envConfig.CLOUDI_API_KEY,
	api_secret: envConfig.CLOUDI_API_SECRET
});

export default cloudinary;
