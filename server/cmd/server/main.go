package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"astfin/server/internal/config"
	"astfin/server/internal/database"
	"astfin/server/internal/handlers"
	"astfin/server/internal/middleware"
	"astfin/server/internal/utils"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	cfg := config.Load()

	// Initialize Database (PostgreSQL / SQLite)
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Fatal: Database initialization error: %v", err)
	}
	defer db.Close()
	log.Printf("Database connection established using driver '%s'", cfg.DBDriver)

	// Handlers
	authH := handlers.NewAuthHandler(db, cfg)
	walletH := handlers.NewWalletHandler(db)
	trH := handlers.NewTransactionHandler(db)
	debtH := handlers.NewDebtHandler(db)
	radarH := handlers.NewRadarHandler(db)
	pantryH := handlers.NewPantryHandler(db)
	dashH := handlers.NewDashboardHandler(db)
	priceH := handlers.NewPriceHandler(db)
	uploadH := handlers.NewUploadHandler("./uploads")

	r := chi.NewRouter()

	// Global Middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(30 * time.Second))
	r.Use(chimiddleware.Compress(5))
	r.Use(middleware.SecurityHeaders)

	// Rate Limiting (600 requests per minute per IP)
	rateLimiter := middleware.NewRateLimiter(600, time.Minute)
	r.Use(rateLimiter.Limit)

	// CORS Configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		utils.JSON(w, http.StatusOK, map[string]interface{}{
			"status":  "healthy",
			"engine":  "OmniLife Nexus Core v2.4",
			"runtime": "Golang High-Performance REST API",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	// Serve Static Uploads
	workDir, _ := os.Getwd()
	uploadsPath := filepath.Join(workDir, "uploads")
	_ = os.MkdirAll(uploadsPath, 0755)
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsPath))))

	// API V1
	r.Route("/api/v1", func(api chi.Router) {
		// Public Auth
		api.Post("/auth/register", authH.Register)
		api.Post("/auth/login", authH.Login)
		api.Get("/auth/roles", authH.GetRoles)
		api.Post("/auth/verify-email", authH.VerifyEmail)
		api.Post("/auth/resend-verification", authH.ResendVerificationCode)

		// Protected Routes
		api.Group(func(p chi.Router) {
			p.Use(middleware.AuthMiddleware(cfg.JWTSecret))

			// User info
			p.Get("/auth/me", authH.Me)

			// Executive Dashboard Summary
			p.Get("/dashboard/summary", dashH.GetSummary)

			// Wallets & Digital Envelopes
			p.Get("/wallets", walletH.GetWallets)
			p.Post("/wallets", walletH.CreateWallet)
			p.Put("/wallets/{id}", walletH.UpdateWallet)
			p.Delete("/wallets/{id}", walletH.DeleteWallet)
			p.Post("/wallets/{id}/pay-card", walletH.PayCreditCard)
			p.Post("/wallets/{id}/adjust-limit", walletH.AdjustCreditLimit)

			p.Get("/envelopes", walletH.GetEnvelopes)
			p.Post("/envelopes", walletH.CreateEnvelope)

			// Transactions, Categories & OCR
			p.Get("/transactions", trH.GetTransactions)
			p.Post("/transactions", trH.CreateTransaction)
			p.Delete("/transactions/{id}", trH.DeleteTransaction)
			p.Post("/transactions/scan-ocr", trH.ScanReceiptOCR)
			p.Get("/transaction-categories", trH.GetCategories)
			p.Post("/transaction-categories", trH.CreateCategory)

			// Debts & Piutang
			p.Get("/debts", debtH.GetDebts)
			p.Post("/debts", debtH.CreateDebt)
			p.Post("/debts/payment", debtH.RecordPayment)
			p.Delete("/debts/{id}", debtH.DeleteDebt)

			// Radar & Rational Procurement
			p.Get("/radar/categories", radarH.GetCategories)
			p.Post("/radar/categories", radarH.CreateCategory)
			p.Get("/radar/platforms", radarH.GetPlatforms)
			p.Post("/radar/platforms", radarH.CreatePlatform)
			p.Get("/radar/settings", radarH.GetProcurementSettings)
			p.Post("/radar/settings", radarH.UpdateProcurementSettings)
			p.Get("/radar-categories", radarH.GetCategories)
			p.Post("/radar-categories", radarH.CreateCategory)
			p.Get("/radar-platforms", radarH.GetPlatforms)
			p.Post("/radar-platforms", radarH.CreatePlatform)
			p.Get("/radar", radarH.GetRadarItems)
			p.Post("/radar", radarH.CreateRadarItem)
			p.Put("/radar/{id}", radarH.UpdateRadarItem)
			p.Delete("/radar/{id}", radarH.DeleteRadarItem)

			// Pantry & Smart Shopping List
			p.Get("/pantry/zones", pantryH.GetStorageZones)
			p.Post("/pantry/zones", pantryH.CreateStorageZone)
			p.Get("/pantry-zones", pantryH.GetStorageZones)
			p.Post("/pantry-zones", pantryH.CreateStorageZone)
			p.Get("/pantry", pantryH.GetPantryItems)
			p.Post("/pantry", pantryH.CreatePantryItem)
			p.Put("/pantry/{id}/quantity", pantryH.UpdatePantryQuantity)
			p.Delete("/pantry/{id}", pantryH.DeletePantryItem)

			p.Get("/shopping", pantryH.GetShoppingList)
			p.Post("/shopping", pantryH.AddShoppingItem)
			p.Post("/shopping/checkout", pantryH.CheckoutShopping)
			p.Put("/shopping/{id}/toggle", pantryH.ToggleShoppingItem)
			p.Delete("/shopping/{id}", pantryH.DeleteShoppingItem)

			// Compare Price Product & Crowdsourced Observation
			p.Get("/price/stores", priceH.GetStores)
			p.Post("/price/stores", priceH.CreateStore)
			p.Put("/price/stores/{id}", priceH.UpdateStore)
			p.Delete("/price/stores/{id}", priceH.DeleteStore)

			p.Get("/price/categories", priceH.GetProductCategories)
			p.Get("/price/products", priceH.GetPriceProducts)
			p.Post("/price/products", priceH.CreatePriceProduct)
			p.Get("/price/products/{id}", priceH.GetPriceProductDetail)
			p.Put("/price/products/{id}", priceH.UpdatePriceProduct)
			p.Delete("/price/products/{id}", priceH.DeletePriceProduct)
			p.Post("/price/products/{id}/entries", priceH.AddPriceEntry)
			p.Delete("/price/entries/{id}", priceH.DeletePriceEntry)

			// File Upload
			p.Post("/upload", uploadH.UploadFile)

			p.Post("/price/check", priceH.PriceCheck)
			p.Get("/price/settings", priceH.GetPriceSettings)
			p.Post("/price/settings", priceH.UpdatePriceSettings)

			// Geocoding Proxy (OpenStreetMap Nominatim with Rate-Limiting & In-Memory Cache)
			p.Get("/geo/search", priceH.SearchGeo)
			p.Get("/geo/reverse", priceH.ReverseGeo)

			// Admin Only: User & Role Management
			p.Group(func(admin chi.Router) {
				admin.Use(middleware.RequireRole("admin"))
				admin.Get("/admin/users", authH.GetUsers)
				admin.Post("/admin/users", authH.CreateUserByAdmin)
				admin.Put("/admin/users/{id}/role", authH.UpdateUserRole)
				admin.Delete("/admin/users/{id}", authH.DeleteUserByAdmin)
			})
		})
	})

	// Server Graceful Shutdown Setup
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("OmniLife Nexus REST API listening on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}
	log.Println("Server exited cleanly.")
}
