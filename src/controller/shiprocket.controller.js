import { shiprocketService } from '../services/shiprocket.service.js';
import Order from '../models/Order.model.js';
import { Product } from '../models/Product.model.js';
import { User } from '../models/User.model.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

// Create shipment for an order
export const createShipment = async (req, res) => {
    try {
        const { orderId } = req.body;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        // Fetch order details
        const order = await Order.findById(orderId).populate('user').populate('products.product');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if shipment already exists
        if (order.shipment?.shiprocketOrderId) {
            return res.status(400).json({
                success: false,
                message: 'Shipment already created for this order'
            });
        }

        // Prepare order data for Shiprocket
        const orderData = {
            orderId: order._id.toString(),
            orderDate: order.createdAt.toISOString().split('T')[0],
            email: order.user.email,
            billingAddress: order.billingAddress,
            shippingAddress: order.shippingAddress,
            shippingIsBilling: JSON.stringify(order.billingAddress) === JSON.stringify(order.shippingAddress),
            items: order.products.map(item => ({
                name: item.product.name,
                productId: item.product._id.toString(),
                sku: item.product.sku || item.product._id.toString(),
                quantity: item.quantity,
                price: item.price,
                discount: 0,
                tax: 0,
                hsn: item.product.hsn || 0
            })),
            paymentMethod: 'Prepaid',
            shippingCharges: 0,
            discount: 0,
            subtotal: order.totalAmount,
            weight: calculateTotalWeight(order.products),
            dimensions: {
                length: 10,
                breadth: 10,
                height: 10
            }
        };

        // Create shipment in Shiprocket
        const result = await shiprocketService.createOrder(orderData);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create shipment',
                error: result.error
            });
        }

        // Update order with shipment details
        order.shipment = {
            shiprocketOrderId: result.orderId,
            shipmentId: result.shipmentId,
            status: result.status,
            statusCode: result.statusCode,
            createdAt: new Date()
        };
        await order.save();

        logger.success('Shipment created successfully');

        res.status(200).json({
            success: true,
            message: 'Shipment created successfully',
            data: {
                orderId: result.orderId,
                shipmentId: result.shipmentId,
                status: result.status
            }
        });
    } catch (error) {
        logger.error('Error creating shipment', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create shipment'
        });
    }
};

// Generate AWB and assign courier
export const assignCourier = async (req, res) => {
    try {
        const { orderId, courierId } = req.body;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order || !order.shipment?.shipmentId) {
            return res.status(404).json({
                success: false,
                message: 'Order or shipment not found'
            });
        }

        // If courierId not provided, get recommended courier
        let selectedCourierId = courierId;
        if (!selectedCourierId) {
            const serviceability = await shiprocketService.checkServiceability(
                process.env.SHIPROCKET_PICKUP_PINCODE,
                order.shippingAddress.pincode
            );

            if (!serviceability.success || !serviceability.serviceable) {
                return res.status(400).json({
                    success: false,
                    message: 'No courier service available for this location'
                });
            }

            // Select the cheapest courier
            selectedCourierId = serviceability.couriers[0].courier_company_id;
        }

        // Generate AWB
        const result = await shiprocketService.generateAWB(order.shipment.shipmentId, selectedCourierId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to assign courier',
                error: result.error
            });
        }

        // Update order with AWB details
        order.shipment.awbCode = result.awbCode;
        order.shipment.courierId = selectedCourierId;
        order.shipment.awbAssignedAt = new Date();
        await order.save();

        logger.success('Courier assigned successfully');

        res.status(200).json({
            success: true,
            message: 'Courier assigned successfully',
            data: result.data
        });
    } catch (error) {
        logger.error('Error assigning courier', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign courier'
        });
    }
};

// Schedule pickup
export const schedulePickup = async (req, res) => {
    try {
        const { orderId, pickupDate } = req.body;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        // SECURITY: Validate pickup date
        if (pickupDate) {
            const pickupDateTime = new Date(pickupDate);
            if (isNaN(pickupDateTime.getTime()) || pickupDateTime < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid pickup date. Must be a future date'
                });
            }
        }

        const order = await Order.findById(orderId);
        
        if (!order || !order.shipment?.shipmentId) {
            return res.status(404).json({
                success: false,
                message: 'Order or shipment not found'
            });
        }

        if (!order.shipment.awbCode) {
            return res.status(400).json({
                success: false,
                message: 'AWB not assigned. Please assign courier first.'
            });
        }

        // Request pickup
        const result = await shiprocketService.requestPickup(order.shipment.shipmentId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to schedule pickup',
                error: result.error
            });
        }

        // Update order
        order.shipment.pickupScheduled = true;
        order.shipment.pickupScheduledAt = new Date();
        order.orderStatus = 'processing';
        await order.save();

        logger.success('Pickup scheduled successfully');

        res.status(200).json({
            success: true,
            message: 'Pickup scheduled successfully',
            data: result.data
        });
    } catch (error) {
        logger.error('Error scheduling pickup', error);
        res.status(500).json({
            success: false,
            message: 'Failed to schedule pickup'
        });
    }
};

