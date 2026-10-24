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

type DebtHandler struct {
	db *database.DB
}

func NewDebtHandler(db *database.DB) *DebtHandler {
	return &DebtHandler{db: db}
}

func (h *DebtHandler) GetDebts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	typeFilter := r.URL.Query().Get("type") // hutang, piutang

	query := `
		SELECT d.id, d.user_id, d.wallet_id, COALESCE(w.name, '') as wallet_name,
		       d.contact_name, d.contact_phone, d.type, d.total_amount, d.paid_amount,
		       d.status, d.due_date, d.notes, d.created_at, d.updated_at
		FROM debts d
		LEFT JOIN wallets w ON d.wallet_id = w.id
		WHERE d.user_id = ?
	`
	args := []interface{}{userID}

	if typeFilter != "" {
		query += " AND d.type = ?"
		args = append(args, typeFilter)
	}

	query += " ORDER BY d.due_date ASC, d.id DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch debts: "+err.Error())
		return
	}
	defer rows.Close()

	debts := make([]models.Debt, 0)
	var totalPiutang, totalHutang, overdueCount int
	var totalPiutangAmount, totalHutangAmount float64
	todayStr := time.Now().Format("2006-01-02")

	for rows.Next() {
		var d models.Debt
		var walletID sql.NullInt64
		var walletName sql.NullString
		var phone, notes sql.NullString
		if err := rows.Scan(
			&d.ID, &d.UserID, &walletID, &walletName,
			&d.ContactName, &phone, &d.Type,
			&d.TotalAmount, &d.PaidAmount, &d.Status, &d.DueDate,
			&notes, &d.CreatedAt, &d.UpdatedAt,
		); err == nil {
			if walletID.Valid {
				idInt := int(walletID.Int64)
				d.WalletID = &idInt
			}
			if walletName.Valid {
				d.WalletName = walletName.String
			}
			if phone.Valid {
				d.ContactPhone = phone.String
			}
			if notes.Valid {
				d.Notes = notes.String
			}
			d.Remaining = d.TotalAmount - d.PaidAmount
			if d.Remaining < 0 {
				d.Remaining = 0
			}

			// Check if overdue
			if d.Status != "paid" && d.DueDate < todayStr {
				d.Status = "overdue"
				overdueCount++
			}

			if d.Type == "piutang" {
				totalPiutang++
				totalPiutangAmount += d.Remaining
			} else {
				totalHutang++
				totalHutangAmount += d.Remaining
			}

			debts = append(debts, d)
		}
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"debts":                debts,
		"total_piutang_amount": totalPiutangAmount,
		"total_hutang_amount":  totalHutangAmount,
		"net_balance":          totalPiutangAmount - totalHutangAmount,
		"overdue_count":        overdueCount,
	})
}

