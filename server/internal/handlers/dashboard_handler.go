package handlers

import (
	"fmt"
	"math"
	"net/http"
	"time"

	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
)

type DashboardHandler struct {
	db *database.DB
}

func NewDashboardHandler(db *database.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	now := time.Now()
	todayStr := now.Format("2006-01-02")
	firstDayOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	summary := models.DashboardSummary{
		RecentTransactions: make([]models.Transaction, 0),
		UrgentAlerts:       make([]models.UrgentAlert, 0),
		CashflowTrend:      make([]models.MonthlyCashflowPoint, 0),
	}

	// 1. Wallets & Net Liquidity
	_ = h.db.QueryRow(`
		SELECT COALESCE(SUM(balance), 0), COUNT(*)
		FROM wallets
		WHERE user_id = ?
	`, userID).Scan(&summary.NetLiquidity, &summary.WalletsCount)

	// 2. Surplus this month (Income - Expense)
	var monthIncome, monthExpense float64
	_ = h.db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE user_id = ? AND deleted = 0 AND transaction_date >= ?
	`, userID, firstDayOfMonth).Scan(&monthIncome, &monthExpense)
	summary.SurplusThisMonth = monthIncome - monthExpense

	// 3. Debts (Piutang & Hutang)
	_ = h.db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN type = 'piutang' THEN total_amount - paid_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN type = 'hutang' THEN total_amount - paid_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN due_date < ? AND status != 'paid' THEN 1 ELSE 0 END), 0)
		FROM debts
		WHERE user_id = ? AND status != 'paid'
	`, todayStr, userID).Scan(&summary.TotalPiutang, &summary.TotalHutang, &summary.OverdueDebtsCount)
	summary.NetDebt = summary.TotalPiutang - summary.TotalHutang

	// 4. Radar & WishBoard
	var totalDealScore float64
	var radarTotal int
	_ = h.db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN current_price <= target_price AND status != 'bought' THEN 1 ELSE 0 END), 0),
		       COALESCE(SUM(saved_amount), 0),
		       COALESCE(SUM(deal_score), 0),
		       COUNT(*)
		FROM radar_items
		WHERE user_id = ?
	`, userID).Scan(&summary.RadarSignalsCount, &summary.RadarReadySavings, &totalDealScore, &radarTotal)
	if radarTotal > 0 {
		summary.AvgDealScore = math.Round((totalDealScore/float64(radarTotal))*10) / 10
	}

	// 5. Pantry Stats
	threeDaysAhead := now.AddDate(0, 0, 3).Format("2006-01-02")
	_ = h.db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN quantity > min_quantity AND expiry_date > ? THEN 1 ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN expiry_date <= ? AND quantity > 0 THEN 1 ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN quantity <= 0 OR quantity <= min_quantity THEN 1 ELSE 0 END), 0)
		FROM pantry_items
		WHERE user_id = ?
	`, threeDaysAhead, threeDaysAhead, userID).Scan(&summary.PantrySafeCount, &summary.PantryCriticalCount, &summary.PantryRestockCount)

	// 6. Recent Transactions
	trRows, err := h.db.Query(`
		SELECT t.id, t.user_id, t.wallet_id, COALESCE(w.name, 'Wallet') as wallet_name,
		       t.type, t.amount, t.category, t.merchant, COALESCE(t.notes, ''),
		       COALESCE(t.receipt_url, ''), t.ocr_accuracy, t.transaction_date, t.created_at
		FROM transactions t
		LEFT JOIN wallets w ON t.wallet_id = w.id
		WHERE t.user_id = ? AND t.deleted = 0
		ORDER BY t.transaction_date DESC, t.id DESC
		LIMIT 5
	`, userID)
	if err == nil {
		defer trRows.Close()
		for trRows.Next() {
			var tr models.Transaction
			if err := trRows.Scan(
				&tr.ID, &tr.UserID, &tr.WalletID, &tr.WalletName, &tr.Type, &tr.Amount,
				&tr.Category, &tr.Merchant, &tr.Notes, &tr.ReceiptURL, &tr.OCRAccuracy,
				&tr.TransactionDate, &tr.CreatedAt,
			); err == nil {
				summary.RecentTransactions = append(summary.RecentTransactions, tr)
			}
		}
	}

	// 7. Dynamic Urgent Alerts
	// A: Overdue Debts Alert
	var overdueDebt models.Debt
	err = h.db.QueryRow(`
		SELECT id, contact_name, total_amount - paid_amount, due_date
		FROM debts
		WHERE user_id = ? AND due_date < ? AND status != 'paid'
		ORDER BY due_date ASC LIMIT 1
	`, userID, todayStr).Scan(&overdueDebt.ID, &overdueDebt.ContactName, &overdueDebt.Remaining, &overdueDebt.DueDate)
	if err == nil && overdueDebt.ContactName != "" {
		summary.UrgentAlerts = append(summary.UrgentAlerts, models.UrgentAlert{
			ID:          fmt.Sprintf("debt-%d", overdueDebt.ID),
			Module:      "DebtTracker",
			Type:        "overdue_debt",
			Title:       fmt.Sprintf("PIUTANG OVERDUE: %s", overdueDebt.ContactName),
			Description: fmt.Sprintf("Tagihan jatuh tempo %s sebesar Rp %s belum diselesaikan.", overdueDebt.DueDate, utils.FormatRupiah(overdueDebt.Remaining)),
			Severity:    "critical",
			ActionURL:   "/finansial-kas",
			ActionText:  "Tagih WhatsApp",
			Amount:      overdueDebt.Remaining,
		})
	}

	// B: Expiring Pantry Alert
	var criticalPantry models.PantryItem
	err = h.db.QueryRow(`
		SELECT id, name, category, expiry_date, quantity, unit
		FROM pantry_items
		WHERE user_id = ? AND expiry_date <= ? AND quantity > 0
		ORDER BY expiry_date ASC LIMIT 1
	`, userID, threeDaysAhead).Scan(&criticalPantry.ID, &criticalPantry.Name, &criticalPantry.Category, &criticalPantry.ExpiryDate, &criticalPantry.Quantity, &criticalPantry.Unit)
	if err == nil && criticalPantry.Name != "" {
		summary.UrgentAlerts = append(summary.UrgentAlerts, models.UrgentAlert{
			ID:          fmt.Sprintf("pantry-%d", criticalPantry.ID),
			Module:      "StockPantry",
			Type:        "expiring_soon",
			Title:       fmt.Sprintf("KEDALUWARSA DEKAT: %s", criticalPantry.Name),
			Description: fmt.Sprintf("Bahan di %s tersisa %.0f %s, kedaluwarsa pada %s. Segera habiskan!", criticalPantry.Category, criticalPantry.Quantity, criticalPantry.Unit, criticalPantry.ExpiryDate),
			Severity:    "warning",
			ActionURL:   "/dapur-inventaris",
			ActionText:  "Buka Pantry",
		})
	}

	// C: Target Hit Radar Alert
	var targetRadar models.RadarItem
	err = h.db.QueryRow(`
		SELECT id, title, current_price, target_price, platform
		FROM radar_items
		WHERE user_id = ? AND current_price <= target_price AND status != 'bought'
		ORDER BY deal_score DESC LIMIT 1
	`, userID).Scan(&targetRadar.ID, &targetRadar.Title, &targetRadar.CurrentPrice, &targetRadar.TargetPrice, &targetRadar.Platform)
	if err == nil && targetRadar.Title != "" {
		summary.UrgentAlerts = append(summary.UrgentAlerts, models.UrgentAlert{
			ID:          fmt.Sprintf("radar-%d", targetRadar.ID),
			Module:      "PriceRadar",
			Type:        "target_hit",
			Title:       fmt.Sprintf("TARGET HARGA HIT: %s", targetRadar.Title),
			Description: fmt.Sprintf("Menyentuh harga target Rp %s di %s. Sinyal siap eksekusi!", utils.FormatRupiah(targetRadar.CurrentPrice), targetRadar.Platform),
			Severity:    "info",
			ActionURL:   "/pengadaan-radar",
			ActionText:  "Sikat Promo",
			Amount:      targetRadar.CurrentPrice,
		})
	}

	// 8. Cashflow Trend (Past 6 Months)
	for i := 5; i >= 0; i-- {
		targetMonth := now.AddDate(0, -i, 0)
		monthStart := time.Date(targetMonth.Year(), targetMonth.Month(), 1, 0, 0, 0, 0, targetMonth.Location()).Format("2006-01-02")
		nextMonthStart := time.Date(targetMonth.Year(), targetMonth.Month()+1, 1, 0, 0, 0, 0, targetMonth.Location()).Format("2006-01-02")
		monthName := targetMonth.Format("Jan")

		var inc, exp float64
		_ = h.db.QueryRow(`
			SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
			       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
			FROM transactions
			WHERE user_id = ? AND deleted = 0 AND transaction_date >= ? AND transaction_date < ?
		`, userID, monthStart, nextMonthStart).Scan(&inc, &exp)

		var debtPay float64
		_ = h.db.QueryRow(`
			SELECT COALESCE(SUM(dp.amount), 0)
			FROM debt_payments dp
			JOIN debts d ON dp.debt_id = d.id
			WHERE d.user_id = ? AND dp.payment_date >= ? AND dp.payment_date < ?
		`, userID, monthStart, nextMonthStart).Scan(&debtPay)

		summary.CashflowTrend = append(summary.CashflowTrend, models.MonthlyCashflowPoint{
			MonthName:    monthName,
			Income:       inc,
			Expense:      exp,
			DebtPayments: debtPay,
		})
	}

	utils.JSON(w, http.StatusOK, summary)
}
