-- =============================================================================
-- Migration: 001_init_schema.sql
-- OmniLife Nexus - PostgreSQL Database Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    balance DOUBLE PRECISION DEFAULT 0.0,
    account_number VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_envelopes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    allocated_amount DOUBLE PRECISION DEFAULT 0.0,
    spent_amount DOUBLE PRECISION DEFAULT 0.0,
    month_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DOUBLE PRECISION NOT NULL,
    category VARCHAR(100) NOT NULL,
    merchant VARCHAR(150) NOT NULL,
    notes TEXT,
    receipt_url TEXT,
    ocr_accuracy DOUBLE PRECISION DEFAULT 0.0,
    transaction_date VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(50),
    type VARCHAR(20) NOT NULL CHECK (type IN ('hutang', 'piutang')),
    total_amount DOUBLE PRECISION NOT NULL,
    paid_amount DOUBLE PRECISION DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    due_date VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debt_payments (
    id SERIAL PRIMARY KEY,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
    amount DOUBLE PRECISION NOT NULL,
    payment_date VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS radar_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    target_price DOUBLE PRECISION NOT NULL,
    current_price DOUBLE PRECISION NOT NULL,
    all_time_low_price DOUBLE PRECISION NOT NULL,
    all_time_high_price DOUBLE PRECISION NOT NULL,
    deal_score DOUBLE PRECISION DEFAULT 0.0,
    priority_score DOUBLE PRECISION DEFAULT 0.0,
    platform VARCHAR(100) NOT NULL,
    url TEXT,
    status VARCHAR(30) DEFAULT 'monitoring',
    saved_amount DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procurement_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    utility_weight INTEGER DEFAULT 35,
    desire_weight INTEGER DEFAULT 30,
    saving_weight INTEGER DEFAULT 35,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pantry_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    unit VARCHAR(50) NOT NULL,
    min_quantity DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    expiry_date VARCHAR(20) NOT NULL,
    price DOUBLE PRECISION DEFAULT 0.0,
    status VARCHAR(30) DEFAULT 'safe',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    estimated_price DOUBLE PRECISION DEFAULT 0.0,
    store_recommendation VARCHAR(150),
    is_checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS radar_categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_radar_category UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS radar_platforms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_radar_platform UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS pantry_storage_zones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_pantry_storage_zone UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_radar_user_status ON radar_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pantry_user_status ON pantry_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pantry_expiry ON pantry_items(expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_shopping_user_checked ON shopping_items(user_id, is_checked);

INSERT INTO roles (name, description) VALUES
    ('admin', 'Administrator with full system access and role management'),
    ('finance', 'Finance Manager with access to cashflow and ledger operations'),
    ('user', 'Standard User with personal life OS access')
ON CONFLICT (name) DO NOTHING;
