const express = require('express');
const router = express.Router();

const readingsController = require('../controllers/readingsController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/readings
// Accepts device token OR body fields (for simple ESP posting)
router.post('/', verifyToken, readingsController.ingestReading);

router.get('/live/:deviceId', readingsController.getLiveReading);
router.get('/daily/:deviceId', readingsController.getDailySummary);
router.get('/weekly/:deviceId', readingsController.getWeeklySummary);

module.exports = router;

