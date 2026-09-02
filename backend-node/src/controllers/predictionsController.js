const predictionsService = require('../services/predictionsService');

// GET /api/predictions/:deviceId
exports.getLatestPredictions = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const predictions = await predictionsService.getLatestPredictions(deviceId);
    return res.status(200).json({ success: true, predictions });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

// GET /api/predictions/bill/:deviceId
exports.getBillPrediction = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const bill = await predictionsService.getBillPrediction(deviceId);
    return res.status(200).json({ success: true, bill });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/predictions/bulb/:deviceId
exports.getLatestBulbPrediction = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await predictionsService.getLatestBulbPrediction(deviceId);
    return res.status(200).json({ success: true, prediction: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/predictions/bulb/:deviceId/run
exports.runBulbPrediction = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await predictionsService.predictBulbStateFromHistory(deviceId);
    return res.status(200).json({ success: true, result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/predictions/activity/:deviceId
exports.getBulbActivityPrediction = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const activity = await predictionsService.predictBulbActivityFromHistory(deviceId);
    return res.status(200).json({ success: true, activity });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/predictions/activity/:deviceId/run
exports.runBulbActivityPrediction = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const activity = await predictionsService.predictBulbActivityFromHistory(deviceId);
    return res.status(200).json({ success: true, activity });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.getHealth = async (req, res) => {
  try {
    const health = await predictionsService.getFlaskHealth();
    return res.status(200).json(health);
  } catch (err) {
    return res.status(500).json({ status: 'offline', error: err.message });
  }
};