func (h *DebtHandler) CreateDebt(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		WalletID     *int    `json:"wallet_id"`
		ContactName  string  `json:"contact_name"`
		ContactPhone string  `json:"contact_phone"`
		Type         string  `json:"type"` // hutang, piutang
		TotalAmount  float64 `json:"total_amount"`
		DueDate      string  `json:"due_date"`
		Notes        string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.ContactName = strings.TrimSpace(req.ContactName)
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.ContactName == "" || (req.Type != "hutang" && req.Type != "piutang") || req.TotalAmount <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Nama kontak, tipe (hutang/piutang), dan nominal total wajib diisi")
		return
	}
	if req.DueDate == "" {
		req.DueDate = time.Now().AddDate(0, 1, 0).Format("2006-01-02")
	}

	tx, err := h.db.Begin()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memulai transaksi database")
		return
	}
	defer tx.Rollback()

	// Handle wallet linkage
	var walletIDVal interface{}
	if req.WalletID != nil && *req.WalletID > 0 {
		walletIDVal = *req.WalletID

		var wallet models.Wallet
		err := tx.QueryRow(`
			SELECT id, name, type, balance, COALESCE(credit_limit, 0.0)
			FROM wallets
			WHERE id = ? AND user_id = ?
		`, *req.WalletID, userID).Scan(&wallet.ID, &wallet.Name, &wallet.Type, &wallet.Balance, &wallet.CreditLimit)
		if err != nil {
			utils.JSONError(w, http.StatusBadRequest, "Dompet / Rekening yang dipilih tidak ditemukan")
			return
		}

		isCreditCard := wallet.Type == "Credit Card" || wallet.Type == "Kartu Kredit"

		if req.Type == "piutang" {
			// Piutang: kita meminjamkan uang -> saldo rekening/dompet harus dipotong
			if req.TotalAmount > wallet.Balance {
				limitLabel := "batas saldo yang tersedia"
				if isCreditCard {
					limitLabel = "sisa limit kartu kredit yang tersedia"
				}
				utils.JSONError(w, http.StatusBadRequest, fmt.Sprintf("Nominal piutang (Rp %.0f) melebihi %s di %s (Tersedia: Rp %.0f)", req.TotalAmount, limitLabel, wallet.Name, wallet.Balance))
				return
			}

			// Potong saldo rekening/dompet atas piutang yang diberikan
			_, err = tx.Exec("UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.TotalAmount, wallet.ID)
			if err != nil {
				utils.JSONError(w, http.StatusInternalServerError, "Gagal memotong saldo rekening untuk piutang")
				return
			}

			// Catat mutasi pengeluaran kas piutang
			_, _ = tx.Insert(`
				INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date)
				VALUES (?, ?, 'expense', ?, 'Piutang & Pinjaman', ?, ?, ?)
			`, userID, wallet.ID, req.TotalAmount, req.ContactName, "Penyaluran piutang kepada "+req.ContactName+": "+req.Notes, time.Now().Format("2006-01-02"))
		} else if req.Type == "hutang" && isCreditCard {
			// Batasan limit jika menggunakan kartu kredit untuk hutang
			if req.TotalAmount > wallet.Balance {
				utils.JSONError(w, http.StatusBadRequest, "Nominal melebihi sisa limit kartu kredit yang tersedia")
				return
			}

			// Potong sisa limit yang tersedia di kartu kredit
			_, err = tx.Exec("UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.TotalAmount, wallet.ID)
			if err != nil {
				utils.JSONError(w, http.StatusInternalServerError, "Gagal memotong limit kartu kredit")
				return
			}

			// Catat mutasi pengeluaran pemakaian limit kartu kredit
			_, _ = tx.Insert(`
				INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date)
				VALUES (?, ?, 'expense', ?, 'Kartu Kredit & Pinjaman', ?, ?, ?)
			`, userID, wallet.ID, req.TotalAmount, req.ContactName, "Pemakaian limit kartu kredit untuk pinjaman: "+req.Notes, time.Now().Format("2006-01-02"))
		}
	} else if req.Type == "piutang" {
		utils.JSONError(w, http.StatusBadRequest, "Pilih rekening bank / dompet penyalur dana untuk mencatat piutang agar saldo dapat dipotong")
		return
	}

	id, err := tx.Insert(`
		INSERT INTO debts (user_id, wallet_id, contact_name, contact_phone, type, total_amount, paid_amount, status, due_date, notes)
		VALUES (?, ?, ?, ?, ?, ?, 0.0, 'pending', ?, ?)
	`, userID, walletIDVal, req.ContactName, req.ContactPhone, req.Type, req.TotalAmount, req.DueDate, req.Notes)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mencatat utang/piutang: "+err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan catatan")
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Catatan utang/piutang berhasil dibuat", map[string]interface{}{
		"id": id,
	})
}

