const express = require('express');
const router = express.Router();

const predictionsService = require('../services/predictionsService');

router.get('/state', async (req, res) => {
  try {
    const state = await predictionsService.getTrayState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const data = await predictionsService.resetTrayState();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
