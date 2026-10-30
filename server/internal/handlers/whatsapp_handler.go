package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"astfin/server/internal/config"
	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
)

type WhatsAppHandler struct {
	db  *database.DB
	cfg *config.Config
}

func NewWhatsAppHandler(db *database.DB, cfg *config.Config) *WhatsAppHandler {
	return &WhatsAppHandler{db: db, cfg: cfg}
}

// Helper: Normalize Indonesian phone numbers to 628xxxxxxxx
func cleanPhoneNumber(phone string) string {
	reg := regexp.MustCompile(`[^0-9]`)
	cleaned := reg.ReplaceAllString(phone, "")
	if strings.HasPrefix(cleaned, "08") {
		cleaned = "628" + cleaned[2:]
	} else if strings.HasPrefix(cleaned, "8") {
		cleaned = "628" + cleaned[1:]
	}
	return cleaned
}

func buildWaLink(phone, message string) string {
	cleaned := cleanPhoneNumber(phone)
	if cleaned == "" {
		return "https://wa.me/?text=" + url.QueryEscape(message)
	}
	return fmt.Sprintf("https://wa.me/%s?text=%s", cleaned, url.QueryEscape(message))
}

func getDefaultSettings(userID int) models.WhatsAppSettings {
	return models.WhatsAppSettings{
		UserID:                userID,
		PhoneNumber:           "",
		IsEnabled:             true,
		Provider:              "wa_me",
		APIKey:                "",
		GatewayURL:            "",
		ReminderTime:          "08:00",
		PantryExpiryEnabled:   true,
		PantryDaysBefore:      3,
		DebtDueEnabled:        true,
		DebtDaysBefore:        1,
		DebtOverdueEnabled:    true,
		PantryLowStockEnabled: true,
		RadarTargetEnabled:    true,
		BudgetAlertEnabled:    true,
		TemplatePantryExpiry:  "Halo {nama}! ⚠️ *Pengingat Stok Dapur*: Produk *{nama_produk}* tersisa {jumlah} {satuan} di {kategori} akan *KADALUWARSA* dalam {hari_sisa} hari (Tgl: {tgl_kadaluarsa}). Segera olah atau konsumsi!",
		TemplateDebtDue:       "Halo {nama}! 💳 *Pengingat Cicilan/Tagihan*: Tagihan *{nama_kontak}* sebesar *Rp {nominal}* akan jatuh tempo pada *{jatuh_tempo}* ({hari_sisa} hari lagi). Jangan lupa disiapkan ya!",
		TemplateDebtOverdue:   "Halo {nama}! 🚨 *Peringatan Jatuh Tempo*: Tagihan *{nama_kontak}* sebesar *Rp {nominal}* telah *MELEWATI JATUH TEMPO* sejak {jatuh_tempo}. Segera selesaikan kewajiban Anda.",
		TemplateLowStock:      "Halo {nama}! 📦 *Pantry Menipis*: Stok *{nama_produk}* di {kategori} tersisa {jumlah} {satuan} (di bawah batas min {min_jumlah} {satuan}). Segera restock!",
		TemplateRadarTarget:   "Halo {nama}! 🎯 *Radar Deal Sinyal*: Produk idaman *{nama_produk}* di {platform} telah turun ke harga *Rp {harga_sekarang}* (Target: Rp {target_harga})! Deal Score: {deal_score}%. Waktunya checkout!",
		UpdatedAt:             time.Now(),
	}
}

// GetSettings retrieves current user WhatsApp & reminder configuration
func (h *WhatsAppHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var s models.WhatsAppSettings
	query := `
		SELECT id, user_id, phone_number, is_enabled, provider, api_key, gateway_url,
		       reminder_time, pantry_expiry_enabled, pantry_days_before,
		       debt_due_enabled, debt_days_before, debt_overdue_enabled,
		       pantry_low_stock_enabled, radar_target_enabled, budget_alert_enabled,
		       template_pantry_expiry, template_debt_due, template_debt_overdue,
		       template_low_stock, template_radar_target, updated_at
		FROM whatsapp_settings
		WHERE user_id = ?
	`
	err := h.db.QueryRow(query, userID).Scan(
		&s.ID, &s.UserID, &s.PhoneNumber, &s.IsEnabled, &s.Provider, &s.APIKey, &s.GatewayURL,
		&s.ReminderTime, &s.PantryExpiryEnabled, &s.PantryDaysBefore,
		&s.DebtDueEnabled, &s.DebtDaysBefore, &s.DebtOverdueEnabled,
		&s.PantryLowStockEnabled, &s.RadarTargetEnabled, &s.BudgetAlertEnabled,
		&s.TemplatePantryExpiry, &s.TemplateDebtDue, &s.TemplateDebtOverdue,
		&s.TemplateLowStock, &s.TemplateRadarTarget, &s.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			defaults := getDefaultSettings(userID)
			utils.JSON(w, http.StatusOK, defaults)
			return
		}
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil pengaturan WhatsApp: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, s)
}

