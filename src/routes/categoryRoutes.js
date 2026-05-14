const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', categoryController.listCategories);
router.post('/', protect, adminOnly, categoryController.createCategory);
router.put('/:id', protect, adminOnly, categoryController.updateCategory);
router.delete('/:id', protect, adminOnly, categoryController.deleteCategory);

module.exports = router;
