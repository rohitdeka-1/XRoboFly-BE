import cloudinary from "../lib/cloudinary.js";
import { Banner } from "../models/Banner.model.js";

// GET /banner  — public
export const getBanners = async (req, res) => {
    try {
        const filter = req.query.all === "true" ? {} : { isActive: true };
        const banners = await Banner.find(filter).sort({ order: 1, createdAt: 1 });
        res.status(200).json({ success: true, banners });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// POST /banner  — admin
export const createBanner = async (req, res) => {
    try {
        const { title, highlight, badge, description, image, link, order, isActive } = req.body;

        let imageUrl = null;
        if (image && image.startsWith("data:image")) {
            const result = await cloudinary.uploader.upload(image, {
                folder: "banners",
                transformation: [
                    { width: 1920, height: 800, crop: "fill" },
                    { quality: "auto" },
                    { fetch_format: "auto" },
                ],
            });
            imageUrl = result.secure_url;
        }

        const banner = await Banner.create({
            title,
            highlight: highlight || "",
            badge: badge || "",
            description: description || "",
            image: imageUrl,
            link: link || "/",
            order: order ?? 0,
            isActive: isActive !== undefined ? isActive : true,
        });

        res.status(201).json({ success: true, banner });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// PUT /banner/:id  — admin
export const updateBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: "Banner not found" });

        const { title, highlight, badge, description, image, link, order, isActive } = req.body;

        if (title !== undefined) banner.title = title;
        if (highlight !== undefined) banner.highlight = highlight;
        if (badge !== undefined) banner.badge = badge;
        if (description !== undefined) banner.description = description;
        if (link !== undefined) banner.link = link;
        if (order !== undefined) banner.order = order;
        if (isActive !== undefined) banner.isActive = isActive;

        // Handle image
        if (image && image.startsWith("data:image")) {
            // Delete old image
            if (banner.image) {
                const publicId = banner.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(`banners/${publicId}`);
            }
            const result = await cloudinary.uploader.upload(image, {
                folder: "banners",
                transformation: [
                    { width: 1920, height: 800, crop: "fill" },
                    { quality: "auto" },
                    { fetch_format: "auto" },
                ],
            });
            banner.image = result.secure_url;
        } else if ('image' in req.body && (image === null || image === '')) {
            if (banner.image) {
                const publicId = banner.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(`banners/${publicId}`);
            }
            banner.image = null;
        }

        const updated = await banner.save();
        res.status(200).json({ success: true, banner: updated });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// DELETE /banner/:id  — admin
export const deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: "Banner not found" });

        if (banner.image) {
            const publicId = banner.image.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(`banners/${publicId}`);
        }

        await Banner.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Banner deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
