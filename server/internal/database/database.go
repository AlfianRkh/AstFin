package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"astfin/server/internal/config"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

func InitDB(cfg *config.Config) (*DB, error) {
	var db *sql.DB
	var err error

	if cfg.DBDriver == "sqlite" {
		db, err = sql.Open("sqlite", cfg.DBPath)
		if err != nil {
			return nil, err
		}
		// SQLite Pragmas
		_, _ = db.Exec("PRAGMA journal_mode = WAL;")
		_, _ = db.Exec("PRAGMA foreign_keys = ON;")
		_, _ = db.Exec("PRAGMA synchronous = NORMAL;")
		_, _ = db.Exec("PRAGMA busy_timeout = 5000;")
	} else {
		// PostgreSQL
		db, err = sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to open postgres connection: %w", err)
		}

		// Performance connection pool tuning
		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(10)
		db.SetConnMaxLifetime(5 * time.Minute)
		db.SetConnMaxIdleTime(2 * time.Minute)

		// Test ping
		if err := db.Ping(); err != nil {
			return nil, fmt.Errorf("failed to ping postgres database: %w. Pastikan PostgreSQL berjalan dan database '%s' sudah dibuat", err, cfg.DBName)
		}
	}

	if err := migrateSchema(db, cfg.DBDriver); err != nil {
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	return NewDB(db, cfg.DBDriver), nil
}

