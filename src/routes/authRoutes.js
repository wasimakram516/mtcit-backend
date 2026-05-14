const express = require("express");
const {
  registerAdmin,
  login,
  refreshToken,
  logout
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", login);
router.get("/refresh", refreshToken);
router.post("/logout", protect, logout);
module.exports = router;
