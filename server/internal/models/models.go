package models

import "time"

type Role struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	RoleID       int       `json:"role_id"`
	RoleName     string    `json:"role_name"`
	IsVerified   bool      `json:"is_verified"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	RoleName string `json:"role_name,omitempty"`
}

type LoginRequest struct {
	UsernameOrEmail string `json:"username_or_email"`
	Password        string `json:"password"`
}

type VerifyEmailRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type ResendVerificationRequest struct {
	Email string `json:"email"`
}

type AuthResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
	User      User   `json:"user"`
}

type Wallet struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	UserName      string    `json:"user_name,omitempty"`
	UserFullName  string    `json:"user_full_name,omitempty"`
	Name          string    `json:"name"`
	Type          string    `json:"type"` // Bank, E-Wallet, Cash, Credit Card
	Balance       float64   `json:"balance"` // Saldo aktif / Sisa limit kartu kredit
	CreditLimit   float64   `json:"credit_limit"` // Batas limit kartu kredit
	AccountNumber string    `json:"account_number"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Transaction struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	UserName        string    `json:"user_name,omitempty"`
	UserFullName    string    `json:"user_full_name,omitempty"`
	WalletID        int       `json:"wallet_id"`
	WalletName      string    `json:"wallet_name,omitempty"`
	Type            string    `json:"type"` // income, expense
	Amount          float64   `json:"amount"`
	Category        string    `json:"category"`
	Merchant        string    `json:"merchant"`
	Notes           string    `json:"notes"`
	ReceiptURL      string    `json:"receipt_url,omitempty"`
	OCRAccuracy     float64   `json:"ocr_accuracy,omitempty"`
	TransactionDate string    `json:"transaction_date"`
	DueDate         string    `json:"due_date,omitempty"`
	Deleted         int       `json:"deleted"`
	CreatedAt       time.Time `json:"created_at"`
}

type AdminUserOverview struct {
	UserID           int     `json:"user_id"`
	Username         string  `json:"username"`
	FullName         string  `json:"full_name"`
	Email            string  `json:"email"`
	RoleName         string  `json:"role_name"`
	IsVerified       bool    `json:"is_verified"`
	TotalWallets     int     `json:"total_wallets"`
	TotalLiquidity   float64 `json:"total_liquidity"`
	TotalExpense     float64 `json:"total_expense"`
	TotalIncome      float64 `json:"total_income"`
	TransactionCount int     `json:"transaction_count"`
	DebtCount        int     `json:"debt_count"`
	TotalDebt        float64 `json:"total_debt"`
	CreatedAt        string  `json:"created_at"`
}

type TransactionCategory struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"` // income, expense
	CreatedAt time.Time `json:"created_at"`
}

type RadarCategory struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type RadarPlatform struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type BudgetEnvelope struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	Name            string    `json:"name"`
	AllocatedAmount float64   `json:"allocated_amount"`
	SpentAmount     float64   `json:"spent_amount"`
	MonthYear       string    `json:"month_year"`
	CreatedAt       time.Time `json:"created_at"`
}

type Debt struct {
	ID           int       `json:"id"`
	UserID       int       `json:"user_id"`
	UserName     string    `json:"user_name,omitempty"`
	UserFullName string    `json:"user_full_name,omitempty"`
	WalletID     *int      `json:"wallet_id,omitempty"`
	WalletName   string    `json:"wallet_name,omitempty"`
	ContactName  string    `json:"contact_name"`
	ContactPhone string    `json:"contact_phone"`
	Type         string    `json:"type"` // hutang (kewajiban), piutang (tagihan)
	TotalAmount  float64   `json:"total_amount"`
	PaidAmount   float64   `json:"paid_amount"`
	Remaining    float64   `json:"remaining"`
	Status       string    `json:"status"` // pending, partial, paid, overdue
	DueDate      string    `json:"due_date"`
	Notes        string    `json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type DebtPaymentRequest struct {
	DebtID   int     `json:"debt_id"`
	WalletID int     `json:"wallet_id"`
	Amount   float64 `json:"amount"`
	Notes    string  `json:"notes"`
}

type RadarItem struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Category        string    `json:"category"`
	ImageURL        string    `json:"image_url"`
	TargetPrice     float64   `json:"target_price"`
	CurrentPrice    float64   `json:"current_price"`
	AllTimeLowPrice float64   `json:"all_time_low_price"`
	AllTimeHighPrice float64  `json:"all_time_high_price"`
	DealScore       float64   `json:"deal_score"`
	PriorityScore   float64   `json:"priority_score"`
	Platform        string    `json:"platform"` // Tokopedia, Shopee, Blibli, etc.
	URL             string    `json:"url"`
	Status          string    `json:"status"` // monitoring, target_hit, bought
	SavedAmount     float64   `json:"saved_amount"`
	Qty             int       `json:"qty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ProcurementSettings struct {
	UserID        int       `json:"user_id"`
	UtilityWeight int       `json:"utility_weight"` // Urgensi Kebutuhan %
	DesireWeight  int       `json:"desire_weight"`  // Tingkat Keinginan %
	SavingWeight  int       `json:"saving_weight"`  // Kesiapan Tabungan %
	UpdatedAt     time.Time `json:"updated_at"`
}

