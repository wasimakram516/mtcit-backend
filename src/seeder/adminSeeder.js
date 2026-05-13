const mongoose = require("mongoose");
const User = require("../models/User");
const env = require("../config/env");

const seedAdmin = async () => {
  try {
    const adminEmail = "admin@wwds.com".toLowerCase();

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log("✅ Admin already exists:", existingAdmin.email);
    } else {
      const admin = new User({
        name: "Admin User",
        email: adminEmail,
        password: "Admin@WWDS#2025",
        role: "admin",
      });

      await admin.save();
      console.log("🚀 Admin user seeded successfully!");
    }
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
  }
};

// ✅ Ensure seedAdmin is properly exported as a function
module.exports = seedAdmin;
