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

type PantryHandler struct {
	db *database.DB
}

func NewPantryHandler(db *database.DB) *PantryHandler {
	return &PantryHandler{db: db}
}

func (h *PantryHandler) GetPantryItems(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	categoryFilter := r.URL.Query().Get("category")

	query := `
		SELECT id, user_id, name, category, quantity, unit, min_quantity, expiry_date, COALESCE(price, 0.0), status, created_at, updated_at
		FROM pantry_items
		WHERE user_id = ?
	`
	args := []interface{}{userID}

	if categoryFilter != "" {
		query += " AND category = ?"
		args = append(args, categoryFilter)
	}

	query += " ORDER BY expiry_date ASC, id ASC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch pantry items: "+err.Error())
		return
	}
	defer rows.Close()

	items := make([]models.PantryItem, 0)
	var safeCount, criticalCount, restockCount int
	now := time.Now()
	todayStr := now.Format("2006-01-02")
	threeDaysStr := now.AddDate(0, 0, 3).Format("2006-01-02")

	for rows.Next() {
		var it models.PantryItem
		if err := rows.Scan(
			&it.ID, &it.UserID, &it.Name, &it.Category, &it.Quantity, &it.Unit,
			&it.MinQuantity, &it.ExpiryDate, &it.Price, &it.Status, &it.CreatedAt, &it.UpdatedAt,
		); err == nil {
			// Dynamic status calculation
			if it.Quantity <= 0 {
				it.Status = "out_of_stock"
				restockCount++
			} else if it.ExpiryDate <= todayStr {
				it.Status = "critical"
				criticalCount++
			} else if it.ExpiryDate <= threeDaysStr {
				it.Status = "expiring_soon"
				criticalCount++
			} else if it.Quantity <= it.MinQuantity {
				it.Status = "menipis"
				restockCount++
			} else {
				it.Status = "safe"
				safeCount++
			}

			items = append(items, it)
		}
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"items":          items,
		"total_count":    len(items),
		"safe_count":     safeCount,
		"critical_count": criticalCount,
		"restock_count":  restockCount,
	})
}

func (h *PantryHandler) CreatePantryItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Name        string  `json:"name"`
		Category    string  `json:"category"` // Kulkas, Freezer, Lemari Kering
		Quantity    float64 `json:"quantity"`
		Unit        string  `json:"unit"`
		MinQuantity float64 `json:"min_quantity"`
		ExpiryDate  string  `json:"expiry_date"`
		Price       float64 `json:"price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.Quantity < 0 {
		utils.JSONError(w, http.StatusBadRequest, "Nama bahan dan kuantitas valid wajib diisi")
		return
	}
	if req.Category == "" {
		req.Category = "Kulkas"
	}
	if req.Unit == "" {
		req.Unit = "Pcs"
	}
	if req.MinQuantity <= 0 {
		req.MinQuantity = 1.0
	}
	if req.ExpiryDate == "" {
		req.ExpiryDate = time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	}

	id, err := h.db.Insert(`
		INSERT INTO pantry_items (user_id, name, category, quantity, unit, min_quantity, expiry_date, price, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'safe')
	`, userID, req.Name, req.Category, req.Quantity, req.Unit, req.MinQuantity, req.ExpiryDate, req.Price)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menambahkan stok bahan: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Bahan dapur berhasil ditambahkan ke inventaris", map[string]interface{}{
		"id": id,
	})
}

func (h *PantryHandler) UpdatePantryQuantity(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	itemID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	var req struct {
		Delta    *float64 `json:"delta"`
		Quantity *float64 `json:"quantity"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var it models.PantryItem
	err = h.db.QueryRow(`
		SELECT id, name, category, quantity, unit, min_quantity
		FROM pantry_items WHERE id = ? AND user_id = ?
	`, itemID, userID).Scan(&it.ID, &it.Name, &it.Category, &it.Quantity, &it.Unit, &it.MinQuantity)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Bahan dapur tidak ditemukan")
		return
	}

	newQty := it.Quantity
	if req.Quantity != nil {
		newQty = *req.Quantity
	} else if req.Delta != nil {
		newQty += *req.Delta
	}

	if newQty < 0 {
		newQty = 0
	}

	status := "safe"
	if newQty == 0 {
		status = "out_of_stock"
		// Autonomous loop: auto add to smart shopping list if not exists!
		var exists int
		_ = h.db.QueryRow("SELECT COUNT(*) FROM shopping_items WHERE user_id = ? AND pantry_item_id = ? AND is_checked = false", userID, itemID).Scan(&exists)
		if exists == 0 {
			_, _ = h.db.Exec(`
				INSERT INTO shopping_items (user_id, pantry_item_id, name, estimated_price, store_recommendation, is_checked)
				VALUES (?, ?, ?, ?, ?, false)
			`, userID, itemID, it.Name, 25000, "Supermarket / Minimarket Terdekat")
		}
	} else if newQty <= it.MinQuantity {
		status = "menipis"
	}

	_, err = h.db.Exec(`
		UPDATE pantry_items
		SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ?
	`, newQty, status, itemID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memperbarui kuantitas bahan")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Kuantitas berhasil diperbarui", map[string]interface{}{
		"id":       itemID,
		"quantity": newQty,
		"status":   status,
	})
}

