# OmniLife Nexus - Full Stack Life OS & Financial Matrix

A high-performance, secure, full-stack application with **React (Frontend)** and **Golang (Backend REST API)**, designed based on the **OmniLife Nexus Unified Life OS v2.4** interface.

---

## 🚀 Fitur Utama & Modul

1. **Authentication & Role-Based Access Control (RBAC)**:
   - Module otentikasi lengkap: Register, Login, Token Verification (`/api/v1/auth/me`).
   - Sistem peran multi-level: `admin`, `finance`, `user`.
   - Admin panel (`/admin/users`) untuk mengelola peran pengguna.
   - Pendaftaran pengguna pertama otomatis dipromosikan sebagai **Administrator**.
   - Keamanan: Password hashing menggunakan **Bcrypt (cost 12)**, **JWT (HS256)**, rate limiter per IP, dan security headers.

2. **Executive OmniCommand Dashboard (`/`)**:
   - Integrasi telemetri live dari seluruh 5 subsistem.
   - 5 Metrik Utama (Kas Likuid, Debt Net, Sinyal Radar, WishBoard, Pantry).
   - Pusat Intervensi Lintas-Modul (Cross-Engine Urgent Alerts) yang mendeteksi utang jatuh tempo, bahan kedaluwarsa, dan sinyal target belanja secara otomatis dari database.
   - Grafik SVG multi-vektor arus kas 6 bulan dinamis.
   - Tombol "+ Tindakan Cepat" untuk aksi instan.

3. **Finansial & Kas Matrix (`/finansial-kas`)**:
   - Multi-Wallet Management (Bank, E-Wallet, Kas Tunai) dengan rekonsiliasi saldo otomatis.
   - Pencatatan transaksi pemasukan dan pengeluaran.
   - Buku besar Utang & Piutang dengan generator pesan penagihan WhatsApp 1-klik (`handleCopyWA`).
   - Pencatatan pembayaran cicilan utang/piutang yang langsung memotong/menambah saldo dompet.
   - Pos Anggaran Digital (Budget Envelopes) dengan visualisasi progress kuota.
   - Kalkulator Split-Bill interaktif dengan opsi pajak (PPN 11%, PB1 16%, dsb.).

4. **Pengadaan & Price Radar (`/pengadaan-radar`)**:
   - Pemantau harga multi-platform (Tokopedia, Shopee, Blibli, Toko Fisik).
   - Penghitungan Deal Score (0-10) dan deteksi Target Hit secara otomatis.
   - Alokasi tabungan barang impian dan sinkronisasi ke buku kas.
   - Tuning Bobot Belanja Rasional (Urgensi Utility, Tingkat Keinginan Desire, Kesiapan Tabungan Buffer) yang tersimpan langsung ke database.

5. **Dapur & Inventaris (`/dapur-inventaris`)**:
   - Pemantauan stok bahan kulkas, freezer, dan lemari bumbu.
   - Pengatur kuantitas real-time (+1 / -1) terhubung ke API.
   - Zero-waste Freshness Tracker untuk bahan yang mendekati tanggal kedaluwarsa.
   - **Autonomous Closed-Loop**: Ketika kuantitas bahan mencapai 0, sistem Golang otomatis memasukkannya ke **Smart Shopping List**.
   - Fitur Pindai Struk Kasir AI (OCR Vision v4.2) untuk mendeteksi barang belanjaan dan otomatis merestock inventaris dapur.

6. **Prinsip Data Bersih (No FE Dummy Data)**:
   - Tidak ada data palsu atau dummy hardcoded di Frontend.
   - Jika database masih kosong, sistem menyajikan *Empty State* interaktif untuk memudahkan pengguna mengisi data pertama kali.

---

## 🛠️ Tech Stack & Arsitektur

### Backend (Golang):
- **Framework / Router**: `github.com/go-chi/chi/v5` (Zero memory allocation, compatible standard library).
- **Database**: **PostgreSQL** via `github.com/lib/pq` (didukung fallback SQLite via `modernc.org/sqlite`).
- **Connection Pool**: Dituning dengan `MaxOpenConns=25`, `MaxIdleConns=10`, `ConnMaxLifetime=5m`.
- **Otentikasi & Keamanan**:
  - `golang.org/x/crypto/bcrypt` untuk hashing password.
  - `github.com/golang-jwt/jwt/v5` untuk claims token JWT.
  - Thread-safe in-memory Rate Limiter per alamat IP.
  - Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`).
  - CORS middleware (`github.com/go-chi/cors`).
  - Transaksi SQL atomik (`tx.Begin()`, `tx.Commit()`, `tx.Rollback()`).
  - Gzip HTTP compression level 5.

### Frontend (React):
- **Tooling**: Vite + React 19.
- **Styling**: Tailwind CSS dengan palet warna resmi OmniLife Dark Theme (`#0d141d`, `#19202a`, `#4edea3`, `#4cd7f6`, dll.).
- **Typography & Icons**: Plus Jakarta Sans & Google Material Symbols Outlined.
- **Routing**: `react-router-dom` v6 dengan `ProtectedRoute` berbasis peran.

---

## 📁 Struktur Direktori

```
AstFin/
├── client/                      # Frontend React (Vite)
│   ├── src/
│   │   ├── api/                 # Service API client dengan JWT header
│   │   ├── context/             # AuthContext (login, register, logout, role)
│   │   ├── components/          # Sidebar, Header, ProtectedRoute, EmptyState
│   │   │   └── modals/          # Modals input & OCR Scan
│   │   ├── pages/               # Dashboard, FinansialKas, PengadaanRadar, Dapur, UserManagement, Login
│   │   ├── App.jsx              # Router & layout orchestration
│   │   ├── index.css            # Tailwind base & custom scrollbar
│   │   └── main.jsx
│   ├── tailwind.config.js       # Konfigurasi Tailwind custom colors
│   ├── postcss.config.js
│   └── package.json
│
├── server/                      # Backend REST API (Golang)
│   ├── cmd/
│   │   └── server/
│   │       └── main.go          # Chi router, middlewares, graceful shutdown
│   ├── internal/
│   │   ├── config/              # Environment config loader
│   │   ├── database/            # SQLite schema migration, PRAGMA WAL & index
│   │   ├── handlers/            # Auth, Dashboard, Wallets, Transactions, Debts, Radar, Pantry
│   │   ├── middleware/          # JWT Auth, Role Guard, Rate Limiter, Security Headers
│   │   ├── models/              # Struct domain & DTOs
│   │   └── utils/               # Bcrypt, JWT generator, JSON responses, Currency
│   ├── go.mod
│   ├── go.sum
│   └── .env
│
└── README.md
```

---

## 🏃 Cara Menjalankan Project

### 1. Menjalankan Backend (Golang):
```bash
cd server
go run ./cmd/server
```
*Backend akan berjalan di port `8080` (http://localhost:8080)*

### 2. Menjalankan Frontend (React):
```bash
cd client
npm run dev
```
*Frontend akan berjalan di port `5173` (http://localhost:5173)*

### 3. Langkah Pertama Saat Menggunakan Aplikasi:
1. Buka browser ke `http://localhost:5173`.
2. Klik **Daftar Pengguna Baru**.
3. Buat akun pertama (otomatis memiliki peran **Administrator**).
4. Masuk ke dashboard dan mulai isi dompet kas pertama Anda di halaman **Finansial & Kas**!
