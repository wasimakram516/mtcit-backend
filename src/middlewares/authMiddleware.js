const jwt = require("jsonwebtoken");
const env = require("../config/env");
const response= require("../utils/response");

// ✅ Protect Route (Ensure the user is authenticated)
exports.protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return errorResponse(res, 401, "Unauthorized - No token provided");
    }

    // ✅ Verify token
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    
    next();
  } catch (error) {
    return response(res, 401, "Unauthorized - Invalid token", null, error.message);
  }
};

// ✅ Admin-Only Access Middleware
exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return errorResponse(res, 403, "Forbidden - Admins only");
  }
  
  next();
};
