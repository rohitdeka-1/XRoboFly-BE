import crypto from 'crypto';


export const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

export const getOTPExpiry = () => {
    return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
};