// Track shipment
export const trackShipment = async (req, res) => {
    try {
        const { orderId } = req.params;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // SECURITY: Ensure user can only track their own orders
        if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only track your own orders'
            });
        }
        
        if (!order.shipment?.shipmentId) {
            return res.status(404).json({
                success: false,
                message: 'Shipment not found for this order'
            });
        }

        const result = await shiprocketService.trackShipment(order.shipment.shipmentId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to track shipment',
                error: result.error
            });
        }

        res.status(200).json({
            success: true,
            data: result.trackingData
        });
    } catch (error) {
        logger.error('Error tracking shipment', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track shipment'
        });
    }
};

// Cancel shipment
export const cancelShipment = async (req, res) => {
    try {
        const { orderId } = req.body;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order || !order.shipment?.awbCode) {
            return res.status(404).json({
                success: false,
                message: 'Order or AWB not found'
            });
        }

        const result = await shiprocketService.cancelShipment(order.shipment.awbCode);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel shipment',
                error: result.error
            });
        }

        // Update order
        order.orderStatus = 'cancelled';
        order.shipment.cancelled = true;
        order.shipment.cancelledAt = new Date();
        await order.save();

        logger.success('Shipment cancelled successfully');

        res.status(200).json({
            success: true,
            message: 'Shipment cancelled successfully',
            data: result.data
        });
    } catch (error) {
        logger.error('Error cancelling shipment', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel shipment'
        });
    }
};

// Generate shipping label
export const generateLabel = async (req, res) => {
    try {
        const { orderId } = req.body;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order || !order.shipment?.shipmentId) {
            return res.status(404).json({
                success: false,
                message: 'Order or shipment not found'
            });
        }

        const result = await shiprocketService.generateLabel(order.shipment.shipmentId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate label',
                error: result.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Label generated successfully',
            labelUrl: result.labelUrl
        });
    } catch (error) {
        logger.error('Error generating label', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate label'
        });
    }
};

// Generate invoice
export const generateInvoice = async (req, res) => {
    try {
        const { orderId } = req.body;

        // SECURITY: Validate orderId format
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order || !order.shipment?.shiprocketOrderId) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const result = await shiprocketService.generateInvoice(order.shipment.shiprocketOrderId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate invoice',
                error: result.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Invoice generated successfully',
            invoiceUrl: result.invoiceUrl
        });
    } catch (error) {
        logger.error('Error generating invoice', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invoice'
        });
    }
};

// Check serviceability
export const checkServiceability = async (req, res) => {
    try {
        const { pincode, weight = 0.5 } = req.query;

        // SECURITY: Validate pincode format (6 digits for India)
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pincode. Must be 6 digits'
            });
        }

        // SECURITY: Validate weight (reasonable limits)
        const parsedWeight = parseFloat(weight);
        if (isNaN(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid weight. Must be between 0 and 100 kg'
            });
        }

        const result = await shiprocketService.checkServiceability(
            process.env.SHIPROCKET_PICKUP_PINCODE,
            pincode,
            parsedWeight
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to check serviceability',
                error: result.error
            });
        }

        res.status(200).json({
            success: true,
            serviceable: result.serviceable,
            couriers: result.couriers
        });
    } catch (error) {
        logger.error('Error checking serviceability', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check serviceability'
        });
    }
};



