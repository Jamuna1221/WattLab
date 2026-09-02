const readingsService = require('../services/readingsService');

// POST /api/readings
exports.ingestReading = async (req, res) => {
  try {
    const {
      timestamp,
      voltage,
      current,
      activePower,
      apparentPower,
      powerFactor,
      deviceId,
      power,
      applianceLabel,
      streamType,
    } = req.body;

    // device_id from body or token
    const device_id = deviceId || req.body.device_id || req.user?.deviceId;
    const user_id = req.user?.userId || req.user?.id || req.body.user_id;

    // Backward-compat: some devices send "power" instead of "activePower"
    const normalizedActivePower =
      activePower !== undefined && activePower !== null ? activePower : power !== undefined ? power : undefined;

    const result = await readingsService.saveReading({
      device_id,
      user_id,
      voltage,
      current,
      activePower: normalizedActivePower,
      apparentPower,
      powerFactor,
      timestamp,
      applianceLabel,
      streamType,
    });

    console.log('Reading saved', {
      device_id,
      reading_id: result.reading.id,
      activePower: normalizedActivePower,
      timestamp: result.reading.timestamp,
      appliance_label: result.reading.appliance_label ?? null,
      stream_type: result.reading.stream_type ?? 'aggregate',
    });

    return res.status(201).json({
      success: true,
      reading_id: result.reading.id,
      prediction: result.prediction,
    });
  } catch (err) {
    console.log('INGEST ERROR:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.getLiveReading = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const reading = await readingsService.getLiveReading(deviceId);
    return res.status(200).json({ success: true, reading });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const summary = await readingsService.getDailySummary(deviceId);
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.getWeeklySummary = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const summary = await readingsService.getWeeklySummary(deviceId);
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMonthlySummary = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const summary = await readingsService.getMonthlySummary(deviceId);
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.getApplianceBreakdown = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const timeframe = req.query.timeframe || 'monthly';
    const breakdown = await readingsService.getApplianceBreakdown(deviceId, timeframe);
    return res.status(200).json({ success: true, breakdown });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

