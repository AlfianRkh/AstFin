package handlers

import (
	"database/sql"
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"strings"

	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
	"github.com/go-chi/chi/v5"
)

type RadarHandler struct {
	db *database.DB
}

func NewRadarHandler(db *database.DB) *RadarHandler {
	return &RadarHandler{db: db}
}

func (h *RadarHandler) GetRadarItems(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	statusFilter := r.URL.Query().Get("status")

	query := `
		SELECT id, user_id, title, description, category, image_url,
		       target_price, current_price, all_time_low_price, all_time_high_price,
		       deal_score, priority_score, platform, url, status, saved_amount,
		       COALESCE(qty, 1), created_at, updated_at
		FROM radar_items
		WHERE user_id = ?
	`
	args := []interface{}{userID}

	if statusFilter != "" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}

	query += " ORDER BY priority_score DESC, id DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch radar items: "+err.Error())
		return
	}
	defer rows.Close()

	items := make([]models.RadarItem, 0)
	var targetHitCount int
	var totalSavings float64
	var sumDealScore float64

	for rows.Next() {
		var it models.RadarItem
		var desc, imgURL, itURL sql.NullString
		if err := rows.Scan(
			&it.ID, &it.UserID, &it.Title, &desc, &it.Category, &imgURL,
			&it.TargetPrice, &it.CurrentPrice, &it.AllTimeLowPrice, &it.AllTimeHighPrice,
			&it.DealScore, &it.PriorityScore, &it.Platform, &itURL, &it.Status,
			&it.SavedAmount, &it.Qty, &it.CreatedAt, &it.UpdatedAt,
		); err == nil {
			if desc.Valid {
				it.Description = desc.String
			}
			if imgURL.Valid {
				it.ImageURL = imgURL.String
			}
			if itURL.Valid {
				it.URL = itURL.String
			}

			if it.Qty <= 0 {
				it.Status = "bought"
			}

			// Automatically determine if target is hit
			if it.CurrentPrice <= it.TargetPrice && it.Status != "bought" && it.Qty > 0 {
				it.Status = "target_hit"
				targetHitCount++
			}

			totalSavings += it.SavedAmount
			sumDealScore += it.DealScore
			items = append(items, it)
		}
	}

	avgDeal := 0.0
	if len(items) > 0 {
		avgDeal = math.Round((sumDealScore/float64(len(items)))*10) / 10
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"items":            items,
		"total_monitored":  len(items),
		"target_hit_count": targetHitCount,
		"avg_deal_score":   avgDeal,
		"total_savings":    totalSavings,
	})
}

func (h *RadarHandler) CreateRadarItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Title        string  `json:"title"`
		Description  string  `json:"description"`
		Category     string  `json:"category"`
		ImageURL     string  `json:"image_url"`
		TargetPrice  float64 `json:"target_price"`
		CurrentPrice float64 `json:"current_price"`
		Platform     string  `json:"platform"`
		URL          string  `json:"url"`
		SavedAmount  float64 `json:"saved_amount"`
		Qty          int     `json:"qty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || req.TargetPrice <= 0 || req.CurrentPrice <= 0 {
		utils.JSONError(w, http.StatusBadRequest, "Judul, harga target, dan harga saat ini wajib diisi")
		return
	}
	if req.Platform == "" {
		req.Platform = "Tokopedia"
	}
	if req.Category == "" {
		req.Category = "Gadget & Setup"
	}
	if req.Qty <= 0 {
		req.Qty = 1
	}

	atl := req.CurrentPrice
	ath := req.CurrentPrice
	if req.CurrentPrice > req.TargetPrice {
		ath = req.CurrentPrice * 1.15
	}

	// Calculate Deal Score (0 - 10)
	dealScore := 7.0
	if req.CurrentPrice <= req.TargetPrice {
		dealScore = 9.2
	} else if req.CurrentPrice < ath {
		dealScore = 8.0
	}

	// Priority Score (0 - 100)
	priorityScore := 65.0
	if req.CurrentPrice <= req.TargetPrice {
		priorityScore += 25.0
	}
	if req.SavedAmount >= req.TargetPrice*0.8 {
		priorityScore += 10.0
	}
	if priorityScore > 100 {
		priorityScore = 98.0
	}

	status := "monitoring"
	if req.CurrentPrice <= req.TargetPrice {
		status = "target_hit"
	}

	id, err := h.db.Insert(`
		INSERT INTO radar_items (
			user_id, title, description, category, image_url,
			target_price, current_price, all_time_low_price, all_time_high_price,
			deal_score, priority_score, platform, url, status, saved_amount, qty
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, req.Title, req.Description, req.Category, req.ImageURL,
		req.TargetPrice, req.CurrentPrice, atl, ath,
		dealScore, priorityScore, req.Platform, req.URL, status, req.SavedAmount, req.Qty)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menambahkan item radar: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Item radar berhasil ditambahkan", map[string]interface{}{
		"id": id,
	})
}

