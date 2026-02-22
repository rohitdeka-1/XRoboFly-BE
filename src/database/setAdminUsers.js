import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import envConfig from "../config/env.config.js";

const updateAdminUsers = async () => {
    try {
        await mongoose.connect(envConfig.MONGO_URI);
        console.log("Connected to MongoDB");

        const adminEmails = ['xrobofly@gmail.com', 'alkardorhd@gmail.com'];

        for (const email of adminEmails) {
            const user = await User.findOne({ email });
            
            if (user) {
                user.role = 'admin';
                await user.save();
                console.log(`✅ ${email} set as admin`);
            } else {
                console.log(`⚠️  User ${email} not found`);
            }
        }

        console.log('\n✅ Admin users updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error("Error updating admin users:", error);
        process.exit(1);
    }
};

updateAdminUsers();