func (h *DebtHandler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req models.DebtPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.DebtID == 0 || req.Amount <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Debt ID and valid payment amount are required")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback()

	var debt models.Debt
	var sourceWalletID sql.NullInt64
	err = tx.QueryRow(`
		SELECT id, user_id, wallet_id, contact_name, type, total_amount, paid_amount, status
		FROM debts
		WHERE id = ? AND user_id = ?
	`, req.DebtID, userID).Scan(&debt.ID, &debt.UserID, &sourceWalletID, &debt.ContactName, &debt.Type, &debt.TotalAmount, &debt.PaidAmount, &debt.Status)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Debt record not found")
		return
	}

	remainingDebt := debt.TotalAmount - debt.PaidAmount
	if req.Amount > remainingDebt {
		typeLabel := "piutang"
		if debt.Type == "hutang" {
			typeLabel = "hutang"
		}
		utils.JSONError(w, http.StatusBadRequest, fmt.Sprintf("Nominal pembayaran (Rp %.0f) melebihi sisa %s yang harus diselesaikan (Sisa: Rp %.0f)", req.Amount, typeLabel, remainingDebt))
		return
	}

	newPaid := debt.PaidAmount + req.Amount
	newStatus := "partial"
	if newPaid >= debt.TotalAmount {
		newStatus = "paid"
	}

	// Update debt
	_, err = tx.Exec(`
		UPDATE debts
		SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, newPaid, newStatus, debt.ID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to update debt record")
		return
	}

	// If debt originated from a Credit Card, restore the Credit Card's available limit upon payment
	if sourceWalletID.Valid {
		var srcType string
		if err := tx.QueryRow("SELECT type FROM wallets WHERE id = ?", sourceWalletID.Int64).Scan(&srcType); err == nil {
			if srcType == "Credit Card" || srcType == "Kartu Kredit" {
				_, _ = tx.Exec("UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.Amount, sourceWalletID.Int64)
			}
		}
	}

	// Record payment entry and adjust paying wallet
	var walletIDVal *int
	if req.WalletID > 0 {
		walletIDVal = &req.WalletID

		if debt.Type == "piutang" {
			// Creditor receives money -> income to wallet
			_, _ = tx.Exec("UPDATE wallets SET balance = balance + ? WHERE id = ? AND user_id = ?", req.Amount, req.WalletID, userID)
			_, _ = tx.Exec(`
				INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date)
				VALUES (?, ?, 'income', ?, 'Pelunasan Piutang', ?, ?, ?)
			`, userID, req.WalletID, req.Amount, debt.ContactName, "Cicilan piutang dari "+debt.ContactName, time.Now().Format("2006-01-02"))
		} else {
			// Debtor pays money -> expense from wallet
			_, _ = tx.Exec("UPDATE wallets SET balance = balance - ? WHERE id = ? AND user_id = ?", req.Amount, req.WalletID, userID)
			_, _ = tx.Exec(`
				INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date)
				VALUES (?, ?, 'expense', ?, 'Pembayaran Hutang', ?, ?, ?)
			`, userID, req.WalletID, req.Amount, debt.ContactName, "Pembayaran cicilan hutang ke "+debt.ContactName, time.Now().Format("2006-01-02"))
		}
	}

	_, _ = tx.Exec(`
		INSERT INTO debt_payments (debt_id, wallet_id, amount, payment_date, notes)
		VALUES (?, ?, ?, ?, ?)
	`, debt.ID, walletIDVal, req.Amount, time.Now().Format("2006-01-02"), req.Notes)

	if err := tx.Commit(); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to commit payment")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Pembayaran berhasil dicatat", map[string]interface{}{
		"debt_id":    debt.ID,
		"paid_total": newPaid,
		"remaining":  debt.TotalAmount - newPaid,
		"status":     newStatus,
	})
}

func (h *DebtHandler) DeleteDebt(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	debtID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid debt ID")
		return
	}

	_, err = h.db.Exec("DELETE FROM debts WHERE id = ? AND user_id = ?", debtID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to delete debt record")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Catatan utang/piutang berhasil dihapus", nil)
}
