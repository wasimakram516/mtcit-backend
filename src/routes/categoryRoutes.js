const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require("../middlewares/uploadMiddleware");

router.get('/', categoryController.listCategories);
router.post('/', upload.single("icon"), categoryController.createCategory);
router.put('/:id', upload.single("icon"), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
