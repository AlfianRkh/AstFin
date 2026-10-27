package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
	"github.com/go-chi/chi/v5"
)

type PriceHandler struct {
	db          *database.DB
	geoMu       sync.Mutex
	lastGeoReq  time.Time
	geoCache    map[string][]byte
	cacheExpiry map[string]time.Time
}

func NewPriceHandler(db *database.DB) *PriceHandler {
	return &PriceHandler{
		db:          db,
		geoCache:    make(map[string][]byte),
		cacheExpiry: make(map[string]time.Time),
	}
}

// =============================================================================
// HELPER CALCULATIONS
// =============================================================================

func normalizeProductName(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	var clean strings.Builder
	for _, r := range lower {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			clean.WriteRune(r)
		}
	}
	words := strings.Fields(clean.String())
	return strings.Join(words, " ")
}

// computeEntryTotals calculates total_units, discount_amount, price_final, price_per_unit
func computeEntryTotals(purchaseQty float64, purchaseUnit string, unitsPerPkg *float64, priceTotal float64, discountType string, discountVal float64) (totalUnits, discountAmt, priceFinal, pricePerUnit float64, baseUnit string) {
	unitLower := strings.ToLower(strings.TrimSpace(purchaseUnit))

	// Determine base unit and total units
	switch unitLower {
	case "kg", "kilogram":
		baseUnit = "kg"
		totalUnits = purchaseQty
	case "gram", "gr", "g":
		baseUnit = "gram"
		totalUnits = purchaseQty
	case "liter", "l":
		baseUnit = "liter"
		totalUnits = purchaseQty
	case "ml", "mililiter":
		baseUnit = "liter"
		totalUnits = purchaseQty / 1000.0
	default:
		// Discrete units: pcs, kardus, pack, dus, lusin, renceng, tray, butir, etc.
		baseUnit = "pcs"
		if unitsPerPkg != nil && *unitsPerPkg > 0 {
			totalUnits = purchaseQty * (*unitsPerPkg)
		} else {
			// standard package multiplier fallbacks if not explicitly provided
			switch unitLower {
			case "lusin":
				totalUnits = purchaseQty * 12.0
			case "kodi":
				totalUnits = purchaseQty * 20.0
			case "gross":
				totalUnits = purchaseQty * 144.0
			default:
				totalUnits = purchaseQty
			}
		}
	}

	if totalUnits <= 0 {
		totalUnits = 1.0
	}

	// Calculate discount
	if strings.ToLower(discountType) == "percent" {
		if discountVal > 100 {
			discountVal = 100
		}
		if discountVal < 0 {
			discountVal = 0
		}
		discountAmt = priceTotal * (discountVal / 100.0)
	} else {
		discountAmt = discountVal
		if discountAmt > priceTotal {
			discountAmt = priceTotal
		}
		if discountAmt < 0 {
			discountAmt = 0
		}
	}

	priceFinal = priceTotal - discountAmt
	if priceFinal < 0 {
		priceFinal = 0
	}

	pricePerUnit = priceFinal / totalUnits
	return
}

// =============================================================================
// STORES
// =============================================================================

func (h *PriceHandler) GetStores(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query(`
		SELECT id, user_id, name, store_type, COALESCE(address_text, ''), lat, lng, is_mobile, public_store_id, created_at
		FROM stores
		WHERE user_id = ?
		ORDER BY name ASC
	`, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil daftar toko: "+err.Error())
		return
	}
	defer rows.Close()

	stores := make([]models.Store, 0)
	for rows.Next() {
		var s models.Store
		if err := rows.Scan(&s.ID, &s.UserID, &s.Name, &s.StoreType, &s.AddressText, &s.Lat, &s.Lng, &s.IsMobile, &s.PublicStoreID, &s.CreatedAt); err != nil {
			continue
		}
		stores = append(stores, s)
	}

	utils.JSON(w, http.StatusOK, stores)
}

func (h *PriceHandler) CreateStore(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Name        string   `json:"name"`
		StoreType   string   `json:"store_type"`
		AddressText string   `json:"address_text"`
		Lat         *float64 `json:"lat"`
		Lng         *float64 `json:"lng"`
		IsMobile    bool     `json:"is_mobile"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Data tidak valid: "+err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.JSONError(w, http.StatusBadRequest, "Nama toko wajib diisi")
		return
	}

	if req.StoreType == "" {
		req.StoreType = "minimarket"
	}

	id, err := h.db.Insert(`
		INSERT INTO stores (user_id, name, store_type, address_text, lat, lng, is_mobile, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, userID, req.Name, req.StoreType, req.AddressText, req.Lat, req.Lng, req.IsMobile)

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan toko: "+err.Error())
		return
	}

	store := models.Store{
		ID:          int(id),
		UserID:      userID,
		Name:        req.Name,
		StoreType:   req.StoreType,
		AddressText: req.AddressText,
		Lat:         req.Lat,
		Lng:         req.Lng,
		IsMobile:    req.IsMobile,
		CreatedAt:   time.Now(),
	}

	utils.JSON(w, http.StatusCreated, store)
}

