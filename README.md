# OmniLife Nexus - Full Stack Life OS & Financial Matrix

A high-performance, secure, full-stack application with **React (Frontend)** and **Golang (Backend REST API)**, designed based on the **OmniLife Nexus Unified Life OS v2.4** interface.

---

## 🚀 Fitur Utama & Modul

1. **Authentication & Role-Based Access Control (RBAC)**:
   - Module otentikasi lengkap: Register, Login, Token Verification.
   - Sistem peran multi-level: `admin`, `finance`, `user`.
   - Admin panel untuk mengelola peran pengguna.

2. **Executive OmniCommand Dashboard**:
   - Integrasi telemetri live dari seluruh 5 subsistem.
   - 5 Metrik Utama (Kas Likuid, Debt Net, Sinyal Radar, WishBoard, Pantry).
   - Pusat Intervensi Lintas-Modul (Cross-Engine Urgent Alerts) yang mendeteksi utang jatuh tempo, bahan kedaluwarsa, dan sinyal target belanja secara otomatis dari database.
   - Grafik SVG multi-vektor arus kas 6 bulan dinamis.
   - Tombol "+ Tindakan Cepat" untuk aksi instan.

3. **Finansial & Kas Matrix**:
   - Multi-Wallet Management (Bank, E-Wallet, Kas Tunai) dengan rekonsiliasi saldo otomatis.
   - Pencatatan transaksi pemasukan dan pengeluaran.
   - Buku besar Utang & Piutang dengan generator pesan penagihan WhatsApp 1-klik (`handleCopyWA`).
   - Pencatatan pembayaran cicilan utang/piutang yang langsung memotong/menambah saldo dompet.
   - Pos Anggaran Digital (Budget Envelopes) dengan visualisasi progress kuota.
   - Kalkulator Split-Bill interaktif dengan opsi pajak (PPN 11%, PB1 16%, dsb.).

4. **Pengadaan & Price Radar**:
   - Pemantau harga multi-platform (Tokopedia, Shopee, Blibli, Toko Fisik).
   - Penghitungan Deal Score (0-10) dan deteksi Target Hit secara otomatis.
   - Alokasi tabungan barang impian dan sinkronisasi ke buku kas.
   - Tuning Bobot Belanja Rasional (Urgensi Utility, Tingkat Keinginan Desire, Kesiapan Tabungan Buffer) yang tersimpan langsung ke database.

5. **Dapur & Inventaris**:
   - Pemantauan stok bahan kulkas, freezer, dan lemari bumbu.
   - Pengatur kuantitas real-time (+1 / -1) terhubung ke API.
   - Zero-waste Freshness Tracker untuk bahan yang mendekati tanggal kedaluwarsa.
   - **Autonomous Closed-Loop**: Ketika kuantitas bahan mencapai 0, sistem Golang otomatis memasukkannya ke **Smart Shopping List**.
   - Fitur Pindai Struk Kasir AI (OCR Vision v4.2) untuk mendeteksi barang belanjaan dan otomatis merestock inventaris dapur.

6. **Prinsip Data Bersih (No FE Dummy Data)**:
   - Tidak ada data palsu atau dummy hardcoded di Frontend.
   - Jika database masih kosong, sistem menyajikan *Empty State* interaktif untuk memudahkan pengguna mengisi data pertama kali.

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