func (h *RadarHandler) UpdateRadarItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	itemID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	var req struct {
		CurrentPrice *float64 `json:"current_price"`
		SavedAmount  *float64 `json:"saved_amount"`
		Status       *string  `json:"status"`
		Qty          *int     `json:"qty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var it models.RadarItem
	err = h.db.QueryRow(`
		SELECT id, target_price, current_price, all_time_low_price, all_time_high_price, saved_amount, status, COALESCE(qty, 1)
		FROM radar_items WHERE id = ? AND user_id = ?
	`, itemID, userID).Scan(&it.ID, &it.TargetPrice, &it.CurrentPrice, &it.AllTimeLowPrice, &it.AllTimeHighPrice, &it.SavedAmount, &it.Status, &it.Qty)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Radar item not found")
		return
	}

	if req.CurrentPrice != nil {
		it.CurrentPrice = *req.CurrentPrice
		if it.CurrentPrice < it.AllTimeLowPrice {
			it.AllTimeLowPrice = it.CurrentPrice
		}
		if it.CurrentPrice > it.AllTimeHighPrice {
			it.AllTimeHighPrice = it.CurrentPrice
		}
		if it.CurrentPrice <= it.TargetPrice && it.Qty > 0 {
			it.Status = "target_hit"
		}
	}
	if req.SavedAmount != nil {
		it.SavedAmount = *req.SavedAmount
	}
	if req.Qty != nil {
		it.Qty = *req.Qty
		if it.Qty <= 0 {
			it.Qty = 0
			it.Status = "bought"
		}
	}
	if req.Status != nil {
		it.Status = *req.Status
		if it.Status == "bought" && req.Qty == nil {
			it.Qty = 0
		}
	}

	_, err = h.db.Exec(`
		UPDATE radar_items
		SET current_price = ?, all_time_low_price = ?, all_time_high_price = ?, saved_amount = ?, status = ?, qty = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ?
	`, it.CurrentPrice, it.AllTimeLowPrice, it.AllTimeHighPrice, it.SavedAmount, it.Status, it.Qty, itemID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memperbarui item radar: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Item radar berhasil diperbarui", it)
}

func (h *RadarHandler) DeleteRadarItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	itemID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	_, err = h.db.Exec("DELETE FROM radar_items WHERE id = ? AND user_id = ?", itemID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus item radar")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Item radar berhasil dihapus", nil)
}

func (h *RadarHandler) GetProcurementSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var s models.ProcurementSettings
	err := h.db.QueryRow(`
		SELECT user_id, utility_weight, desire_weight, saving_weight, updated_at
		FROM procurement_settings
		WHERE user_id = ?
	`, userID).Scan(&s.UserID, &s.UtilityWeight, &s.DesireWeight, &s.SavingWeight, &s.UpdatedAt)
	if err != nil {
		// Return default settings
		s = models.ProcurementSettings{
			UserID:        userID,
			UtilityWeight: 35,
			DesireWeight:  30,
			SavingWeight:  35,
		}
	}

	utils.JSON(w, http.StatusOK, s)
}

func (h *RadarHandler) UpdateProcurementSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		UtilityWeight int `json:"utility_weight"`
		DesireWeight  int `json:"desire_weight"`
		SavingWeight  int `json:"saving_weight"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	_, err := h.db.Exec(`
		INSERT INTO procurement_settings (user_id, utility_weight, desire_weight, saving_weight, updated_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET
			utility_weight = excluded.utility_weight,
			desire_weight = excluded.desire_weight,
			saving_weight = excluded.saving_weight,
			updated_at = CURRENT_TIMESTAMP
	`, userID, req.UtilityWeight, req.DesireWeight, req.SavingWeight)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan bobot belanja")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Bobot belanja rasional berhasil disimpan", req)
}