func (h *PriceHandler) UpdateStore(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	storeIDStr := chi.URLParam(r, "id")
	storeID, err := strconv.Atoi(storeIDStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID toko tidak valid")
		return
	}

	var req struct {
		Name        string   `json:"name"`
		StoreType   string   `json:"store_type"`
		AddressText string   `json:"address_text"`
		Lat         *float64 `json:"lat"`
		Lng         *float64 `json:"lng"`
		IsMobile    bool     `json:"is_mobile"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Data tidak valid")
		return
	}

	res, err := h.db.Exec(`
		UPDATE stores
		SET name = ?, store_type = ?, address_text = ?, lat = ?, lng = ?, is_mobile = ?
		WHERE id = ? AND user_id = ?
	`, req.Name, req.StoreType, req.AddressText, req.Lat, req.Lng, req.IsMobile, storeID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengupdate toko: "+err.Error())
		return
	}

	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		utils.JSONError(w, http.StatusNotFound, "Toko tidak ditemukan")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"message": "Toko berhasil diperbarui", "id": storeID})
}

func (h *PriceHandler) DeleteStore(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	storeIDStr := chi.URLParam(r, "id")
	storeID, err := strconv.Atoi(storeIDStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID toko tidak valid")
		return
	}

	_, err = h.db.Exec(`DELETE FROM stores WHERE id = ? AND user_id = ?`, storeID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus toko: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"message": "Toko berhasil dihapus"})
}

// =============================================================================
// PRODUCT CATEGORIES
// =============================================================================

func (h *PriceHandler) GetProductCategories(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query(`
		SELECT id, user_id, name, group_code, shelf_life_room_days, shelf_life_chiller_days, shelf_life_freezer_days,
		       threshold_cheap_pct, threshold_expensive_pct, created_at
		FROM product_categories
		WHERE user_id IS NULL OR user_id = ?
		ORDER BY id ASC
	`, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil kategori: "+err.Error())
		return
	}
	defer rows.Close()

	cats := make([]models.ProductCategory, 0)
	for rows.Next() {
		var c models.ProductCategory
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.Name, &c.GroupCode,
			&c.ShelfLifeRoomDays, &c.ShelfLifeChillerDays, &c.ShelfLifeFreezerDays,
			&c.ThresholdCheapPct, &c.ThresholdExpensivePct, &c.CreatedAt,
		); err != nil {
			continue
		}
		cats = append(cats, c)
	}

	utils.JSON(w, http.StatusOK, cats)
}

// =============================================================================
// PRICE PRODUCTS & ENTRIES
// =============================================================================

// GetPriceProducts returns products list with aggregated min, max, avg, last price, trend
func (h *PriceHandler) GetPriceProducts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	catIDStr := r.URL.Query().Get("category_id")

	query := `
		SELECT p.id, p.user_id, p.category_id, COALESCE(c.name, 'Lainnya') as category_name,
		       p.canonical_product_id, p.name, p.name_normalized, p.base_unit, p.created_at
		FROM price_products p
		LEFT JOIN product_categories c ON p.category_id = c.id
		WHERE p.user_id = ?
	`
	args := []interface{}{userID}

	if q != "" {
		qNorm := "%" + normalizeProductName(q) + "%"
		query += " AND (p.name_normalized LIKE ? OR p.name LIKE ?)"
		args = append(args, qNorm, "%"+q+"%")
	}

	if catIDStr != "" {
		if catID, err := strconv.Atoi(catIDStr); err == nil && catID > 0 {
			query += " AND p.category_id = ?"
			args = append(args, catID)
		}
	}

	query += " ORDER BY p.id DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil daftar produk: "+err.Error())
		return
	}
	defer rows.Close()

	products := make([]models.PriceProduct, 0)
	for rows.Next() {
		var p models.PriceProduct
		if err := rows.Scan(&p.ID, &p.UserID, &p.CategoryID, &p.CategoryName, &p.CanonicalProductID, &p.Name, &p.NameNormalized, &p.BaseUnit, &p.CreatedAt); err != nil {
			continue
		}
		products = append(products, p)
	}

	// Compute aggregated stats for each product from price_entries
	for i := range products {
		pID := products[i].ID
		statsRow := h.db.QueryRow(`
			SELECT 
				COUNT(e.id) as cnt,
				COALESCE(MIN(e.price_per_unit), 0) as min_price,
				COALESCE(MAX(e.price_per_unit), 0) as max_price,
				COALESCE(AVG(e.price_per_unit), 0) as avg_price
			FROM price_entries e
			WHERE e.product_id = ? AND e.user_id = ? AND e.ignore_in_stats = ?
		`, pID, userID, false)

		var cnt int
		var minP, maxP, avgP float64
		_ = statsRow.Scan(&cnt, &minP, &maxP, &avgP)

		products[i].EntriesCount = cnt
		products[i].MinPricePerUnit = minP
		products[i].MaxPricePerUnit = maxP
		products[i].AvgPricePerUnit = avgP

		// Find cheapest store
		if cnt > 0 {
			cheapRow := h.db.QueryRow(`
				SELECT COALESCE(s.name, e.address_text, 'Toko Tanpa Nama')
				FROM price_entries e
				LEFT JOIN stores s ON e.store_id = s.id
				WHERE e.product_id = ? AND e.user_id = ? AND e.ignore_in_stats = ?
				ORDER BY e.price_per_unit ASC, e.observed_at DESC
				LIMIT 1
			`, pID, userID, false)
			var cheapStore string
			_ = cheapRow.Scan(&cheapStore)
			products[i].CheapestStoreName = cheapStore

			// Find last observed entry and trend
			lastRows, err := h.db.Query(`
				SELECT e.price_per_unit, e.observed_at
				FROM price_entries e
				WHERE e.product_id = ? AND e.user_id = ? AND e.ignore_in_stats = ?
				ORDER BY e.observed_at DESC, e.id DESC
				LIMIT 2
			`, pID, userID, false)
			if err == nil {
				defer lastRows.Close()
				prices := make([]float64, 0)
				dates := make([]string, 0)
				for lastRows.Next() {
					var pu float64
					var dt string
					if err := lastRows.Scan(&pu, &dt); err == nil {
						prices = append(prices, pu)
						dates = append(dates, dt)
					}
				}
				if len(prices) > 0 {
					products[i].LastPricePerUnit = prices[0]
					products[i].LastObservedAt = dates[0]
				}
				if len(prices) >= 2 {
					if prices[0] > prices[1] {
						products[i].PriceTrend = "up"
					} else if prices[0] < prices[1] {
						products[i].PriceTrend = "down"
					} else {
						products[i].PriceTrend = "flat"
					}
				} else {
					products[i].PriceTrend = "flat"
				}
			}
		}
	}

	utils.JSON(w, http.StatusOK, products)
}

// CreatePriceProduct creates product (or attaches to existing) and saves initial price entry
func (h *PriceHandler) CreatePriceProduct(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		// Product info
		Name       string `json:"name"`
		CategoryID *int   `json:"category_id"`
		BaseUnit   string `json:"base_unit"`

		// Initial Entry info
		StoreID           *int     `json:"store_id"`
		EntryType         string   `json:"entry_type"` // observation, purchase
		PurchaseUnit      string   `json:"purchase_unit"`
		PurchaseQty       float64  `json:"purchase_qty"`
		UnitsPerPackage   *float64 `json:"units_per_package"`
		PriceTotal        float64  `json:"price_total"`
		DiscountType      string   `json:"discount_type"` // amount, percent
		DiscountValue     float64  `json:"discount_value"`
		Lat               *float64 `json:"lat"`
		Lng               *float64 `json:"lng"`
		AddressText       string   `json:"address_text"`
		ObservedAt        string   `json:"observed_at"` // YYYY-MM-DD
		PhotoURL          string   `json:"photo_url"`
		Notes             string   `json:"notes"`
		ShareToCommunity  bool     `json:"share_to_community"`
		ExpiryDate        string   `json:"expiry_date"`
		ExpiryIsEstimated bool     `json:"expiry_is_estimated"`
		StorageType       string   `json:"storage_type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Format JSON tidak valid: "+err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.JSONError(w, http.StatusBadRequest, "Nama barang wajib diisi")
		return
	}

	if req.PurchaseUnit == "" {
		req.PurchaseUnit = "pcs"
	}
	if req.PurchaseQty <= 0 {
		req.PurchaseQty = 1.0
	}
	if req.ObservedAt == "" {
		req.ObservedAt = time.Now().Format("2006-01-02")
	}
	if req.EntryType == "" {
		req.EntryType = "observation"
	}

	// Compute entry values
	totalUnits, discountAmt, priceFinal, pricePerUnit, inferredBaseUnit := computeEntryTotals(
		req.PurchaseQty,
		req.PurchaseUnit,
		req.UnitsPerPackage,
		req.PriceTotal,
		req.DiscountType,
		req.DiscountValue,
	)

	if req.BaseUnit == "" {
		req.BaseUnit = inferredBaseUnit
	}

	normName := normalizeProductName(req.Name)

	// Check if product with this normalized name already exists for this user
	var productID int
	err := h.db.QueryRow(`
		SELECT id FROM price_products
		WHERE user_id = ? AND name_normalized = ?
		LIMIT 1
	`, userID, normName).Scan(&productID)

	if err != nil && err != sql.ErrNoRows {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal memeriksa produk: "+err.Error())
		return
	}

	// If not exists, insert product
	if err == sql.ErrNoRows {
		newPID, insErr := h.db.Insert(`
			INSERT INTO price_products (user_id, category_id, canonical_product_id, name, name_normalized, base_unit, created_at)
			VALUES (?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP)
		`, userID, req.CategoryID, req.Name, normName, req.BaseUnit)
		if insErr != nil {
			utils.JSONError(w, http.StatusInternalServerError, "Gagal membuat produk: "+insErr.Error())
			return
		}
		productID = int(newPID)
	}

	// Insert Price Entry
	entryID, err := h.db.Insert(`
		INSERT INTO price_entries (
			user_id, product_id, store_id, entry_type, purchase_unit, purchase_qty, units_per_package,
			total_units, price_total, discount_type, discount_value, discount_amount, price_final, price_per_unit,
			lat, lng, address_text, observed_at, photo_url, notes, ignore_in_stats, share_to_community,
			expiry_date, expiry_is_estimated, storage_type, created_at
		) VALUES (
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, CURRENT_TIMESTAMP
		)
	`,
		userID, productID, req.StoreID, req.EntryType, req.PurchaseUnit, req.PurchaseQty, req.UnitsPerPackage,
		totalUnits, req.PriceTotal, req.DiscountType, req.DiscountValue, discountAmt, priceFinal, pricePerUnit,
		req.Lat, req.Lng, req.AddressText, req.ObservedAt, req.PhotoURL, req.Notes, false, req.ShareToCommunity,
		req.ExpiryDate, req.ExpiryIsEstimated, req.StorageType,
	)

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan pengamatan harga: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, map[string]interface{}{
		"message":        "Harga produk berhasil disimpan",
		"product_id":     productID,
		"entry_id":       entryID,
		"price_final":    priceFinal,
		"price_per_unit": pricePerUnit,
		"total_units":    totalUnits,
		"base_unit":      req.BaseUnit,
	})
}

