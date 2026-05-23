const express = require('express');
const router = express.Router();
const {
  createStock,
  getAvailableStocks,
  getMyStocks,
  getStockById,
  updateStock,
  deleteStock,
  toggleVisibility,
  updateStatus,
  updateQuantity,
  updatePrice,
  updateAvailability,
  removeExpiredStock,
  bulkAddStocks,
  bulkUpdateStocks,
  getAllStocksAdmin,
  deactivateStockAdmin
} = require('../controllers/stockController');
const { validateStockData } = require('../middleware/stockValidation');
const { protect, farmerRole, adminRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const handleUpload = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image size must be 2MB or less.' });
    }

    if (error.code === 'EPERM' || error.code === 'EACCES') {
      return res.status(500).json({
        message: 'Image upload folder is not writable. Check server uploads permissions.'
      });
    }

    return res.status(400).json({ message: error.message || 'Image upload failed.' });
  });
};

/** JSON updates must not go through multer (can break parsed body on some stacks). */
const maybeHandleUpload = (req, res, next) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    return handleUpload(req, res, next);
  }
  return next();
};

// Route mapping
router.route('/')
  .get(protect, getAvailableStocks)
  .post(protect, farmerRole, handleUpload, validateStockData, createStock);

router.route('/my')
  .get(protect, farmerRole, getMyStocks);

router.route('/all')
  .get(protect, adminRole, getAllStocksAdmin);

// Bulk operations (Must be before /:id)
router.route('/bulk/add')
  .post(protect, farmerRole, bulkAddStocks);

router.route('/bulk/update')
  .put(protect, farmerRole, bulkUpdateStocks);

router.route('/expired/all')
  .delete(protect, farmerRole, removeExpiredStock);

router.route('/:id')
  .get(protect, getStockById)
  .put(protect, maybeHandleUpload, validateStockData, updateStock)
  .delete(protect, deleteStock);

router.route('/:id/visibility')
  .patch(protect, farmerRole, toggleVisibility);

router.route('/:id/status')
  .patch(protect, farmerRole, updateStatus);

router.route('/:id/deactivate')
  .patch(protect, adminRole, deactivateStockAdmin);

router.route('/:id/quantity')
  .patch(protect, farmerRole, updateQuantity);

router.route('/:id/price')
  .patch(protect, farmerRole, updatePrice);

router.route('/:id/availability')
  .patch(protect, farmerRole, updateAvailability);

module.exports = router;
