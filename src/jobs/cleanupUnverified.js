import cron from 'node-cron';
import { User } from '../models/User.model.js';

// Run every day at midnight to clean up unverified users
export const startCleanupJob = () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
            
            const result = await User.deleteMany({
                isVerified: false,
                createdAt: { $lt: twoDaysAgo }
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️ Cleaned up ${result.deletedCount} unverified user(s) older than 2 days`);
            }
        } catch (error) {
            console.error('Error in cleanup job:', error);
        }
    });

    console.log('✅ Cleanup job scheduled - runs daily at midnight');
};
