const { setDefaultResultOrder } = require('dns');
setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const deviceRoutes      = require('./src/routes/deviceRoutes');
const readingsRoutes    = require('./src/routes/readingsRoutes');
const predictionsRoutes = require('./src/routes/predictionsRoutes');
const predictionsService = require('./src/services/predictionsService');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS
app.use(cors({
  origin: '*',
}));

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/devices',     deviceRoutes);
app.use('/api/readings',    readingsRoutes);
app.use('/api/predictions', predictionsRoutes);
 
// --------------------------------------------------------------------------
// Health check
// --------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status : 'running',
    routes : [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/admin/login',
      'GET  /api/admin/seed',
      'POST /api/devices/link',
      'GET  /api/devices',
      'POST /api/readings',
      'GET  /api/readings/live/:deviceId',
      'GET  /api/readings/daily/:deviceId',
      'GET  /api/readings/weekly/:deviceId',
      'GET  /api/predictions/:deviceId',
      'GET  /api/predictions/bill/:deviceId',
    ]
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'WattLab API is running!' });
});

// 🔥 IMPORTANT (allow ESP connection)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

const autoMlIntervalMs = Number(process.env.AUTO_ML_INTERVAL_MS || 60000);
setInterval(async () => {
  try {
    const cycleResults = await predictionsService.runAutoBulbPredictionCycle();
    const predictedCount = cycleResults.filter((item) => item.status === 'predicted').length;
    const skippedCount = cycleResults.filter((item) => item.status === 'skipped').length;
    const errorCount = cycleResults.filter((item) => item.status === 'error').length;
    console.log(`[auto-ml] bulb cycle complete predicted=${predictedCount} skipped=${skippedCount} errors=${errorCount}`);
  } catch (err) {
    console.log(`[auto-ml] cycle failed: ${err.message}`);
  }
}, autoMlIntervalMs);