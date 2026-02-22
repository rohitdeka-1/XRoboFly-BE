/**
 * Secure logging utility
 * Only logs sensitive information in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    info: (message, data = null) => {
        if (isDevelopment) {
            console.log(`ℹ️ ${message}`, data ? data : '');
        }
    },
    
    error: (message, error = null) => {
        if (isDevelopment) {
            console.error(` ${message}`, error ? error.message : '');
        }
    },
    
    warn: (message, data = null) => {
        if (isDevelopment) {
            console.warn(` ${message}`, data ? data : '');
        }
    },
    
    success: (message) => {
        if (isDevelopment) {
            console.log(` ${message}`);
        }
    },

    // Never log sensitive data even in development
    secure: (message) => {
        if (isDevelopment) {
            console.log(`🔒 ${message}`);
        }
    }
};
