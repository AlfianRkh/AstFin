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

		CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, transaction_date);
		CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_radar_user ON radar_items(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id, status);
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

		CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, transaction_date);
		CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_radar_user ON radar_items(user_id, status);
		CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id, status);
		`
	}

	if _, err := db.Exec(schema); err != nil {
		return err
	}

	// Idempotent column and table migrations for existing databases
	if driver == "postgres" {
		_, _ = db.Exec("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credit_limit DOUBLE PRECISION DEFAULT 0.0;")
		_, _ = db.Exec("ALTER TABLE debts ADD COLUMN IF NOT EXISTS wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL;")
		_, _ = db.Exec("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_date VARCHAR(20);")
		_, _ = db.Exec("ALTER TABLE radar_items ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;")
		_, _ = db.Exec("ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS price DOUBLE PRECISION DEFAULT 0.0;")
		_, _ = db.Exec(`
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
		_, _ = db.Exec("ALTER TABLE wallets ADD COLUMN credit_limit REAL DEFAULT 0.0;")
		_, _ = db.Exec("ALTER TABLE debts ADD COLUMN wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL;")
		_, _ = db.Exec("ALTER TABLE transactions ADD COLUMN due_date TEXT;")
		_, _ = db.Exec("ALTER TABLE radar_items ADD COLUMN qty INTEGER DEFAULT 1;")
		_, _ = db.Exec("ALTER TABLE pantry_items ADD COLUMN price REAL DEFAULT 0.0;")
		_, _ = db.Exec(`
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

	return nil
}