// GetPriceProductDetail returns product details + complete history of entries
func (h *PriceHandler) GetPriceProductDetail(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	productID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID produk tidak valid")
		return
	}

	var p models.PriceProduct
	err = h.db.QueryRow(`
		SELECT p.id, p.user_id, p.category_id, COALESCE(c.name, 'Lainnya') as category_name,
		       p.canonical_product_id, p.name, p.name_normalized, p.base_unit, p.created_at
		FROM price_products p
		LEFT JOIN product_categories c ON p.category_id = c.id
		WHERE p.id = ? AND p.user_id = ?
	`, productID, userID).Scan(&p.ID, &p.UserID, &p.CategoryID, &p.CategoryName, &p.CanonicalProductID, &p.Name, &p.NameNormalized, &p.BaseUnit, &p.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			utils.JSONError(w, http.StatusNotFound, "Produk tidak ditemukan")
		} else {
			utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil data produk: "+err.Error())
		}
		return
	}

	// Fetch all price entries
	rows, err := h.db.Query(`
		SELECT 
			e.id, e.user_id, e.product_id, p.name as product_name,
			e.store_id, COALESCE(s.name, 'Toko Tanpa Nama') as store_name, COALESCE(s.store_type, '') as store_type,
			e.entry_type, e.purchase_unit, e.purchase_qty, e.units_per_package, e.total_units,
			e.price_total, COALESCE(e.discount_type, 'amount'), e.discount_value, e.discount_amount,
			e.price_final, e.price_per_unit, e.lat, e.lng, COALESCE(e.address_text, ''),
			e.observed_at, COALESCE(e.photo_url, ''), COALESCE(e.notes, ''),
			e.ignore_in_stats, e.share_to_community, e.transaction_id, e.pantry_item_id,
			COALESCE(e.expiry_date, ''), e.expiry_is_estimated, COALESCE(e.storage_type, ''), e.created_at
		FROM price_entries e
		JOIN price_products p ON e.product_id = p.id
		LEFT JOIN stores s ON e.store_id = s.id
		WHERE e.product_id = ? AND e.user_id = ?
		ORDER BY e.observed_at DESC, e.id DESC
	`, productID, userID)

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil entri harga: "+err.Error())
		return
	}
	defer rows.Close()

	entries := make([]models.PriceEntry, 0)
	var minP, maxP, sumP float64
	minP = math.MaxFloat64

	for rows.Next() {
		var e models.PriceEntry
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.ProductID, &e.ProductName,
			&e.StoreID, &e.StoreName, &e.StoreType,
			&e.EntryType, &e.PurchaseUnit, &e.PurchaseQty, &e.UnitsPerPackage, &e.TotalUnits,
			&e.PriceTotal, &e.DiscountType, &e.DiscountValue, &e.DiscountAmount,
			&e.PriceFinal, &e.PricePerUnit, &e.Lat, &e.Lng, &e.AddressText,
			&e.ObservedAt, &e.PhotoURL, &e.Notes,
			&e.IgnoreInStats, &e.ShareToCommunity, &e.TransactionID, &e.PantryItemID,
			&e.ExpiryDate, &e.ExpiryIsEstimated, &e.StorageType, &e.CreatedAt,
		); err != nil {
			continue
		}

		if !e.IgnoreInStats {
			if e.PricePerUnit < minP {
				minP = e.PricePerUnit
			}
			if e.PricePerUnit > maxP {
				maxP = e.PricePerUnit
			}
			sumP += e.PricePerUnit
		}

		entries = append(entries, e)
	}

	p.Entries = entries
	p.EntriesCount = len(entries)
	if len(entries) > 0 && minP != math.MaxFloat64 {
		p.MinPricePerUnit = minP
		p.MaxPricePerUnit = maxP
		p.AvgPricePerUnit = sumP / float64(len(entries))
		p.LastPricePerUnit = entries[0].PricePerUnit
		p.LastObservedAt = entries[0].ObservedAt
	}

	utils.JSON(w, http.StatusOK, p)
}

