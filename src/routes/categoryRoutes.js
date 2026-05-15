const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require("../middlewares/uploadMiddleware");

router.get('/', categoryController.listCategories);
router.post(
  '/',
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "mapQr", maxCount: 1 },
  ]),
  categoryController.createCategory
);
router.put(
  '/:id',
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "mapQr", maxCount: 1 },
  ]),
  categoryController.updateCategory
);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
