package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"astfin/server/internal/config"
	"astfin/server/internal/database"
	"astfin/server/internal/middleware"
	"astfin/server/internal/models"
	"astfin/server/internal/utils"
	"github.com/go-chi/chi/v5"
)

type AuthHandler struct {
	db  *database.DB
	cfg *config.Config
}

func NewAuthHandler(db *database.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)

	if req.Username == "" || req.Email == "" || len(req.Password) < 6 {
		utils.JSONError(w, http.StatusBadRequest, "Username, email, and password (min 6 characters) are required")
		return
	}

	// Check if this is the first user
	var userCount int
	err := h.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Database error checking user count")
		return
	}

	// Determine role and initial verification status:
	// Jika belum ada akun sama sekali, akun pertama otomatis menjadi Admin dan langsung terverifikasi.
	// Pendaftaran publik berikutnya wajib role 'user' dan memerlukan verifikasi email 20 menit.
	roleName := "user"
	var isVerified bool
	if userCount == 0 {
		roleName = "admin"
		isVerified = true
	} else {
		isVerified = false
	}

	var roleID int
	err = h.db.QueryRow("SELECT id FROM roles WHERE name = ?", roleName).Scan(&roleID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Role not found in database")
		return
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}

	userID, err := h.db.Insert(`
		INSERT INTO users (username, email, password_hash, full_name, role_id, is_verified)
		VALUES (?, ?, ?, ?, ?, ?)
	`, req.Username, req.Email, hashedPassword, req.FullName, roleID, isVerified)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			utils.JSONError(w, http.StatusConflict, "Username atau email sudah terdaftar sebelumnya")
			return
		}
		utils.JSONError(w, http.StatusInternalServerError, "Failed to create user: "+err.Error())
		return
	}

	// Superuser administrator pertama langsung login
	if isVerified {
		token, exp, err := utils.GenerateToken(int(userID), req.Username, req.FullName, roleName, h.cfg.JWTSecret, h.cfg.JWTExpiresIn)
		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "Failed to generate token")
			return
		}

		utils.JSONMessage(w, http.StatusCreated, "Akun Administrator pertama berhasil dibuat", models.AuthResponse{
			Token:     token,
			ExpiresAt: exp.Format("2006-01-02T15:04:05Z07:00"),
			User: models.User{
				ID:         int(userID),
				Username:   req.Username,
				Email:      req.Email,
				FullName:   req.FullName,
				RoleID:     roleID,
				RoleName:   roleName,
				IsVerified: true,
			},
		})
		return
	}

	// Akun standar: buat kode OTP 6 digit dengan masa berlaku 20 menit
	code := utils.GenerateVerificationCode()
	expiresAt := time.Now().Add(20 * time.Minute)

	_, _ = h.db.Exec("DELETE FROM email_verifications WHERE email = ?", req.Email)
	_, err = h.db.Insert(`
		INSERT INTO email_verifications (email, code, expires_at)
		VALUES (?, ?, ?)
	`, req.Email, code, expiresAt)
	if err != nil {
		log.Printf("Warning: Failed to store email verification code: %v", err)
	}

	// Kirim email atau tampilkan di terminal (jika SMTP offline)
	_ = utils.SendVerificationEmail(h.cfg, req.Email, req.FullName, code)

	utils.JSONMessage(w, http.StatusCreated, "Registrasi berhasil! Kode verifikasi 6 digit telah dikirim ke email Anda (berlaku 20 menit).", map[string]interface{}{
		"email":                 req.Email,
		"requires_verification": true,
		"expires_in_minutes":    20,
		"dev_code":              code,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.UsernameOrEmail = strings.TrimSpace(req.UsernameOrEmail)
	if req.UsernameOrEmail == "" || req.Password == "" {
		utils.JSONError(w, http.StatusBadRequest, "Username/Email and password are required")
		return
	}

	var user models.User
	var passwordHash string
	err := h.db.QueryRow(`
		SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role_id, r.name, u.is_verified, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.username = ? OR u.email = ?
	`, req.UsernameOrEmail, strings.ToLower(req.UsernameOrEmail)).Scan(
		&user.ID, &user.Username, &user.Email, &passwordHash, &user.FullName, &user.RoleID, &user.RoleName, &user.IsVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if !utils.CheckPasswordHash(req.Password, passwordHash) {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Cek apakah akun sudah diverifikasi
	if !user.IsVerified {
		utils.JSON(w, http.StatusForbidden, map[string]interface{}{
			"error":                 "Akun Anda belum aktif. Silakan verifikasi email Anda dengan kode OTP terlebih dahulu.",
			"requires_verification": true,
			"email":                 user.Email,
		})
		return
	}

	token, exp, err := utils.GenerateToken(user.ID, user.Username, user.FullName, user.RoleName, h.cfg.JWTSecret, h.cfg.JWTExpiresIn)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to generate auth token")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Login successful", models.AuthResponse{
		Token:     token,
		ExpiresAt: exp.Format("2006-01-02T15:04:05Z07:00"),
		User:      user,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		utils.JSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var user models.User
	err := h.db.QueryRow(`
		SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.name, u.is_verified, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName, &user.RoleID, &user.RoleName, &user.IsVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "User not found")
		return
	}

	utils.JSON(w, http.StatusOK, user)
}

func (h *AuthHandler) GetRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query("SELECT id, name, description, created_at FROM roles ORDER BY id ASC")
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch roles")
		return
	}
	defer rows.Close()

	var roles []models.Role
	for rows.Next() {
		var role models.Role
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &role.CreatedAt); err == nil {
			roles = append(roles, role)
		}
	}

	utils.JSON(w, http.StatusOK, roles)
}

func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req models.VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Permintaan verifikasi tidak valid")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Code = strings.TrimSpace(req.Code)

	if req.Email == "" || req.Code == "" {
		utils.JSONError(w, http.StatusBadRequest, "Email dan kode verifikasi 6 digit wajib diisi")
		return
	}

	var verifID int
	var expiresAt time.Time
	err := h.db.QueryRow(`
		SELECT id, expires_at 
		FROM email_verifications 
		WHERE email = ? AND code = ? 
		ORDER BY id DESC LIMIT 1
	`, req.Email, req.Code).Scan(&verifID, &expiresAt)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Kode verifikasi salah atau tidak ditemukan. Silakan periksa kembali email Anda.")
		return
	}

	if time.Now().After(expiresAt) {
		utils.JSONError(w, http.StatusBadRequest, "Kode verifikasi telah kedaluwarsa (lebih dari 20 menit). Silakan klik 'Kirim Ulang Kode'.")
		return
	}

	// Update user to verified/active
	res, err := h.db.Exec("UPDATE users SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE email = ?", req.Email)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengaktivasi akun pengguna")
		return
	}
	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		utils.JSONError(w, http.StatusNotFound, "Pengguna dengan email ini tidak ditemukan")
		return
	}

	// Delete used verification code
	_, _ = h.db.Exec("DELETE FROM email_verifications WHERE email = ?", req.Email)

	utils.JSONMessage(w, http.StatusOK, "Selamat! Akun Anda berhasil diverifikasi dan diaktifkan. Silakan masuk.", map[string]interface{}{
		"verified": true,
		"email":    req.Email,
	})
}

func (h *AuthHandler) ResendVerificationCode(w http.ResponseWriter, r *http.Request) {
	var req models.ResendVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Permintaan tidak valid")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		utils.JSONError(w, http.StatusBadRequest, "Email wajib diisi")
		return
	}

	var userID int
	var isVerified bool
	var fullName string
	err := h.db.QueryRow("SELECT id, is_verified, full_name FROM users WHERE email = ?", req.Email).Scan(&userID, &isVerified, &fullName)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Email tidak terdaftar dalam sistem")
		return
	}

	if isVerified {
		utils.JSONError(w, http.StatusBadRequest, "Akun dengan email ini sudah aktif dan diverifikasi. Silakan langsung login.")
		return
	}

	code := utils.GenerateVerificationCode()
	expiresAt := time.Now().Add(20 * time.Minute)

	_, _ = h.db.Exec("DELETE FROM email_verifications WHERE email = ?", req.Email)
	_, err = h.db.Insert(`
		INSERT INTO email_verifications (email, code, expires_at)
		VALUES (?, ?, ?)
	`, req.Email, code, expiresAt)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan kode verifikasi baru")
		return
	}

	_ = utils.SendVerificationEmail(h.cfg, req.Email, fullName, code)

	utils.JSONMessage(w, http.StatusOK, "Kode verifikasi baru berhasil dikirim ke email Anda (berlaku 20 menit).", map[string]interface{}{
		"email":              req.Email,
		"expires_in_minutes": 20,
		"dev_code":           code,
	})
}

func (h *AuthHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.name, u.is_verified, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON u.role_id = r.id
		ORDER BY u.id ASC
	`)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.RoleID, &u.RoleName, &u.IsVerified, &u.CreatedAt, &u.UpdatedAt); err == nil {
			users = append(users, u)
		}
	}

	utils.JSON(w, http.StatusOK, users)
}

func (h *AuthHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	targetUserIDStr := chi.URLParam(r, "id")
	targetUserID, err := strconv.Atoi(targetUserIDStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		RoleName string `json:"role_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var roleID int
	err = h.db.QueryRow("SELECT id FROM roles WHERE name = ?", strings.ToLower(req.RoleName)).Scan(&roleID)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Role does not exist")
		return
	}

	_, err = h.db.Exec("UPDATE users SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", roleID, targetUserID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to update role")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "User role updated successfully", nil)
}

func (h *AuthHandler) CreateUserByAdmin(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)

	if req.Username == "" || req.Email == "" || len(req.Password) < 6 {
		utils.JSONError(w, http.StatusBadRequest, "Nama pengguna, email, dan kata sandi (minimal 6 karakter) wajib diisi")
		return
	}

	// Validate role specified by admin
	roleName := strings.ToLower(strings.TrimSpace(req.RoleName))
	if roleName != "admin" && roleName != "finance" && roleName != "user" {
		roleName = "user"
	}

	var roleID int
	err := h.db.QueryRow("SELECT id FROM roles WHERE name = ?", roleName).Scan(&roleID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Peran pengguna tidak ditemukan di database")
		return
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal mengenkripsi kata sandi")
		return
	}

	// Akun yang dibuat langsung oleh Administrator otomatis terverifikasi (is_verified = true)
	userID, err := h.db.Insert(`
		INSERT INTO users (username, email, password_hash, full_name, role_id, is_verified)
		VALUES (?, ?, ?, ?, ?, ?)
	`, req.Username, req.Email, hashedPassword, req.FullName, roleID, true)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			utils.JSONError(w, http.StatusConflict, "Username atau email sudah terdaftar sebelumnya")
			return
		}
		utils.JSONError(w, http.StatusInternalServerError, "Gagal membuat pengguna: "+err.Error())
		return
	}

	createdUser := models.User{
		ID:         int(userID),
		Username:   req.Username,
		Email:      req.Email,
		FullName:   req.FullName,
		RoleID:     roleID,
		RoleName:   roleName,
		IsVerified: true,
	}

	utils.JSONMessage(w, http.StatusCreated, "Akun pengguna berhasil dibuat", createdUser)
}

func (h *AuthHandler) DeleteUserByAdmin(w http.ResponseWriter, r *http.Request) {
	currentAdminID := middleware.GetUserID(r)
	targetUserIDStr := chi.URLParam(r, "id")
	targetUserID, err := strconv.Atoi(targetUserIDStr)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "ID pengguna tidak valid")
		return
	}

	if targetUserID == currentAdminID {
		utils.JSONError(w, http.StatusBadRequest, "Anda tidak dapat menghapus akun Anda sendiri")
		return
	}

	res, err := h.db.Exec("DELETE FROM users WHERE id = ?", targetUserID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menghapus pengguna: "+err.Error())
		return
	}

	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		utils.JSONError(w, http.StatusNotFound, "Pengguna tidak ditemukan")
		return
	}

	utils.JSONMessage(w, http.StatusOK, "Pengguna berhasil dihapus", nil)
}