func migrateSchema(db *sql.DB, driver string) error {
	var schema string

	if driver == "sqlite" {
		schema = `
		CREATE TABLE IF NOT EXISTS roles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
			is_verified INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS wallets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			balance REAL DEFAULT 0.0,
			credit_limit REAL DEFAULT 0.0,
			account_number TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS budget_envelopes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			allocated_amount REAL DEFAULT 0.0,
			spent_amount REAL DEFAULT 0.0,
			month_year TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
			type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
			amount REAL NOT NULL,
			category TEXT NOT NULL,
			merchant TEXT NOT NULL,
			notes TEXT,
			receipt_url TEXT,
			ocr_accuracy REAL DEFAULT 0.0,
			transaction_date TEXT NOT NULL,
			due_date TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS transaction_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, name, type)
		);

		CREATE TABLE IF NOT EXISTS debts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
			contact_name TEXT NOT NULL,
			contact_phone TEXT,
			type TEXT NOT NULL CHECK (type IN ('hutang', 'piutang')),
			total_amount REAL NOT NULL,
			paid_amount REAL DEFAULT 0.0,
			status TEXT NOT NULL DEFAULT 'pending',
			due_date TEXT NOT NULL,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS debt_payments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
			wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
			amount REAL NOT NULL,
			payment_date TEXT NOT NULL,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS radar_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT,
			category TEXT NOT NULL,
			image_url TEXT,
			target_price REAL NOT NULL,
			current_price REAL NOT NULL,
			all_time_low_price REAL NOT NULL,
			all_time_high_price REAL NOT NULL,
			deal_score REAL DEFAULT 0.0,
			priority_score REAL DEFAULT 0.0,
			platform TEXT NOT NULL,
			url TEXT,
			status TEXT DEFAULT 'monitoring',
			saved_amount REAL DEFAULT 0.0,
			qty INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS procurement_settings (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			utility_weight INTEGER DEFAULT 35,
			desire_weight INTEGER DEFAULT 30,
			saving_weight INTEGER DEFAULT 35,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS pantry_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			quantity REAL NOT NULL DEFAULT 0.0,
			unit TEXT NOT NULL,
			min_quantity REAL NOT NULL DEFAULT 1.0,
			expiry_date TEXT NOT NULL,
			price REAL DEFAULT 0.0,
			status TEXT DEFAULT 'safe',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS shopping_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			estimated_price REAL DEFAULT 0.0,
			store_recommendation TEXT,
			is_checked INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Compare Price Product Schema (SQLite)
		CREATE TABLE IF NOT EXISTS stores (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			store_type TEXT NOT NULL DEFAULT 'minimarket',
			address_text TEXT,
			lat REAL,
			lng REAL,
			is_mobile INTEGER DEFAULT 0,
			public_store_id INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS product_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			group_code TEXT NOT NULL,
			shelf_life_room_days INTEGER,
			shelf_life_chiller_days INTEGER,
			shelf_life_freezer_days INTEGER,
			threshold_cheap_pct REAL DEFAULT 10.0,
			threshold_expensive_pct REAL DEFAULT 15.0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(name)
		);

		CREATE TABLE IF NOT EXISTS price_products (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
			canonical_product_id INTEGER,
			name TEXT NOT NULL,
			name_normalized TEXT NOT NULL,
			base_unit TEXT NOT NULL DEFAULT 'pcs',
			image_url TEXT,
			barcode TEXT,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS price_entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			product_id INTEGER NOT NULL REFERENCES price_products(id) ON DELETE CASCADE,
			store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
			entry_type TEXT NOT NULL DEFAULT 'observation',
			purchase_unit TEXT NOT NULL,
			purchase_qty REAL NOT NULL DEFAULT 1.0,
			units_per_package REAL,
			total_units REAL NOT NULL DEFAULT 1.0,
			price_total REAL NOT NULL DEFAULT 0.0,
			discount_type TEXT DEFAULT 'amount',
			discount_value REAL DEFAULT 0.0,
			discount_amount REAL DEFAULT 0.0,
			price_final REAL NOT NULL DEFAULT 0.0,
			price_per_unit REAL NOT NULL DEFAULT 0.0,
			lat REAL,
			lng REAL,
			address_text TEXT,
			observed_at TEXT NOT NULL,
			photo_url TEXT,
			notes TEXT,
			ignore_in_stats INTEGER DEFAULT 0,
			share_to_community INTEGER DEFAULT 0,
			transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
			pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL,
			expiry_date TEXT,
			expiry_is_estimated INTEGER DEFAULT 0,
			storage_type TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS price_settings (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			threshold_mode TEXT DEFAULT 'percent',
			threshold_cheap_pct REAL DEFAULT 10.0,
			threshold_expensive_pct REAL DEFAULT 15.0,
			period_days INTEGER DEFAULT 60,
			default_source TEXT DEFAULT 'combined',
			share_all_entries INTEGER DEFAULT 0
		);

		CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, transaction_date);
		CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_radar_user ON radar_items(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_price_products_user ON price_products(user_id, name_normalized);
		CREATE INDEX IF NOT EXISTS idx_price_entries_product ON price_entries(product_id, observed_at);
		CREATE INDEX IF NOT EXISTS idx_price_entries_user ON price_entries(user_id, observed_at);
		CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id, name);
		`
	} else {
		// PostgreSQL Schema
		schema = `
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
			is_verified BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS wallets (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			type VARCHAR(50) NOT NULL,
			balance DOUBLE PRECISION DEFAULT 0.0,
			credit_limit DOUBLE PRECISION DEFAULT 0.0,
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
			due_date VARCHAR(20),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS transaction_categories (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT uq_user_category UNIQUE (user_id, name, type)
		);

		CREATE TABLE IF NOT EXISTS debts (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
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
			qty INTEGER DEFAULT 1,
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

		-- Compare Price Product Schema (PostgreSQL)
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

		CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, transaction_date);
		CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_radar_user ON radar_items(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_price_products_user ON price_products(user_id, name_normalized);
		CREATE INDEX IF NOT EXISTS idx_price_entries_product ON price_entries(product_id, observed_at);
		CREATE INDEX IF NOT EXISTS idx_price_entries_user ON price_entries(user_id, observed_at);
		CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id, name);
		`
	}

	if _, err := db.Exec(schema); err != nil {
		return err
	}

	// Idempotent column and table migrations for existing databases
	if driver == "postgres" {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;")
		_, _ = db.Exec("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;")
		_, _ = db.Exec("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credit_limit DOUBLE PRECISION DEFAULT 0.0;")
		_, _ = db.Exec("ALTER TABLE debts ADD COLUMN IF NOT EXISTS wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL;")
		_, _ = db.Exec("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_date VARCHAR(20);")
		_, _ = db.Exec("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted INTEGER DEFAULT 0;")
		_, _ = db.Exec("UPDATE transactions SET deleted = 0 WHERE deleted IS NULL;")
		_, _ = db.Exec("ALTER TABLE radar_items ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;")
		_, _ = db.Exec("ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS price DOUBLE PRECISION DEFAULT 0.0;")
		_, _ = db.Exec("ALTER TABLE price_products ADD COLUMN IF NOT EXISTS image_url TEXT;")
		_, _ = db.Exec("ALTER TABLE price_products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);")
		_, _ = db.Exec("ALTER TABLE price_products ADD COLUMN IF NOT EXISTS notes TEXT;")
		_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_price_products_barcode ON price_products(user_id, barcode);")
		_, _ = db.Exec(`
			CREATE TABLE IF NOT EXISTS email_verifications (
				id SERIAL PRIMARY KEY,
				email VARCHAR(255) NOT NULL,
				code VARCHAR(20) NOT NULL,
				expires_at TIMESTAMPTZ NOT NULL,
				created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
			);
			CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);

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
		`)
	} else {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 1;")
		_, _ = db.Exec("ALTER TABLE wallets ADD COLUMN credit_limit REAL DEFAULT 0.0;")
		_, _ = db.Exec("ALTER TABLE debts ADD COLUMN wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL;")
		_, _ = db.Exec("ALTER TABLE transactions ADD COLUMN due_date TEXT;")
		_, _ = db.Exec("ALTER TABLE transactions ADD COLUMN deleted INTEGER DEFAULT 0;")
		_, _ = db.Exec("ALTER TABLE radar_items ADD COLUMN qty INTEGER DEFAULT 1;")
		_, _ = db.Exec("ALTER TABLE pantry_items ADD COLUMN price REAL DEFAULT 0.0;")
		_, _ = db.Exec("ALTER TABLE price_products ADD COLUMN image_url TEXT;")
		_, _ = db.Exec("ALTER TABLE price_products ADD COLUMN barcode TEXT;")
		_, _ = db.Exec("ALTER TABLE price_products ADD COLUMN notes TEXT;")
		_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_price_products_barcode ON price_products(user_id, barcode);")
		_, _ = db.Exec(`
			CREATE TABLE IF NOT EXISTS email_verifications (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT NOT NULL,
				code TEXT NOT NULL,
				expires_at DATETIME NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS radar_categories (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id, name)
			);
			CREATE TABLE IF NOT EXISTS radar_platforms (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id, name)
			);
			CREATE TABLE IF NOT EXISTS pantry_storage_zones (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id, name)
			);
		`)
	}

	// Seed default roles metadata only (NO dummy business data)
	roles := []struct {
		name string
		desc string
	}{
		{"admin", "Administrator with full system access and role management"},
		{"finance", "Finance Manager with access to cashflow and ledger operations"},
		{"user", "Standard User with personal life OS access"},
	}

	for _, r := range roles {
		if driver == "sqlite" {
			_, err := db.Exec("INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)", r.name, r.desc)
			if err != nil {
				log.Printf("Role seed error: %v", err)
			}
		} else {
			_, err := db.Exec("INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", r.name, r.desc)
			if err != nil {
				log.Printf("Role seed error: %v", err)
			}
		}
	}

	// Seed default product categories for price comparison & shelf life
	type DefaultCategory struct {
		Name                  string
		GroupCode             string
		RoomDays              int
		ChillerDays           int
		FreezerDays           int
		CheapPct              float64
		ExpensivePct          float64
	}

	defaultCategories := []DefaultCategory{
		{"Sembako (Beras, Gula, Minyak)", "sembako", 180, 180, 360, 5.0, 10.0},
		{"Telur Ayam / Bebek", "telur", 14, 30, 0, 10.0, 15.0},
		{"Sayur Daun (Bayam, Kangkung, Sawi)", "sayur_daun", 2, 7, 0, 15.0, 20.0},
		{"Sayur Buah (Tomat, Terong, Timun)", "sayur_buah", 4, 10, 0, 15.0, 20.0},
		{"Sayur Kol & Brokoli", "sayur_kol", 4, 14, 0, 15.0, 20.0},
		{"Sayur Umbi (Kentang, Wortel)", "sayur_umbi", 21, 30, 0, 10.0, 15.0},
		{"Bawang Merah & Putih", "bawang", 30, 45, 0, 10.0, 15.0},
		{"Cabai & Paprika", "cabai", 5, 14, 60, 15.0, 20.0},
		{"Bumbu Dapur (Jahe, Kunyit, Lengkuas)", "bumbu", 14, 30, 90, 10.0, 15.0},
		{"Buah Tropis (Pisang, Mangga, Pepaya)", "buah_tropis", 4, 7, 30, 15.0, 20.0},
		{"Buah Subtropis & Berry (Apel, Jeruk, Berry)", "buah_subtropis", 5, 14, 60, 15.0, 20.0},
		{"Buah Besar (Semangka, Melon)", "buah_besar", 7, 14, 0, 15.0, 20.0},
		{"Ikan & Seafood Segar", "seafood", 1, 2, 90, 15.0, 20.0},
		{"Daging Sapi & Kambing", "daging_merah", 1, 3, 180, 10.0, 15.0},
		{"Daging Ayam & Unggas", "unggas", 1, 2, 120, 10.0, 15.0},
		{"Tahu & Tempe", "tahu_tempe", 2, 5, 0, 10.0, 15.0},
		{"Olahan Susu & Keju", "dairy", 1, 14, 60, 10.0, 15.0},
		{"Biskuit & Camilan", "camilan", 90, 90, 180, 10.0, 15.0},
		{"Minuman Kemasan", "minuman", 90, 90, 180, 10.0, 15.0},
		{"Kebutuhan Rumah Tangga", "household", 365, 365, 365, 10.0, 15.0},
		{"Lainnya", "lainnya", 30, 30, 30, 10.0, 15.0},
	}

	for _, c := range defaultCategories {
		if driver == "sqlite" {
			_, _ = db.Exec(`
				INSERT OR IGNORE INTO product_categories 
				(name, group_code, shelf_life_room_days, shelf_life_chiller_days, shelf_life_freezer_days, threshold_cheap_pct, threshold_expensive_pct) 
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, c.Name, c.GroupCode, c.RoomDays, c.ChillerDays, c.FreezerDays, c.CheapPct, c.ExpensivePct)
		} else {
			_, _ = db.Exec(`
				INSERT INTO product_categories 
				(name, group_code, shelf_life_room_days, shelf_life_chiller_days, shelf_life_freezer_days, threshold_cheap_pct, threshold_expensive_pct) 
				VALUES ($1, $2, $3, $4, $5, $6, $7) 
				ON CONFLICT (name) DO NOTHING
			`, c.Name, c.GroupCode, c.RoomDays, c.ChillerDays, c.FreezerDays, c.CheapPct, c.ExpensivePct)
		}
	}

	return nil
}
