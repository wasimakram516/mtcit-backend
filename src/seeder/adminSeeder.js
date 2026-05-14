const mongoose = require("mongoose");
const User = require("../models/User");
const env = require("../config/env");

const seedAdmin = async () => {
  try {
    const adminEmail = "admin@wwds.com";
    const adminPassword = "admin";

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      existingAdmin.name = "Admin User";
      existingAdmin.email = adminEmail;
      existingAdmin.password = adminPassword;
      existingAdmin.role = "admin";
      await existingAdmin.save();
      console.log("Admin credentials refreshed:", existingAdmin.email);
    } else {
      const admin = new User({
        name: "Admin User",
        email: adminEmail,
        password: adminPassword,
        role: "admin",
      });

      await admin.save();
      console.log("🚀 Admin user seeded successfully!");
    }
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
  }
};

// Ensure seedAdmin is properly exported as a function
module.exports = seedAdmin;
