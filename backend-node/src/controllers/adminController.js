const adminService = require('../services/adminService');

exports.loginAdmin = async (req, res) => {
  try {
    const data = await adminService.loginAdmin(req.body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

exports.seedAdmin = async (req, res) => {
  try {
    await adminService.seedAdmin();
    res.json({ success: true, message: 'Admin seeded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const data = await adminService.getDashboardData();
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDeviceAndAssign = async (req, res) => {
  try {
    const { device_id, device_secret, user_id } = req.body;
    const data = await adminService.createDeviceAndAssign({ device_id, device_secret, user_id });
    res.status(201).json({ success: true, message: 'Device created and assigned successfully', device: data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.assignDevice = async (req, res) => {
  try {
    const { device_id, user_id } = req.body;
    const data = await adminService.assignDevice({ device_id, user_id });
    res.status(200).json({ success: true, message: 'Device assigned successfully', device: data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};