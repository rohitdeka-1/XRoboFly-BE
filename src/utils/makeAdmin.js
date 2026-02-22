import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import dotenv from 'dotenv';

dotenv.config();

const makeAdmin = async (email) => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');
    
    console.log(`🔍 Looking for user: ${email}`);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      console.log('💡 Make sure the user has signed up first');
      process.exit(1);
    }
    
    if (user.role === 'admin') {
      console.log('ℹ️  User is already an admin');
      process.exit(0);
    }
    
    user.role = 'admin';
    await user.save();
    
    console.log('✅ Success!');
    console.log(`👤 ${user.name} (${user.email}) is now an admin`);
    console.log('🔄 User must log out and log back in for changes to take effect');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

const email = process.argv[2];

if (!email) {
  console.log('📝 Usage: node makeAdmin.js <email>');
  console.log('📝 Example: node makeAdmin.js admin@example.com');
  process.exit(1);
}

makeAdmin(email);
