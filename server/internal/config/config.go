package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DBDriver     string // "postgres" or "sqlite"
	DBHost       string
	DBPort       string
	DBUser       string
	DBPassword   string
	DBName       string
	DBSSLMode    string
	DatabaseURL  string
	DBPath       string // for sqlite fallback
	JWTSecret    string
	JWTExpiresIn int // in hours
	CORSOrigin   string
}

func Load() *Config {
	// Automatically load .env if present
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbDriver := os.Getenv("DB_DRIVER")
	if dbDriver == "" {
		dbDriver = "postgres"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}

	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "postgres"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "astfin_db"
	}

	dbSSLMode := os.Getenv("DB_SSLMODE")
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" && dbDriver == "postgres" {
		databaseURL = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode)
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./astfin.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "astfin_super_secure_jwt_secret_key_2026_xyz987"
	}

	jwtExpiresIn := 24
	if expStr := os.Getenv("JWT_EXPIRES_HOURS"); expStr != "" {
		if exp, err := strconv.Atoi(expStr); err == nil && exp > 0 {
			jwtExpiresIn = exp
		}
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}

	return &Config{
		Port:         port,
		DBDriver:     dbDriver,
		DBHost:       dbHost,
		DBPort:       dbPort,
		DBUser:       dbUser,
		DBPassword:   dbPassword,
		DBName:       dbName,
		DBSSLMode:    dbSSLMode,
		DatabaseURL:  databaseURL,
		DBPath:       dbPath,
		JWTSecret:    jwtSecret,
		JWTExpiresIn: jwtExpiresIn,
		CORSOrigin:   corsOrigin,
	}
}
