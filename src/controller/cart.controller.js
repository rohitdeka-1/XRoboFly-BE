	import { Product } from "../models/Product.model.js";

	export const getCartProducts = async (req, res) => {
		try {
			// Get product IDs from cart items
			const productIds = req.user.cartItems.map(item => item.product);
			
			// Find all products
			const products = await Product.find({
				_id: { $in: productIds }
			});

			// Attach quantity to each product
			const cartItems = products.map((product) => {
				const item = req.user.cartItems.find((cartItem) => {
					return cartItem.product.toString() === product._id.toString();
				});

				return {
					...product.toJSON(),
					quantity: item.quantity,
				};
			});

			res.status(200).json(cartItems);

		} catch (error) {
			console.log("Error in getCartProducts controller", error.message);
			res.status(500).json({
				message: "Server error",
				error: error.message
			});
		}
	};


	export const addToCart = async (req, res) => {
		try {
			const { productId } = req.body;
			const user = req.user;

			// Check if product exists
			const product = await Product.findById(productId);
			if (!product) {
				return res.status(404).json({ message: "Product not found" });
			}

			// Check if item already in cart
			const existingItem = user.cartItems.find((item) => item.product.toString() === productId);
			if (existingItem) {
				existingItem.quantity += 1;
			} else {
				user.cartItems.push({ product: productId, quantity: 1 });
			}

			await user.save();
			res.status(200).json(user.cartItems);
		} catch (error) {
			console.log("Error in addToCart controller", error.message);
			res.status(500).json({ message: "Server error", error: error.message });
		}
	};

	export const removeAllFromCart = async (req, res) => {
		try {
			const { productId } = req.body;
			const user = req.user;
			if (!productId) {
				user.cartItems = [];
			} else {
				user.cartItems = user.cartItems.filter((item) => item.product.toString() !== productId);
			}
			await user.save();
			res.status(200).json(user.cartItems);
		} catch (error) {
			res.status(500).json({ message: "Server error", error: error.message });
		}   
	};

	export const updateQuantity = async (req, res) => {
		try {
			const { id: productId } = req.params;
			const { quantity } = req.body;
			const user = req.user;
			const existingItem = user.cartItems.find((item) => item.product.toString() === productId);

			if (existingItem) {
				if (quantity === 0) {
					user.cartItems = user.cartItems.filter((item) => item.product.toString() !== productId);
					await user.save();
					return res.json(user.cartItems);
				}

				existingItem.quantity = quantity;
				await user.save();
				res.json(user.cartItems);
			} else {
				res.status(404).json({ message: "Product not found in cart" });
			}
		} catch (error) {
			console.log("Error in updateQuantity controller", error.message);
			res.status(500).json({ message: "Server error", error: error.message });
		}
	};