type PantryItem struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Name        string    `json:"name"`
	Category    string    `json:"category"` // Kulkas, Freezer, Lemari Kering
	Quantity    float64   `json:"quantity"`
	Unit        string    `json:"unit"` // Butir, Pouch, Kotak, Botol, etc.
	MinQuantity float64   `json:"min_quantity"`
	ExpiryDate  string    `json:"expiry_date"`
	Price       float64   `json:"price"` // Harga beli / referensi awal
	Status      string    `json:"status"` // safe, expiring_soon, critical, out_of_stock
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PantryStorageZone struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type ShoppingItem struct {
	ID                  int       `json:"id"`
	UserID              int       `json:"user_id"`
	PantryItemID        *int      `json:"pantry_item_id,omitempty"`
	Name                string    `json:"name"`
	EstimatedPrice      float64   `json:"estimated_price"`
	StoreRecommendation string    `json:"store_recommendation"`
	IsChecked           bool      `json:"is_checked"`
	CreatedAt           time.Time `json:"created_at"`
}

type UrgentAlert struct {
	ID          string  `json:"id"`
	Module      string  `json:"module"` // PriceRadar, Pantry, DebtTracker
	Type        string  `json:"type"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"` // critical, warning, info
	ImageURL    string  `json:"image_url,omitempty"`
	ActionURL   string  `json:"action_url"`
	ActionText  string  `json:"action_text"`
	Amount      float64 `json:"amount,omitempty"`
}

type MonthlyCashflowPoint struct {
	MonthName    string  `json:"month_name"`
	Income       float64 `json:"income"`
	Expense      float64 `json:"expense"`
	DebtPayments float64 `json:"debt_payments"`
}

type DashboardSummary struct {
	NetLiquidity       float64                `json:"net_liquidity"`
	WalletsCount       int                    `json:"wallets_count"`
	SurplusThisMonth   float64                `json:"surplus_this_month"`
	NetDebt            float64                `json:"net_debt"`
	TotalPiutang       float64                `json:"total_piutang"`
	TotalHutang        float64                `json:"total_hutang"`
	OverdueDebtsCount  int                    `json:"overdue_debts_count"`
	RadarSignalsCount  int                    `json:"radar_signals_count"`
	RadarReadySavings  float64                `json:"radar_ready_savings"`
	AvgDealScore       float64                `json:"avg_deal_score"`
	PantrySafeCount    int                    `json:"pantry_safe_count"`
	PantryCriticalCount int                   `json:"pantry_critical_count"`
	PantryRestockCount int                    `json:"pantry_restock_count"`
	RecentTransactions []Transaction          `json:"recent_transactions"`
	UrgentAlerts       []UrgentAlert          `json:"urgent_alerts"`
	CashflowTrend      []MonthlyCashflowPoint `json:"cashflow_trend"`
}

// ==========================================
// Compare Price Product Models
// ==========================================

type Store struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Name          string    `json:"name"`
	StoreType     string    `json:"store_type"` // minimarket, supermarket, pasar, tukang_sayur, grosir, online
	AddressText   string    `json:"address_text,omitempty"`
	Lat           *float64  `json:"lat,omitempty"`
	Lng           *float64  `json:"lng,omitempty"`
	IsMobile      bool      `json:"is_mobile"`
	PublicStoreID *int      `json:"public_store_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type ProductCategory struct {
	ID                    int       `json:"id"`
	UserID                *int      `json:"user_id,omitempty"`
	Name                  string    `json:"name"`
	GroupCode             string    `json:"group_code"`
	ShelfLifeRoomDays     *int      `json:"shelf_life_room_days,omitempty"`
	ShelfLifeChillerDays  *int      `json:"shelf_life_chiller_days,omitempty"`
	ShelfLifeFreezerDays  *int      `json:"shelf_life_freezer_days,omitempty"`
	ThresholdCheapPct     *float64  `json:"threshold_cheap_pct,omitempty"`
	ThresholdExpensivePct *float64  `json:"threshold_expensive_pct,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
}

