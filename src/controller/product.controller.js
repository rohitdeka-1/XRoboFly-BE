import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import { Product } from "../models/Product.model.js";

export const getAllProducts = async (req, res) => {
	try {
		const { page = 1, limit = 20, category, subcategory, isAvailable, isFeatured } = req.query;
		
		const safeLimit = Math.min(parseInt(limit), 100);
		const safePage = Math.max(parseInt(page), 1);
		
		const query = {};
		if (category) query.category = category;
		if (subcategory) query.subcategory = subcategory;
		if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
		if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
		
		const products = await Product.find(query)
			.sort({ createdAt: -1 })
			.limit(safeLimit)
			.skip((safePage - 1) * safeLimit);
		
		const total = await Product.countDocuments(query);
		
		res.status(200).send({ 
			products,
			totalPages: Math.ceil(total / safeLimit),
			currentPage: safePage,
			total
		});
	} catch (error) {
		console.log("Error in getAllProducts controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const getProductById = async (req, res) => {
	try {
		const product = await Product.findById(req.params.id);
		
		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}
		
		res.status(200).json({ success: true, product });
	} catch (error) {
		console.log("Error in getProductById controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const searchProducts = async (req, res) => {
	try {
		const { 
			q, 
			category, 
			subcategory, 
			minPrice, 
			maxPrice, 
			inStock,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			page = 1,
			limit = 20
		} = req.query;
		
		const safeLimit = Math.min(parseInt(limit), 100);
		const safePage = Math.max(parseInt(page), 1);
		
		const query = { isAvailable: true };
		
		// Text search
		if (q) {
			query.$or = [
				{ name: { $regex: q, $options: 'i' } },
				{ description: { $regex: q, $options: 'i' } },
				{ brand: { $regex: q, $options: 'i' } },
				{ tags: { $in: [new RegExp(q, 'i')] } }
			];
		}
		
		// Category filters
		if (category) query.category = category;
		if (subcategory) query.subcategory = subcategory;
		
		// Price range
		if (minPrice || maxPrice) {
			query.price = {};
			if (minPrice) query.price.$gte = parseFloat(minPrice);
			if (maxPrice) query.price.$lte = parseFloat(maxPrice);
		}
		
		// Stock filter
		if (inStock === 'true') {
			query.stock = { $gt: 0 };
		}
		
		// Sort options
		const sortOptions = {};
		const validSortFields = ['price', 'createdAt', 'rating', 'soldCount', 'name'];
		if (validSortFields.includes(sortBy)) {
			sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
		} else {
			sortOptions.createdAt = -1;
		}
		
		const products = await Product.find(query)
			.sort(sortOptions)
			.limit(safeLimit)
			.skip((safePage - 1) * safeLimit);
		
		const total = await Product.countDocuments(query);
		
		res.status(200).json({
			success: true,
			products,
			totalPages: Math.ceil(total / safeLimit),
			currentPage: safePage,
			total,
			query: q || ''
		});
	} catch (error) {
		console.log("Error in searchProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getFeaturedProducts = async (req, res) => {
	try {
		let featuredProducts = await redis.get("featured_products");

		if (featuredProducts) {
			const parsed = JSON.parse(featuredProducts);
			// Only serve from cache if it's a non-empty array
			if (Array.isArray(parsed) && parsed.length > 0) {
				return res.json(parsed);
			}
			// Stale empty cache — fall through and re-fetch from DB
		}

		// fetch from mongodb
		featuredProducts = await Product.find({ isFeatured: true }).lean();

		// store in redis only if we have results (avoid caching empty array)
		if (featuredProducts && featuredProducts.length > 0) {
			await redis.set("featured_products", JSON.stringify(featuredProducts));
		}

		res.status(200).send(featuredProducts || []);
	} catch (error) {
		console.log("Error in getFeaturedProducts controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const createProduct = async (req, res) => {
	try {
		const { 
			name, description, price, originalPrice, coverImage, images, 
			category, subcategory, brand, stock, isAvailable, 
			specs, tags, rating, reviewCount, isFeatured
		} = req.body;

		let coverImageUrl = "";
		let additionalImagesUrls = [];

		// Upload cover image
		if (coverImage) {
			const cloudinaryResponse = await cloudinary.uploader.upload(coverImage, { 
				folder: "products",
				transformation: [
					{ width: 1000, height: 1000, crop: "limit" },
					{ quality: "auto" },
					{ fetch_format: "auto" }
				]
			});
			coverImageUrl = cloudinaryResponse.secure_url;
		}

		// Upload additional images (if provided)
		if (images && Array.isArray(images) && images.length > 0) {
			const uploadPromises = images.map(img => 
				cloudinary.uploader.upload(img, { 
					folder: "products",
					transformation: [
						{ width: 1000, height: 1000, crop: "limit" },
						{ quality: "auto" },
						{ fetch_format: "auto" }
					]
				})
			);
			
			const uploadResults = await Promise.all(uploadPromises);
			additionalImagesUrls = uploadResults.map(result => result.secure_url);
		}

		const product = await Product.create({
			name,
			description,
			price,
			originalPrice,
			coverImage: coverImageUrl,
			images: additionalImagesUrls,
			category,
			subcategory,
			brand,
			stock: stock || 0,
			isAvailable: isAvailable !== undefined ? isAvailable : true,
			specs: specs || {},
			tags: tags || [],
			rating: rating || 0,
			reviewCount: reviewCount || 0,
			isFeatured: isFeatured || false,
		});

		// If this product is featured, refresh the cache
		if (isFeatured) {
			await updateFeaturedProductsCache();
		}

		res.status(201).json({
			success: true,
			message: "Product created successfully",
			product
		});
	} catch (error) {
		console.log("Error in createProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const deleteProduct = async (req, res) => {
	try {
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		// Delete cover image from cloudinary
		if (product.coverImage) {
			const publicId = product.coverImage.split("/").pop().split(".")[0];
			try {
				await cloudinary.uploader.destroy(`products/${publicId}`);
				console.log("Deleted cover image from cloudinary");
			} catch (error) {
				console.log("Error deleting cover image from cloudinary", error);
			}
		}

		// Delete additional images from cloudinary
		if (product.images && product.images.length > 0) {
			const deletePromises = product.images.map(async (imageUrl) => {
				const publicId = imageUrl.split("/").pop().split(".")[0];
				try {
					await cloudinary.uploader.destroy(`products/${publicId}`);
					console.log(`Deleted additional image from cloudinary: ${publicId}`);
				} catch (error) {
					console.log(`Error deleting image ${publicId}:`, error);
				}
			});
			
			await Promise.all(deletePromises);
		}

		await Product.findByIdAndDelete(req.params.id);

		// Invalidate Redis featured products cache so deleted products don't persist
		if (product.isFeatured) {
			await redis.del("featured_products");
		}

		res.status(200).json({ 
			success: true,
			message: "Product and all images deleted successfully" 
		});
	} catch (error) {
		console.log("Error in deleteProduct controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const getRecommendedProducts = async (req, res) => {
	try {
		const products = await Product.aggregate([
			{
				$sample: { size: 4 },
			},
			{
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					coverImage: 1,
					price: 1,
				},
			},
		]);

		res.json(products);
	} catch (error) {
		console.log("Error in getRecommendedProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getProductsByCategory = async (req, res) => {
	const { category } = req.params;
	try {
		const products = await Product.find({ category });
		res.status(200).send({ products });
	} catch (error) {
		console.log("Error in getProductsByCategory controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const getProductsBySubcategory = async (req, res) => {
	const { subcategory } = req.params;
	try {
		const products = await Product.find({ subcategory });
		res.status(200).send({ products });
	} catch (error) {
		console.log("Error in getProductsBySubcategory controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const getProductsByCategoryAndSubcategory = async (req, res) => {
	const { category, subcategory } = req.params;
	try {
		const query = { category };
		if (subcategory && subcategory !== 'all') {
			query.subcategory = subcategory;
		}
		const products = await Product.find(query);
		res.status(200).send({ products });
	} catch (error) {
		console.log("Error in getProductsByCategoryAndSubcategory controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const getAllCategories = async (req, res) => {
	try {
		const categories = [
			{
				id: 'fpv-gears',
				name: 'FPV Gears',
				description: 'Professional FPV drone components',
				icon: '🚁',
				subcategories: [
					{ id: 'frames', name: 'Frames' },
					{ id: 'motors', name: 'Motors' },
					{ id: 'esc', name: 'ESC' },
					{ id: 'flight-controllers', name: 'Flight Controllers' },
					{ id: 'stack', name: 'Stack' },
					{ id: 'propellers', name: 'Propellers' },
					{ id: 'batteries', name: 'Batteries & Chargers' },
					{ id: 'gps', name: 'GPS' },
					{ id: 'fpv-cameras', name: 'FPV Cameras' },
					{ id: 'antennas', name: 'Antennas & Receivers' },
					{ id: 'goggles', name: 'Goggles' },
					{ id: 'rc-controllers', name: 'RC Controllers' },
				],
			},
			{
				id: 'electronics',
				name: 'Electronics & Components',
				description: 'Electronic components and boards',
				icon: '⚡',
				subcategories: [
					{ id: 'microcontrollers', name: 'Microcontrollers' },
					{ id: 'sbc', name: 'Single Board Computers' },
					{ id: 'sensors', name: 'Sensors' },
					{ id: 'displays', name: 'Displays' },
					{ id: 'relays', name: 'Relays & Switches' },
				],
			},
		];
		
		// Get product counts for each category/subcategory
		for (const category of categories) {
			const categoryCount = await Product.countDocuments({ category: category.id });
			category.count = categoryCount;
			
			for (const subcategory of category.subcategories) {
				const subCount = await Product.countDocuments({ 
					category: category.id, 
					subcategory: subcategory.id 
				});
				subcategory.count = subCount;
			}
		}
		
		res.status(200).send({ categories });
	} catch (error) {
		console.log("Error in getAllCategories controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

export const toggleFeaturedProduct = async (req, res) => {
	try {
		const product = await Product.findById(req.params.id);
		if (product) {
			product.isFeatured = !product.isFeatured;
			const updatedProduct = await product.save();
			await updateFeaturedProductsCache();
			res.status(200).send(updatedProduct);
		} else {
			res.status(404).send({ message: "Product not found" });
		}
	} catch (error) {
		console.log("Error in toggleFeaturedProduct controller", error.message);
		res.status(500).send({ message: "Server error", error: error.message });
	}
};

// Update product details
export const updateProduct = async (req, res) => {
	try {
		const { name, description, price, category, isAvailable } = req.body;
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		// Update basic fields
		if (name) product.name = name;
		if (description) product.description = description;
		if (price !== undefined) product.price = price;
		if (req.body.originalPrice !== undefined) product.originalPrice = req.body.originalPrice;
		if (category) product.category = category;
		if (req.body.subcategory) product.subcategory = req.body.subcategory;
		if (req.body.brand) product.brand = req.body.brand;
		if (isAvailable !== undefined) product.isAvailable = isAvailable;
		if (req.body.specs) product.specs = req.body.specs;
		if (req.body.tags) product.tags = req.body.tags;
		if (req.body.rating !== undefined) product.rating = req.body.rating;
		if (req.body.reviewCount !== undefined) product.reviewCount = req.body.reviewCount;
		if (req.body.stock !== undefined) product.stock = req.body.stock;
		const featuredChanged = req.body.isFeatured !== undefined && req.body.isFeatured !== product.isFeatured;
		if (req.body.isFeatured !== undefined) product.isFeatured = req.body.isFeatured;

		const updatedProduct = await product.save();

		// Invalidate Redis cache if this product is featured (any field update affects the cache)
		// OR if the isFeatured flag itself changed
		if (product.isFeatured || featuredChanged) {
			await redis.del("featured_products");
		}

		res.status(200).json({
			success: true,
			message: "Product updated successfully",
			product: updatedProduct
		});
	} catch (error) {
		console.log("Error in updateProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

 
export const updateStock = async (req, res) => {
	try {
		const { stock, operation } = req.body; // operation: 'set', 'add', 'subtract'
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		if (stock === undefined || stock < 0) {
			return res.status(400).json({ message: "Invalid stock value" });
		}

		switch (operation) {
			case 'set':
				product.stock = stock;
				if (stock > 0) product.isAvailable = true;
				break;
			case 'add':
				await product.increaseStock(stock);
				break;
			case 'subtract':
				await product.decreaseStock(stock);
				break;
			default:
				product.stock = stock;
				if (stock > 0) product.isAvailable = true;
		}

		if (operation !== 'add' && operation !== 'subtract') {
			await product.save();
		}

		res.status(200).json({
			success: true,
			message: "Stock updated successfully",
			product: {
				_id: product._id,
				name: product.name,
				stock: product.stock,
				isAvailable: product.isAvailable,
				soldCount: product.soldCount
			}
		});
	} catch (error) {
		console.log("Error in updateStock controller", error.message);
		res.status(500).json({ message: error.message || "Server error" });
	}
};

 
export const addProductImages = async (req, res) => {
	try {
		const { images } = req.body;  
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		if (!images || !Array.isArray(images) || images.length === 0) {
			return res.status(400).json({ message: "No images provided" });
		}

 		const totalImages = product.images.length + images.length;
		if (totalImages > 10) {
			return res.status(400).json({ 
				message: `Cannot add ${images.length} images. Maximum 10 images allowed. Current: ${product.images.length}` 
			});
		}

 		const uploadPromises = images.map(img => 
			cloudinary.uploader.upload(img, { 
				folder: "products",
				transformation: [
					{ width: 1000, height: 1000, crop: "limit" },
					{ quality: "auto" },
					{ fetch_format: "auto" }
				]
			})
		);

		const uploadResults = await Promise.all(uploadPromises);
		const newImageUrls = uploadResults.map(result => result.secure_url);

 		product.images.push(...newImageUrls);
		await product.save();

		res.status(200).json({
			success: true,
			message: `${newImageUrls.length} image(s) added successfully`,
			product: product
		});
	} catch (error) {
		console.log("Error in addProductImages controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

 export const removeProductImage = async (req, res) => {
	try {
		const { imageUrl } = req.body;
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		if (!imageUrl) {
			return res.status(400).json({ message: "Image URL is required" });
		}

 		const imageIndex = product.images.indexOf(imageUrl);
		if (imageIndex === -1) {
			return res.status(404).json({ message: "Image not found in product" });
		}

 		const publicId = imageUrl.split("/").pop().split(".")[0];
		try {
			await cloudinary.uploader.destroy(`products/${publicId}`);
			console.log(`Deleted image from cloudinary: ${publicId}`);
		} catch (error) {
			console.log("Error deleting image from cloudinary:", error);
		}

 		product.images.splice(imageIndex, 1);
		await product.save();

		res.status(200).json({
			success: true,
			message: "Image removed successfully",
			product: product
		});
	} catch (error) {
		console.log("Error in removeProductImage controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

 export const updateCoverImage = async (req, res) => {
	try {
		const { coverImage } = req.body; // base64 image
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		if (!coverImage) {
			return res.status(400).json({ message: "Cover image is required" });
		}

 		if (product.coverImage) {
			const oldPublicId = product.coverImage.split("/").pop().split(".")[0];
			try {
				await cloudinary.uploader.destroy(`products/${oldPublicId}`);
				console.log("Deleted old cover image from cloudinary");
			} catch (error) {
				console.log("Error deleting old cover image:", error);
			}
		}

 		const cloudinaryResponse = await cloudinary.uploader.upload(coverImage, { 
			folder: "products",
			transformation: [
				{ width: 1000, height: 1000, crop: "limit" },
				{ quality: "auto" },
				{ fetch_format: "auto" }
			]
		});

		product.coverImage = cloudinaryResponse.secure_url;
		await product.save();

		res.status(200).json({
			success: true,
			message: "Cover image updated successfully",
			product: product
		});
	} catch (error) {
		console.log("Error in updateCoverImage controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const bulkUpdateStock = async (req, res) => {
	try {
		const { updates } = req.body; // Array of { productId, stock, operation }
		
		if (!Array.isArray(updates) || updates.length === 0) {
			return res.status(400).json({ message: "Updates array is required" });
		}
		
		const results = [];
		
		for (const update of updates) {
			const { productId, stock, operation = 'set' } = update;
			
			try {
				const product = await Product.findById(productId);
				
				if (!product) {
					results.push({
						productId,
						success: false,
						error: "Product not found"
					});
					continue;
				}
				
				switch (operation) {
					case 'set':
						product.stock = stock;
						if (stock > 0) product.isAvailable = true;
						else product.isAvailable = false;
						break;
					case 'add':
						product.stock += stock;
						if (product.stock > 0) product.isAvailable = true;
						break;
					case 'subtract':
						product.stock = Math.max(0, product.stock - stock);
						if (product.stock === 0) product.isAvailable = false;
						break;
					default:
						product.stock = stock;
				}
				
				await product.save();
				
				results.push({
					productId,
					success: true,
					newStock: product.stock,
					isAvailable: product.isAvailable
				});
			} catch (error) {
				results.push({
					productId,
					success: false,
					error: error.message
				});
			}
		}
		
		res.status(200).json({
			success: true,
			message: "Bulk stock update completed",
			results
		});
	} catch (error) {
		console.log("Error in bulkUpdateStock controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

async function updateFeaturedProductsCache() {
	try {
		// The lean() method  is used to return plain JavaScript objects instead of full Mongoose documents. This can significantly improve performance

		const featuredProducts = await Product.find({ isFeatured: true }).lean();
		await redis.set("featured_products", JSON.stringify(featuredProducts));
	} catch (error) {
		console.log("error in update cache function");
	}
}
