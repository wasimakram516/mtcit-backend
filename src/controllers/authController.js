const User = require("../models/User");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const response = require("../utils/response");
const asyncHandler = require("../middlewares/asyncHandler");

// Generate Access & Refresh Tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign({ id: user._id, role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.accessExpiry,
  });

  const refreshToken = jwt.sign({ id: user._id }, env.jwt.secret, {
    expiresIn: env.jwt.refreshExpiry,
  });

  return { accessToken, refreshToken };
};

// ✅ Register Admin
exports.registerAdmin = asyncHandler(async (req, res) => {
  if (!req.body || !req.body.email || !req.body.password || !req.body.name) {
    return response(res, 400, "All fields are required");
  }

  const { name, email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return response(res, 400, "User already exists");
  }

  const user = new User({ name, email, password, role: "admin" });
  await user.save();

  return response(res, 201, "Admin registered successfully", { user });
});

// ✅ Login & Set Refresh Token in Cookie
exports.login = asyncHandler(async (req, res) => {
  if (!req.body || !req.body.email || !req.body.password) {
    return response(res, 400, "Email and password are required");
  }

  const email = req.body.email.toLowerCase();
  const password = req.body.password;

  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    return response(res, 401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user);

  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.node_env === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // ✅ Exclude sensitive fields like password
  const userSafe = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return response(res, 200, "Login successful", { accessToken, user: userSafe });
});

// ✅ Refresh Token
exports.refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return response(res, 401, "No refresh token provided");
  }

  jwt.verify(refreshToken, env.jwt.secret, (err, decoded) => {
    if (err) return response(res, 403, "Invalid refresh token");

    const newAccessToken = jwt.sign({ id: decoded.id }, env.jwt.secret, {
      expiresIn: env.jwt.accessExpiry,
    });

    return response(res, 200, "Token refreshed", { accessToken: newAccessToken });
  });
});

// ✅ Logout User (Clears Refresh Token Cookie)
exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "Strict" });

  return response(res, 200, "Logged out successfully");
});
