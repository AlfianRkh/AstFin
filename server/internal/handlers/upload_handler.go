package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"astfin/server/internal/utils"
)

type UploadHandler struct {
	UploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	_ = os.MkdirAll(uploadDir, 0755)
	return &UploadHandler{
		UploadDir: uploadDir,
	}
}

// UploadFile handles image upload via multipart/form-data or Base64 JSON
func (h *UploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	_ = os.MkdirAll(h.UploadDir, 0755)

	// Check if content-type is JSON (base64 upload)
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			Image    string `json:"image"`
			Filename string `json:"filename"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.JSONError(w, http.StatusBadRequest, "Invalid JSON data: "+err.Error())
			return
		}

		if req.Image == "" {
			utils.JSONError(w, http.StatusBadRequest, "Gambar tidak boleh kosong")
			return
		}

		// Handle base64 data URI (e.g. data:image/png;base64,iVBORw0KGgo...)
		data := req.Image
		ext := ".jpg"
		if strings.HasPrefix(data, "data:image/") {
			parts := strings.SplitN(data, ";base64,", 2)
			if len(parts) == 2 {
				mimeType := strings.TrimPrefix(parts[0], "data:image/")
				switch mimeType {
				case "png":
					ext = ".png"
				case "webp":
					ext = ".webp"
				case "gif":
					ext = ".gif"
				default:
					ext = ".jpg"
				}
				data = parts[1]
			}
		}

		decoded, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			utils.JSONError(w, http.StatusBadRequest, "Format Base64 gambar tidak valid")
			return
		}

		randomHex := make([]byte, 4)
		_, _ = rand.Read(randomHex)
		filename := fmt.Sprintf("img_%d_%s%s", time.Now().UnixNano(), hex.EncodeToString(randomHex), ext)
		dstPath := filepath.Join(h.UploadDir, filename)

		if err := os.WriteFile(dstPath, decoded, 0644); err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan file gambar: "+err.Error())
			return
		}

		utils.JSON(w, http.StatusOK, map[string]interface{}{
			"message":  "Gambar berhasil diunggah",
			"url":      "/uploads/" + filename,
			"filename": filename,
		})
		return
	}

	// Multipart Form Data upload (Max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "File terlalu besar atau format form tidak valid (Max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		// Try form field "image"
		file, header, err = r.FormFile("image")
		if err != nil {
			utils.JSONError(w, http.StatusBadRequest, "Field 'file' atau 'image' tidak ditemukan")
			return
		}
	}
	defer file.Close()

	// Detect and validate extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		ext = ".jpg"
	}

	randomHex := make([]byte, 4)
	_, _ = rand.Read(randomHex)
	filename := fmt.Sprintf("img_%d_%s%s", time.Now().UnixNano(), hex.EncodeToString(randomHex), ext)
	dstPath := filepath.Join(h.UploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal membuat file di server: "+err.Error())
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "Gagal menyimpan file gambar: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Gambar berhasil diunggah",
		"url":      "/uploads/" + filename,
		"filename": filename,
	})
}