// UpdateSettings saves or updates WhatsApp & reminder configuration
func (h *WhatsAppHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.WhatsAppSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Format JSON tidak valid")
		return
	}

	// Fallback to safe defaults if template is empty
	def := getDefaultSettings(userID)
	if req.TemplatePantryExpiry == "" {
		req.TemplatePantryExpiry = def.TemplatePantryExpiry
	}
	if req.TemplateDebtDue == "" {
		req.TemplateDebtDue = def.TemplateDebtDue
	}
	if req.TemplateDebtOverdue == "" {
		req.TemplateDebtOverdue = def.TemplateDebtOverdue
	}
	if req.TemplateLowStock == "" {
		req.TemplateLowStock = def.TemplateLowStock
	}
	if req.TemplateRadarTarget == "" {
		req.TemplateRadarTarget = def.TemplateRadarTarget
	}
	if req.ReminderTime == "" {
		req.ReminderTime = "08:00"
	}
	if req.Provider == "" {
		req.Provider = "wa_me"
	}
	if req.PantryDaysBefore <= 0 {
		req.PantryDaysBefore = 3
	}
	if req.DebtDaysBefore <= 0 {
		req.DebtDaysBefore = 1
	}

	query := `
		INSERT INTO whatsapp_settings (
			user_id, phone_number, is_enabled, provider, api_key, gateway_url,
			reminder_time, pantry_expiry_enabled, pantry_days_before,
			debt_due_enabled, debt_days_before, debt_overdue_enabled,
			pantry_low_stock_enabled, radar_target_enabled, budget_alert_enabled,
			template_pantry_expiry, template_debt_due, template_debt_overdue,
			template_low_stock, template_radar_target, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET
			phone_number = excluded.phone_number,
			is_enabled = excluded.is_enabled,
			provider = excluded.provider,
			api_key = excluded.api_key,
			gateway_url = excluded.gateway_url,
			reminder_time = excluded.reminder_time,
			pantry_expiry_enabled = excluded.pantry_expiry_enabled,
			pantry_days_before = excluded.pantry_days_before,
			debt_due_enabled = excluded.debt_due_enabled,
			debt_days_before = excluded.debt_days_before,
			debt_overdue_enabled = excluded.debt_overdue_enabled,
			pantry_low_stock_enabled = excluded.pantry_low_stock_enabled,
			radar_target_enabled = excluded.radar_target_enabled,
			budget_alert_enabled = excluded.budget_alert_enabled,
			template_pantry_expiry = excluded.template_pantry_expiry,
			template_debt_due = excluded.template_debt_due,
			template_debt_overdue = excluded.template_debt_overdue,
			template_low_stock = excluded.template_low_stock,
			template_radar_target = excluded.template_radar_target,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := h.db.Exec(query,
		userID, req.PhoneNumber, req.IsEnabled, req.Provider, req.APIKey, req.GatewayURL,
		req.ReminderTime, req.PantryExpiryEnabled, req.PantryDaysBefore,
		req.DebtDueEnabled, req.DebtDaysBefore, req.DebtOverdueEnabled,
		req.PantryLowStockEnabled, req.RadarTargetEnabled, req.BudgetAlertEnabled,
		req.TemplatePantryExpiry, req.TemplateDebtDue, req.TemplateDebtOverdue,
		req.TemplateLowStock, req.TemplateRadarTarget,
	)

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan pengaturan WhatsApp: "+err.Error())
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Pengaturan pengingat WhatsApp berhasil disimpan", req)
}

// GetQueue scans active items that need attention today and generates WhatsApp action links
func (h *WhatsAppHandler) GetQueue(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// 1. Fetch user settings & profile name
	var s models.WhatsAppSettings
	query := `
		SELECT id, user_id, phone_number, is_enabled, provider, api_key, gateway_url,
		       reminder_time, pantry_expiry_enabled, pantry_days_before,
		       debt_due_enabled, debt_days_before, debt_overdue_enabled,
		       pantry_low_stock_enabled, radar_target_enabled, budget_alert_enabled,
		       template_pantry_expiry, template_debt_due, template_debt_overdue,
		       template_low_stock, template_radar_target, updated_at
		FROM whatsapp_settings
		WHERE user_id = ?
	`
	err := h.db.QueryRow(query, userID).Scan(
		&s.ID, &s.UserID, &s.PhoneNumber, &s.IsEnabled, &s.Provider, &s.APIKey, &s.GatewayURL,
		&s.ReminderTime, &s.PantryExpiryEnabled, &s.PantryDaysBefore,
		&s.DebtDueEnabled, &s.DebtDaysBefore, &s.DebtOverdueEnabled,
		&s.PantryLowStockEnabled, &s.RadarTargetEnabled, &s.BudgetAlertEnabled,
		&s.TemplatePantryExpiry, &s.TemplateDebtDue, &s.TemplateDebtOverdue,
		&s.TemplateLowStock, &s.TemplateRadarTarget, &s.UpdatedAt,
	)
	if err != nil {
		s = getDefaultSettings(userID)
	}

	var userName string
	_ = h.db.QueryRow("SELECT COALESCE(full_name, username) FROM users WHERE id = ?", userID).Scan(&userName)
	if userName == "" {
		userName = "Pengguna"
	}

	now := time.Now()
	todayStr := now.Format("2006-01-02")
	todayDate, _ := time.Parse("2006-01-02", todayStr)

	items := make([]models.WhatsAppQueueItem, 0)
	var pantryAlertCount, debtAlertCount, radarAlertCount int

	targetPhone := s.PhoneNumber

	// 2. Scan Pantry Expiring Items (H-X days and expired)
	if s.PantryExpiryEnabled {
		maxDays := s.PantryDaysBefore
		if maxDays <= 0 {
			maxDays = 3
		}
		thresholdDate := now.AddDate(0, 0, maxDays).Format("2006-01-02")

		rows, err := h.db.Query(`
			SELECT id, name, category, quantity, unit, expiry_date
			FROM pantry_items
			WHERE user_id = ? AND quantity > 0 AND expiry_date <= ?
			ORDER BY expiry_date ASC
		`, userID, thresholdDate)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p models.PantryItem
				if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Quantity, &p.Unit, &p.ExpiryDate); err == nil {
					expDate, _ := time.Parse("2006-01-02", p.ExpiryDate)
					daysLeft := int(expDate.Sub(todayDate).Hours() / 24)

					severity := "warning"
					statusLabel := fmt.Sprintf("%d hari lagi", daysLeft)
					if daysLeft < 0 {
						severity = "critical"
						statusLabel = fmt.Sprintf("KADALUWARSA LEWAT %d HARI", -daysLeft)
					} else if daysLeft == 0 {
						severity = "critical"
						statusLabel = "KADALUWARSA HARI INI!"
					}

					// Interpolate template
					msg := s.TemplatePantryExpiry
					msg = strings.ReplaceAll(msg, "{nama}", userName)
					msg = strings.ReplaceAll(msg, "{nama_produk}", p.Name)
					msg = strings.ReplaceAll(msg, "{jumlah}", fmt.Sprintf("%.0f", p.Quantity))
					msg = strings.ReplaceAll(msg, "{satuan}", p.Unit)
					msg = strings.ReplaceAll(msg, "{kategori}", p.Category)
					msg = strings.ReplaceAll(msg, "{hari_sisa}", fmt.Sprintf("%d", daysLeft))
					msg = strings.ReplaceAll(msg, "{tgl_kadaluarsa}", p.ExpiryDate)

					waLink := buildWaLink(targetPhone, msg)

					items = append(items, models.WhatsAppQueueItem{
						ID:          fmt.Sprintf("pantry-exp-%d", p.ID),
						Type:        "pantry_expiry",
						Title:       fmt.Sprintf("KEDALUWARSA: %s (%s)", p.Name, statusLabel),
						Description: fmt.Sprintf("Stok %s %.0f %s di %s mendekati/melewati batas konsumsi (%s)", p.Name, p.Quantity, p.Unit, p.Category, p.ExpiryDate),
						Severity:    severity,
						Phone:       targetPhone,
						Message:     msg,
						WaLink:      waLink,
						TargetDate:  p.ExpiryDate,
						DaysLeft:    daysLeft,
						ModuleName:  "Dapur & Inventaris",
						ItemName:    p.Name,
					})
					pantryAlertCount++
				}
			}
		}
	}

	// 3. Scan Pantry Low Stock Items
	if s.PantryLowStockEnabled {
		rows, err := h.db.Query(`
			SELECT id, name, category, quantity, unit, min_quantity
			FROM pantry_items
			WHERE user_id = ? AND quantity <= min_quantity
			ORDER BY quantity ASC
		`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p models.PantryItem
				if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Quantity, &p.Unit, &p.MinQuantity); err == nil {
					msg := s.TemplateLowStock
					msg = strings.ReplaceAll(msg, "{nama}", userName)
					msg = strings.ReplaceAll(msg, "{nama_produk}", p.Name)
					msg = strings.ReplaceAll(msg, "{jumlah}", fmt.Sprintf("%.0f", p.Quantity))
					msg = strings.ReplaceAll(msg, "{min_jumlah}", fmt.Sprintf("%.0f", p.MinQuantity))
					msg = strings.ReplaceAll(msg, "{satuan}", p.Unit)
					msg = strings.ReplaceAll(msg, "{kategori}", p.Category)

					waLink := buildWaLink(targetPhone, msg)

					items = append(items, models.WhatsAppQueueItem{
						ID:          fmt.Sprintf("pantry-low-%d", p.ID),
						Type:        "low_stock",
						Title:       fmt.Sprintf("STOK MENIPIS: %s", p.Name),
						Description: fmt.Sprintf("Sisa %.0f %s di %s sudah berada di bawah batas aman %.0f %s", p.Quantity, p.Unit, p.Category, p.MinQuantity, p.Unit),
						Severity:    "warning",
						Phone:       targetPhone,
						Message:     msg,
						WaLink:      waLink,
						DaysLeft:    0,
						ModuleName:  "Dapur & Inventaris",
						ItemName:    p.Name,
					})
					pantryAlertCount++
				}
			}
		}
	}

	// 4. Scan Debts (H-1 / Due Soon & Overdue)
	if s.DebtDueEnabled || s.DebtOverdueEnabled {
		maxDebtDays := s.DebtDaysBefore
		if maxDebtDays <= 0 {
			maxDebtDays = 1
		}
		thresholdDue := now.AddDate(0, 0, maxDebtDays).Format("2006-01-02")

		rows, err := h.db.Query(`
			SELECT id, contact_name, COALESCE(contact_phone, ''), type, total_amount - paid_amount, due_date
			FROM debts
			WHERE user_id = ? AND status != 'paid' AND due_date <= ?
			ORDER BY due_date ASC
		`, userID, thresholdDue)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var d models.Debt
				var debtPhone string
				if err := rows.Scan(&d.ID, &d.ContactName, &debtPhone, &d.Type, &d.Remaining, &d.DueDate); err == nil {
					dueDateParsed, _ := time.Parse("2006-01-02", d.DueDate)
					daysLeft := int(dueDateParsed.Sub(todayDate).Hours() / 24)

					isOverdue := daysLeft < 0
					if isOverdue && !s.DebtOverdueEnabled {
						continue
					}
					if !isOverdue && !s.DebtDueEnabled {
						continue
					}

					var msg string
					var title string
					var severity string

					formattedNominal := utils.FormatRupiah(d.Remaining)

					// Prefer debt contact phone if available, else send reminder to user
					destPhone := targetPhone
					if d.Type == "piutang" && debtPhone != "" {
						destPhone = debtPhone
					}

					if isOverdue {
						severity = "critical"
						title = fmt.Sprintf("JATUH TEMPO LEWAT: %s (H%d)", d.ContactName, daysLeft)
						msg = s.TemplateDebtOverdue
						msg = strings.ReplaceAll(msg, "{nama}", userName)
						msg = strings.ReplaceAll(msg, "{nama_kontak}", d.ContactName)
						msg = strings.ReplaceAll(msg, "{nominal}", formattedNominal)
						msg = strings.ReplaceAll(msg, "{jatuh_tempo}", d.DueDate)
						msg = strings.ReplaceAll(msg, "{hari_sisa}", fmt.Sprintf("%d", -daysLeft))
					} else {
						severity = "warning"
						if daysLeft == 0 {
							title = fmt.Sprintf("CICILAN JATUH TEMPO HARI INI: %s", d.ContactName)
						} else {
							title = fmt.Sprintf("PENGINGAT CICILAN H-%d: %s", daysLeft, d.ContactName)
						}
						msg = s.TemplateDebtDue
						msg = strings.ReplaceAll(msg, "{nama}", userName)
						msg = strings.ReplaceAll(msg, "{nama_kontak}", d.ContactName)
						msg = strings.ReplaceAll(msg, "{nominal}", formattedNominal)
						msg = strings.ReplaceAll(msg, "{jatuh_tempo}", d.DueDate)
						msg = strings.ReplaceAll(msg, "{hari_sisa}", fmt.Sprintf("%d", daysLeft))
					}

					waLink := buildWaLink(destPhone, msg)

					items = append(items, models.WhatsAppQueueItem{
						ID:          fmt.Sprintf("debt-%d", d.ID),
						Type:        func() string { if isOverdue { return "debt_overdue" }; return "debt_due" }(),
						Title:       title,
						Description: fmt.Sprintf("%s kepada %s sebesar Rp %s jatuh tempo %s", strings.ToUpper(d.Type), d.ContactName, formattedNominal, d.DueDate),
						Severity:    severity,
						Phone:       destPhone,
						Message:     msg,
						WaLink:      waLink,
						TargetDate:  d.DueDate,
						Amount:      d.Remaining,
						DaysLeft:    daysLeft,
						ModuleName:  "Finansial & Kas",
						ItemName:    d.ContactName,
					})
					debtAlertCount++
				}
			}
		}
	}

	// 5. Scan Radar Items (Target Hit)
	if s.RadarTargetEnabled {
		rows, err := h.db.Query(`
			SELECT id, title, category, current_price, target_price, platform, deal_score
			FROM radar_items
			WHERE user_id = ? AND status != 'bought' AND current_price <= target_price
			ORDER BY deal_score DESC
		`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var rItem models.RadarItem
				if err := rows.Scan(&rItem.ID, &rItem.Title, &rItem.Category, &rItem.CurrentPrice, &rItem.TargetPrice, &rItem.Platform, &rItem.DealScore); err == nil {
					msg := s.TemplateRadarTarget
					msg = strings.ReplaceAll(msg, "{nama}", userName)
					msg = strings.ReplaceAll(msg, "{nama_produk}", rItem.Title)
					msg = strings.ReplaceAll(msg, "{harga_sekarang}", utils.FormatRupiah(rItem.CurrentPrice))
					msg = strings.ReplaceAll(msg, "{target_harga}", utils.FormatRupiah(rItem.TargetPrice))
					msg = strings.ReplaceAll(msg, "{platform}", rItem.Platform)
					msg = strings.ReplaceAll(msg, "{deal_score}", fmt.Sprintf("%.0f", rItem.DealScore))

					waLink := buildWaLink(targetPhone, msg)

					items = append(items, models.WhatsAppQueueItem{
						ID:          fmt.Sprintf("radar-%d", rItem.ID),
						Type:        "radar_target",
						Title:       fmt.Sprintf("TARGET HARGA TERCAPAI: %s", rItem.Title),
						Description: fmt.Sprintf("Menyentuh Rp %s di %s (Deal Score: %.0f%%)", utils.FormatRupiah(rItem.CurrentPrice), rItem.Platform, rItem.DealScore),
						Severity:    "info",
						Phone:       targetPhone,
						Message:     msg,
						WaLink:      waLink,
						Amount:      rItem.CurrentPrice,
						DaysLeft:    0,
						ModuleName:  "Pengadaan & Radar",
						ItemName:    rItem.Title,
					})
					radarAlertCount++
				}
			}
		}
	}

	// 6. Generate Bundled Daily Digest
	var digestSb strings.Builder
	digestSb.WriteString(fmt.Sprintf("🔔 *RINGKASAN PERHATIAN HARI INI (%s)*\n", now.Format("02 Jan 2006")))
	digestSb.WriteString(fmt.Sprintf("Halo *%s*, berikut daftar perhatian penting di OmniLife Nexus:\n\n", userName))

	if len(items) == 0 {
		digestSb.WriteString("✅ *Semua aman terkendali!* Tidak ada produk kedaluwarsa atau cicilan yang mendesak hari ini. Tetap pertahankan!")
	} else {
		if pantryAlertCount > 0 {
			digestSb.WriteString("🧊 *Dapur & Inventaris:*\n")
			for _, it := range items {
				if it.Type == "pantry_expiry" || it.Type == "low_stock" {
					digestSb.WriteString(fmt.Sprintf(" • %s\n", it.Title))
				}
			}
			digestSb.WriteString("\n")
		}

		if debtAlertCount > 0 {
			digestSb.WriteString("💳 *Cicilan & Kewajiban:*\n")
			for _, it := range items {
				if it.Type == "debt_due" || it.Type == "debt_overdue" {
					digestSb.WriteString(fmt.Sprintf(" • %s (Rp %s)\n", it.Title, utils.FormatRupiah(it.Amount)))
				}
			}
			digestSb.WriteString("\n")
		}

		if radarAlertCount > 0 {
			digestSb.WriteString("🎯 *Radar Pengadaan:*\n")
			for _, it := range items {
				if it.Type == "radar_target" {
					digestSb.WriteString(fmt.Sprintf(" • %s\n", it.Title))
				}
			}
			digestSb.WriteString("\n")
		}

		digestSb.WriteString("⚡ _Pesan otomatis dikirim melalui OmniLife WhatsApp Notification Hub._")
	}

	digestMsg := digestSb.String()
	digestWaLink := buildWaLink(targetPhone, digestMsg)

	res := models.WhatsAppQueueResponse{
		TotalAlerts:  len(items),
		PantryAlerts: pantryAlertCount,
		DebtAlerts:   debtAlertCount,
		RadarAlerts:  radarAlertCount,
		Items:        items,
		DailyDigest:  digestMsg,
		DigestWaLink: digestWaLink,
	}

	utils.JSON(w, http.StatusOK, res)
}

// sendViaGateway attempts HTTP dispatch to external WhatsApp providers
func sendViaGateway(provider, apiKey, gatewayURL, phone, message string) error {
	cleanedPhone := cleanPhoneNumber(phone)
	if cleanedPhone == "" {
		return fmt.Errorf("nomor telepon tujuan tidak valid")
	}

	client := &http.Client{Timeout: 10 * time.Second}

	switch provider {
	case "fonnte":
		if apiKey == "" {
			return fmt.Errorf("Fonnte API Token belum diisi")
		}
		data := url.Values{}
		data.Set("target", cleanedPhone)
		data.Set("message", message)

		req, err := http.NewRequest("POST", "https://api.fonnte.com/send", strings.NewReader(data.Encode()))
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", apiKey)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("Fonnte error (%d): %s", resp.StatusCode, string(body))
		}
		return nil

	case "wablas":
		if apiKey == "" {
			return fmt.Errorf("Wablas API Key belum diisi")
		}
		endpoint := "https://bdg.wablas.com/api/send-message"
		if gatewayURL != "" {
			endpoint = gatewayURL
		}
		payload := map[string]interface{}{
			"phone":   cleanedPhone,
			"message": message,
		}
		jsonBytes, _ := json.Marshal(payload)

		req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("Wablas error (%d): %s", resp.StatusCode, string(body))
		}
		return nil

	case "custom_gateway":
		if gatewayURL == "" {
			return fmt.Errorf("Custom Gateway URL belum ditentukan")
		}
		payload := map[string]interface{}{
			"phone":   cleanedPhone,
			"message": message,
		}
		jsonBytes, _ := json.Marshal(payload)

		req, err := http.NewRequest("POST", gatewayURL, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return err
		}
		if apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("Gateway error (%d): %s", resp.StatusCode, string(body))
		}
		return nil

	case "wa_me":
		// Direct browser wa.me link generation mode
		return nil

	default:
		return nil
	}
}

// TestSend dispatches a test message or validates WhatsApp wa.me link
func (h *WhatsAppHandler) TestSend(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.WhatsAppTestSendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Format JSON tidak valid")
		return
	}

	if req.PhoneNumber == "" {
		utils.JSONError(w, http.StatusBadRequest, "Nomor WhatsApp tujuan wajib diisi")
		return
	}

	testMessage := req.Message
	if testMessage == "" {
		testMessage = "Halo! Ini adalah *PESAN UJI COBA* pengingat dari *OmniLife Nexus*. Sistem notifikasi WhatsApp Anda telah berhasil terhubung dan siap digunakan! 🚀"
	}

	waLink := buildWaLink(req.PhoneNumber, testMessage)

	var dispatchErr error
	status := "link_generated"
	var errStr string

	if req.Provider != "" && req.Provider != "wa_me" {
		dispatchErr = sendViaGateway(req.Provider, req.APIKey, req.GatewayURL, req.PhoneNumber, testMessage)
		if dispatchErr != nil {
			status = "failed"
			errStr = dispatchErr.Error()
		} else {
			status = "sent"
		}
	}

	// Record in logs
	_, _ = h.db.Exec(`
		INSERT INTO whatsapp_reminder_logs (user_id, reminder_type, title, recipient_phone, message, status, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, userID, "test_notification", "Uji Coba Pengiriman WhatsApp", cleanPhoneNumber(req.PhoneNumber), testMessage, status, errStr)

	if dispatchErr != nil {
		utils.JSONError(w, http.StatusBadRequest, "Gagal mengirim melalui Gateway: "+dispatchErr.Error())
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Uji coba WhatsApp berhasil diproses", map[string]interface{}{
		"status":  status,
		"wa_link": waLink,
		"phone":   cleanPhoneNumber(req.PhoneNumber),
		"message": testMessage,
	})
}

