const express = require('express');
const router = express.Router();

const predictionsController = require('../controllers/predictionsController');

router.get('/bulb/:deviceId', predictionsController.getLatestBulbPrediction);
router.post('/bulb/:deviceId/run', predictionsController.runBulbPrediction);
router.get('/activity/:deviceId', predictionsController.getBulbActivityPrediction);
router.post('/activity/:deviceId/run', predictionsController.runBulbActivityPrediction);
router.get('/bill/:deviceId', predictionsController.getBillPrediction);
router.get('/:deviceId', predictionsController.getLatestPredictions);

module.exports = router;

