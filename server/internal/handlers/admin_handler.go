package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
)

type AdminHandler struct {
	db *database.DB
}

func NewAdminHandler(db *database.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// GetOverview returns financial metrics segregated by each user account
func (h *AdminHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	callerRole := strings.ToLower(middleware.GetUserRole(r))
	if callerRole != "admin" && callerRole != "finance" {
		utils.JSONError(w, http.StatusForbidden, "Akses ditolak: Hanya Admin dan Finance yang berhak mengakses Portal Administrasi")
		return
	}

	query := `
		SELECT 
			u.id, u.username, u.full_name, u.email, r.name as role_name, u.is_verified,
			u.created_at,
			(SELECT COUNT(*) FROM wallets w WHERE w.user_id = u.id) as total_wallets,
			(SELECT COALESCE(SUM(balance), 0.0) FROM wallets w WHERE w.user_id = u.id AND w.type NOT IN ('Credit Card', 'Kartu Kredit')) as total_liquidity,
			(SELECT COALESCE(SUM(amount), 0.0) FROM transactions t WHERE t.user_id = u.id AND t.deleted = 0 AND t.type = 'expense') as total_expense,
			(SELECT COALESCE(SUM(amount), 0.0) FROM transactions t WHERE t.user_id = u.id AND t.deleted = 0 AND t.type = 'income') as total_income,
			(SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id AND t.deleted = 0) as transaction_count,
			(SELECT COUNT(*) FROM debts d WHERE d.user_id = u.id AND d.status != 'paid') as debt_count,
			(SELECT COALESCE(SUM(total_amount - paid_amount), 0.0) FROM debts d WHERE d.user_id = u.id AND d.type = 'hutang' AND d.status != 'paid') as total_debt
		FROM users u
		JOIN roles r ON u.role_id = r.id
		ORDER BY u.id ASC
	`

	rows, err := h.db.Query(query)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil data ringkasan administrasi: "+err.Error())
		return
	}
	defer rows.Close()

	var overviews []models.AdminUserOverview
	var globalLiquidity, globalExpense, globalIncome, globalDebt float64
	var globalTransactions int

	for rows.Next() {
		var o models.AdminUserOverview
		var createdAt sql.NullTime
		if err := rows.Scan(
			&o.UserID, &o.Username, &o.FullName, &o.Email, &o.RoleName, &o.IsVerified,
			&createdAt,
			&o.TotalWallets, &o.TotalLiquidity, &o.TotalExpense, &o.TotalIncome,
			&o.TransactionCount, &o.DebtCount, &o.TotalDebt,
		); err == nil {
			if createdAt.Valid {
				o.CreatedAt = createdAt.Time.Format("2006-01-02 15:04")
			}
			globalLiquidity += o.TotalLiquidity
			globalExpense += o.TotalExpense
			globalIncome += o.TotalIncome
			globalDebt += o.TotalDebt
			globalTransactions += o.TransactionCount

			overviews = append(overviews, o)
		}
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"users_overview": overviews,
		"global_summary": map[string]interface{}{
			"total_users":        len(overviews),
			"total_liquidity":    globalLiquidity,
			"total_expense":      globalExpense,
			"total_income":       globalIncome,
			"total_debt":         globalDebt,
			"total_transactions": globalTransactions,
		},
	})
}
