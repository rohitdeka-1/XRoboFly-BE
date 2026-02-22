import { Product } from "../models/Product.model.js";
import { connectDb } from "../database/db.js";
import dotenv from "dotenv";

dotenv.config();

const products = [
	// FPV Frames
	{
		name: "XRF-5 Carbon Fiber Frame",
		description: "Ultra-lightweight 5-inch carbon fiber frame designed for freestyle and racing. Features 3K carbon construction with reinforced arms.",
		price: 4999,
		originalPrice: 5999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "frames",
		brand: "XroboFly",
		stock: 50,
		isFeatured: true,
		isAvailable: true,
		rating: 4.8,
		reviewCount: 124,
		specs: {
			"Wheelbase": "220mm",
			"Weight": "98g",
			"Material": "3K Carbon Fiber",
			"Arm Thickness": "5mm",
			"Motor Mount": "16x16mm / 19x19mm"
		},
		tags: ["freestyle", "racing", "lightweight"]
	},
	{
		name: "Apex Pro 7\" Long Range",
		description: "Purpose-built long-range frame with integrated GPS mount and efficient aerodynamic design.",
		price: 6499,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "frames",
		brand: "Apex",
		stock: 30,
		isFeatured: true,
		isAvailable: true,
		rating: 4.9,
		reviewCount: 87,
		specs: {
			"Wheelbase": "295mm",
			"Weight": "145g",
			"Material": "T700 Carbon",
			"Arm Thickness": "6mm"
		},
		tags: ["long-range", "gps", "efficient"]
	},
	// Motors
	{
		name: "XRM-2207 2750KV Motor",
		description: "High-performance brushless motor optimized for 5-inch propellers. Featuring N52H magnets and titanium shaft.",
		price: 1899,
		originalPrice: 2299,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "motors",
		brand: "XroboFly",
		stock: 100,
		isFeatured: true,
		isAvailable: true,
		rating: 4.7,
		reviewCount: 256,
		specs: {
			"KV Rating": "2750KV",
			"Stator Size": "22x07mm",
			"Weight": "32.5g",
			"Max Power": "680W",
			"Shaft": "5mm Titanium"
		},
		tags: ["high-performance", "5-inch", "racing"]
	},
	{
		name: "ThrustX 2806.5 1300KV",
		description: "Efficiency-focused motor for long-range builds. Lower KV for larger props and better flight times.",
		price: 2499,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "motors",
		brand: "ThrustX",
		stock: 75,
		isFeatured: false,
		isAvailable: true,
		rating: 4.8,
		reviewCount: 143,
		specs: {
			"KV Rating": "1300KV",
			"Stator Size": "28x06.5mm",
			"Weight": "42g",
			"Max Power": "520W"
		},
		tags: ["long-range", "efficient", "7-inch"]
	},
	// ESC
	{
		name: "BlitzESC 55A 4-in-1",
		description: "Premium 4-in-1 ESC with BLHeli_32 firmware. Features current sensing and RGB LED support.",
		price: 5499,
		originalPrice: 6299,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "esc",
		brand: "XroboFly",
		stock: 45,
		isFeatured: true,
		isAvailable: true,
		rating: 4.9,
		reviewCount: 198,
		specs: {
			"Current Rating": "55A Continuous",
			"Burst Current": "65A",
			"Firmware": "BLHeli_32",
			"Input Voltage": "3-6S LiPo",
			"Size": "30.5x30.5mm"
		},
		tags: ["4-in-1", "high-current", "blheli32"]
	},
	// Flight Controllers
	{
		name: "NeuroFC F7 Flight Controller",
		description: "Advanced F7 flight controller with Betaflight support. Includes barometer and blackbox logging.",
		price: 4299,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "flight-controllers",
		brand: "XroboFly",
		stock: 60,
		isFeatured: true,
		isAvailable: true,
		rating: 4.8,
		reviewCount: 167,
		specs: {
			"Processor": "STM32F722",
			"Gyro": "BMI270",
			"OSD": "AT7456E",
			"Mounting": "30.5x30.5mm",
			"UART": "6x"
		},
		tags: ["f7", "betaflight", "osd"]
	},
	// Stack
	{
		name: "ProStack F7 55A Combo",
		description: "Complete FC + ESC stack solution. Perfect matching of components for optimal performance.",
		price: 8999,
		originalPrice: 10499,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "stack",
		brand: "XroboFly",
		stock: 25,
		isFeatured: true,
		isAvailable: true,
		rating: 4.9,
		reviewCount: 89,
		specs: {
			"FC Processor": "STM32F722",
			"ESC Current": "55A",
			"Stack Height": "8mm",
			"Weight": "28g"
		},
		tags: ["stack", "combo", "value"]
	},
	// Batteries
	{
		name: "PowerCell 6S 1300mAh 120C",
		description: "Competition-grade LiPo battery with extreme discharge rate for maximum power.",
		price: 3999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "batteries",
		brand: "PowerCell",
		stock: 80,
		isFeatured: true,
		isAvailable: true,
		rating: 4.7,
		reviewCount: 312,
		specs: {
			"Capacity": "1300mAh",
			"Voltage": "6S (22.2V)",
			"Discharge Rate": "120C",
			"Weight": "198g"
		},
		tags: ["6s", "high-c", "racing"]
	},
	// Goggles
	{
		name: "VisionX Pro OLED Goggles",
		description: "Premium FPV goggles with dual OLED displays and integrated DVR. Features adjustable IPD and focus.",
		price: 32999,
		originalPrice: 37999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "goggles",
		brand: "VisionX",
		stock: 20,
		isFeatured: true,
		isAvailable: true,
		rating: 4.9,
		reviewCount: 76,
		specs: {
			"Display": "Dual 1280x960 OLED",
			"FOV": "46°",
			"DVR": "1080p 60fps",
			"Receiver": "5.8GHz 48CH",
			"IPD": "56-72mm"
		},
		tags: ["oled", "dvr", "premium"]
	},
	// RC Controllers
	{
		name: "CommanderX Pro Radio",
		description: "Professional-grade radio transmitter with hall-effect gimbals and ELRS support.",
		price: 18999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "rc-controllers",
		brand: "CommanderX",
		stock: 35,
		isFeatured: true,
		isAvailable: true,
		rating: 4.8,
		reviewCount: 134,
		specs: {
			"Protocol": "ELRS / Multi-protocol",
			"Channels": "16CH",
			"Gimbals": "Hall Effect",
			"Display": "4.3\" Color LCD",
			"Battery": "5000mAh Li-ion"
		},
		tags: ["elrs", "hall-gimbals", "multi-protocol"]
	},
	// Propellers
	{
		name: "RaceBlade 5145 Tri-blade",
		description: "High-performance tri-blade propellers optimized for racing. Ultra-durable PC material.",
		price: 399,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "propellers",
		brand: "XroboFly",
		stock: 200,
		isFeatured: false,
		isAvailable: true,
		rating: 4.6,
		reviewCount: 534,
		specs: {
			"Size": "5.1x4.5 inch",
			"Blades": "3",
			"Material": "Polycarbonate",
			"Weight": "4.2g each"
		},
		tags: ["5-inch", "tri-blade", "racing"]
	},
	// GPS
	{
		name: "NavStar M10 GPS Module",
		description: "High-precision GPS module with GLONASS and Galileo support.",
		price: 1999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "gps",
		brand: "NavStar",
		stock: 40,
		isFeatured: false,
		isAvailable: true,
		rating: 4.7,
		reviewCount: 189,
		specs: {
			"Constellations": "GPS/GLONASS/Galileo/BeiDou",
			"Accuracy": "1.5m CEP",
			"Update Rate": "10Hz",
			"Size": "25x25mm"
		},
		tags: ["gps", "multi-constellation", "high-precision"]
	},
	// FPV Cameras
	{
		name: "HawkEye Nano 2 Camera",
		description: "Ultra low-latency FPV camera with excellent low-light performance.",
		price: 2999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "fpv-cameras",
		brand: "HawkEye",
		stock: 55,
		isFeatured: false,
		isAvailable: true,
		rating: 4.7,
		reviewCount: 223,
		specs: {
			"Sensor": "1/1.8\" CMOS",
			"Resolution": "1200TVL",
			"Latency": "6ms",
			"FOV": "160°",
			"Size": "19x19mm"
		},
		tags: ["low-latency", "nano", "wide-fov"]
	},
	// Antennas
	{
		name: "PolarX RHCP Antenna Set",
		description: "Premium circular polarized antenna set for maximum range and signal clarity.",
		price: 1299,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "fpv-gears",
		subcategory: "antennas",
		brand: "PolarX",
		stock: 70,
		isFeatured: false,
		isAvailable: true,
		rating: 4.8,
		reviewCount: 276,
		specs: {
			"Polarization": "RHCP",
			"Gain": "5.8dBi",
			"Frequency": "5.8GHz",
			"Connector": "SMA"
		},
		tags: ["rhcp", "5.8ghz", "long-range"]
	},
	// Microcontrollers
	{
		name: "ESP32-S3 DevKit",
		description: "Powerful dual-core microcontroller with WiFi and Bluetooth. Perfect for IoT and robotics.",
		price: 899,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "electronics",
		subcategory: "microcontrollers",
		brand: "Espressif",
		stock: 150,
		isFeatured: true,
		isAvailable: true,
		rating: 4.8,
		reviewCount: 456,
		specs: {
			"Core": "Dual Xtensa LX7",
			"Clock": "240MHz",
			"RAM": "512KB SRAM",
			"Flash": "8MB",
			"GPIO": "45 pins"
		},
		tags: ["wifi", "bluetooth", "iot"]
	},
	{
		name: "STM32F4 Discovery Board",
		description: "ARM Cortex-M4 development board with DSP and FPU capabilities.",
		price: 1499,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "electronics",
		subcategory: "microcontrollers",
		brand: "STMicroelectronics",
		stock: 90,
		isFeatured: false,
		isAvailable: true,
		rating: 4.7,
		reviewCount: 289,
		specs: {
			"Core": "ARM Cortex-M4",
			"Clock": "168MHz",
			"Flash": "1MB",
			"RAM": "192KB"
		},
		tags: ["arm", "dsp", "development"]
	},
	// Sensors
	{
		name: "LiDAR TF-Luna 8m",
		description: "Compact Time-of-Flight LiDAR sensor for precise distance measurement.",
		price: 2499,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "electronics",
		subcategory: "sensors",
		brand: "Benewake",
		stock: 65,
		isFeatured: true,
		isAvailable: true,
		rating: 4.6,
		reviewCount: 167,
		specs: {
			"Range": "0.2-8m",
			"Accuracy": "±2cm",
			"Frame Rate": "250Hz",
			"Interface": "UART/I2C"
		},
		tags: ["lidar", "tof", "ranging"]
	},
	// Single Board Computers
	{
		name: "Raspberry Pi 5 8GB",
		description: "Latest generation SBC with significant performance improvements.",
		price: 7999,
		coverImage: "/placeholder.svg",
		images: ["/placeholder.svg"],
		category: "electronics",
		subcategory: "sbc",
		brand: "Raspberry Pi",
		stock: 50,
		isFeatured: true,
		isAvailable: true,
		rating: 4.9,
		reviewCount: 342,
		specs: {
			"CPU": "Quad Cortex-A76 @ 2.4GHz",
			"RAM": "8GB LPDDR4X",
			"Video": "Dual 4K HDMI",
			"Storage": "MicroSD / NVMe"
		},
		tags: ["raspberry-pi", "sbc", "linux"]
	}
];

const seedProducts = async () => {
	try {
		await connectDb();
		
		// Clear existing products
		await Product.deleteMany({});
		console.log("Cleared existing products");

		// Insert new products
		const createdProducts = await Product.insertMany(products);
		console.log("\n✅ Products seeded successfully:");
		console.log(`   Total: ${createdProducts.length} products`);
		
		// Group by category
		const fpvGears = createdProducts.filter(p => p.category === 'fpv-gears');
		const electronics = createdProducts.filter(p => p.category === 'electronics');
		
		console.log(`\n📦 FPV Gears: ${fpvGears.length} products`);
		console.log(`⚡ Electronics: ${electronics.length} products`);
		
		console.log("\n🌟 Featured products:");
		createdProducts.filter(p => p.isFeatured).forEach(p => {
			console.log(`   - ${p.name} (${p.category}/${p.subcategory})`);
		});

		process.exit(0);
	} catch (error) {
		console.error("❌ Error seeding products:", error);
		process.exit(1);
	}
};

seedProducts();
