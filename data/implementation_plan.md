# WattLab Smart Shakti - System Roadmap & Implementation Plan

## Executive Summary & Product Vision
WattLab is an intelligent non-intrusive load monitoring (NILM) and energy analytics platform. The application empowers users to monitor their home electricity consumption in real-time, understand exactly which appliances are consuming power, track historical usage across multiple timeframes (**Daily, Weekly, Monthly**), compare monthly bills (**Last Month vs. This Month**), and receive actionable recommendations to reduce electricity costs.

---

## Part 1: What Has Been Implemented So Far

### 1. Backend & Data Architecture (`backend-node`)
- **Supabase Database Integration**: Stores `users`, `devices`, `energy_readings` (voltage, current, active power, timestamp), and `predictions`.
- **Hardware Data Ingestion API** (`POST /api/readings`): Accepts real-time power data from physical ESP32 sensors or simulation scripts without requiring user session tokens.
- **Admin Management API**:
  - `GET /api/admin/dashboard`: Returns system stats, users, and assigned hardware devices.
  - `POST /api/admin/create-device`: Creates and links ESP32 hardware devices (`device_id`, `device_secret`) directly to registered users.
- **User Device API** (`GET /api/devices`): Allows authenticated users to automatically discover their assigned hardware device ID.
- **Aggregated Analytics API**:
  - `GET /api/readings/live/:deviceId`: Latest live voltage, current, and active power reading.
  - `GET /api/readings/daily/:deviceId`: Day-by-day energy consumption (kWh) over time.
  - `GET /api/readings/weekly/:deviceId`: Week-by-week aggregated consumption.

### 2. Machine Learning & Candidate Tray Engine (`backend-python`)
- **Multi-Appliance Step-Change Detection**: Flask backend (`app.py`) runs a Candidate Tray Engine (`/tray/state`, `/tray/reset`) that identifies step changes in power (e.g. +150W for Fridge, +2000W for Kettle) and maintains a candidate elimination timer.
- **Appliance Energy Disaggregation**: Measures active duration (seconds), calculates exact kWh consumed per appliance (Fridge, Kettle, Microwave, Washing Machine, Dishwasher), and calculates estimated session cost.
- **Deep Learning Bill Forecast DNN**: Predicts next-day kWh consumption and projects 30-day billing forecasts based on neural network models (`bill_prediction_model.h5`).

### 3. Frontend Web Application (`frontend`)
- **Admin Panel (`/admin`)**: Complete management dashboard allowing admins to view all registered users and assign hardware devices.
- **Automatic Device Resolution (`useDeviceId` hook)**: Automatically fetches the logged-in user's assigned device ID from the backend so that every user sees their own real data.
- **Live Readings Dashboard (`/dashboard/live`)**: Live voltage, aggregate current, active power meters, and the real-time Candidate Tray.
- **User Overview Dashboard (`/dashboard`)**: Summary cards (Total Consumption, Predicted Bill, Active Devices), appliance pie chart, and ML model status.
- **History & CSV Export (`/dashboard/history`)**: Paginated log of energy readings with date range filter and CSV export.
- **Analytics & Bill Forecast (`/dashboard/analytics`, `/dashboard/bill`)**: Visual charts for daily usage trends and preliminary cost saving tips.

---

## Part 2: Proposed Next Phase Implementation Roadmap

To transform WattLab into a consumer-centric energy optimization app, we will implement the following features:

### Component 1: Multi-Timeframe Energy Analytics (Daily, Weekly, Monthly)
#### [MODIFY] `backend-node/src/services/readingsService.js` & `readingsController.js`
- Implement `getMonthlySummary(deviceId)`: Aggregates energy consumption grouped by month for the past 12 months.
- Implement `getApplianceBreakdown(deviceId, timeframe)`: Aggregates appliance-level consumption grouped by timeframe (`daily`, `weekly`, `monthly`).

#### [MODIFY] `frontend/src/pages/AnalyticsPage.jsx`
- Add a Timeframe Selector Toggle (**Daily** | **Weekly** | **Monthly**) at the top of the analytics page.
- Render dynamic overall consumption charts matching the selected timeframe.
- Render **Appliance-Wise Consumption Breakdown** matching the selected timeframe (e.g., Fridge vs. Kettle vs. Washing Machine kWh for Today, This Week, or This Month).

---

### Component 2: Comprehensive Bill Comparison (Last Month vs. This Month)
#### [MODIFY] `frontend/src/pages/BillPage.jsx`
- **Month-over-Month Comparison Card**:
  - Compare **Last Month Bill (Actual)** vs. **This Month Bill (Projected & Cumulative)**.
  - Display variance percentage (`+8.5%` or `-4.2%`), peak consumption day, and average daily cost.
- **Tiered Electricity Rate Breakdown**:
  - Visualize cost calculation based on local slab rates (e.g., 0-100 kWh @ ₹0, 101-200 kWh @ ₹4.50, >200 kWh @ ₹8.50).

---

### Component 3: Intelligent Energy-Saving Recommendation Engine
#### [MODIFY] `frontend/src/pages/UserDashboard.jsx` & `BillPage.jsx`
- **Personalized Consumption Insights**:
  - **Idle Standby Detector**: Identifies baseline standby loads (e.g. continuous 40-60W drawing ~1.2 kWh/day) and estimates annual savings if turned off at wall sockets.
  - **Peak Hours Alert**: Recommends shifting high-wattage appliances (Kettle, Washing Machine) away from peak tariff hours.
  - **Appliance Anomaly Alert**: Warns if an appliance (e.g., Fridge) is running longer than usual cycles, indicating potential gasket leakage or inefficiency.
- **Monthly Budget Goal & Alert Bar**:
  - Allows user to set a monthly target bill (e.g. ₹1,500).
  - Displays a progress bar showing percentage of budget consumed relative to days passed in the month.

---

### Component 4: Streamlined & Focused Navigation
#### [MODIFY] `frontend/src/pages/LiveDashboard.jsx`
- Focus `Live Readings` strictly on real-time hardware metrics (Voltage, Current, Power) and day-wise live activity stream.
- Ensure seamless navigation between Live Feed, Overall Analytics, and Bill Forecast.

---

## Verification Plan

### Automated / API Verification
- Test `GET /api/readings/monthly/:deviceId` to verify month-by-month kWh aggregation.
- Test `GET /api/readings/daily/:deviceId` and `weekly` endpoints for correct dataset structure.

### Manual UX Verification
- **Timeframe Toggle**: Switch between Daily, Weekly, and Monthly tabs in Analytics to verify charts update smoothly.
- **Bill Comparison**: Verify Last Month vs. This Month card renders accurate totals and percentage variances.
- **Energy Saving Tips**: Check that personalized tips calculate potential savings dynamically using the user's tariff rate.
- **Budget Tracker**: Set a budget in Settings/Bill page and confirm progress bar accurately reflects current monthly spend.
