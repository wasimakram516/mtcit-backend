const jwt = require("jsonwebtoken");
const env = require("../config/env");
const response= require("../utils/response");

// Protect Route - BYPASSED (Allow all access)
exports.protect = (req, res, next) => {
  // Set a mock user so subsequent controllers don't crash if they expect user data
  req.user = { 
    id: "public-access-id", 
    role: "admin",
    username: "public_admin"
  };
  next();
};

// Admin-Only Access Middleware - BYPASSED
exports.adminOnly = (req, res, next) => {
  next();
};
