const express = require("express");
const {
  registerAdmin,
  login,
  refreshToken,
  logout
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", login);
router.get("/refresh", refreshToken);
router.post("/logout", protect, adminOnly, logout);
module.exports = router;