func (h *RadarHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query("SELECT id, user_id, name, created_at FROM radar_categories WHERE user_id = ? ORDER BY name ASC", userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil kategori radar: "+err.Error())
		return
	}
	defer rows.Close()

	categories := make([]models.RadarCategory, 0)
	for rows.Next() {
		var cat models.RadarCategory
		if err := rows.Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.CreatedAt); err == nil {
			categories = append(categories, cat)
		}
	}

	// Jika user belum memiliki kategori, buat default categories untuk user ini
	if len(categories) == 0 {
		defaultCats := []string{
			"Gadget & Setup",
			"Komputer & Aksesoris",
			"Elektronik Rumah",
			"Hobi & Gaming",
			"Fashion & Apparel",
			"Kebutuhan Dapur & Bahan Pokok",
			"Buku & Edukasi",
			"Lain-lain",
		}
		for _, name := range defaultCats {
			if h.db.Driver == "postgres" {
				_, _ = h.db.Exec("INSERT INTO radar_categories (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING", userID, name)
			} else {
				_, _ = h.db.Exec("INSERT OR IGNORE INTO radar_categories (user_id, name) VALUES (?, ?)", userID, name)
			}
		}

		rowsAfter, errAfter := h.db.Query("SELECT id, user_id, name, created_at FROM radar_categories WHERE user_id = ? ORDER BY name ASC", userID)
		if errAfter == nil {
			defer rowsAfter.Close()
			for rowsAfter.Next() {
				var cat models.RadarCategory
				if err := rowsAfter.Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.CreatedAt); err == nil {
					categories = append(categories, cat)
				}
			}
		}
	}

	utils.JSON(w, http.StatusOK, categories)
}

func (h *RadarHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
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
		utils.JSONError(w, http.StatusBadRequest, "Nama kategori wajib diisi")
		return
	}

	var id int64
	var err error
	if h.db.Driver == "postgres" {
		err = h.db.QueryRow(`
			INSERT INTO radar_categories (user_id, name)
			VALUES ($1, $2)
			ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, userID, req.Name).Scan(&id)
	} else {
		id, err = h.db.Insert("INSERT OR IGNORE INTO radar_categories (user_id, name) VALUES (?, ?)", userID, req.Name)
	}

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menambahkan kategori radar: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Kategori radar berhasil ditambahkan", map[string]interface{}{
		"id":      id,
		"user_id": userID,
		"name":    req.Name,
	})
}

func (h *RadarHandler) GetPlatforms(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query("SELECT id, user_id, name, created_at FROM radar_platforms WHERE user_id = ? ORDER BY name ASC", userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil platform radar: "+err.Error())
		return
	}
	defer rows.Close()

	platforms := make([]models.RadarPlatform, 0)
	for rows.Next() {
		var p models.RadarPlatform
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.CreatedAt); err == nil {
			platforms = append(platforms, p)
		}
	}

	// Jika belum ada platform untuk user ini, inisialisasi default platforms
	if len(platforms) == 0 {
		defaultPlatforms := []string{
			"Tokopedia",
			"Shopee",
			"Blibli",
			"TikTok Shop",
			"Lazada",
			"Toko Fisik / Offline",
		}
		for _, name := range defaultPlatforms {
			if h.db.Driver == "postgres" {
				_, _ = h.db.Exec("INSERT INTO radar_platforms (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING", userID, name)
			} else {
				_, _ = h.db.Exec("INSERT OR IGNORE INTO radar_platforms (user_id, name) VALUES (?, ?)", userID, name)
			}
		}

		rowsAfter, errAfter := h.db.Query("SELECT id, user_id, name, created_at FROM radar_platforms WHERE user_id = ? ORDER BY name ASC", userID)
		if errAfter == nil {
			defer rowsAfter.Close()
			for rowsAfter.Next() {
				var p models.RadarPlatform
				if err := rowsAfter.Scan(&p.ID, &p.UserID, &p.Name, &p.CreatedAt); err == nil {
					platforms = append(platforms, p)
				}
			}
		}
	}

	utils.JSON(w, http.StatusOK, platforms)
}

func (h *RadarHandler) CreatePlatform(w http.ResponseWriter, r *http.Request) {
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
		utils.JSONError(w, http.StatusBadRequest, "Nama platform e-commerce wajib diisi")
		return
	}

	var id int64
	var err error
	if h.db.Driver == "postgres" {
		err = h.db.QueryRow(`
			INSERT INTO radar_platforms (user_id, name)
			VALUES ($1, $2)
			ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, userID, req.Name).Scan(&id)
	} else {
		id, err = h.db.Insert("INSERT OR IGNORE INTO radar_platforms (user_id, name) VALUES (?, ?)", userID, req.Name)
	}

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menambahkan platform: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "Platform e-commerce berhasil ditambahkan", map[string]interface{}{
		"id":      id,
		"user_id": userID,
		"name":    req.Name,
	})
}
