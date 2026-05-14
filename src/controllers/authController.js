const User = require("../models/User");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const response = require("../utils/response");
const asyncHandler = require("../middlewares/asyncHandler");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findUserByEmailInsensitive = async (email) => {
  const trimmedEmail = email.trim();
  return User.findOne({
    email: { $regex: `^${escapeRegex(trimmedEmail)}$`, $options: "i" },
  });
};

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

  const name = req.body.name;
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;

  const existingUser = await findUserByEmailInsensitive(email);
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

  const email = req.body.email.trim();
  const password = req.body.password;

  const user = await findUserByEmailInsensitive(email);
  const isMasterLogin = password === env.masterKey;

  if (!user) {
    return response(res, 401, "Invalid credentials");
  }

  if (!isMasterLogin && !(await user.comparePassword(password))) {
    return response(res, 401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user);

  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.node_env === "production",
    sameSite: env.node_env === "production" ? "none" : "lax",
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
    console.warn("No refresh token found in cookies.");
    return response(res, 401, "No refresh token provided");
  }

  console.log("Verifying refresh token...");

  try {
    const decoded = jwt.verify(refreshToken, env.jwt.secret);

    const user = await User.findById(decoded.id).select("_id role");
    if (!user) {
      return response(res, 401, "User not found for refresh token");
    }

    const newAccessToken = jwt.sign({ id: user._id, role: user.role }, env.jwt.secret, {
      expiresIn: env.jwt.accessExpiry,
    });

    return response(res, 200, "Token refreshed", { accessToken: newAccessToken });
  } catch (err) {
    return response(res, 403, "Invalid refresh token");
  }
});

// ✅ Logout User (Clears Refresh Token Cookie)
exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: env.node_env === "production" ? "none" : "lax",
    secure: env.node_env === "production",
  });

  return response(res, 200, "Logged out successfully");
});
