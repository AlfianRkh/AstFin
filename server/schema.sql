-- =============================================================================
-- OmniLife Nexus - PostgreSQL Database Schema
-- Unified Life OS v2.4 (SmartFin, DebtTracker, PriceRadar, StockPantry)
-- =============================================================================

-- 1. ROLES TABLE (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS TABLE
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

-- 3. WALLETS TABLE (Multi-Wallet: Bank, E-Wallet, Cash, Credit Card)
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'Bank', 'E-Wallet', 'Cash', 'Investment', 'Credit Card'
    balance DOUBLE PRECISION DEFAULT 0.0, -- Saldo tersedia / Sisa limit kartu kredit
    credit_limit DOUBLE PRECISION DEFAULT 0.0, -- Batas plafon limit kartu kredit
    account_number VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. DIGITAL BUDGET ENVELOPES (Pos Anggaran)
CREATE TABLE IF NOT EXISTS budget_envelopes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    allocated_amount DOUBLE PRECISION DEFAULT 0.0,
    spent_amount DOUBLE PRECISION DEFAULT 0.0,
    month_year VARCHAR(20) NOT NULL, -- Format: 'YYYY-MM'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. TRANSACTIONS TABLE (SmartFin Ledger & OCR Struk)
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
    transaction_date VARCHAR(20) NOT NULL, -- Format: 'YYYY-MM-DD'
    due_date VARCHAR(20), -- Format: 'YYYY-MM-DD' (Tanggal tagihan / jatuh tempo kartu kredit)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5b. TRANSACTION CUSTOM CATEGORIES (Kategori Pos Tersimpan)
CREATE TABLE IF NOT EXISTS transaction_categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_category UNIQUE (user_id, name, type)
);

-- 6. DEBTS TABLE (DebtTracker: Buku Utang & Piutang)
CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL, -- Sumber Kartu Kredit / Rekening
    contact_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(50),
    type VARCHAR(20) NOT NULL CHECK (type IN ('hutang', 'piutang')),
    total_amount DOUBLE PRECISION NOT NULL,
    paid_amount DOUBLE PRECISION DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue'
    due_date VARCHAR(20) NOT NULL, -- Format: 'YYYY-MM-DD'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. DEBT PAYMENTS (Rekonsiliasi Pembayaran & Cicilan)
CREATE TABLE IF NOT EXISTS debt_payments (
    id SERIAL PRIMARY KEY,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
    amount DOUBLE PRECISION NOT NULL,
    payment_date VARCHAR(20) NOT NULL, -- Format: 'YYYY-MM-DD'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. RADAR ITEMS (PriceRadar & WishBoard Prioritas)
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
    deal_score DOUBLE PRECISION DEFAULT 0.0, -- Range: 0.0 - 10.0
    priority_score DOUBLE PRECISION DEFAULT 0.0, -- Range: 0.0 - 100.0
    platform VARCHAR(100) NOT NULL, -- 'Tokopedia', 'Shopee', 'Blibli', 'Toko Fisik'
    url TEXT,
    status VARCHAR(30) DEFAULT 'monitoring', -- 'monitoring', 'target_hit', 'bought'
    saved_amount DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. PROCUREMENT SETTINGS (Tuning Bobot Belanja Rasional)
CREATE TABLE IF NOT EXISTS procurement_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    utility_weight INTEGER DEFAULT 35, -- Urgensi Kebutuhan %
    desire_weight INTEGER DEFAULT 30,  -- Tingkat Keinginan %
    saving_weight INTEGER DEFAULT 35,  -- Kesiapan Tabungan %
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. PANTRY ITEMS (StockPantry & Zero-Waste Freshness)
CREATE TABLE IF NOT EXISTS pantry_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Kulkas', 'Freezer', 'Lemari Kering'
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    unit VARCHAR(50) NOT NULL, -- 'Butir', 'Pouch', 'Kotak', 'Botol', 'Kg', 'Gram', 'Pcs'
    min_quantity DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    expiry_date VARCHAR(20) NOT NULL, -- Format: 'YYYY-MM-DD'
    price DOUBLE PRECISION DEFAULT 0.0, -- Harga acuan / beli terakhir
    status VARCHAR(30) DEFAULT 'safe', -- 'safe', 'expiring_soon', 'critical', 'out_of_stock'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. SMART SHOPPING ITEMS (Autonomous Closed-Loop Supply Chain)
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

-- 12. RADAR CATEGORIES (Kategori Khusus Pemantauan Belanja PriceRadar)
CREATE TABLE IF NOT EXISTS radar_categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_radar_category UNIQUE (user_id, name)
);

