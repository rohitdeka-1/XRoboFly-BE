import mongoose from "mongoose";
import { Category } from "../models/Category.model.js";
import envConfig from "../config/env.config.js";

const seedCategories = async () => {
    try {
        await mongoose.connect(envConfig.MONGO_URI);
        console.log("Connected to MongoDB");

        // Clear existing categories
        await Category.deleteMany({});
        console.log("Cleared existing categories");

        // Seed categories
        const categories = [
            {
                id: 'fpv-gears',
                name: 'FPV Gears',
                description: 'Professional FPV drone components and accessories',
                icon: '🚁',
                order: 1,
                isActive: true,
                subcategories: [
                    { id: 'frames', name: 'Frames', description: 'Drone frames for all sizes', order: 1, isActive: true },
                    { id: 'motors', name: 'Motors', description: 'Brushless motors', order: 2, isActive: true },
                    { id: 'esc', name: 'ESC', description: 'Electronic Speed Controllers', order: 3, isActive: true },
                    { id: 'flight-controllers', name: 'Flight Controllers', description: 'FC boards and stacks', order: 4, isActive: true },
                    { id: 'stack', name: 'Stack', description: 'FC and ESC stacks', order: 5, isActive: true },
                    { id: 'propellers', name: 'Propellers', description: 'Props for all drone sizes', order: 6, isActive: true },
                    { id: 'batteries', name: 'Batteries & Chargers', description: 'LiPo batteries and chargers', order: 7, isActive: true },
                    { id: 'gps', name: 'GPS', description: 'GPS modules for drones', order: 8, isActive: true },
                    { id: 'fpv-cameras', name: 'FPV Cameras', description: 'Analog and digital cameras', order: 9, isActive: true },
                    { id: 'antennas', name: 'Antennas & Receivers', description: 'Video receivers and antennas', order: 10, isActive: true },
                    { id: 'goggles', name: 'Goggles', description: 'FPV goggles and headsets', order: 11, isActive: true },
                    { id: 'rc-controllers', name: 'RC Controllers', description: 'Radio controllers and transmitters', order: 12, isActive: true },
                ],
            },
            {
                id: 'electronics',
                name: 'Electronics & Components',
                description: 'Electronic components, microcontrollers, and development boards',
                icon: '⚡',
                order: 2,
                isActive: true,
                subcategories: [
                    { id: 'microcontrollers', name: 'Microcontrollers', description: 'Arduino, ESP32, STM32 boards', order: 1, isActive: true },
                    { id: 'sbc', name: 'Single Board Computers', description: 'Raspberry Pi and similar boards', order: 2, isActive: true },
                    { id: 'sensors', name: 'Sensors', description: 'Various sensors and modules', order: 3, isActive: true },
                    { id: 'displays', name: 'Displays', description: 'LCD, OLED, and LED displays', order: 4, isActive: true },
                    { id: 'relays', name: 'Relays & Switches', description: 'Relays and electronic switches', order: 5, isActive: true },
                ],
            },
        ];

        await Category.insertMany(categories);
        console.log("✅ Categories seeded successfully!");
        
        // Display seeded categories
        const seededCategories = await Category.find();
        console.log(`\nSeeded ${seededCategories.length} categories:`);
        seededCategories.forEach(cat => {
            console.log(`  - ${cat.name} (${cat.id}) with ${cat.subcategories.length} subcategories`);
        });

        process.exit(0);
    } catch (error) {
        console.error("Error seeding categories:", error);
        process.exit(1);
    }
};

seedCategories();
