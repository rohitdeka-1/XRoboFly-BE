import { User } from "../models/User.model.js";

// Get all billing addresses for the logged-in user
export const getBillingAddresses = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('billingAddresses');
        res.json(user.billingAddresses || []);
    } catch (error) {
        console.error("Error in getBillingAddresses:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Add a new billing address
export const addBillingAddress = async (req, res) => {
    try {
        const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // If this is the first billing address, make it default
        const isFirstAddress = user.billingAddresses.length === 0;

        const newAddress = {
            fullName,
            phone,
            addressLine1,
            addressLine2,
            city,
            state,
            pincode,
            country: country || "India",
            isDefault: isFirstAddress
        };

        user.billingAddresses.push(newAddress);
        await user.save();

        res.status(201).json({
            message: "Billing address added successfully",
            address: user.billingAddresses[user.billingAddresses.length - 1]
        });
    } catch (error) {
        console.error("Error adding billing address:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update a billing address
export const updateBillingAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const address = user.billingAddresses.id(id);

        if (!address) {
            return res.status(404).json({ message: "Billing address not found" });
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key !== '_id' && key !== 'isDefault') {
                address[key] = updateData[key];
            }
        });

        await user.save();

        res.json({
            message: "Billing address updated successfully",
            address
        });
    } catch (error) {
        console.error("Error updating billing address:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete a billing address
export const deleteBillingAddress = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const addressIndex = user.billingAddresses.findIndex(addr => addr._id.toString() === id);

        if (addressIndex === -1) {
            return res.status(404).json({ message: "Billing address not found" });
        }

        const wasDefault = user.billingAddresses[addressIndex].isDefault;

        user.billingAddresses.splice(addressIndex, 1);

        // If deleted address was default and there are other addresses, make the first one default
        if (wasDefault && user.billingAddresses.length > 0) {
            user.billingAddresses[0].isDefault = true;
        }

        await user.save();

        res.json({ message: "Billing address deleted successfully" });
    } catch (error) {
        console.error("Error deleting billing address:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Set default billing address
export const setDefaultBillingAddress = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Set all addresses to non-default
        user.billingAddresses.forEach(addr => {
            addr.isDefault = false;
        });

        // Set the selected address as default
        const address = user.billingAddresses.id(id);

        if (!address) {
            return res.status(404).json({ message: "Billing address not found" });
        }

        address.isDefault = true;
        await user.save();

        res.json({
            message: "Default billing address updated successfully",
            address
        });
    } catch (error) {
        console.error("Error setting default billing address:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
