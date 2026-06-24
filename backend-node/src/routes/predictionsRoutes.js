const express = require('express');
const router = express.Router();

const predictionsController = require('../controllers/predictionsController');
const predictionsService = require('../services/predictionsService');

router.get('/bulb/:deviceId', predictionsController.getLatestBulbPrediction);
router.post('/bulb/:deviceId/run', predictionsController.runBulbPrediction);
router.get('/activity/:deviceId', predictionsController.getBulbActivityPrediction);
router.post('/activity/:deviceId/run', predictionsController.runBulbActivityPrediction);
router.get('/bill/:deviceId', predictionsController.getBillPrediction);

router.get('/tray/state', async (req, res) => {
  try {
    const state = await predictionsService.getTrayState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tray/reset', async (req, res) => {
  try {
    const data = await predictionsService.resetTrayState();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:deviceId', predictionsController.getLatestPredictions);

module.exports = router;

