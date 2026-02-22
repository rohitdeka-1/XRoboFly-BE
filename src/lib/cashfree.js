import { Cashfree, CFEnvironment } from 'cashfree-pg';

const appId = process.env.CASHFREE_APP_ID;
const secretKey = process.env.CASHFREE_SECRET_KEY;
const isProduction = process.env.CASHFREE_ENVIRONMENT === 'production' ||
                     process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION';

if (!appId || !secretKey) {
  console.error('❌ Cashfree credentials missing');
  throw new Error('Cashfree credentials not found. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in environment variables.');
}

// v5: pass environment, appId, secretKey directly to constructor
const cashfreeInstance = new Cashfree(
  isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  appId,
  secretKey
);

console.log("✅ Cashfree SDK initialized:", {
  appId: appId ? "Set" : "Missing",
  environment: isProduction ? "🚀 PRODUCTION" : "🧪 SANDBOX"
});

export default cashfreeInstance;
