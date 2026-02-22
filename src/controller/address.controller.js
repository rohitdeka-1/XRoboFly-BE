import { User } from "../models/User.model.js";

export const getAddresses = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select("addresses");
		res.json(user.addresses || []);
	} catch (error) {
		console.error("Error fetching addresses:", error);
		res.status(500).json({ message: "Error fetching addresses", error: error.message });
	}
};



export const addAddress = async (req, res) => {
	try {
		const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = req.body;

		// Validation
		if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
			return res.status(400).json({ message: "Please provide all required address fields" });
		}

		const user = await User.findById(req.user._id);

		if (isDefault) {
			user.addresses.forEach(addr => {
				addr.isDefault = false;
			});
		}

		const isFirstAddress = user.addresses.length === 0;

		user.addresses.push({
			fullName,
			phone,
			addressLine1,
			addressLine2: addressLine2 || "",
			city,
			state,
			pincode,
			country: country || "India",
			isDefault: isDefault || isFirstAddress,
		});

		await user.save();

		res.status(201).json({
			message: "Address added successfully",
			addresses: user.addresses,
		});
	} catch (error) {
		console.error("Error adding address:", error);
		res.status(500).json({ message: "Error adding address", error: error.message });
	}
};

export const updateAddress = async (req, res) => {
	try {
		const { addressId } = req.params;
		const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = req.body;

		const user = await User.findById(req.user._id);

		const address = user.addresses.id(addressId);
		if (!address) {
			return res.status(404).json({ message: "Address not found" });
		}

		if (isDefault) {
			user.addresses.forEach(addr => {
				addr.isDefault = false;
			});
		}
 
		if (fullName) address.fullName = fullName;
		if (phone) address.phone = phone;
		if (addressLine1) address.addressLine1 = addressLine1;
		if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
		if (city) address.city = city;
		if (state) address.state = state;
		if (pincode) address.pincode = pincode;
		if (country) address.country = country;
		if (isDefault !== undefined) address.isDefault = isDefault;

		await user.save();

		res.json({
			message: "Address updated successfully",
			addresses: user.addresses,
		});
	} catch (error) {
		console.error("Error updating address:", error);
		res.status(500).json({ message: "Error updating address", error: error.message });
	}
};

export const deleteAddress = async (req, res) => {
	try {
		const { addressId } = req.params;

		const user = await User.findById(req.user._id);

		const address = user.addresses.id(addressId);
		if (!address) {
			return res.status(404).json({ message: "Address not found" });
		}

		const wasDefault = address.isDefault;
		address.deleteOne();

		if (wasDefault && user.addresses.length > 0) {
			user.addresses[0].isDefault = true;
		}

		await user.save();

		res.json({
			message: "Address deleted successfully",
			addresses: user.addresses,
		});
	} catch (error) {
		console.error("Error deleting address:", error);
		res.status(500).json({ message: "Error deleting address", error: error.message });
	}
};

export const setDefaultAddress = async (req, res) => {
	try {
		const { addressId } = req.params;

		const user = await User.findById(req.user._id);

		const address = user.addresses.id(addressId);
		if (!address) {
			return res.status(404).json({ message: "Address not found" });
		}

		user.addresses.forEach(addr => {
			addr.isDefault = false;
		});

		address.isDefault = true;

		await user.save();

		res.json({
			message: "Default address updated successfully",
			addresses: user.addresses,
		});
	} catch (error) {
		console.error("Error setting default address:", error);
		res.status(500).json({ message: "Error setting default address", error: error.message });
	}
};
