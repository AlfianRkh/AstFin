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

type AuthResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
	User      User   `json:"user"`
}

type Wallet struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
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
	CreatedAt       time.Time `json:"created_at"`
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
