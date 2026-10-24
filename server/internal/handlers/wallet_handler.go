package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
	"github.com/go-chi/chi/v5"
)

type WalletHandler struct {
	db *database.DB
}

func NewWalletHandler(db *database.DB) *WalletHandler {
	return &WalletHandler{db: db}
}

func (h *WalletHandler) GetWallets(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	rows, err := h.db.Query(`
		SELECT id, user_id, name, type, balance, COALESCE(credit_limit, 0.0), account_number, created_at, updated_at
		FROM wallets
		WHERE user_id = ?
		ORDER BY id ASC
	`, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch wallets: "+err.Error())
		return
	}
	defer rows.Close()

	wallets := make([]models.Wallet, 0)
	var totalLiquidity float64
	for rows.Next() {
		var wl models.Wallet
		var accNum sql.NullString
		if err := rows.Scan(&wl.ID, &wl.UserID, &wl.Name, &wl.Type, &wl.Balance, &wl.CreditLimit, &accNum, &wl.CreatedAt, &wl.UpdatedAt); err == nil {
			if accNum.Valid {
				wl.AccountNumber = accNum.String
			}
			if wl.Type != "Credit Card" && wl.Type != "Kartu Kredit" {
				totalLiquidity += wl.Balance
			}
			wallets = append(wallets, wl)
		}
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"wallets":         wallets,
		"total_liquidity": totalLiquidity,
	})
}

func (h *WalletHandler) CreateWallet(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Name          string  `json:"name"`
		Type          string  `json:"type"` // Bank, E-Wallet, Cash, Credit Card
		InitialAmount float64 `json:"initial_amount"`
		CreditLimit   float64 `json:"credit_limit"`
		AccountNumber string  `json:"account_number"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.JSONError(w, http.StatusBadRequest, "Wallet name is required")
		return
	}
	if req.Type == "" {
		req.Type = "Bank"
	}

	// For Credit Card wallets, default available balance to credit limit if not specified
	if req.Type == "Credit Card" || req.Type == "Kartu Kredit" {
		if req.CreditLimit <= 0 && req.InitialAmount > 0 {
			req.CreditLimit = req.InitialAmount
		} else if req.InitialAmount <= 0 && req.CreditLimit > 0 {
			req.InitialAmount = req.CreditLimit
		}
	}

	walletID, err := h.db.Insert(`
		INSERT INTO wallets (user_id, name, type, balance, credit_limit, account_number)
		VALUES (?, ?, ?, ?, ?, ?)
	`, userID, req.Name, req.Type, req.InitialAmount, req.CreditLimit, req.AccountNumber)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to create wallet: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Dompet berhasil ditambahkan", map[string]interface{}{
		"id":             walletID,
		"name":           req.Name,
		"type":           req.Type,
		"balance":        req.InitialAmount,
		"credit_limit":   req.CreditLimit,
		"account_number": req.AccountNumber,
	})
}

func (h *WalletHandler) UpdateWallet(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	walletID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid wallet ID")
		return
	}

	var req struct {
		Name          string   `json:"name"`
		Type          string   `json:"type"`
		Balance       *float64 `json:"balance"`
		CreditLimit   *float64 `json:"credit_limit"`
		AccountNumber string   `json:"account_number"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var current models.Wallet
	err = h.db.QueryRow("SELECT id, name, type, balance, COALESCE(credit_limit, 0.0), account_number FROM wallets WHERE id = ? AND user_id = ?", walletID, userID).
		Scan(&current.ID, &current.Name, &current.Type, &current.Balance, &current.CreditLimit, &current.AccountNumber)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Wallet not found")
		return
	}

	if req.Name != "" {
		current.Name = strings.TrimSpace(req.Name)
	}
	if req.Type != "" {
		current.Type = strings.TrimSpace(req.Type)
	}
	if req.AccountNumber != "" {
		current.AccountNumber = strings.TrimSpace(req.AccountNumber)
	}
	if req.Balance != nil {
		current.Balance = *req.Balance
	}
	if req.CreditLimit != nil {
		current.CreditLimit = *req.CreditLimit
	}

	_, err = h.db.Exec(`
		UPDATE wallets
		SET name = ?, type = ?, balance = ?, credit_limit = ?, account_number = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ?
	`, current.Name, current.Type, current.Balance, current.CreditLimit, current.AccountNumber, walletID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to update wallet")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Dompet berhasil diperbarui", current)
}