type PriceProduct struct {
	ID                 int          `json:"id"`
	UserID             int          `json:"user_id"`
	CategoryID         *int         `json:"category_id,omitempty"`
	CategoryName       string       `json:"category_name,omitempty"`
	CanonicalProductID *int         `json:"canonical_product_id,omitempty"`
	Name               string       `json:"name"`
	NameNormalized     string       `json:"name_normalized"`
	BaseUnit           string       `json:"base_unit"` // pcs, kg, liter, gram
	ImageURL           string       `json:"image_url,omitempty"`
	Barcode            string       `json:"barcode,omitempty"`
	Notes              string       `json:"notes,omitempty"`
	LastPricePerUnit   float64      `json:"last_price_per_unit,omitempty"`
	MinPricePerUnit    float64      `json:"min_price_per_unit,omitempty"`
	MaxPricePerUnit    float64      `json:"max_price_per_unit,omitempty"`
	AvgPricePerUnit    float64      `json:"avg_price_per_unit,omitempty"`
	CheapestStoreName  string       `json:"cheapest_store_name,omitempty"`
	EntriesCount       int          `json:"entries_count,omitempty"`
	PriceTrend         string       `json:"price_trend,omitempty"` // up, down, flat
	LastObservedAt     string       `json:"last_observed_at,omitempty"`
	CreatedAt          time.Time    `json:"created_at"`
	Entries            []PriceEntry `json:"entries"`
}

