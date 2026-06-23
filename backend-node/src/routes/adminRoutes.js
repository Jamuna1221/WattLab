const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const deviceController = require('../controllers/deviceController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

router.post('/login', adminController.loginAdmin);

// ONE-TIME setup route — remove after first use!
router.get('/seed', adminController.seedAdmin);

// Admin creates a new device
// POST /api/admin/devices
router.post('/devices', verifyToken, authorize('admin'), deviceController.createDevice);

module.exports = router;