func (h *PantryHandler) DeletePantryItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	itemID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	_, err = h.db.Exec("DELETE FROM pantry_items WHERE id = ? AND user_id = ?", itemID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus bahan dapur")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Bahan dapur berhasil dihapus", nil)
}

// Shopping Items
func (h *PantryHandler) GetShoppingList(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	rows, err := h.db.Query(`
		SELECT id, user_id, pantry_item_id, name, estimated_price, store_recommendation, is_checked, created_at
		FROM shopping_items
		WHERE user_id = ?
		ORDER BY is_checked ASC, id DESC
	`, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch shopping list")
		return
	}
	defer rows.Close()

	items := make([]models.ShoppingItem, 0)
	var totalEstimated float64
	for rows.Next() {
		var it models.ShoppingItem
		var pID sql.NullInt64
		var storeRec sql.NullString
		var isChecked bool
		var scanErr error

		if h.db.Driver == "sqlite" {
			var isCheckedInt int
			scanErr = rows.Scan(&it.ID, &it.UserID, &pID, &it.Name, &it.EstimatedPrice, &storeRec, &isCheckedInt, &it.CreatedAt)
			isChecked = isCheckedInt == 1
		} else {
			scanErr = rows.Scan(&it.ID, &it.UserID, &pID, &it.Name, &it.EstimatedPrice, &storeRec, &isChecked, &it.CreatedAt)
		}

		if scanErr == nil {
			if pID.Valid {
				v := int(pID.Int64)
				it.PantryItemID = &v
			}
			if storeRec.Valid {
				it.StoreRecommendation = storeRec.String
			}
			it.IsChecked = isChecked
			totalEstimated += it.EstimatedPrice
			items = append(items, it)
		}
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"items":           items,
		"total_count":     len(items),
		"total_estimated": totalEstimated,
	})
}