// AddPriceEntry adds a price observation or purchase record to an existing product
func (h *PriceHandler) AddPriceEntry(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	productID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID produk tidak valid")
		return
	}

	var req struct {
		StoreID           *int     `json:"store_id"`
		EntryType         string   `json:"entry_type"` // observation, purchase
		PurchaseUnit      string   `json:"purchase_unit"`
		PurchaseQty       float64  `json:"purchase_qty"`
		UnitsPerPackage   *float64 `json:"units_per_package"`
		PriceTotal        float64  `json:"price_total"`
		DiscountType      string   `json:"discount_type"` // amount, percent
		DiscountValue     float64  `json:"discount_value"`
		Lat               *float64 `json:"lat"`
		Lng               *float64 `json:"lng"`
		AddressText       string   `json:"address_text"`
		ObservedAt        string   `json:"observed_at"` // YYYY-MM-DD
		PhotoURL          string   `json:"photo_url"`
		Notes             string   `json:"notes"`
		ShareToCommunity  bool     `json:"share_to_community"`
		ExpiryDate        string   `json:"expiry_date"`
		ExpiryIsEstimated bool     `json:"expiry_is_estimated"`
		StorageType       string   `json:"storage_type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Format JSON tidak valid: "+err.Error())
		return
	}

	// Verify product exists and belongs to user
	var currentBaseUnit string
	err = h.db.QueryRow(`SELECT base_unit FROM price_products WHERE id = ? AND user_id = ?`, productID, userID).Scan(&currentBaseUnit)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Produk tidak ditemukan")
		return
	}

	if req.PurchaseUnit == "" {
		req.PurchaseUnit = currentBaseUnit
	}
	if req.PurchaseQty <= 0 {
		req.PurchaseQty = 1.0
	}
	if req.ObservedAt == "" {
		req.ObservedAt = time.Now().Format("2006-01-02")
	}
	if req.EntryType == "" {
		req.EntryType = "observation"
	}

	totalUnits, discountAmt, priceFinal, pricePerUnit, _ := computeEntryTotals(
		req.PurchaseQty,
		req.PurchaseUnit,
		req.UnitsPerPackage,
		req.PriceTotal,
		req.DiscountType,
		req.DiscountValue,
	)

	entryID, err := h.db.Insert(`
		INSERT INTO price_entries (
			user_id, product_id, store_id, entry_type, purchase_unit, purchase_qty, units_per_package,
			total_units, price_total, discount_type, discount_value, discount_amount, price_final, price_per_unit,
			lat, lng, address_text, observed_at, photo_url, notes, ignore_in_stats, share_to_community,
			expiry_date, expiry_is_estimated, storage_type, created_at
		) VALUES (
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, CURRENT_TIMESTAMP
		)
	`,
		userID, productID, req.StoreID, req.EntryType, req.PurchaseUnit, req.PurchaseQty, req.UnitsPerPackage,
		totalUnits, req.PriceTotal, req.DiscountType, req.DiscountValue, discountAmt, priceFinal, pricePerUnit,
		req.Lat, req.Lng, req.AddressText, req.ObservedAt, req.PhotoURL, req.Notes, false, req.ShareToCommunity,
		req.ExpiryDate, req.ExpiryIsEstimated, req.StorageType,
	)

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menambahkan entri harga: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, map[string]interface{}{
		"message":        "Entri harga berhasil ditambahkan",
		"id":             entryID,
		"product_id":     productID,
		"price_final":    priceFinal,
		"price_per_unit": pricePerUnit,
		"total_units":    totalUnits,
	})
}

func (h *PriceHandler) DeletePriceEntry(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	entryIDStr := chi.URLParam(r, "id")
	entryID, err := strconv.Atoi(entryIDStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID entri tidak valid")
		return
	}

	_, err = h.db.Exec(`DELETE FROM price_entries WHERE id = ? AND user_id = ?`, entryID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus entri harga: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"message": "Entri harga berhasil dihapus"})
}

func (h *PriceHandler) DeletePriceProduct(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	idStr := chi.URLParam(r, "id")
	productID, err := strconv.Atoi(idStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID produk tidak valid")
		return
	}

	_, err = h.db.Exec(`DELETE FROM price_products WHERE id = ? AND user_id = ?`, productID, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus produk: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"message": "Produk dan riwayat harga berhasil dihapus"})
}

// =============================================================================
// PRICE CHECK CALCULATOR (Cek Sebelum Belanja)
// =============================================================================

func (h *PriceHandler) PriceCheck(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.PriceCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Format JSON tidak valid: "+err.Error())
		return
	}

	req.ProductName = strings.TrimSpace(req.ProductName)
	if req.ProductName == "" {
		utils.JSONError(w, http.StatusBadRequest, "Nama barang wajib diisi untuk cek harga")
		return
	}
	if req.PurchaseQty <= 0 {
		req.PurchaseQty = 1.0
	}
	if req.PurchaseUnit == "" {
		req.PurchaseUnit = "pcs"
	}

	// Calculate input normalized price per unit
	_, _, priceFinal, inputPricePerUnit, baseUnit := computeEntryTotals(
		req.PurchaseQty,
		req.PurchaseUnit,
		req.UnitsPerPackage,
		req.PriceTotal,
		req.DiscountType,
		req.DiscountValue,
	)

	normName := normalizeProductName(req.ProductName)

	// Fetch user's settings or defaults
	var thresholdMode string
	var cheapPct, expPct float64
	var periodDays int
	settingsRow := h.db.QueryRow(`
		SELECT threshold_mode, threshold_cheap_pct, threshold_expensive_pct, period_days
		FROM price_settings
		WHERE user_id = ?
	`, userID)
	if err := settingsRow.Scan(&thresholdMode, &cheapPct, &expPct, &periodDays); err != nil {
		thresholdMode = "percent"
		cheapPct = 10.0
		expPct = 15.0
		periodDays = 60
	}

	// Try finding product category threshold overrides if category exists
	var catCheapPct, catExpPct *float64
	_ = h.db.QueryRow(`
		SELECT c.threshold_cheap_pct, c.threshold_expensive_pct
		FROM price_products p
		JOIN product_categories c ON p.category_id = c.id
		WHERE p.user_id = ? AND p.name_normalized = ?
		LIMIT 1
	`, userID, normName).Scan(&catCheapPct, &catExpPct)

	if catCheapPct != nil && *catCheapPct > 0 {
		cheapPct = *catCheapPct
	}
	if catExpPct != nil && *catExpPct > 0 {
		expPct = *catExpPct
	}

	// Query historical entries for this product (fuzzy match on name or normalized)
	cutoffDate := time.Now().AddDate(0, 0, -periodDays).Format("2006-01-02")
	rows, err := h.db.Query(`
		SELECT 
			e.id, e.user_id, e.product_id, p.name as product_name,
			e.store_id, COALESCE(s.name, 'Toko Tanpa Nama') as store_name, COALESCE(s.store_type, '') as store_type,
			e.entry_type, e.purchase_unit, e.purchase_qty, e.units_per_package, e.total_units,
			e.price_total, COALESCE(e.discount_type, 'amount'), e.discount_value, e.discount_amount,
			e.price_final, e.price_per_unit, e.lat, e.lng, COALESCE(e.address_text, ''),
			e.observed_at, COALESCE(e.photo_url, ''), COALESCE(e.notes, ''),
			e.ignore_in_stats, e.share_to_community, e.transaction_id, e.pantry_item_id,
			COALESCE(e.expiry_date, ''), e.expiry_is_estimated, COALESCE(e.storage_type, ''), e.created_at
		FROM price_entries e
		JOIN price_products p ON e.product_id = p.id
		LEFT JOIN stores s ON e.store_id = s.id
		WHERE (p.name_normalized = ? OR p.name_normalized LIKE ?)
		  AND (e.user_id = ? OR e.share_to_community = ?)
		  AND e.ignore_in_stats = ?
		  AND e.observed_at >= ?
		ORDER BY e.observed_at DESC, e.id DESC
		LIMIT 30
	`, normName, "%"+normName+"%", userID, true, false, cutoffDate)

	var history []models.PriceEntry
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ent models.PriceEntry
			if err := rows.Scan(
				&ent.ID, &ent.UserID, &ent.ProductID, &ent.ProductName,
				&ent.StoreID, &ent.StoreName, &ent.StoreType,
				&ent.EntryType, &ent.PurchaseUnit, &ent.PurchaseQty, &ent.UnitsPerPackage, &ent.TotalUnits,
				&ent.PriceTotal, &ent.DiscountType, &ent.DiscountValue, &ent.DiscountAmount,
				&ent.PriceFinal, &ent.PricePerUnit, &ent.Lat, &ent.Lng, &ent.AddressText,
				&ent.ObservedAt, &ent.PhotoURL, &ent.Notes,
				&ent.IgnoreInStats, &ent.ShareToCommunity, &ent.TransactionID, &ent.PantryItemID,
				&ent.ExpiryDate, &ent.ExpiryIsEstimated, &ent.StorageType, &ent.CreatedAt,
			); err == nil {
				history = append(history, ent)
			}
		}
	}

	result := models.PriceCheckResult{
		NormalizedPricePerUnit: math.Round(inputPricePerUnit*100) / 100,
		BaseUnit:               baseUnit,
		RecentHistory:          history,
		EntriesAnalyzedCount:   len(history),
	}

	if len(history) < 2 {
		result.Verdict = "not_enough_data"
		result.VerdictLabel = "Data Belum Cukup"
		result.Recommendation = fmt.Sprintf("Belum ada riwayat harga yang cukup untuk '%s' dalam %d hari terakhir. Simpan harga ini sebagai referensi awal!", req.ProductName, periodDays)
		utils.JSON(w, http.StatusOK, result)
		return
	}

	// Calculate median, min, max, avg
	unitPrices := make([]float64, 0, len(history))
	var sum float64
	var cheapestStore string
	var cheapestDate string
	minPrice := math.MaxFloat64
	maxPrice := 0.0

	for _, h := range history {
		unitPrices = append(unitPrices, h.PricePerUnit)
		sum += h.PricePerUnit
		if h.PricePerUnit < minPrice {
			minPrice = h.PricePerUnit
			cheapestStore = h.StoreName
			cheapestDate = h.ObservedAt
		}
		if h.PricePerUnit > maxPrice {
			maxPrice = h.PricePerUnit
		}
	}

	sort.Float64s(unitPrices)
	var median float64
	n := len(unitPrices)
	if n%2 == 1 {
		median = unitPrices[n/2]
	} else {
		median = (unitPrices[n/2-1] + unitPrices[n/2]) / 2.0
	}

	result.MedianPrice = math.Round(median*100) / 100
	result.AvgPrice = math.Round((sum/float64(n))*100) / 100
	result.MinPrice = math.Round(minPrice*100) / 100
	result.MaxPrice = math.Round(maxPrice*100) / 100
	result.CheapestStoreName = cheapestStore
	result.CheapestDate = cheapestDate

	// Percentage difference vs median
	diffPct := ((inputPricePerUnit - median) / median) * 100.0
	result.DiffPercentage = math.Round(diffPct*10) / 10

	// Verdict calculation
	if diffPct <= -cheapPct {
		result.Verdict = "cheap"
		result.VerdictLabel = "Murah / Hemat"
		result.ThresholdUsedPct = cheapPct
		result.Recommendation = fmt.Sprintf("Harga ini %.1f%% lebih hemat dibanding harga median (Rp %s/%s). Sangat direkomendasikan untuk dibeli!", math.Abs(diffPct), utils.FormatRupiah(median), baseUnit)
	} else if diffPct >= expPct {
		result.Verdict = "expensive"
		result.VerdictLabel = "Mahal"
		result.ThresholdUsedPct = expPct
		if cheapestStore != "" {
			result.Recommendation = fmt.Sprintf("Harga ini %.1f%% lebih mahal dari median (Rp %s/%s). Toko termurah sebelumnya: %s (Rp %s/%s pada %s). Sebaiknya tunda atau cari alternatif toko lain.", diffPct, utils.FormatRupiah(median), baseUnit, cheapestStore, utils.FormatRupiah(minPrice), baseUnit, cheapestDate)
		} else {
			result.Recommendation = fmt.Sprintf("Harga ini %.1f%% lebih mahal dari median (Rp %s/%s). Sebaiknya bandingkan dengan toko lain terlebih dahulu.", diffPct, utils.FormatRupiah(median), baseUnit)
		}
	} else {
		result.Verdict = "fair"
		result.VerdictLabel = "Wajar / Standar"
		result.ThresholdUsedPct = 0.0
		result.Recommendation = fmt.Sprintf("Harga berada di kisaran wajar pasar (selisih %+.1f%% dari median Rp %s/%s). Layak dibeli jika memang sedang dibutuhkan.", diffPct, utils.FormatRupiah(median), baseUnit)
	}

	_ = priceFinal
	utils.JSON(w, http.StatusOK, result)
}

// =============================================================================
// SETTINGS
// =============================================================================

func (h *PriceHandler) GetPriceSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var s models.PriceSettings
	err := h.db.QueryRow(`
		SELECT user_id, threshold_mode, threshold_cheap_pct, threshold_expensive_pct, period_days, default_source, share_all_entries
		FROM price_settings
		WHERE user_id = ?
	`, userID).Scan(&s.UserID, &s.ThresholdMode, &s.ThresholdCheapPct, &s.ThresholdExpensivePct, &s.PeriodDays, &s.DefaultSource, &s.ShareAllEntries)

	if err != nil {
		// Default settings
		s = models.PriceSettings{
			UserID:                userID,
			ThresholdMode:         "percent",
			ThresholdCheapPct:     10.0,
			ThresholdExpensivePct: 15.0,
			PeriodDays:            60,
			DefaultSource:         "combined",
			ShareAllEntries:       false,
		}
	}

	utils.JSON(w, http.StatusOK, s)
}

func (h *PriceHandler) UpdatePriceSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.PriceSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Data tidak valid")
		return
	}

	if req.ThresholdCheapPct <= 0 {
		req.ThresholdCheapPct = 10.0
	}
	if req.ThresholdExpensivePct <= 0 {
		req.ThresholdExpensivePct = 15.0
	}
	if req.PeriodDays <= 0 {
		req.PeriodDays = 60
	}
	if req.ThresholdMode == "" {
		req.ThresholdMode = "percent"
	}
	if req.DefaultSource == "" {
		req.DefaultSource = "combined"
	}

	if h.db.Driver == "sqlite" {
		_, err := h.db.Exec(`
			INSERT INTO price_settings (user_id, threshold_mode, threshold_cheap_pct, threshold_expensive_pct, period_days, default_source, share_all_entries)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				threshold_mode = excluded.threshold_mode,
				threshold_cheap_pct = excluded.threshold_cheap_pct,
				threshold_expensive_pct = excluded.threshold_expensive_pct,
				period_days = excluded.period_days,
				default_source = excluded.default_source,
				share_all_entries = excluded.share_all_entries
		`, userID, req.ThresholdMode, req.ThresholdCheapPct, req.ThresholdExpensivePct, req.PeriodDays, req.DefaultSource, req.ShareAllEntries)
		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan pengaturan: "+err.Error())
			return
		}
	} else {
		_, err := h.db.Exec(`
			INSERT INTO price_settings (user_id, threshold_mode, threshold_cheap_pct, threshold_expensive_pct, period_days, default_source, share_all_entries)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				threshold_mode = EXCLUDED.threshold_mode,
				threshold_cheap_pct = EXCLUDED.threshold_cheap_pct,
				threshold_expensive_pct = EXCLUDED.threshold_expensive_pct,
				period_days = EXCLUDED.period_days,
				default_source = EXCLUDED.default_source,
				share_all_entries = EXCLUDED.share_all_entries
		`, userID, req.ThresholdMode, req.ThresholdCheapPct, req.ThresholdExpensivePct, req.PeriodDays, req.DefaultSource, req.ShareAllEntries)
		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan pengaturan: "+err.Error())
			return
		}
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"message": "Pengaturan berhasil diperbarui"})
}

// =============================================================================
// OPENSTREETMAP NOMINATIM PROXY (Search & Reverse Geocoding)
// Complies with Nominatim usage policy: 1 req/sec max, User-Agent, in-memory cache
// =============================================================================

func (h *PriceHandler) checkGeoRateLimit() {
	h.geoMu.Lock()
	defer h.geoMu.Unlock()
	elapsed := time.Since(h.lastGeoReq)
	if elapsed < 1100*time.Millisecond {
		time.Sleep(1100*time.Millisecond - elapsed)
	}
	h.lastGeoReq = time.Now()
}

func (h *PriceHandler) SearchGeo(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		utils.JSON(w, http.StatusOK, []interface{}{})
		return
	}

	cacheKey := "search:" + strings.ToLower(q)
	h.geoMu.Lock()
	if data, ok := h.geoCache[cacheKey]; ok {
		if time.Now().Before(h.cacheExpiry[cacheKey]) {
			h.geoMu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.Write(data)
			return
		}
	}
	h.geoMu.Unlock()

	h.checkGeoRateLimit()

	// Prioritize Indonesian results
	nominatimURL := fmt.Sprintf("https://nominatim.openstreetmap.org/search?q=%s&format=json&addressdetails=1&countrycodes=id&limit=8", url.QueryEscape(q))
	req, err := http.NewRequest("GET", nominatimURL, nil)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal membuat request geocoding")
		return
	}
	req.Header.Set("User-Agent", "AstFin-ComparePrice/1.0 (contact: admin@astfin.local)")
	req.Header.Set("Accept-Language", "id,en")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		utils.JSONError(w, http.StatusBadGateway, "Gagal menghubungi OpenStreetMap")
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal membaca respon")
		return
	}

	// Cache for 24 hours
	h.geoMu.Lock()
	h.geoCache[cacheKey] = body
	h.cacheExpiry[cacheKey] = time.Now().Add(24 * time.Hour)
	h.geoMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

func (h *PriceHandler) ReverseGeo(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		utils.JSONError(w, http.StatusBadRequest, "Lat dan Lng wajib disertakan")
		return
	}

	cacheKey := fmt.Sprintf("rev:%.5s,%.5s", latStr, lngStr)
	h.geoMu.Lock()
	if data, ok := h.geoCache[cacheKey]; ok {
		if time.Now().Before(h.cacheExpiry[cacheKey]) {
			h.geoMu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.Write(data)
			return
		}
	}
	h.geoMu.Unlock()

	h.checkGeoRateLimit()

	nominatimURL := fmt.Sprintf("https://nominatim.openstreetmap.org/reverse?lat=%s&lon=%s&format=json&addressdetails=1", url.QueryEscape(latStr), url.QueryEscape(lngStr))
	req, err := http.NewRequest("GET", nominatimURL, nil)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal membuat request")
		return
	}
	req.Header.Set("User-Agent", "AstFin-ComparePrice/1.0 (contact: admin@astfin.local)")
	req.Header.Set("Accept-Language", "id,en")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		utils.JSONError(w, http.StatusBadGateway, "Gagal menghubungi OpenStreetMap")
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal membaca respon")
		return
	}

	h.geoMu.Lock()
	h.geoCache[cacheKey] = body
	h.cacheExpiry[cacheKey] = time.Now().Add(24 * time.Hour)
	h.geoMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}
