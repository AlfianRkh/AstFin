# 🌿 AstFin — Smart Household Life & Financial Operating System

<p align="center">
  <img src="https://img.shields.io/badge/Backend-Golang%201.22-00ADD8?style=for-the-badge&logo=go&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL%2015-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

**AstFin** adalah platform terpadu (*Life OS*) modern yang menghubungkan manajemen logistik dapur rumah tangga dengan pembukuan keuangan pribadi dalam satu ekosistem tertutup (**Closed-Loop Supply Chain**).

Aplikasi ini mengotomatiskan siklus konsumsi bahan harian: dari pelacakan kedaluwarsa zero-waste di kulkas, pembuatan daftar belanja cerdas otomatis saat stok habis, komparasi harga komoditas belanja, hingga eksekusi pembayaran belanja yang langsung memotong saldo dompet dan memperbarui stok dapur dalam satu transaksi database atomik.

---

### ✨ Fitur Unggulan

#### 1. 🥫 StockPantry & Zero-Waste Freshness
* **Pelacakan Kedaluwarsa Real-time**: Visualisasi zona penyimpanan (Kulkas/Chiller, Freezer, Lemari Kering, Rak Bumbu) dengan sistem peringatan dini bahan kritis sebelum kedaluwarsa.
* **Manajemen Satuan Bertingkat & Konversi Cerdas**: Mendukung pembelian satuan grosir (*Kardus, Pack, Dus, Bungkus @ X pcs*) yang otomatis terkonversi ke unit konsumsi dapur (*Pcs*), serta satuan reguler (*Kg, Gram, Liter, Botol, Butir*).
* **Threshold Restock Fleksibel**: Batas minimum restock dinamis yang otomatis menyesuaikan satuan komoditas yang bersangkutan.

#### 2. 🛒 Smart Shopping List & Atomic Checkout
* **Autonomous Closed-Loop**: Bahan dapur yang habis (0) atau menipis secara otomatis terdaftar di Smart Shopping List.
* **Penyesuaian Harga Restock Terkini**: Modal belanja ulang interaktif yang dapat mendeteksi kenaikan atau penghematan harga pasar dibanding harga beli awal.
* **Transaksi Eksekusi Belanja Atomik**: Satu klik "Bayar & Update Dapur" secara aman memotong saldo dompet yang dipilih, mencatat mutasi pengeluaran kasir, dan menambahkan stok dapur tanpa risiko inkonsistensi data (*ACID Transaction*).

#### 3. 🎯 PriceRadar (Autonomous Procurement & Price Tracking)
* **Algoritma Belanja Rasional**: Scoring kelayakan pembelian berdasarkan tuning bobot kebutuhan (*Utility Weight*), keinginan (*Desire Weight*), dan kesiapan tabungan (*Saving Weight*).
* **Platform Monitoring**: Integrasi pencatatan harga antar platform marketplace dan kategori belanja.

#### 4. 💳 Multi-Wallet & Cashflow Management
* Mendukung berbagai instrumen dana: Rekening Bank, E-Wallet, Kartu Kredit (dengan kalkulasi limit kredit aktif), dan Uang Tunai.
* **DebtTracker**: Pencatatan dan monitoring jatuh tempo hutang & piutang.
* Ringkasan arus kas harian dan riwayat mutasi keuangan.

---

### 🛠️ Tech Stack & Architecture

* **Backend**: Golang (Go 1.22+), Chi Router, PostgreSQL Driver (`lib/pq`), JWT Authentication, Rate Limiting & Security Middlewares.
* **Frontend**: React 18, Vite, Material Design 3 Dark Theme tokens, TailwindCSS utilities, Material Symbols.
* **Database**: PostgreSQL (Supabase Compatible) & SQLite fallback.
* **Deployment Ready**: Terkonfigurasi untuk deploy otomatis di **Supabase** (DB), **Render** (Backend API), dan **Netlify** (Frontend SPA).

---

### 🚀 Menjalankan Secara Lokal

#### 1. Clone Repository
```bash
git clone https://github.com/USERNAME/AstFin.git
cd AstFin