func (h *WalletHandler) DeleteWallet(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	walletID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid wallet ID")
		return
	}

	_, err = h.db.Exec("DELETE FROM wallets WHERE id = ? AND user_id = ?", walletID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to delete wallet")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Dompet berhasil dihapus", nil)
}

// Budget Envelopes Handlers
func (h *WalletHandler) GetEnvelopes(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	rows, err := h.db.Query(`
		SELECT id, user_id, name, allocated_amount, spent_amount, month_year, created_at
		FROM budget_envelopes
		WHERE user_id = ?
		ORDER BY id ASC
	`, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch envelopes")
		return
	}
	defer rows.Close()

	envelopes := make([]models.BudgetEnvelope, 0)
	for rows.Next() {
		var env models.BudgetEnvelope
		if err := rows.Scan(&env.ID, &env.UserID, &env.Name, &env.AllocatedAmount, &env.SpentAmount, &env.MonthYear, &env.CreatedAt); err == nil {
			envelopes = append(envelopes, env)
		}
	}

	utils.JSON(w, http.StatusOK, envelopes)
}

func (h *WalletHandler) CreateEnvelope(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Name            string  `json:"name"`
		AllocatedAmount float64 `json:"allocated_amount"`
		MonthYear       string  `json:"month_year"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" || req.AllocatedAmount <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Valid name and allocated amount are required")
		return
	}
	if req.MonthYear == "" {
		req.MonthYear = "current"
	}

	id, err := h.db.Insert(`
		INSERT INTO budget_envelopes (user_id, name, allocated_amount, spent_amount, month_year)
		VALUES (?, ?, ?, 0.0, ?)
	`, userID, req.Name, req.AllocatedAmount, req.MonthYear)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to create envelope")
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Pos anggaran digital dibuat", map[string]interface{}{
		"id":               id,
		"name":             req.Name,
		"allocated_amount": req.AllocatedAmount,
	})
}

// PayCreditCard handles paying credit card bills from a bank wallet, restoring available limit
func (h *WalletHandler) PayCreditCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	cardID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid credit card ID")
		return
	}

	var req struct {
		SourceWalletID int     `json:"source_wallet_id"`
		Amount         float64 `json:"amount"`
		Note           string  `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Amount <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Nominal pembayaran harus lebih besar dari 0")
		return
	}
	if req.SourceWalletID <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Pilih rekening sumber pembayaran")
		return
	}
	if req.SourceWalletID == cardID {
		utils.JSONError(w, http.StatusBadRequest, "Rekening sumber tidak boleh sama dengan kartu kredit yang dibayar")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}
	defer tx.Rollback()

	// 1. Fetch target credit card
	var card models.Wallet
	err = tx.QueryRow(`
		SELECT id, name, type, balance, COALESCE(credit_limit, 0.0)
		FROM wallets
		WHERE id = ? AND user_id = ?
	`, cardID, userID).Scan(&card.ID, &card.Name, &card.Type, &card.Balance, &card.CreditLimit)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Kartu kredit tidak ditemukan")
		return
	}

	if card.Type != "Credit Card" && card.Type != "Kartu Kredit" {
		utils.JSONError(w, http.StatusBadRequest, "Dompet yang dipilih bukan bertipe kartu kredit")
		return
	}

	// 2. Fetch source bank/cash wallet
	var src models.Wallet
	err = tx.QueryRow(`
		SELECT id, name, type, balance
		FROM wallets
		WHERE id = ? AND user_id = ?
	`, req.SourceWalletID, userID).Scan(&src.ID, &src.Name, &src.Type, &src.Balance)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Rekening sumber pembayaran tidak ditemukan")
		return
	}

	if src.Balance < req.Amount {
		utils.JSONError(w, http.StatusBadRequest, "Saldo rekening sumber tidak mencukupi untuk melakukan pembayaran")
		return
	}

	// 3. Calculate new balance for credit card (restore limit, maxed out at credit_limit)
	newCardBalance := card.Balance + req.Amount
	if newCardBalance > card.CreditLimit {
		newCardBalance = card.CreditLimit
	}
	newSrcBalance := src.Balance - req.Amount

	// Deduct source wallet
	_, err = tx.Exec("UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newSrcBalance, src.ID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memotong saldo rekening sumber")
		return
	}

	// Restore credit card limit
	_, err = tx.Exec("UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newCardBalance, card.ID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memulihkan limit kartu kredit")
		return
	}

	// Record transaction
	note := strings.TrimSpace(req.Note)
	if note == "" {
		note = "Pembayaran Tagihan " + card.Name
	}
	today := time.Now().Format("2006-01-02")
	_, _ = tx.Exec(`
		INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date)
		VALUES (?, ?, 'expense', ?, 'Pembayaran Tagihan Kartu Kredit', ?, ?, ?)
	`, userID, src.ID, req.Amount, card.Name, note, today)

	if err := tx.Commit(); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyelesaikan transaksi pembayaran")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Pembayaran kartu kredit berhasil! Limit telah dipulihkan kembali.", map[string]interface{}{
		"card_id":            card.ID,
		"card_name":          card.Name,
		"new_card_balance":   newCardBalance,
		"credit_limit":       card.CreditLimit,
		"source_wallet_id":   src.ID,
		"new_source_balance": newSrcBalance,
	})
}