// DispatchAlert handles one-click sending or logging of a specific queue item
func (h *WhatsAppHandler) DispatchAlert(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.WhatsAppDispatchAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Format JSON tidak valid")
		return
	}

	// Fetch user provider setting
	var provider, apiKey, gatewayURL string
	_ = h.db.QueryRow("SELECT provider, api_key, gateway_url FROM whatsapp_settings WHERE user_id = ?", userID).Scan(&provider, &apiKey, &gatewayURL)

	status := "link_generated"
	var errStr string

	if provider != "" && provider != "wa_me" {
		err := sendViaGateway(provider, apiKey, gatewayURL, req.PhoneNumber, req.Message)
		if err != nil {
			status = "failed"
			errStr = err.Error()
		} else {
			status = "sent"
		}
	}

	// Insert log
	_, _ = h.db.Exec(`
		INSERT INTO whatsapp_reminder_logs (user_id, reminder_type, title, recipient_phone, message, status, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, userID, req.Type, req.Title, cleanPhoneNumber(req.PhoneNumber), req.Message, status, errStr)

	waLink := buildWaLink(req.PhoneNumber, req.Message)

	utils.JSONMessage(w, http.StatusOK, "Pengingat berhasil diproses", map[string]interface{}{
		"status":  status,
		"wa_link": waLink,
	})
}

// GetLogs returns recent notification history
func (h *WhatsAppHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query(`
		SELECT id, user_id, reminder_type, title, recipient_phone, message, status, COALESCE(error_message, ''), created_at
		FROM whatsapp_reminder_logs
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengambil log: "+err.Error())
		return
	}
	defer rows.Close()

	logs := make([]models.WhatsAppLog, 0)
	for rows.Next() {
		var l models.WhatsAppLog
		if err := rows.Scan(&l.ID, &l.UserID, &l.ReminderType, &l.Title, &l.RecipientPhone, &l.Message, &l.Status, &l.ErrorMessage, &l.CreatedAt); err == nil {
			logs = append(logs, l)
		}
	}

	utils.JSON(w, http.StatusOK, logs)
}

