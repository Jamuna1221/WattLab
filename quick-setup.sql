-- Quick database setup for WattLab
-- Run this if PostgreSQL is installed and running

-- Create database
CREATE DATABASE wattlab;

-- Connect to the database
\c wattlab

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password, name, role) 
VALUES ('admin@wattlab.com', '$2b$10$rBV2kbFKxHZ.4xNbJKf8rOqKqB8kX5K9u6L9R4Q0oV5VfYZXvYvGu', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Show success message
SELECT 'Database setup complete! You can now use WattLab.' as message;
