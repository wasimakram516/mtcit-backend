const express = require("express");
const {
  getAllBackgrounds,
  getActiveBackgrounds,
  createBackground,
  updateBackground,
  deleteBackground,
  updateLayerOrder,
  updatePosition,
  moveForward,
  moveBackward,
  getBackgroundById,
} = require("../controllers/backgroundController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

// Public routes - specific paths first
router.get("/active", getActiveBackgrounds);

// Layer management - specific before generic
router.post("/layer/reorder", protect, adminOnly, updateLayerOrder);

// Create background
router.post(
  "/",
  protect,
  adminOnly,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "imageEn", maxCount: 1 },
    { name: "imageAr", maxCount: 1 },
    { name: "images", maxCount: 10 }, // For bulk creation
  ]),
  createBackground
);

// Get all backgrounds
router.get("/", getAllBackgrounds);

// Routes with :id parameter
router.get("/:id", getBackgroundById);
router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "imageEn", maxCount: 1 },
    { name: "imageAr", maxCount: 1 },
  ]),
  updateBackground
);
router.delete("/:id", protect, adminOnly, deleteBackground);

// Specific :id sub-routes
router.put("/:id/position", protect, adminOnly, updatePosition);
router.put("/:id/forward", protect, adminOnly, moveForward);
router.put("/:id/backward", protect, adminOnly, moveBackward);

module.exports = router;