// RunDailyCronWebhook handles public webhook requests from Render Cron Job / cron-job.org
func (h *WhatsAppHandler) RunDailyCronWebhook(w http.ResponseWriter, r *http.Request) {
	// Secret key validation
	providedSecret := r.Header.Get("X-Cron-Secret")
	if providedSecret == "" {
		providedSecret = r.URL.Query().Get("secret")
	}

	expectedSecret := "omnilife_cron_secret_2026"
	if h.cfg != nil && h.cfg.CronSecret != "" {
		expectedSecret = h.cfg.CronSecret
	}

	if providedSecret != expectedSecret {
		utils.JSONError(w, http.StatusUnauthorized, "Unauthorized: Secret key cron tidak cocok")
		return
	}

	forceParam := r.URL.Query().Get("force") == "true"
	report := h.ExecuteDailyBlastEngine(0, forceParam)
	utils.JSONMessage(w, http.StatusOK, "Eksekusi Cron Reminder WhatsApp Berhasil", report)
}

// RunManualUserScanner handles on-demand scan & blast from authenticated UI dashboard
func (h *WhatsAppHandler) RunManualUserScanner(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	forceParam := r.URL.Query().Get("force") == "true"
	report := h.ExecuteDailyBlastEngine(userID, forceParam)
	utils.JSONMessage(w, http.StatusOK, "Pemindaian pengingat mandiri berhasil diproses", report)
}

