import axios from 'axios';

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

class ShiprocketService {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
        
        // SECURITY: Validate environment variables on initialization
        this.validateConfig();
    }

    // SECURITY: Validate required environment variables
    validateConfig() {
        const required = [
            'SHIPROCKET_EMAIL',
            'SHIPROCKET_PASSWORD',
            'SHIPROCKET_PICKUP_LOCATION',
            'SHIPROCKET_PICKUP_PINCODE'
        ];
        
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.error(`Missing Shiprocket configuration: ${missing.join(', ')}`);
            // Don't throw error, just log warning - allows server to start
            console.warn('Shiprocket integration will not work until configuration is complete');
        }
    }

    // Authenticate and get token
    async authenticate() {
        try {
            // SECURITY: Check credentials exist before making API call
            if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
                throw new Error('Shiprocket credentials not configured');
            }

            const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
                email: process.env.SHIPROCKET_EMAIL,
                password: process.env.SHIPROCKET_PASSWORD
            });

            this.token = response.data.token;
            // Token expires in 10 days, we'll refresh after 9 days
            this.tokenExpiry = Date.now() + (9 * 24 * 60 * 60 * 1000);
            
            return this.token;
        } catch (error) {
            console.error('Shiprocket authentication failed:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Shiprocket');
        }
    }

    // Get valid token (refresh if needed)
    async getToken() {
        if (!this.token || Date.now() >= this.tokenExpiry) {
            await this.authenticate();
        }
        return this.token;
    }

    // Get headers with authentication
    async getHeaders() {
        const token = await this.getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Create Shiprocket order
    async createOrder(orderData) {
        try {
            const headers = await this.getHeaders();
            
            // SECURITY: Validate required fields
            if (!orderData.orderId || !orderData.email || !orderData.billingAddress || !orderData.shippingAddress) {
                throw new Error('Missing required order fields');
            }

            // SECURITY: Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(orderData.email)) {
                throw new Error('Invalid email format');
            }

            // SECURITY: Validate phone numbers (10 digits)
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(orderData.billingAddress.phone)) {
                throw new Error('Invalid billing phone number. Must be 10 digits');
            }
            if (!phoneRegex.test(orderData.shippingAddress.phone)) {
                throw new Error('Invalid shipping phone number. Must be 10 digits');
            }

            // SECURITY: Validate pincode format (6 digits)
            const pincodeRegex = /^\d{6}$/;
            if (!pincodeRegex.test(orderData.billingAddress.pincode)) {
                throw new Error('Invalid billing pincode. Must be 6 digits');
            }
            if (!pincodeRegex.test(orderData.shippingAddress.pincode)) {
                throw new Error('Invalid shipping pincode. Must be 6 digits');
            }

            // SECURITY: Validate items array
            if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
                throw new Error('Order must have at least one item');
            }

            // SECURITY: Sanitize string inputs (prevent injection)
            const sanitize = (str) => {
                if (typeof str !== 'string') return str;
                return str.replace(/[<>]/g, '').trim();
            };
            
            const shiprocketOrder = {
                order_id: sanitize(orderData.orderId),
                order_date: orderData.orderDate,
                pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
                channel_id: process.env.SHIPROCKET_CHANNEL_ID || "",
                comment: sanitize(orderData.comment) || "Order from RedClaw",
                billing_customer_name: sanitize(orderData.billingAddress.fullName),
                billing_last_name: "",
                billing_address: sanitize(orderData.billingAddress.addressLine1),
                billing_address_2: sanitize(orderData.billingAddress.addressLine2 || ""),
                billing_city: sanitize(orderData.billingAddress.city),
                billing_pincode: orderData.billingAddress.pincode,
                billing_state: sanitize(orderData.billingAddress.state),
                billing_country: sanitize(orderData.billingAddress.country),
                billing_email: orderData.email.toLowerCase(),
                billing_phone: orderData.billingAddress.phone,
                shipping_is_billing: orderData.shippingIsBilling,
                shipping_customer_name: sanitize(orderData.shippingAddress.fullName),
                shipping_last_name: "",
                shipping_address: sanitize(orderData.shippingAddress.addressLine1),
                shipping_address_2: sanitize(orderData.shippingAddress.addressLine2 || ""),
                shipping_city: sanitize(orderData.shippingAddress.city),
                shipping_pincode: orderData.shippingAddress.pincode,
                shipping_country: sanitize(orderData.shippingAddress.country),
                shipping_state: sanitize(orderData.shippingAddress.state),
                shipping_email: orderData.email.toLowerCase(),
                shipping_phone: orderData.shippingAddress.phone,
                order_items: orderData.items.map(item => ({
                    name: sanitize(item.name),
                    sku: sanitize(item.sku || item.productId),
                    units: Math.max(1, parseInt(item.quantity) || 1), // Ensure positive quantity
                    selling_price: Math.max(0, parseFloat(item.price) || 0), // Ensure positive price
                    discount: Math.max(0, parseFloat(item.discount) || 0),
                    tax: Math.max(0, parseFloat(item.tax) || 0),
                    hsn: parseInt(item.hsn) || 0
                })),
                payment_method: orderData.paymentMethod || "Prepaid",
                shipping_charges: Math.max(0, parseFloat(orderData.shippingCharges) || 0),
                giftwrap_charges: 0,
                transaction_charges: 0,
                total_discount: Math.max(0, parseFloat(orderData.discount) || 0),
                sub_total: Math.max(0, parseFloat(orderData.subtotal) || 0),
                length: Math.max(1, parseFloat(orderData.dimensions?.length) || 10),
                breadth: Math.max(1, parseFloat(orderData.dimensions?.breadth) || 10),
                height: Math.max(1, parseFloat(orderData.dimensions?.height) || 10),
                weight: Math.max(0.1, parseFloat(orderData.weight) || 0.5)
            };

            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/orders/create/adhoc`,
                shiprocketOrder,
                { 
                    headers,
                    timeout: 30000 // SECURITY: 30 second timeout to prevent hanging requests
                }
            );

            return {
                success: true,
                orderId: response.data.order_id,
                shipmentId: response.data.shipment_id,
                status: response.data.status,
                statusCode: response.data.status_code,
                data: response.data
            };
        } catch (error) {
            // SECURITY: Don't expose sensitive error details
            const errorMessage = error.response?.data?.message || 'Order creation failed';
            console.error('Shiprocket order creation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    // Generate AWB (Airway Bill) for shipment
    async generateAWB(shipmentId, courierId) {
        try {
            const headers = await this.getHeaders();
            
            // SECURITY: Validate inputs
            if (!shipmentId || !courierId) {
                throw new Error('Shipment ID and Courier ID are required');
            }
            
            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/courier/assign/awb`,
                {
                    shipment_id: parseInt(shipmentId),
                    courier_id: parseInt(courierId)
                },
                { 
                    headers,
                    timeout: 30000 // SECURITY: 30 second timeout
                }
            );

            return {
                success: true,
                awbCode: response.data.awb_assign_status,
                data: response.data
            };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'AWB generation failed';
            console.error('AWB generation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    // Get available courier services for a shipment
    async getAvailableCouriers(shipmentId) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.get(
                `${SHIPROCKET_BASE_URL}/courier/serviceability/?pickup_postcode=${process.env.SHIPROCKET_PICKUP_PINCODE}&delivery_postcode=${shipmentId}&weight=${0.5}&cod=0`,
                { headers }
            );

            return {
                success: true,
                couriers: response.data.data.available_courier_companies,
                data: response.data
            };
        } catch (error) {
            console.error('Failed to fetch couriers:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Request pickup for shipment
    async requestPickup(shipmentId) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/courier/generate/pickup`,
                {
                    shipment_id: [shipmentId]
                },
                { headers }
            );

            return {
                success: true,
                pickupStatus: response.data.pickup_status,
                data: response.data
            };
        } catch (error) {
            console.error('Pickup request failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Track shipment
    async trackShipment(shipmentId) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.get(
                `${SHIPROCKET_BASE_URL}/courier/track/shipment/${shipmentId}`,
                { headers }
            );

            return {
                success: true,
                trackingData: response.data.tracking_data,
                data: response.data
            };
        } catch (error) {
            console.error('Shipment tracking failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Cancel shipment
    async cancelShipment(awbNumbers) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/orders/cancel/shipment/awbs`,
                {
                    awbs: Array.isArray(awbNumbers) ? awbNumbers : [awbNumbers]
                },
                { headers }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Shipment cancellation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Get shipment details
    async getShipmentDetails(shipmentId) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.get(
                `${SHIPROCKET_BASE_URL}/shipments?shipment_id=${shipmentId}`,
                { headers }
            );

            return {
                success: true,
                shipment: response.data.data,
                data: response.data
            };
        } catch (error) {
            console.error('Failed to get shipment details:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Generate label for shipment
    async generateLabel(shipmentIds) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/courier/generate/label`,
                {
                    shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds]
                },
                { headers }
            );

            return {
                success: true,
                labelUrl: response.data.label_url,
                data: response.data
            };
        } catch (error) {
            console.error('Label generation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Generate invoice for shipment
    async generateInvoice(orderIds) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/orders/print/invoice`,
                {
                    ids: Array.isArray(orderIds) ? orderIds : [orderIds]
                },
                { headers }
            );

            return {
                success: true,
                invoiceUrl: response.data.invoice_url,
                data: response.data
            };
        } catch (error) {
            console.error('Invoice generation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Generate manifest for pickup
    async generateManifest(shipmentIds) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.post(
                `${SHIPROCKET_BASE_URL}/manifests/generate`,
                {
                    shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds]
                },
                { headers }
            );

            return {
                success: true,
                manifestUrl: response.data.manifest_url,
                data: response.data
            };
        } catch (error) {
            console.error('Manifest generation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Check serviceability
    async checkServiceability(pickupPincode, deliveryPincode, weight = 0.5, cod = 0) {
        try {
            const headers = await this.getHeaders();
            
            const response = await axios.get(
                `${SHIPROCKET_BASE_URL}/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=${cod}`,
                { headers }
            );

            return {
                success: true,
                serviceable: response.data.data.available_courier_companies.length > 0,
                couriers: response.data.data.available_courier_companies,
                data: response.data
            };
        } catch (error) {
            console.error('Serviceability check failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

// Export singleton instance
export const shiprocketService = new ShiprocketService();
