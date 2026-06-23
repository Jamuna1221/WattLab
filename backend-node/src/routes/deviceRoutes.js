const express = require('express');
const router = express.Router();

const deviceController = require('../controllers/deviceController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/devices/link
router.post('/link', verifyToken, deviceController.linkDevice);

// GET /api/devices
router.get('/', verifyToken, deviceController.getUserDevices);

module.exports = router;

