const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/login', adminController.loginAdmin);

// ONE-TIME setup route — remove after first use!
router.get('/seed', adminController.seedAdmin);

module.exports = router;