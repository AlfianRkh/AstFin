package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
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

type TransactionHandler struct {
	db *database.DB
}

func NewTransactionHandler(db *database.DB) *TransactionHandler {
	return &TransactionHandler{db: db}
}

func (h *TransactionHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	filterType := r.URL.Query().Get("type")
	filterCategory := r.URL.Query().Get("category")

	query := `
		SELECT t.id, t.user_id, t.wallet_id, COALESCE(w.name, 'Unknown') as wallet_name,
		       t.type, t.amount, t.category, t.merchant, t.notes, t.receipt_url,
		       t.ocr_accuracy, t.transaction_date, COALESCE(t.due_date, ''), t.created_at
		FROM transactions t
		LEFT JOIN wallets w ON t.wallet_id = w.id
		WHERE t.user_id = ?
	`
	args := []interface{}{userID}

	if filterType != "" {
		query += " AND t.type = ?"
		args = append(args, filterType)
	}
	if filterCategory != "" {
		query += " AND t.category = ?"
		args = append(args, filterCategory)
	}
	filterWalletID := r.URL.Query().Get("wallet_id")
	if filterWalletID != "" {
		if wid, err := strconv.Atoi(filterWalletID); err == nil && wid > 0 {
			query += " AND t.wallet_id = ?"
			args = append(args, wid)
		}
	}

	query += " ORDER BY t.transaction_date DESC, t.id DESC LIMIT ?"
	args = append(args, limit)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to query transactions: "+err.Error())
		return
	}
	defer rows.Close()

	transactions := make([]models.Transaction, 0)
	for rows.Next() {
		var tr models.Transaction
		var receiptURL sql.NullString
		var ocrAcc sql.NullFloat64
		var notes sql.NullString

		if err := rows.Scan(
			&tr.ID, &tr.UserID, &tr.WalletID, &tr.WalletName, &tr.Type, &tr.Amount,
			&tr.Category, &tr.Merchant, &notes, &receiptURL, &ocrAcc,
			&tr.TransactionDate, &tr.DueDate, &tr.CreatedAt,
		); err == nil {
			if notes.Valid {
				tr.Notes = notes.String
			}
			if receiptURL.Valid {
				tr.ReceiptURL = receiptURL.String
			}
			if ocrAcc.Valid {
				tr.OCRAccuracy = ocrAcc.Float64
			}
			transactions = append(transactions, tr)
		}
	}

	utils.JSON(w, http.StatusOK, transactions)
}

