const deviceService = require('../services/deviceService');

exports.linkDevice = async (req, res) => {
  try {
    const { device_id, device_secret } = req.body;
    if (!device_id || !device_secret) {
      return res.status(400).json({ success: false, message: 'device_id and device_secret are required' });
    }

    const user_id = req.user?.id || req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const result = await deviceService.linkDevice({ device_id, device_secret, user_id });
    return res.status(200).json({
      success: true,
      message: 'Device linked successfully',
      device: result.device,
      token: result.token,
    });
  } catch (err) {
    console.log('LINK DEVICE ERROR:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.getUserDevices = async (req, res) => {
  try {
    const user_id = req.user?.id || req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const devices = await deviceService.getUserDevices(user_id);
    return res.status(200).json({ success: true, devices });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const { device_id, device_secret } = req.body;
    if (!device_id || !device_secret) {
      return res.status(400).json({ success: false, message: 'device_id and device_secret are required' });
    }

    const device = await deviceService.createDevice({ device_id, device_secret });
    return res.status(201).json({ success: true, device });
  } catch (err) {
    console.log('CREATE DEVICE ERROR:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