func (h *PantryHandler) AddShoppingItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		PantryItemID        *int    `json:"pantry_item_id,omitempty"`
		Name                string  `json:"name"`
		EstimatedPrice      float64 `json:"estimated_price"`
		StoreRecommendation string  `json:"store_recommendation"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.JSONError(w, http.StatusBadRequest, "Item name is required")
		return
	}

	if req.EstimatedPrice <= 0 {
		req.EstimatedPrice = 25000
	}
	if req.StoreRecommendation == "" {
		req.StoreRecommendation = "Supermarket / Minimarket Terdekat"
	}

	var id int64
	var err error
	if req.PantryItemID != nil {
		id, err = h.db.Insert(`
			INSERT INTO shopping_items (user_id, pantry_item_id, name, estimated_price, store_recommendation, is_checked)
			VALUES (?, ?, ?, ?, ?, false)
		`, userID, *req.PantryItemID, req.Name, req.EstimatedPrice, req.StoreRecommendation)
	} else {
		id, err = h.db.Insert(`
			INSERT INTO shopping_items (user_id, name, estimated_price, store_recommendation, is_checked)
			VALUES (?, ?, ?, ?, false)
		`, userID, req.Name, req.EstimatedPrice, req.StoreRecommendation)
	}

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to add shopping item: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Item belanja ditambahkan", map[string]interface{}{
		"id": id,
	})
}

func (h *PantryHandler) ToggleShoppingItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	itemID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	_, err = h.db.Exec(`
		UPDATE shopping_items
		SET is_checked = NOT is_checked
		WHERE id = ? AND user_id = ?
	`, itemID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengubah status belanja")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Status item belanja diperbarui", nil)
}

func (h *PantryHandler) DeleteShoppingItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	itemID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	_, err = h.db.Exec("DELETE FROM shopping_items WHERE id = ? AND user_id = ?", itemID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus item belanja")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Item belanja dihapus", nil)
}

func (h *PantryHandler) CheckoutShopping(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		WalletID    int     `json:"wallet_id"`
		TotalAmount float64 `json:"total_amount"`
		Notes       string  `json:"notes"`
		Items       []struct {
			ShoppingItemID *int    `json:"shopping_item_id,omitempty"`
			PantryItemID   *int    `json:"pantry_item_id,omitempty"`
			Name           string  `json:"name"`
			Price          float64 `json:"price"`
			RestockQty     float64 `json:"restock_qty"`
			Unit           string  `json:"unit"`
			Category       string  `json:"category"`
		} `json:"items"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.WalletID <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Dompet sumber dana wajib dipilih")
		return
	}
	if req.TotalAmount <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Total nominal belanja tidak valid")
		return
	}
	if len(req.Items) == 0 {
		utils.JSONError(w, http.StatusBadRequest, "Daftar belanja kosong")
		return
	}

	// 1. Verifikasi saldo dompet
	var wallet models.Wallet
	err := h.db.QueryRow(`
		SELECT id, name, type, balance, COALESCE(credit_limit, 0)
		FROM wallets
		WHERE id = ? AND user_id = ?
	`, req.WalletID, userID).Scan(&wallet.ID, &wallet.Name, &wallet.Type, &wallet.Balance, &wallet.CreditLimit)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Dompet tidak ditemukan")
		return
	}

	if wallet.Balance < req.TotalAmount {
		utils.JSONError(w, http.StatusBadRequest, fmt.Sprintf("Saldo dompet %s tidak mencukupi (Tersedia: Rp %.0f, Dibutuhkan: Rp %.0f)", wallet.Name, wallet.Balance, req.TotalAmount))
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memulai transaksi: "+err.Error())
		return
	}
	defer tx.Rollback()

	// 2. Kurangi saldo dompet
	_, err = tx.Exec(`
		UPDATE wallets
		SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ?
	`, req.TotalAmount, req.WalletID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memotong saldo dompet: "+err.Error())
		return
	}

	// 3. Catat transaksi pengeluaran di buku kas
	todayStr := time.Now().Format("2006-01-02")
	txNotes := req.Notes
	if strings.TrimSpace(txNotes) == "" {
		itemNames := make([]string, 0, len(req.Items))
		for _, it := range req.Items {
			itemNames = append(itemNames, it.Name)
		}
		txNotes = "Belanja Smart Shopping List: " + strings.Join(itemNames, ", ")
	}

	_, err = tx.Exec(`
		INSERT INTO transactions (user_id, wallet_id, type, amount, category, merchant, notes, transaction_date)
		VALUES (?, ?, 'expense', ?, 'Kebutuhan Pokok', 'Supermarket / Belanja Dapur', ?, ?)
	`, userID, req.WalletID, req.TotalAmount, txNotes, todayStr)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mencatat transaksi kas: "+err.Error())
		return
	}

	// 4. Update / Insert stok bahan dapur & update status shopping items
	for _, it := range req.Items {
		restockQty := it.RestockQty
		if restockQty <= 0 {
			restockQty = 1
		}
		unit := it.Unit
		if unit == "" {
			unit = "Pcs"
		}
		category := it.Category
		if category == "" {
			category = "Kulkas (Chiller)"
		}

		updatedPantry := false
		if it.PantryItemID != nil && *it.PantryItemID > 0 {
			res, err := tx.Exec(`
				UPDATE pantry_items
				SET quantity = quantity + ?, name = ?, price = ?, status = 'safe', updated_at = CURRENT_TIMESTAMP
				WHERE id = ? AND user_id = ?
			`, restockQty, strings.TrimSpace(it.Name), it.Price, *it.PantryItemID, userID)
			if err == nil {
				rowsAff, _ := res.RowsAffected()
				if rowsAff > 0 {
					updatedPantry = true
				}
			}
		}

		// Jika belum diupdate via PantryItemID, coba cari bahan dengan nama yang sama
		if !updatedPantry {
			var existingPantryID int
			err := tx.QueryRow(`
				SELECT id FROM pantry_items
				WHERE user_id = ? AND LOWER(name) = LOWER(?)
				LIMIT 1
			`, userID, strings.TrimSpace(it.Name)).Scan(&existingPantryID)
			if err == nil && existingPantryID > 0 {
				_, _ = tx.Exec(`
					UPDATE pantry_items
					SET quantity = quantity + ?, price = ?, status = 'safe', updated_at = CURRENT_TIMESTAMP
					WHERE id = ? AND user_id = ?
				`, restockQty, it.Price, existingPantryID, userID)
			} else {
				// Buat bahan baru di dapur
				expiry := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
				_, _ = tx.Exec(`
					INSERT INTO pantry_items (user_id, name, category, quantity, unit, min_quantity, expiry_date, price, status)
					VALUES (?, ?, ?, ?, ?, 5, ?, ?, 'safe')
				`, userID, strings.TrimSpace(it.Name), category, restockQty, unit, expiry, it.Price)
			}
		}

		// Tandai item shopping sebagai sudah dibeli
		if it.ShoppingItemID != nil && *it.ShoppingItemID > 0 {
			_, _ = tx.Exec(`
				UPDATE shopping_items
				SET is_checked = true
				WHERE id = ? AND user_id = ?
			`, *it.ShoppingItemID, userID)
		}
	}

	if err := tx.Commit(); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyelesaikan proses belanja: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Belanja berhasil diselesaikan dan stok dapur telah diperbarui", map[string]interface{}{
		"total_spent": req.TotalAmount,
		"wallet_id":   req.WalletID,
	})
}

