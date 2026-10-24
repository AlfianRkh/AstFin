package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"astfin/server/internal/utils"
)

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

type clientInfo struct {
	windowStart time.Time
	requests    int
}

type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientInfo
	limit   int
	window  time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		clients: make(map[string]*clientInfo),
		limit:   limit,
		window:  window,
	}

	// Background cleanup of stale IP records
	go func() {
		ticker := time.NewTicker(rl.window * 2)
		for range ticker.C {
			rl.mu.Lock()
			now := time.Now()
			for ip, info := range rl.clients {
				if now.Sub(info.windowStart) > rl.window {
					delete(rl.clients, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}

		// Whitelist local development addresses (IPv4 & IPv6 loopback)
		if ip == "::1" || ip == "127.0.0.1" || ip == "localhost" {
			next.ServeHTTP(w, r)
			return
		}

		rl.mu.Lock()
		info, exists := rl.clients[ip]
		now := time.Now()

		if !exists || now.Sub(info.windowStart) > rl.window {
			rl.clients[ip] = &clientInfo{
				windowStart: now,
				requests:    1,
			}
			rl.mu.Unlock()
			next.ServeHTTP(w, r)
			return
		}

		info.requests++

		if info.requests > rl.limit {
			rl.mu.Unlock()
			utils.JSONError(w, http.StatusTooManyRequests, "Rate limit exceeded. Please wait a moment.")
			return
		}

		rl.mu.Unlock()
		next.ServeHTTP(w, r)
	})
}
