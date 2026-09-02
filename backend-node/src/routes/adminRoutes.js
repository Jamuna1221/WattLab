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
// Admin Dashboard Data
router.get('/dashboard', verifyToken, authorize('admin'), adminController.getDashboardData);

// Admin creates a NEW device and immediately assigns it to a user (one-shot)
router.post('/create-device', verifyToken, authorize('admin'), adminController.createDeviceAndAssign);

// Admin Assigns an existing device to a user
router.post('/assign-device', verifyToken, authorize('admin'), adminController.assignDevice);

module.exports = router;