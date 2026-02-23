import nodemailer from "nodemailer";
import { Resend } from "resend";
import envConfig from "../config/env.config.js";
import { logger } from "../utils/logger.js";

// ─── Transport setup ──────────────────────────────────────────────────────────
// Priority: Resend (HTTPS - works everywhere) > SMTP (local only)

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const isSmtpConfigured = !!(envConfig.GOOGLE_APP_GMAIL && envConfig.GOOGLE_APP_PASSWORD);

export const transporter = (!resend && isSmtpConfigured)
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: envConfig.GOOGLE_APP_GMAIL,
            pass: envConfig.GOOGLE_APP_PASSWORD,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
    })
    : null;

if (resend) {
    logger.success("Email transport: Resend (HTTPS)");
} else if (transporter) {
    logger.success("Email transport: SMTP/Gmail");
} else {
    logger.warn("Email transport: not configured — emails will be skipped");
}

// ─── HTML Templates ───────────────────────────────────────────────────────────

const baseLayout = (content) => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;}
  .wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);}
  .header{background:#111;padding:24px 32px;text-align:center;}
  .header h1{color:#f97316;margin:0;font-size:22px;letter-spacing:1px;}
  .body{padding:32px;}
  .body h2{color:#111;margin-top:0;}
  .otp{font-size:36px;font-weight:bold;letter-spacing:8px;color:#f97316;background:#fff7ed;border:2px dashed #f97316;padding:16px 24px;border-radius:8px;display:inline-block;margin:16px 0;}
  .btn{display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;}
  .info{background:#f9fafb;border-left:4px solid #f97316;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;}
  .footer{background:#f4f4f4;padding:16px 32px;text-align:center;font-size:12px;color:#888;}
  p{color:#444;line-height:1.6;}
</style></head>
<body><div class="wrap">
  <div class="header"><h1>🚀 XRoboFly</h1></div>
  <div class="body">${content}</div>
  <div class="footer">© ${new Date().getFullYear()} XRoboFly. All rights reserved.</div>
</div></body></html>`;

const templates = {
    otp: ({ name, otp, expiryMinutes = 15 }) => baseLayout(`
        <h2>Verify Your Email</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Use the OTP below to complete your registration. It expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <div style="text-align:center"><div class="otp">${otp}</div></div>
        <p style="color:#888;font-size:13px;">If you did not request this, please ignore this email.</p>`),

    welcome: ({ name, email }) => baseLayout(`
        <h2>Welcome to XRoboFly! 🎉</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account has been verified successfully. Welcome aboard!</p>
        <div class="info">📧 Account Email: <strong>${email}</strong></div>
        <p>Start exploring our range of FPV gear and electronics.</p>
        <a href="https://xrobofly.com" class="btn">Shop Now</a>`),

    login: ({ name, email, loginTime, ipAddress, deviceInfo, browser, os, location }) => baseLayout(`
        <h2>🔐 New Login Alert</h2>
        <p>Hi <strong>${name}</strong>, your account was just accessed.</p>
        <div class="info">
          📧 <strong>${email}</strong><br/>
          🕐 ${loginTime}<br/>
          📍 ${location || 'Unknown location'}<br/>
          💻 ${deviceInfo || ''} — ${browser || ''} on ${os || ''}<br/>
          🌐 IP: ${ipAddress || 'Unknown'}
        </div>
        <p>If this was not you, please <a href="https://xrobofly.com/signin" style="color:#f97316">change your password immediately</a>.</p>`),

    "forgot-password": ({ name, otp, expiryMinutes = 15 }) => baseLayout(`
        <h2>Reset Your Password</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Use the OTP below to reset your password. It expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <div style="text-align:center"><div class="otp">${otp}</div></div>
        <p style="color:#888;font-size:13px;margin-top:16px;">If you did not request this, you can safely ignore this email.</p>`),

    "password-reset-success": ({ name }) => baseLayout(`
        <h2>Password Changed Successfully ✅</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your password has been updated. You can now log in with your new password.</p>
        <a href="https://xrobofly.com/signin" class="btn">Login Now</a>`),

    orderConfirmation: ({ customerName, orderId, orderDate, paymentId, products = [], shippingAddress, subtotal, tax, shipping, discount, totalAmount, frontendUrl = 'https://xrobofly.com' }) => baseLayout(`
        <h2>Order Confirmed! 🎉</h2>
        <p>Hi <strong>${customerName}</strong>, thank you for your order! We've received it and will start processing soon.</p>
        <div class="info">
          📦 Order ID: <strong>${orderId}</strong><br/>
          📅 Date: ${orderDate}<br/>
          💳 Payment Ref: ${paymentId}
        </div>

        <h3 style="margin-top:24px;color:#111;">Items Ordered</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px;text-align:left;color:#555;">Product</th>
            <th style="padding:8px;text-align:center;color:#555;">Qty</th>
            <th style="padding:8px;text-align:right;color:#555;">Price</th>
          </tr></thead>
          <tbody>
            ${(products || []).map(p => `
            <tr style="border-top:1px solid #eee;">
              <td style="padding:8px;">${p.name}</td>
              <td style="padding:8px;text-align:center;">${p.quantity}</td>
              <td style="padding:8px;text-align:right;">₹${p.price}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <table style="width:100%;font-size:14px;margin-top:12px;border-top:2px solid #eee;padding-top:8px;">
          <tr><td style="padding:4px 8px;color:#666;">Subtotal</td><td style="text-align:right;padding:4px 8px;">₹${subtotal}</td></tr>
          <tr><td style="padding:4px 8px;color:#666;">Tax</td><td style="text-align:right;padding:4px 8px;">₹${tax}</td></tr>
          <tr><td style="padding:4px 8px;color:#666;">Shipping</td><td style="text-align:right;padding:4px 8px;">${shipping}</td></tr>
          ${discount ? `<tr><td style="padding:4px 8px;color:#22c55e;">Discount</td><td style="text-align:right;padding:4px 8px;color:#22c55e;">- ₹${discount}</td></tr>` : ''}
          <tr style="font-weight:bold;font-size:16px;border-top:2px solid #f97316;">
            <td style="padding:8px;">Total</td><td style="text-align:right;padding:8px;color:#f97316;">₹${totalAmount}</td>
          </tr>
        </table>

        ${shippingAddress ? `
        <h3 style="margin-top:24px;color:#111;">Delivery Address</h3>
        <div class="info">
          ${shippingAddress.fullName}<br/>
          ${shippingAddress.addressLine1}${shippingAddress.addressLine2 ? ', ' + shippingAddress.addressLine2 : ''}<br/>
          ${shippingAddress.city}, ${shippingAddress.state} – ${shippingAddress.pincode}
        </div>` : ''}

        <div style="text-align:center;margin-top:28px;">
          <a href="${frontendUrl}/orders" class="btn">Track Your Order</a>
        </div>`),

    shippingNotification: ({ customerName, orderId, trackingUrl, products = [], totalAmount, frontendUrl = 'https://xrobofly.com' }) => baseLayout(`
        <h2>Your Order Has Shipped! 🚚</h2>
        <p>Hi <strong>${customerName}</strong>, great news — your order is on its way!</p>
        <div class="info">📦 Order ID: <strong>${orderId}</strong></div>

        ${products.length ? `
        <h3 style="margin-top:24px;color:#111;">Items in This Shipment</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px;text-align:left;color:#555;">Product</th>
            <th style="padding:8px;text-align:center;color:#555;">Qty</th>
            <th style="padding:8px;text-align:right;color:#555;">Price</th>
          </tr></thead>
          <tbody>
            ${products.map(p => `
            <tr style="border-top:1px solid #eee;">
              <td style="padding:8px;">${p.name}</td>
              <td style="padding:8px;text-align:center;">${p.quantity}</td>
              <td style="padding:8px;text-align:right;">&#8377;${p.price}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${totalAmount ? `<div style="text-align:right;font-weight:bold;font-size:15px;padding:8px;border-top:2px solid #f97316;color:#f97316;">Total: &#8377;${totalAmount}</div>` : ''}
        ` : ''}

        <div style="text-align:center;margin:28px 0 8px;">
          <a href="${trackingUrl}" class="btn" style="background:#f97316;font-size:15px;padding:14px 32px;">📍 Track My Package</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#888;">Or copy this link: <a href="${trackingUrl}" style="color:#f97316;">${trackingUrl}</a></p>

        <div style="text-align:center;margin-top:20px;">
          <a href="${frontendUrl}/orders" class="btn" style="background:#111;">View My Orders</a>
        </div>
        <p style="color:#888;font-size:13px;margin-top:24px;">If you have any questions, feel free to reply to this email.</p>`),
};

// ─── sendMail ─────────────────────────────────────────────────────────────────

export const sendMail = async (to, subject, template, context = {}) => {
    const htmlFn = templates[template];
    if (!htmlFn) {
        logger.error(`[EMAIL] Unknown template: ${template}`);
        return { messageId: 'unknown-template' };
    }

    const html = htmlFn(context);

    // 1. Try Resend (HTTPS — works on any cloud host)
    if (resend) {
        try {
            const from = process.env.EMAIL_FROM || "XRoboFly <noreply@xrobofly.com>";
            const { data, error } = await resend.emails.send({
                from,
                to,
                subject,
                html,
            });
            // Resend SDK returns { data, error } instead of throwing — check explicitly
            if (error) {
                const msg = error?.message || JSON.stringify(error);
                logger.error(`Resend failed for ${to}: [${error.statusCode}] ${msg}`);
                throw new Error(`Resend error ${error.statusCode}: ${msg}`);
            }
            logger.success(`Email sent via Resend to ${to} — ${subject}`);
            return data;
        } catch (error) {
            const msg = error?.message || String(error);
            logger.error(`Resend failed for ${to}: ${msg}`);
            throw error;
        }
    }

    // 2. Fall back to SMTP (works locally, may be blocked on cloud hosts)
    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from: `XRoboFly <${envConfig.GOOGLE_APP_GMAIL}>`,
                to,
                subject,
                html,
            });
            logger.success(`Email sent via SMTP to ${to} — ${subject}`);
            return info;
        } catch (error) {
            const msg = error?.message || String(error);
            logger.error(`Failed to send email to ${to}: ${msg}`);
            if (process.env.NODE_ENV !== 'production' && process.env.COOKIE_SECURE !== 'true') {
                logger.warn('[DEV MODE] Email error suppressed.');
                return { messageId: 'dev-error', accepted: [to] };
            }
            throw error;
        }
    }

    // 3. Not configured
    logger.warn(`[EMAIL SKIPPED] No transport configured. Would send "${subject}" to ${to}`);
    return { messageId: 'skipped', accepted: [to] };
};
