package middleware

import (
	"context"
	"net/http"
	"strings"

	"astfin/server/internal/utils"
)

type contextKey string

const ClaimsContextKey contextKey = "jwt_claims"

func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				utils.JSONError(w, http.StatusUnauthorized, "Authorization token is required")
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				utils.JSONError(w, http.StatusUnauthorized, "Invalid authorization header format (Bearer <token>)")
				return
			}

			claims, err := utils.ValidateToken(parts[1], secret)
			if err != nil {
				utils.JSONError(w, http.StatusUnauthorized, "Invalid or expired token: "+err.Error())
				return
			}

			ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r)
			if claims == nil {
				utils.JSONError(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			roleAllowed := false
			for _, role := range allowedRoles {
				if strings.EqualFold(claims.Role, role) {
					roleAllowed = true
					break
				}
			}

			if !roleAllowed {
				utils.JSONError(w, http.StatusForbidden, "Access forbidden: insufficient role permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetClaims(r *http.Request) *utils.JWTClaims {
	if val := r.Context().Value(ClaimsContextKey); val != nil {
		if claims, ok := val.(*utils.JWTClaims); ok {
			return claims
		}
	}
	return nil
}

func GetUserID(r *http.Request) int {
	claims := GetClaims(r)
	if claims != nil {
		return claims.UserID
	}
	return 0
}

func GetUserRole(r *http.Request) string {
	claims := GetClaims(r)
	if claims != nil {
		return claims.Role
	}
	return ""
}
