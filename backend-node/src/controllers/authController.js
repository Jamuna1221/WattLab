const authService = require('../services/authService');

exports.register = async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err.message);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const data = await authService.loginUser(req.body);
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.log("LOGIN ERROR:", err.message);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};