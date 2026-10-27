package utils

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	mathrand "math/rand"
	"net/smtp"
	"strings"
	"time"

	"astfin/server/internal/config"
)

// GenerateVerificationCode generates a secure 6-digit numeric OTP code.
func GenerateVerificationCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		r := mathrand.New(mathrand.NewSource(time.Now().UnixNano()))
		return fmt.Sprintf("%06d", r.Intn(900000)+100000)
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

// SendVerificationEmail sends the 6-digit OTP code to the recipient's email.
// If SMTP is not configured, it logs the OTP code clearly in the server terminal for local development.
func SendVerificationEmail(cfg *config.Config, toEmail, fullName, code string) error {
	displayName := fullName
	if displayName == "" {
		displayName = strings.Split(toEmail, "@")[0]
	}

	// Fallback when SMTP is not configured
	if cfg.SMTPHost == "" {
		log.Printf("\n" +
			"================================================================================\n" +
			"🚀 [EMAIL NOTIFICATION - VERIFICATION OTP (DEV/OFFLINE MODE)]\n" +
			"--------------------------------------------------------------------------------\n" +
			fmt.Sprintf("To:              %s <%s>\n", displayName, toEmail) +
			fmt.Sprintf("Subject:         Kode Aktivasi & Verifikasi Akun OmniLife Nexus\n") +
			fmt.Sprintf("OTP Code:        >>> %s <<<\n", code) +
			fmt.Sprintf("Masa Berlaku:    20 Menit (Kedaluwarsa: %s)\n", time.Now().Add(20*time.Minute).Format("15:04:05 WIB")) +
			"--------------------------------------------------------------------------------\n" +
			"Tip: Konfigurasikan SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD di .env\n" +
			"     untuk mengaktifkan pengiriman email otomatis ke inbox nyata.\n" +
			"================================================================================\n")
		return nil
	}

	// Prepare Email Content with OmniLife aesthetic HTML
	subject := "Kode Verifikasi Email OmniLife Nexus"
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verifikasi Email - OmniLife Nexus</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1329; color: #e2e8f0; margin: 0; padding: 24px; }
    .container { max-width: 520px; margin: 0 auto; background: #131d36; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: rgba(78,222,163,0.15); color: #4edea3; font-size: 24px; border-radius: 12px; font-weight: bold; }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 12px; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #94a3b8; }
    .content { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .otp-box { background: #1a2744; border: 2px dashed #4edea3; border-radius: 16px; text-align: center; padding: 20px; margin: 24px 0; }
    .otp-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #4edea3; font-weight: 700; margin-bottom: 8px; }
    .otp-code { font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; margin: 0; }
    .expiry { font-size: 12px; color: #f59e0b; margin-top: 8px; font-weight: 600; }
    .footer { font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡</div>
      <div class="title">OmniLife Nexus</div>
      <div class="subtitle">Unified Command Center OS v2.4</div>
    </div>
    <div class="content">
      <p>Halo <strong>%s</strong>,</p>
      <p>Terima kasih telah mendaftar di OmniLife Nexus. Untuk mengaktifkan akun Anda dan memverifikasi alamat email ini, silakan masukkan kode verifikasi 6 digit berikut ke layar aktivasi:</p>
      <div class="otp-box">
        <div class="otp-label">Kode Verifikasi 6 Digit</div>
        <div class="otp-code">%s</div>
        <div class="expiry">⏱️ Berlaku selama 20 Menit</div>
      </div>
      <p>Jika Anda tidak merasa mendaftarkan akun di OmniLife Nexus, Anda dapat mengabaikan email ini dengan aman.</p>
    </div>
    <div class="footer">
      Email ini dikirim secara otomatis oleh sistem keamanan OmniLife Nexus Core.<br>
      Mohon jangan membalas pesan ini secara langsung.
    </div>
  </div>
</body>
</html>`, displayName, code)

	// MIME Multipart / Alternative Email Headers
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n%s\r\n%s", cfg.SMTPFrom, toEmail, subject, mime, htmlBody))

	// SMTP Auth
	addr := fmt.Sprintf("%s:%s", cfg.SMTPHost, cfg.SMTPPort)
	var auth smtp.Auth
	if cfg.SMTPUser != "" && cfg.SMTPPassword != "" {
		auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost)
	}

	err := smtp.SendMail(addr, auth, cfg.SMTPFrom, []string{toEmail}, msg)
	if err != nil {
		log.Printf("Warning: Failed to send SMTP email to %s: %v. Outputting OTP to console.", toEmail, err)
		log.Printf("[FALLBACK DEV OTP FOR %s]: %s (Valid for 20 mins)", toEmail, code)
		return nil // Don't crash registration if SMTP provider drops connection
	}

	log.Printf("Verification email with OTP sent successfully to %s via SMTP (%s)", toEmail, cfg.SMTPHost)
	return nil
}