// ExecuteDailyBlastEngine performs the core scanning, template formatting, anti-spam check, and gateway blasting
func (h *WhatsAppHandler) ExecuteDailyBlastEngine(targetUserID int, forceSend bool) map[string]interface{} {
	now := time.Now()
	todayStr := now.Format("2006-01-02")
	todayDate, _ := time.Parse("2006-01-02", todayStr)
	todayStartStr := todayStr + " 00:00:00"

	// 1. Query users to process
	query := `
		SELECT ws.user_id, ws.phone_number, ws.provider, ws.api_key, ws.gateway_url,
		       ws.pantry_expiry_enabled, ws.pantry_days_before,
		       ws.debt_due_enabled, ws.debt_days_before, ws.debt_overdue_enabled,
		       ws.pantry_low_stock_enabled, ws.radar_target_enabled,
		       ws.template_pantry_expiry, ws.template_debt_due, ws.template_debt_overdue,
		       ws.template_low_stock, ws.template_radar_target,
		       COALESCE(u.full_name, u.username)
		FROM whatsapp_settings ws
		JOIN users u ON ws.user_id = u.id
		WHERE ws.is_enabled = 1 AND ws.phone_number != ''
	`
	var args []interface{}
	if targetUserID > 0 {
		query += " AND ws.user_id = ?"
		args = append(args, targetUserID)
	}

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return map[string]interface{}{
			"error": "Failed to query active users: " + err.Error(),
		}
	}
	defer rows.Close()

	usersScanned := 0
	usersBlasted := 0
	usersSkipped := 0
	totalAlertsFound := 0
	dispatches := make([]map[string]interface{}, 0)

	for rows.Next() {
		var s models.WhatsAppSettings
		var userName string

		if err := rows.Scan(
			&s.UserID, &s.PhoneNumber, &s.Provider, &s.APIKey, &s.GatewayURL,
			&s.PantryExpiryEnabled, &s.PantryDaysBefore,
			&s.DebtDueEnabled, &s.DebtDaysBefore, &s.DebtOverdueEnabled,
			&s.PantryLowStockEnabled, &s.RadarTargetEnabled,
			&s.TemplatePantryExpiry, &s.TemplateDebtDue, &s.TemplateDebtOverdue,
			&s.TemplateLowStock, &s.TemplateRadarTarget,
			&userName,
		); err != nil {
			continue
		}
		usersScanned++

		// 2. Anti-Spam / Idempotency Check: Don't send duplicate daily_digest on the same day unless forceSend = true
		if !forceSend {
			var alreadySentCount int
			_ = h.db.QueryRow(`
				SELECT COUNT(*) FROM whatsapp_reminder_logs
				WHERE user_id = ? AND reminder_type = 'daily_digest' AND status = 'sent' AND created_at >= ?
			`, s.UserID, todayStartStr).Scan(&alreadySentCount)

			if alreadySentCount > 0 {
				usersSkipped++
				continue
			}
		}

		userAlerts := make([]models.WhatsAppQueueItem, 0)

		// 3. Scan Pantry Expiring Items
		if s.PantryExpiryEnabled {
			maxDays := s.PantryDaysBefore
			if maxDays <= 0 {
				maxDays = 3
			}
			thresholdDate := now.AddDate(0, 0, maxDays).Format("2006-01-02")

			pRows, err := h.db.Query(`
				SELECT id, name, category, quantity, unit, expiry_date
				FROM pantry_items
				WHERE user_id = ? AND quantity > 0 AND expiry_date <= ?
				ORDER BY expiry_date ASC
			`, s.UserID, thresholdDate)
			if err == nil {
				for pRows.Next() {
					var p models.PantryItem
					if err := pRows.Scan(&p.ID, &p.Name, &p.Category, &p.Quantity, &p.Unit, &p.ExpiryDate); err == nil {
						expDate, _ := time.Parse("2006-01-02", p.ExpiryDate)
						daysLeft := int(expDate.Sub(todayDate).Hours() / 24)

						statusLabel := fmt.Sprintf("%d hari lagi", daysLeft)
						if daysLeft < 0 {
							statusLabel = fmt.Sprintf("KADALUWARSA LEWAT %d HARI", -daysLeft)
						} else if daysLeft == 0 {
							statusLabel = "KADALUWARSA HARI INI!"
						}

						userAlerts = append(userAlerts, models.WhatsAppQueueItem{
							ID:         fmt.Sprintf("pantry-%d", p.ID),
							Type:       "pantry_expiry",
							Title:      fmt.Sprintf("%s (%s - %s)", p.Name, p.ExpiryDate, statusLabel),
							DaysLeft:   daysLeft,
							ModuleName: "Dapur",
						})
					}
				}
				pRows.Close()
			}
		}

		// 4. Scan Debts Due & Overdue
		if s.DebtDueEnabled || s.DebtOverdueEnabled {
			maxDebtDays := s.DebtDaysBefore
			if maxDebtDays <= 0 {
				maxDebtDays = 1
			}
			thresholdDue := now.AddDate(0, 0, maxDebtDays).Format("2006-01-02")

			dRows, err := h.db.Query(`
				SELECT id, contact_name, type, total_amount - paid_amount, due_date
				FROM debts
				WHERE user_id = ? AND status != 'paid' AND due_date <= ?
				ORDER BY due_date ASC
			`, s.UserID, thresholdDue)
			if err == nil {
				for dRows.Next() {
					var d models.Debt
					if err := dRows.Scan(&d.ID, &d.ContactName, &d.Type, &d.Remaining, &d.DueDate); err == nil {
						dueDateParsed, _ := time.Parse("2006-01-02", d.DueDate)
						daysLeft := int(dueDateParsed.Sub(todayDate).Hours() / 24)

						isOverdue := daysLeft < 0
						if isOverdue && !s.DebtOverdueEnabled {
							continue
						}
						if !isOverdue && !s.DebtDueEnabled {
							continue
						}

						title := fmt.Sprintf("%s kepada %s: Rp %s (Jatuh Tempo: %s)", strings.ToUpper(d.Type), d.ContactName, utils.FormatRupiah(d.Remaining), d.DueDate)
						if isOverdue {
							title += fmt.Sprintf(" [LEWAT %d HARI]", -daysLeft)
						} else if daysLeft == 0 {
							title += " [HARI INI]"
						} else {
							title += fmt.Sprintf(" [H-%d BESOK]", daysLeft)
						}

						userAlerts = append(userAlerts, models.WhatsAppQueueItem{
							ID:         fmt.Sprintf("debt-%d", d.ID),
							Type:       func() string { if isOverdue { return "debt_overdue" }; return "debt_due" }(),
							Title:      title,
							DaysLeft:   daysLeft,
							ModuleName: "Cicilan",
						})
					}
				}
				dRows.Close()
			}
		}

		// 5. Scan Low Stock
		if s.PantryLowStockEnabled {
			lsRows, err := h.db.Query(`
				SELECT id, name, category, quantity, unit, min_quantity
				FROM pantry_items
				WHERE user_id = ? AND quantity <= min_quantity
			`, s.UserID)
			if err == nil {
				for lsRows.Next() {
					var p models.PantryItem
					if err := lsRows.Scan(&p.ID, &p.Name, &p.Category, &p.Quantity, &p.Unit, &p.MinQuantity); err == nil {
						userAlerts = append(userAlerts, models.WhatsAppQueueItem{
							ID:         fmt.Sprintf("low-%d", p.ID),
							Type:       "low_stock",
							Title:      fmt.Sprintf("%s di %s tersisa %.0f %s (min %.0f)", p.Name, p.Category, p.Quantity, p.Unit, p.MinQuantity),
							ModuleName: "Stok Menipis",
						})
					}
				}
				lsRows.Close()
			}
		}

		totalAlertsFound += len(userAlerts)

		// 6. If user has alerts, bundle into Daily Digest WhatsApp message
		if len(userAlerts) > 0 {
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("🔔 *PENGINGAT HARIAN OMNILIFE (%s)*\n", now.Format("02 Jan 2006")))
			sb.WriteString(fmt.Sprintf("Halo *%s*, berikut rangkuman perhatian penting untuk ditindaklanjuti:\n\n", userName))

			for _, it := range userAlerts {
				sb.WriteString(fmt.Sprintf("• [%s] %s\n", it.ModuleName, it.Title))
			}
			sb.WriteString("\n⚡ _Pesan otomatis dikirim oleh OmniLife Cron Reminder Engine._")

			messageContent := sb.String()

			// Dispatch via Gateway if configured
			status := "link_generated"
			var errStr string

			if s.Provider != "" && s.Provider != "wa_me" {
				dispatchErr := sendViaGateway(s.Provider, s.APIKey, s.GatewayURL, s.PhoneNumber, messageContent)
				if dispatchErr != nil {
					status = "failed"
					errStr = dispatchErr.Error()
				} else {
					status = "sent"
				}
			} else {
				// Provider wa_me: Record ready link
				status = "link_generated"
			}

			// Record in logs
			_, _ = h.db.Exec(`
				INSERT INTO whatsapp_reminder_logs (user_id, reminder_type, title, recipient_phone, message, status, error_message)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, s.UserID, "daily_digest", fmt.Sprintf("Cron Blast Harian: %d Perhatian", len(userAlerts)), cleanPhoneNumber(s.PhoneNumber), messageContent, status, errStr)

			usersBlasted++
			dispatches = append(dispatches, map[string]interface{}{
				"user_id":   s.UserID,
				"user_name": userName,
				"phone":     cleanPhoneNumber(s.PhoneNumber),
				"provider":  s.Provider,
				"status":    status,
				"alerts":    len(userAlerts),
				"error":     errStr,
			})
		}
	}

	return map[string]interface{}{
		"executed_at":    now.Format(time.RFC3339),
		"users_scanned":  usersScanned,
		"users_blasted":  usersBlasted,
		"users_skipped":  usersSkipped,
		"total_alerts":   totalAlertsFound,
		"dispatches":     dispatches,
	}
}

