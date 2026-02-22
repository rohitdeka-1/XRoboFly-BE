import os from "os";

// Get server's local IP address
function getIpAddress() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return "Unknown IP";
}

// Get client IP address from request
export const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded 
        ? forwarded.split(',')[0].trim() 
        : req.socket.remoteAddress || req.connection.remoteAddress || req.ip || 'Unknown';
    
    // Remove IPv6 prefix if present
    return ip.replace(/^::ffff:/, '');
};

// Parse user agent to extract browser and OS info
export const parseUserAgent = (userAgent) => {
    if (!userAgent) {
        return {
            browser: 'Unknown Browser',
            os: 'Unknown OS',
            deviceInfo: 'Unknown Device'
        };
    }

    // Browser detection
    let browser = 'Unknown Browser';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser = 'Google Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
    } else if (userAgent.includes('Firefox')) {
        browser = 'Mozilla Firefox';
    } else if (userAgent.includes('Edg')) {
        browser = 'Microsoft Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
        browser = 'Opera';
    }

    // OS detection
    let os = 'Unknown OS';
    if (userAgent.includes('Windows NT 10.0')) {
        os = 'Windows 10/11';
    } else if (userAgent.includes('Windows NT 6.3')) {
        os = 'Windows 8.1';
    } else if (userAgent.includes('Windows NT 6.2')) {
        os = 'Windows 8';
    } else if (userAgent.includes('Windows NT 6.1')) {
        os = 'Windows 7';
    } else if (userAgent.includes('Mac OS X')) {
        os = 'macOS';
    } else if (userAgent.includes('Linux')) {
        os = 'Linux';
    } else if (userAgent.includes('Android')) {
        os = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        os = 'iOS';
    }

    // Device type
    let deviceType = 'Desktop';
    if (userAgent.includes('Mobile')) {
        deviceType = 'Mobile';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        deviceType = 'Tablet';
    }

    return {
        browser,
        os,
        deviceInfo: `${browser} on ${os} (${deviceType})`
    };
};

// Get location from IP
export const getLocationFromIp = (ip) => {
    if (ip === '127.0.0.1' || ip === 'localhost' || ip.includes('::1') || ip === 'Unknown') {
        return 'Localhost / Development Environment';
    }
    return 'Location data unavailable';
};

// Format date for email templates
export const formatDate = (date = new Date()) => {
    return new Date(date).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
};

export default getIpAddress;