// Webhook handler for Shiprocket updates
export const shiprocketWebhook = async (req, res) => {
    try {
        // Log incoming webhook request for debugging
        console.log('📦 Shiprocket webhook received:', {
            headers: req.headers,
            body: req.body,
            ip: req.ip,
            method: req.method,
            url: req.originalUrl
        });

        // SECURITY: Fast 200 response (Shiprocket requires quick acknowledgment)
        // We'll process async to avoid timeout
        const webhookData = req.body;

        // SECURITY: Optional x-api-key validation (if configured in Shiprocket dashboard)
        if (process.env.SHIPROCKET_WEBHOOK_SECRET) {
            const receivedKey = req.headers['x-api-key'];
            if (receivedKey !== process.env.SHIPROCKET_WEBHOOK_SECRET) {
                logger.warn('Webhook authentication failed - invalid x-api-key');
                console.log('Webhook auth failed. Expected:', process.env.SHIPROCKET_WEBHOOK_SECRET, 'Received:', receivedKey);
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            console.log('Webhook authentication successful');
        } else {
            console.log('⚠️  No webhook secret configured - skipping authentication');
        }

        // SECURITY: Validate webhook payload
        if (!webhookData || typeof webhookData !== 'object') {
            logger.warn('Invalid webhook payload received');
            console.log('❌ Invalid payload type');
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        // Extract fields from Shiprocket payload (they can vary)
        const { 
            shipment_id,        // Shiprocket internal shipment ID
            order_id,           // Shiprocket order ID (sometimes used instead)
            current_status,     // Current shipment status
            awb,                // AWB tracking number
            shipment_status     // Alternative status field
        } = webhookData;

        console.log('📋 Webhook data extracted:', { shipment_id, order_id, current_status, awb, shipment_status });

        // Send fast 200 response to Shiprocket (required - they expect quick acknowledgment)
        res.status(200).json({ success: true, message: 'Webhook received' });

        // Process webhook asynchronously (non-blocking)
        setImmediate(async () => {
            try {
                const status = current_status || shipment_status;
                console.log('🔄 Processing webhook async:', { shipment_id, order_id, status, awb });

                // Find order by shipment ID, order ID, or AWB
                let order;
                
                // Try finding by shipment_id first
                if (shipment_id) {
                    order = await Order.findOne({ 'shipment.shipmentId': shipment_id });
                    console.log('🔍 Search by shipment_id:', shipment_id, 'Found:', !!order);
                }
                
                // Try finding by order_id if not found
                if (!order && order_id) {
                    order = await Order.findOne({ 'shipment.shiprocketOrderId': order_id });
                    console.log('🔍 Search by order_id:', order_id, 'Found:', !!order);
                }
                
                // Fallback: try finding by AWB if order still not found
                if (!order && awb) {
                    order = await Order.findOne({ 'shipment.awbCode': String(awb) });
                    console.log('🔍 Search by awb:', awb, 'Found:', !!order);
                }

                if (order) {
                    // Update order status based on shipment status
                    const finalStatus = current_status || shipment_status;
                    if (finalStatus) {
                        order.shipment.currentStatus = finalStatus;
                    }
                    
                    // Update AWB if provided and not already set
                    if (awb && !order.shipment.awbCode) {
                        order.shipment.awbCode = String(awb);
                    }
                    
                    order.shipment.lastUpdatedAt = new Date();

                    // Map Shiprocket status to our order status
                    const statusMapping = {
                        'PICKUP SCHEDULED': 'processing',
                        'PICKUP QUEUED': 'processing',
                        'AWB ASSIGNED': 'processing',
                        'MANIFESTED': 'processing',
                        'PICKED UP': 'processing',
                        'SHIPMENT PICKED UP': 'processing',
                        'SHIPPED': 'shipped',
                        'IN TRANSIT': 'shipped',
                        'SHIPMENT OUT FOR DELIVERY': 'shipped',
                        'OUT FOR DELIVERY': 'shipped',
                        'DELIVERED': 'delivered',
                        'SHIPMENT DELIVERED': 'delivered',
                        'RTO INITIATED': 'cancelled',
                        'RTO DELIVERED': 'cancelled',
                        'CANCELLED': 'cancelled',
                        'LOST': 'cancelled'
                    };

                    if (finalStatus && statusMapping[finalStatus.toUpperCase()]) {
                        order.orderStatus = statusMapping[finalStatus.toUpperCase()];
                        console.log('✅ Status mapped:', finalStatus, '→', order.orderStatus);
                    }

                    await order.save();

                    logger.success(`Order ${order._id} updated with status: ${finalStatus}`);
                    console.log('✅ Order updated successfully:', order._id);
                } else {
                    const searchCriteria = { shipment_id, order_id, awb };
                    logger.warn(`Order not found for webhook`, searchCriteria);
                    console.log('❌ Order not found. Search criteria:', searchCriteria);
                }
            } catch (error) {
                logger.error('Async webhook processing error', error);
            }
        });
    } catch (error) {
        logger.error('Webhook processing error', error);
        // Still return 200 to prevent Shiprocket retries
        res.status(200).json({ success: true });
    }
};

// Helper function to calculate total weight
function calculateTotalWeight(products) {
    // Default weight per product is 0.5 kg
    // You can modify this based on actual product weights
    const totalWeight = products.reduce((sum, item) => {
        const weight = item.product.weight || 0.5;
        return sum + (weight * item.quantity);
    }, 0);
    
    return totalWeight;
}

// Auto-create shipment after order success (can be called from payment controller)
export const autoCreateShipment = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('user').populate('products.product');
        
        if (!order) {
            return { success: false, message: 'Order not found' };
        }

        // Prepare order data
        const orderData = {
            orderId: order._id.toString(),
            orderDate: order.createdAt.toISOString().split('T')[0],
            email: order.user.email,
            billingAddress: order.billingAddress,
            shippingAddress: order.shippingAddress,
            shippingIsBilling: JSON.stringify(order.billingAddress) === JSON.stringify(order.shippingAddress),
            items: order.products.map(item => ({
                name: item.product.name,
                productId: item.product._id.toString(),
                sku: item.product.sku || item.product._id.toString(),
                quantity: item.quantity,
                price: item.price,
                discount: 0,
                tax: 0,
                hsn: item.product.hsn || 0
            })),
            paymentMethod: 'Prepaid',
            shippingCharges: 0,
            discount: 0,
            subtotal: order.totalAmount,
            weight: calculateTotalWeight(order.products)
        };

        // Create shipment
        const result = await shiprocketService.createOrder(orderData);

        if (result.success) {
            order.shipment = {
                shiprocketOrderId: result.orderId,
                shipmentId: result.shipmentId,
                status: result.status,
                statusCode: result.statusCode,
                createdAt: new Date()
            };
            await order.save();
            logger.success(`Auto-created shipment for order ${orderId}`);
        }

        return result;
    } catch (error) {
        logger.error('Auto shipment creation failed', error);
        return { success: false, error: error.message };
    }
};