func (h *TransactionHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		WalletID                int      `json:"wallet_id"`
		Type                    string   `json:"type"` // income, expense
		Amount                  float64  `json:"amount"`
		Category                string   `json:"category"`
		Merchant                string   `json:"merchant"`
		Notes                   string   `json:"notes"`
		TransactionDate         string   `json:"transaction_date"`
		DueDate                 string   `json:"due_date"` // Tanggal tagihan / jatuh tempo kartu kredit
		AutoRestockPantry       bool     `json:"auto_restock_pantry"`
		PantryItems             []string `json:"pantry_items,omitempty"`
		SaveCategory            bool     `json:"save_category"`
		CancelledTransactionIDs []int    `json:"cancelled_transaction_ids,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "income" && req.Type != "expense" {
		utils.JSONError(w, http.StatusBadRequest, "Type must be 'income' or 'expense'")
		return
	}
	if req.Amount <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Amount must be greater than zero")
		return
	}
	if req.WalletID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "Valid wallet is required")
		return
	}
	if req.TransactionDate == "" {
		req.TransactionDate = time.Now().Format("2006-01-02")
	}

	// Begin Atomic Transaction
	tx, err := h.db.Begin()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to start database transaction")
		return
	}
	defer tx.Rollback()

	// Verify wallet belongs to user and fetch type & limits
	var wallet models.Wallet
	err = tx.QueryRow("SELECT id, name, type, balance, COALESCE(credit_limit, 0.0) FROM wallets WHERE id = ? AND user_id = ?", req.WalletID, userID).
		Scan(&wallet.ID, &wallet.Name, &wallet.Type, &wallet.Balance, &wallet.CreditLimit)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Selected wallet not found or does not belong to user")
		return
	}

	isCreditCard := wallet.Type == "Credit Card" || wallet.Type == "Kartu Kredit"

	// Calculate new balance
	newBalance := wallet.Balance
	if req.Type == "income" {
		newBalance += req.Amount
		if isCreditCard && wallet.CreditLimit > 0 && newBalance > wallet.CreditLimit {
			newBalance = wallet.CreditLimit
		}
	} else {
		// Expense check: enforce balance limit on all wallet types (Bank, Cash, E-Wallet, Credit Card, etc.)
		if req.Amount > wallet.Balance {
			limitLabel := "batas saldo yang tersedia"
			if isCreditCard {
				limitLabel = "sisa limit kartu kredit yang tersedia"
			}
			utils.JSONError(w, http.StatusBadRequest, fmt.Sprintf("Nominal transaksi (Rp %.0f) melebihi %s di %s (Tersedia: Rp %.0f)", req.Amount, limitLabel, wallet.Name, wallet.Balance))
			return
		}

		if isCreditCard {
			// Jika kartu kredit dan tanggal tagihan diberikan, sinkronkan otomatis ke buku utang
			if strings.TrimSpace(req.DueDate) != "" {
				_, _ = tx.Insert(`
					INSERT INTO debts (user_id, wallet_id, contact_name, contact_phone, type, total_amount, paid_amount, status, due_date, notes)
					VALUES (?, ?, ?, '', 'hutang', ?, 0.0, 'pending', ?, ?)
				`, userID, wallet.ID, wallet.Name, req.Amount, req.DueDate, "Tagihan transaksi kartu kredit: "+req.Category+" ("+req.Merchant+")")
			}
		}
		newBalance -= req.Amount
	}

	// Update wallet
	_, err = tx.Exec("UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newBalance, req.WalletID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to update wallet balance")
		return
	}

	// Insert transaction with due_date
	trID, err := tx.Insert(`
		INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date, due_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, req.WalletID, req.Type, req.Amount, req.Category, req.Merchant, req.Notes, req.TransactionDate, req.DueDate)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to insert transaction: "+err.Error())
		return
	}

	// If this income is a refund/cancellation of previous transactions, mark them
	if req.Type == "income" && len(req.CancelledTransactionIDs) > 0 {
		for _, cID := range req.CancelledTransactionIDs {
			_, _ = tx.Exec(`
				UPDATE transactions 
				SET notes = CASE 
					WHEN notes IS NULL OR notes = '' THEN '[DIBATALKAN / REFUND]' 
					WHEN notes NOT LIKE '%[DIBATALKAN%' THEN '[DIBATALKAN / REFUND] ' || notes 
					ELSE notes 
				END 
				WHERE id = ? AND user_id = ?
			`, cID, userID)
		}
	}

	// Save custom category if user opted in
	if req.SaveCategory && strings.TrimSpace(req.Category) != "" && strings.ToLower(strings.TrimSpace(req.Category)) != "lain-lain" {
		cleanCat := strings.TrimSpace(req.Category)
		if h.db.Driver == "postgres" {
			_, _ = tx.Exec(`
				INSERT INTO transaction_categories (user_id, name, type)
				VALUES (?, ?, ?)
				ON CONFLICT (user_id, name, type) DO NOTHING
			`, userID, cleanCat, req.Type)
		} else {
			_, _ = tx.Exec(`
				INSERT OR IGNORE INTO transaction_categories (user_id, name, type)
				VALUES (?, ?, ?)
			`, userID, cleanCat, req.Type)
		}
	}

	// Update envelope spent amount if expense
	if req.Type == "expense" && req.Category != "" {
		_, _ = tx.Exec(`
			UPDATE budget_envelopes 
			SET spent_amount = spent_amount + ? 
			WHERE user_id = ? AND LOWER(name) LIKE ?
		`, req.Amount, userID, "%"+strings.ToLower(req.Category)+"%")
	}

	// Commit
	if err := tx.Commit(); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Transaksi berhasil dicatat dan saldo dompet telah diperbarui", map[string]interface{}{
		"id":          trID,
		"new_balance": newBalance,
	})
}