type PriceEntry struct {
	ID                int       `json:"id"`
	UserID            int       `json:"user_id"`
	ProductID         int       `json:"product_id"`
	ProductName       string    `json:"product_name,omitempty"`
	StoreID           *int      `json:"store_id,omitempty"`
	StoreName         string    `json:"store_name,omitempty"`
	StoreType         string    `json:"store_type,omitempty"`
	EntryType         string    `json:"entry_type"` // observation, purchase
	PurchaseUnit      string    `json:"purchase_unit"`
	PurchaseQty       float64   `json:"purchase_qty"`
	UnitsPerPackage   *float64  `json:"units_per_package,omitempty"`
	TotalUnits        float64   `json:"total_units"`
	PriceTotal        float64   `json:"price_total"`
	DiscountType      string    `json:"discount_type,omitempty"` // amount, percent
	DiscountValue     float64   `json:"discount_value"`
	DiscountAmount    float64   `json:"discount_amount"`
	PriceFinal        float64   `json:"price_final"`
	PricePerUnit      float64   `json:"price_per_unit"`
	Lat               *float64  `json:"lat,omitempty"`
	Lng               *float64  `json:"lng,omitempty"`
	AddressText       string    `json:"address_text,omitempty"`
	ObservedAt        string    `json:"observed_at"` // YYYY-MM-DD
	PhotoURL          string    `json:"photo_url,omitempty"`
	Notes             string    `json:"notes,omitempty"`
	IgnoreInStats     bool      `json:"ignore_in_stats"`
	ShareToCommunity  bool      `json:"share_to_community"`
	TransactionID     *int      `json:"transaction_id,omitempty"`
	PantryItemID      *int      `json:"pantry_item_id,omitempty"`
	ExpiryDate        string    `json:"expiry_date,omitempty"`
	ExpiryIsEstimated bool      `json:"expiry_is_estimated"`
	StorageType       string    `json:"storage_type,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

type PriceSettings struct {
	UserID                int     `json:"user_id"`
	ThresholdMode         string  `json:"threshold_mode"` // percent, percentile
	ThresholdCheapPct     float64 `json:"threshold_cheap_pct"`
	ThresholdExpensivePct float64 `json:"threshold_expensive_pct"`
	PeriodDays            int     `json:"period_days"`
	DefaultSource         string  `json:"default_source"` // personal, community, combined
	ShareAllEntries       bool    `json:"share_all_entries"`
}

type PriceCheckRequest struct {
	ProductName     string   `json:"product_name"`
	Barcode         string   `json:"barcode,omitempty"`
	PurchaseUnit    string   `json:"purchase_unit"`
	PurchaseQty     float64  `json:"purchase_qty"`
	UnitsPerPackage *float64 `json:"units_per_package,omitempty"`
	PriceTotal      float64  `json:"price_total"`
	DiscountType    string   `json:"discount_type,omitempty"`
	DiscountValue   float64  `json:"discount_value"`
	StoreID         *int     `json:"store_id,omitempty"`
}

type PriceCheckResult struct {
	NormalizedPricePerUnit float64      `json:"normalized_price_per_unit"`
	BaseUnit               string       `json:"base_unit"`
	Verdict                string       `json:"verdict"`       // cheap, fair, expensive, not_enough_data
	VerdictLabel           string       `json:"verdict_label"` // Murah, Wajar, Mahal, Data Belum Cukup
	ThresholdUsedPct       float64      `json:"threshold_used_pct"`
	DiffPercentage         float64      `json:"diff_percentage"`
	MedianPrice            float64      `json:"median_price"`
	AvgPrice               float64      `json:"avg_price"`
	MinPrice               float64      `json:"min_price"`
	MaxPrice               float64      `json:"max_price"`
	CheapestStoreName      string       `json:"cheapest_store_name,omitempty"`
	CheapestDate           string       `json:"cheapest_date,omitempty"`
	EntriesAnalyzedCount   int          `json:"entries_analyzed_count"`
	Recommendation         string       `json:"recommendation,omitempty"`
	RecentHistory          []PriceEntry `json:"recent_history,omitempty"`
}

// ==========================================
// WhatsApp & Reminder Setting Models
// ==========================================

type WhatsAppSettings struct {
	ID                    int       `json:"id"`
	UserID                int       `json:"user_id"`
	PhoneNumber           string    `json:"phone_number"`
	IsEnabled             bool      `json:"is_enabled"`
	Provider              string    `json:"provider"` // wa_me, fonnte, wablas, custom_gateway
	APIKey                string    `json:"api_key"`
	GatewayURL            string    `json:"gateway_url"`
	ReminderTime          string    `json:"reminder_time"`
	PantryExpiryEnabled   bool      `json:"pantry_expiry_enabled"`
	PantryDaysBefore      int       `json:"pantry_days_before"`
	DebtDueEnabled        bool      `json:"debt_due_enabled"`
	DebtDaysBefore        int       `json:"debt_days_before"`
	DebtOverdueEnabled    bool      `json:"debt_overdue_enabled"`
	PantryLowStockEnabled bool      `json:"pantry_low_stock_enabled"`
	RadarTargetEnabled    bool      `json:"radar_target_enabled"`
	BudgetAlertEnabled    bool      `json:"budget_alert_enabled"`
	TemplatePantryExpiry  string    `json:"template_pantry_expiry"`
	TemplateDebtDue       string    `json:"template_debt_due"`
	TemplateDebtOverdue   string    `json:"template_debt_overdue"`
	TemplateLowStock      string    `json:"template_low_stock"`
	TemplateRadarTarget   string    `json:"template_radar_target"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type WhatsAppQueueItem struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"` // pantry_expiry, debt_due, debt_overdue, low_stock, radar_target
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"` // critical, warning, info
	Phone       string  `json:"phone"`
	Message     string  `json:"message"`
	WaLink      string  `json:"wa_link"`
	TargetDate  string  `json:"target_date,omitempty"`
	Amount      float64 `json:"amount,omitempty"`
	DaysLeft    int     `json:"days_left"`
	ModuleName  string  `json:"module_name"`
	ItemName    string  `json:"item_name"`
}

type WhatsAppQueueResponse struct {
	TotalAlerts  int                 `json:"total_alerts"`
	PantryAlerts int                 `json:"pantry_alerts"`
	DebtAlerts   int                 `json:"debt_alerts"`
	RadarAlerts  int                 `json:"radar_alerts"`
	Items        []WhatsAppQueueItem `json:"items"`
	DailyDigest  string              `json:"daily_digest"`
	DigestWaLink string              `json:"digest_wa_link"`
}

type WhatsAppTestSendRequest struct {
	PhoneNumber string `json:"phone_number"`
	Message     string `json:"message"`
	Provider    string `json:"provider"`
	APIKey      string `json:"api_key"`
	GatewayURL  string `json:"gateway_url"`
}

type WhatsAppDispatchAlertRequest struct {
	AlertID     string `json:"alert_id"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	PhoneNumber string `json:"phone_number"`
	Message     string `json:"message"`
}

type WhatsAppLog struct {
	ID             int       `json:"id"`
	UserID         int       `json:"user_id"`
	ReminderType   string    `json:"reminder_type"`
	Title          string    `json:"title"`
	RecipientPhone string    `json:"recipient_phone"`
	Message        string    `json:"message"`
	Status         string    `json:"status"`
	ErrorMessage   string    `json:"error_message,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}


