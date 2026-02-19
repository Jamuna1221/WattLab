# WattLab Setup & Run Guide

## Quick Start (Development)

### 1. Start PostgreSQL Database
Make sure PostgreSQL is running and create the database:

```bash
# Windows (PowerShell as Administrator)
psql -U postgres -c "CREATE DATABASE wattlab;"
psql -U postgres -d wattlab -f backend-node/src/config/schema.sql
```

### 2. Start Backend API (Terminal 1)

```bash
cd backend-node

# Install dependencies (first time only)
npm install

# Create .env file (first time only)
# Copy .env.example to .env and update values:
# DB_PASSWORD=your_postgres_password
# JWT_SECRET=your_random_secret_key

# Start development server
npm run dev
```

✅ Backend running at: http://localhost:4000

### 3. Start ML Service (Terminal 2)

```bash
cd backend-python

# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies (first time only)
pip install -r requirements.txt

# Start ML service
python app.py
```

✅ ML Service running at: http://localhost:5000

### 4. Start Frontend (Terminal 3)

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

✅ Frontend running at: http://localhost:5173

## Access the Application

1. Open browser: http://localhost:5173
2. Register a new account or use demo credentials:
   - Admin: admin@wattlab.com / admin123
   - User: user@wattlab.com / user123 (if created)

## Common Issues

### Database Connection Error
- Ensure PostgreSQL is running
- Check credentials in `backend-node/.env`
- Verify database `wattlab` exists

### Port Already in Use
- Backend (4000): Change PORT in `.env`
- ML Service (5000): Change port in `app.py`
- Frontend (5173): Change in `vite.config.js`

### Module Not Found
- Run `npm install` in backend-node and frontend
- Run `pip install -r requirements.txt` in backend-python

## Testing the System

1. **Register** a new user account
2. **Add appliances** in the dashboard
3. View **energy analytics** and charts
4. Check **bill predictions**
5. Review **recommendations**
6. Admin can view **system statistics**

## Stop Services

Press `Ctrl+C` in each terminal to stop the services.