func (h *PantryHandler) GetStorageZones(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query("SELECT id, user_id, name, created_at FROM pantry_storage_zones WHERE user_id = ? ORDER BY id ASC", userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil zona penyimpanan dapur: "+err.Error())
		return
	}
	defer rows.Close()

	zones := make([]models.PantryStorageZone, 0)
	for rows.Next() {
		var z models.PantryStorageZone
		if err := rows.Scan(&z.ID, &z.UserID, &z.Name, &z.CreatedAt); err == nil {
			zones = append(zones, z)
		}
	}

	// Inisialisasi default zones jika user belum memiliki zona penyimpanan di DB
	if len(zones) == 0 {
		defaultZones := []string{
			"Kulkas (Chiller)",
			"Freezer (Beku)",
			"Lemari Kering (Pantry/Bumbu)",
			"Rak Bumbu & Rempah",
			"Wadah Kedap Udara",
		}
		for _, name := range defaultZones {
			if h.db.Driver == "postgres" {
				_, _ = h.db.Exec("INSERT INTO pantry_storage_zones (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING", userID, name)
			} else {
				_, _ = h.db.Exec("INSERT OR IGNORE INTO pantry_storage_zones (user_id, name) VALUES (?, ?)", userID, name)
			}
		}

		rowsAfter, errAfter := h.db.Query("SELECT id, user_id, name, created_at FROM pantry_storage_zones WHERE user_id = ? ORDER BY id ASC", userID)
		if errAfter == nil {
			defer rowsAfter.Close()
			for rowsAfter.Next() {
				var z models.PantryStorageZone
				if err := rowsAfter.Scan(&z.ID, &z.UserID, &z.Name, &z.CreatedAt); err == nil {
					zones = append(zones, z)
				}
			}
		}
	}

	utils.JSON(w, http.StatusOK, zones)
}

func (h *PantryHandler) CreateStorageZone(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.JSONError(w, http.StatusBadRequest, "Nama zona penyimpanan wajib diisi")
		return
	}

	var id int64
	var err error
	if h.db.Driver == "postgres" {
		err = h.db.QueryRow(`
			INSERT INTO pantry_storage_zones (user_id, name)
			VALUES ($1, $2)
			ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, userID, req.Name).Scan(&id)
	} else {
		id, err = h.db.Insert("INSERT OR IGNORE INTO pantry_storage_zones (user_id, name) VALUES (?, ?)", userID, req.Name)
	}

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menambahkan zona penyimpanan dapur: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Zona penyimpanan dapur berhasil ditambahkan", map[string]interface{}{
		"id":      id,
		"user_id": userID,
		"name":    req.Name,
	})
}