// AdjustCreditLimit allows increasing or updating the credit line limit of a credit card
func (h *WalletHandler) AdjustCreditLimit(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	cardID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid credit card ID")
		return
	}

	var req struct {
		CreditLimit    float64 `json:"credit_limit"`
		IncreaseAmount float64 `json:"increase_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var card models.Wallet
	err = h.db.QueryRow(`
		SELECT id, name, type, balance, COALESCE(credit_limit, 0.0)
		FROM wallets
		WHERE id = ? AND user_id = ?
	`, cardID, userID).Scan(&card.ID, &card.Name, &card.Type, &card.Balance, &card.CreditLimit)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Kartu kredit tidak ditemukan")
		return
	}

	if card.Type != "Credit Card" && card.Type != "Kartu Kredit" {
		utils.JSONError(w, http.StatusBadRequest, "Hanya kartu kredit yang dapat diatur limit saldonya")
		return
	}

	var newLimit float64
	var newBalance float64

	if req.IncreaseAmount > 0 {
		newLimit = card.CreditLimit + req.IncreaseAmount
		newBalance = card.Balance + req.IncreaseAmount
	} else if req.CreditLimit > 0 {
		delta := req.CreditLimit - card.CreditLimit
		newLimit = req.CreditLimit
		newBalance = card.Balance + delta
		if newBalance < 0 {
			newBalance = 0
		}
		if newBalance > newLimit {
			newBalance = newLimit
		}
	} else {
		utils.JSONError(w, http.StatusBadRequest, "Nominal limit saldo baru atau nominal penambahan harus lebih besar dari 0")
		return
	}

	_, err = h.db.Exec(`
		UPDATE wallets
		SET credit_limit = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ?
	`, newLimit, newBalance, cardID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengupdate limit kartu kredit")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Limit saldo kartu kredit berhasil diperbarui", map[string]interface{}{
		"id":           cardID,
		"name":         card.Name,
		"old_limit":    card.CreditLimit,
		"credit_limit": newLimit,
		"balance":      newBalance,
	})
}