-- 13. RADAR PLATFORMS (Marketplace / E-Commerce Monitoring PriceRadar)
CREATE TABLE IF NOT EXISTS radar_platforms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_radar_platform UNIQUE (user_id, name)
);

-- 14. PANTRY STORAGE ZONES (Zona Penyimpanan Dinamis Dapur)
CREATE TABLE IF NOT EXISTS pantry_storage_zones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_pantry_storage_zone UNIQUE (user_id, name)
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_radar_user_status ON radar_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pantry_user_status ON pantry_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pantry_expiry ON pantry_items(expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_shopping_user_checked ON shopping_items(user_id, is_checked);

-- =============================================================================
-- COMPARE PRICE PRODUCT TABLES & INDEXES
-- =============================================================================
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    store_type VARCHAR(50) NOT NULL DEFAULT 'minimarket',
    address_text TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    is_mobile BOOLEAN DEFAULT FALSE,
    public_store_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) UNIQUE NOT NULL,
    group_code VARCHAR(50) NOT NULL,
    shelf_life_room_days INTEGER,
    shelf_life_chiller_days INTEGER,
    shelf_life_freezer_days INTEGER,
    threshold_cheap_pct DOUBLE PRECISION DEFAULT 10.0,
    threshold_expensive_pct DOUBLE PRECISION DEFAULT 15.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
    canonical_product_id INTEGER,
    name VARCHAR(200) NOT NULL,
    name_normalized VARCHAR(200) NOT NULL,
    base_unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    image_url TEXT,
    barcode VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES price_products(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    entry_type VARCHAR(30) NOT NULL DEFAULT 'observation',
    purchase_unit VARCHAR(50) NOT NULL,
    purchase_qty DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    units_per_package DOUBLE PRECISION,
    total_units DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    price_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    discount_type VARCHAR(20) DEFAULT 'amount',
    discount_value DOUBLE PRECISION DEFAULT 0.0,
    discount_amount DOUBLE PRECISION DEFAULT 0.0,
    price_final DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    price_per_unit DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address_text TEXT,
    observed_at VARCHAR(20) NOT NULL,
    photo_url TEXT,
    notes TEXT,
    ignore_in_stats BOOLEAN DEFAULT FALSE,
    share_to_community BOOLEAN DEFAULT FALSE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL,
    expiry_date VARCHAR(20),
    expiry_is_estimated BOOLEAN DEFAULT FALSE,
    storage_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    threshold_mode VARCHAR(30) DEFAULT 'percent',
    threshold_cheap_pct DOUBLE PRECISION DEFAULT 10.0,
    threshold_expensive_pct DOUBLE PRECISION DEFAULT 15.0,
    period_days INTEGER DEFAULT 60,
    default_source VARCHAR(30) DEFAULT 'combined',
    share_all_entries BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_price_products_user ON price_products(user_id, name_normalized);
CREATE INDEX IF NOT EXISTS idx_price_entries_product ON price_entries(product_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_entries_user ON price_entries(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id, name);

-- =============================================================================
-- INITIAL SEED: SYSTEM ROLES (Hanya Metadata Role, Tanpa Data Dummy Pengguna)
-- =============================================================================
INSERT INTO roles (name, description) VALUES
    ('admin', 'Administrator with full system access and role management'),
    ('finance', 'Finance Manager with access to cashflow and ledger operations'),
    ('user', 'Standard User with personal life OS access')
ON CONFLICT (name) DO NOTHING;