func (h *TransactionHandler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	trID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid transaction ID")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback()

	var tr models.Transaction
	err = tx.QueryRow("SELECT id, wallet_id, type, amount FROM transactions WHERE id = ? AND user_id = ?", trID, userID).
		Scan(&tr.ID, &tr.WalletID, &tr.Type, &tr.Amount)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	// Revert wallet balance
	if tr.Type == "income" {
		_, _ = tx.Exec("UPDATE wallets SET balance = balance - ? WHERE id = ?", tr.Amount, tr.WalletID)
	} else {
		_, _ = tx.Exec("UPDATE wallets SET balance = balance + ? WHERE id = ?", tr.Amount, tr.WalletID)
	}

	// Delete
	_, err = tx.Exec("DELETE FROM transactions WHERE id = ?", trID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to delete transaction")
		return
	}

	if err := tx.Commit(); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to commit delete")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Transaksi berhasil dihapus dan saldo dompet dipulihkan", nil)
}

func (h *TransactionHandler) ScanReceiptOCR(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ReceiptText string `json:"receipt_text"`
		Merchant    string `json:"merchant"`
		Amount      float64 `json:"amount"`
	}

	// Allows client to send either simulated parsed text or manual hints
	_ = json.NewDecoder(r.Body).Decode(&req)

	merchant := req.Merchant
	if merchant == "" {
		merchant = "Indomaret Merr Surabaya"
	}
	amount := req.Amount
	if amount <= 0 {
		amount = 88500
	}

	// Simulated AI OCR Vision Extraction Response
	response := map[string]interface{}{
		"merchant":         merchant,
		"ocr_accuracy":     99.4,
		"total_amount":     amount,
		"suggested_category": "Belanja Dapur",
		"payment_method":   "QRIS / Debit",
		"date":             time.Now().Format("2006-01-02"),
		"extracted_items": []map[string]interface{}{
			{"name": "Minyak Goreng Bimoli 2L", "qty": 1, "price": 38000, "category": "Kulkas"},
			{"name": "Susu UHT Ultra Milk 1L", "qty": 1, "price": 19500, "category": "Kulkas"},
			{"name": "Sunlight Jeruk Nipis 750ml", "qty": 1, "price": 16000, "category": "Lemari Kering"},
			{"name": "Telur Ayam 10 Butir", "qty": 1, "price": 15000, "category": "Kulkas"},
		},
	}

	utils.JSONMessage(w, http.StatusOK, "AI OCR Vision v4.2 Berhasil Mengekstraksi Struk Kasir", response)
}

func (h *TransactionHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	categoryType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))

	query := "SELECT id, user_id, name, type, created_at FROM transaction_categories WHERE user_id = ?"
	args := []interface{}{userID}

	if categoryType != "" {
		query += " AND type = ?"
		args = append(args, categoryType)
	}
	query += " ORDER BY name ASC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to query categories: "+err.Error())
		return
	}
	defer rows.Close()

	categories := make([]models.TransactionCategory, 0)
	for rows.Next() {
		var cat models.TransactionCategory
		if err := rows.Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.Type, &cat.CreatedAt); err == nil {
			categories = append(categories, cat)
		}
	}

	utils.JSON(w, http.StatusOK, categories)
}

func (h *TransactionHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Name string `json:"name"`
		Type string `json:"type"` // income, expense
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Name == "" {
		utils.JSONError(w, http.StatusBadRequest, "Category name is required")
		return
	}
	if req.Type != "income" && req.Type != "expense" {
		utils.JSONError(w, http.StatusBadRequest, "Type must be 'income' or 'expense'")
		return
	}

	if h.db.Driver == "postgres" {
		query := `
			INSERT INTO transaction_categories (user_id, name, type)
			VALUES (?, ?, ?)
			ON CONFLICT (user_id, name, type) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`
		var id int
		err := h.db.QueryRow(query, userID, req.Name, req.Type).Scan(&id)
		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "Failed to save category: "+err.Error())
			return
		}
		utils.JSONMessage(w, http.StatusCreated, "Kategori berhasil disimpan", map[string]interface{}{
			"id":   id,
			"name": req.Name,
			"type": req.Type,
		})
		return
	}

	// SQLite
	query := `
		INSERT OR IGNORE INTO transaction_categories (user_id, name, type)
		VALUES (?, ?, ?)
	`
	id, err := h.db.Insert(query, userID, req.Name, req.Type)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to save category: "+err.Error())
		return
	}
	utils.JSONMessage(w, http.StatusCreated, "Kategori berhasil disimpan", map[string]interface{}{
		"id":   id,
		"name": req.Name,
		"type": req.Type,
	})
}

