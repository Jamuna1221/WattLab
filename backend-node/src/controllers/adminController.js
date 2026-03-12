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