package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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

	// Determine role
	roleName := "user"
	if userCount == 0 {
		roleName = "admin" // First user is automatically Admin!
	} else if req.RoleName != "" {
		// If custom role is specified, check if it's valid
		reqRole := strings.ToLower(req.RoleName)
		if reqRole == "admin" || reqRole == "finance" || reqRole == "user" {
			roleName = reqRole
		}
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
		INSERT INTO users (username, email, password_hash, full_name, role_id)
		VALUES (?, ?, ?, ?, ?)
	`, req.Username, req.Email, hashedPassword, req.FullName, roleID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			utils.JSONError(w, http.StatusConflict, "Username or email already exists")
			return
		}
		utils.JSONError(w, http.StatusInternalServerError, "Failed to create user: "+err.Error())
		return
	}

	token, exp, err := utils.GenerateToken(int(userID), req.Username, req.FullName, roleName, h.cfg.JWTSecret, h.cfg.JWTExpiresIn)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	utils.JSONMessage(w, http.StatusCreated, "User registered successfully", models.AuthResponse{
		Token:     token,
		ExpiresAt: exp.Format("2006-01-02T15:04:05Z07:00"),
		User: models.User{
			ID:       int(userID),
			Username: req.Username,
			Email:    req.Email,
			FullName: req.FullName,
			RoleID:   roleID,
			RoleName: roleName,
		},
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
		SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role_id, r.name, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.username = ? OR u.email = ?
	`, req.UsernameOrEmail, strings.ToLower(req.UsernameOrEmail)).Scan(
		&user.ID, &user.Username, &user.Email, &passwordHash, &user.FullName, &user.RoleID, &user.RoleName, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if !utils.CheckPasswordHash(req.Password, passwordHash) {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid credentials")
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
		SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.name, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName, &user.RoleID, &user.RoleName, &user.CreatedAt, &user.UpdatedAt,
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

func (h *AuthHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.name, u.created_at, u.updated_at
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
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.RoleID, &u.RoleName, &u.CreatedAt, &u.UpdatedAt); err == nil {
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
