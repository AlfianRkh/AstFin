import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export function AdminPortal() {
  const { user: currentUser, isAdmin, isFinance } = useAuth();

  // State Data
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewData, setOverviewData] = useState({ users_overview: [], global_summary: {} });
  const [selectedUserId, setSelectedUserId] = useState("all"); // 'all' or numeric string

  // Tabs
  const [activeTab, setActiveTab] = useState("transactions"); // transactions, wallets, debts, users

  // Transaksi state
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txLimit, setTxLimit] = useState(10);
  const [txTotal, setTxTotal] = useState(0);

  // Wallets state
  const [wallets, setWallets] = useState([]);
  const [loadingWallets, setLoadingWallets] = useState(false);

  // Debts state
  const [debts, setDebts] = useState([]);
  const [loadingDebts, setLoadingDebts] = useState(false);

  // User Management state (for Tab 4)
  const [usersList, setUsersList] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: "", email: "", full_name: "", password: "", role_id: 3 });

  // Modals Transaksi CRUD (Admin Only)
  const [createTxModal, setCreateTxModal] = useState(false);
  const [editTxModal, setEditTxModal] = useState(false);
  const [targetTxForEdit, setTargetTxForEdit] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [targetTxForDelete, setTargetTxForDelete] = useState(null);

  // Form Create Transaction
  const [txForm, setTxForm] = useState({
    target_user_id: "",
    wallet_id: "",
    type: "expense",
    amount: "",
    category: "",
    merchant: "",
    notes: "",
    transaction_date: new Date().toISOString().split("T")[0],
    due_date: "",
  });

  // User wallets for selected target user in create tx modal
  const [targetUserWallets, setTargetUserWallets] = useState([]);

  // Fetch Overview Data
  const fetchOverview = async () => {
    try {
      setLoadingOverview(true);
      const res = await api.getAdminOverview();
      if (res.data) {
        setOverviewData(res.data);
      }
    } catch (err) {
      console.error("Gagal mengambil overview admin:", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  // Fetch Transactions with pagination and user filter
  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const params = {
        paged: "1",
        limit: txLimit.toString(),
        offset: ((txPage - 1) * txLimit).toString(),
      };
      if (selectedUserId !== "all") {
        params.user_id = selectedUserId;
      }
      if (txTypeFilter) {
        params.type = txTypeFilter;
      }
      const res = await api.getTransactions(params);
      if (res.data) {
        setTransactions(res.data.items || []);
        setTxTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error("Gagal mengambil transaksi lintas akun:", err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Fetch Wallets
  const fetchWallets = async () => {
    try {
      setLoadingWallets(true);
      const params = selectedUserId === "all" ? { all: "1" } : { user_id: selectedUserId };
      const res = await api.getWallets(params);
      if (res.data) {
        setWallets(res.data.wallets || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data dompet:", err);
    } finally {
      setLoadingWallets(false);
    }
  };

  // Fetch Debts
  const fetchDebts = async () => {
    try {
      setLoadingDebts(true);
      const params = selectedUserId === "all" ? { all: "1" } : { user_id: selectedUserId };
      const res = await api.getDebts(params);
      if (res.data) {
        setDebts(res.data.debts || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data utang:", err);
    } finally {
      setLoadingDebts(false);
    }
  };

  // Fetch Users & Roles
  const fetchUsersAndRoles = async () => {
    if (!isAdmin) return;
    try {
      setLoadingUsers(true);
      const [usersRes, rolesRes] = await Promise.all([api.getUsers(), api.getRoles()]);
      if (usersRes.data) setUsersList(usersRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
    } catch (err) {
      console.error("Gagal mengambil data users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    } else if (activeTab === "wallets") {
      fetchWallets();
    } else if (activeTab === "debts") {
      fetchDebts();
    } else if (activeTab === "users" && isAdmin) {
      fetchUsersAndRoles();
    }
  }, [activeTab, selectedUserId, txPage, txLimit, txTypeFilter]);

  // When target user changes in create transaction modal, fetch their wallets
  const handleTargetUserSelect = async (userId) => {
    setTxForm((prev) => ({ ...prev, target_user_id: userId, wallet_id: "" }));
    if (!userId) {
      setTargetUserWallets([]);
      return;
    }
    try {
      const res = await api.getWallets({ user_id: userId });
      if (res.data) {
        setTargetUserWallets(res.data.wallets || []);
        if (res.data.wallets?.length > 0) {
          setTxForm((prev) => ({ ...prev, wallet_id: res.data.wallets[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error("Gagal mengambil dompet user terpilih:", err);
    }
  };

  // Handle Create Transaction (Admin only)
  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await api.createTransaction({
        target_user_id: parseInt(txForm.target_user_id) || undefined,
        wallet_id: parseInt(txForm.wallet_id),
        type: txForm.type,
        amount: parseFloat(txForm.amount),
        category: txForm.category,
        merchant: txForm.merchant,
        notes: txForm.notes,
        transaction_date: txForm.transaction_date,
        due_date: txForm.due_date || undefined,
      });
      setCreateTxModal(false);
      setTxForm({
        target_user_id: "",
        wallet_id: "",
        type: "expense",
        amount: "",
        category: "",
        merchant: "",
        notes: "",
        transaction_date: new Date().toISOString().split("T")[0],
        due_date: "",
      });
      fetchTransactions();
      fetchOverview();
    } catch (err) {
      alert("Gagal mencatat transaksi: " + (err.message || "Terjadi kesalahan"));
    }
  };

  // Handle Edit Transaction (Admin only)
  const handleOpenEdit = (tx) => {
    setTargetTxForEdit({
      id: tx.id,
      amount: tx.amount,
      category: tx.category,
      merchant: tx.merchant,
      notes: tx.notes || "",
      transaction_date: tx.transaction_date,
      due_date: tx.due_date || "",
      user_name: tx.user_name,
      wallet_name: tx.wallet_name,
    });
    setEditTxModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!targetTxForEdit) return;
    try {
      await api.updateTransaction(targetTxForEdit.id, {
        amount: parseFloat(targetTxForEdit.amount),
        category: targetTxForEdit.category,
        merchant: targetTxForEdit.merchant,
        notes: targetTxForEdit.notes,
        transaction_date: targetTxForEdit.transaction_date,
        due_date: targetTxForEdit.due_date,
      });
      setEditTxModal(false);
      setTargetTxForEdit(null);
      fetchTransactions();
      fetchOverview();
    } catch (err) {
      alert("Gagal memperbarui transaksi: " + (err.message || "Terjadi kesalahan"));
    }
  };

  // Handle Delete Transaction (Admin only)
  const handleOpenDelete = (tx) => {
    setTargetTxForDelete(tx);
    setDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetTxForDelete) return;
    try {
      await api.deleteTransaction(targetTxForDelete.id);
      setDeleteConfirmModal(false);
      setTargetTxForDelete(null);
      fetchTransactions();
      fetchOverview();
    } catch (err) {
      alert("Gagal menghapus transaksi: " + (err.message || "Terjadi kesalahan"));
    }
  };

  // User Management Actions
  const handleRoleChange = async (userId, roleName) => {
    try {
      await api.updateUserRole(userId, roleName);
      fetchUsersAndRoles();
      fetchOverview();
    } catch (err) {
      alert("Gagal memperbarui role: " + err.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Yakin ingin menghapus pengguna "${username}"? Seluruh data akun akan dibersihkan.`)) return;
    try {
      await api.deleteUser(userId);
      fetchUsersAndRoles();
      fetchOverview();
    } catch (err) {
      alert("Gagal menghapus pengguna: " + err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newUserForm);
      setNewUserModal(false);
      setNewUserForm({ username: "", email: "", full_name: "", password: "", role_id: 3 });
      fetchUsersAndRoles();
      fetchOverview();
    } catch (err) {
      alert("Gagal membuat user: " + err.message);
    }
  };

  // Selected User Object
  const selectedUserObj = useMemo(() => {
    if (selectedUserId === "all") return null;
    return overviewData.users_overview?.find((u) => u.user_id.toString() === selectedUserId);
  }, [selectedUserId, overviewData]);

  // Filtered transactions by search query
  const filteredTransactions = useMemo(() => {
    if (!txSearch) return transactions;
    const q = txSearch.toLowerCase();
    return transactions.filter(
      (t) =>
        t.merchant?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.user_name?.toLowerCase().includes(q) ||
        t.user_full_name?.toLowerCase().includes(q)
    );
  }, [transactions, txSearch]);

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="max-w-7xl mx-auto px-space-md lg:px-space-xl py-space-md space-y-space-lg">
      {/* Header Portal Administration */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-low p-space-lg rounded-2xl border border-outline-variant/15 shadow-sm">
        <div className="flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[28px]">shield_person</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-extrabold text-on-surface tracking-tight">Portal Administrasi Terpadu</h1>
              {isAdmin ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ADMINISTRATOR • FULL CRUD
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  FINANCE • AUDIT & READ ONLY
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Pemantauan data multi-akun, segregasi pembuat data, audit transaksi, dan kendali wewenang sistem.
            </p>
          </div>
        </div>

        {/* Global Action / Switcher Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {isAdmin && (
            <button
              onClick={() => {
                if (overviewData.users_overview?.length > 0) {
                  const defaultUID = selectedUserId !== "all" ? selectedUserId : overviewData.users_overview[0].user_id.toString();
                  handleTargetUserSelect(defaultUID);
                }
                setCreateTxModal(true);
              }}
              className="flex items-center gap-1.5 px-space-md py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Catat Transaksi untuk Akun</span>
            </button>
          )}
          <button
            onClick={() => {
              fetchOverview();
              if (activeTab === "transactions") fetchTransactions();
              if (activeTab === "wallets") fetchWallets();
              if (activeTab === "debts") fetchDebts();
            }}
            title="Muat Ulang Data"
            className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Account Segregation Filter Bar */}
      <div className="bg-surface-container-low p-space-md rounded-2xl border border-outline-variant/15 flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">filter_alt</span>
            Filter Akun:
          </span>
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setTxPage(1);
            }}
            className="bg-surface-container-high text-on-surface px-space-md py-2 rounded-xl text-xs font-bold border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            <option value="all">🌐 Semua Akun Pengguna ({overviewData.users_overview?.length || 0} Akun Terkonsolidasi)</option>
            {overviewData.users_overview?.map((u) => (
              <option key={u.user_id} value={u.user_id.toString()}>
                👤 {u.username} ({u.full_name || "Tanpa Nama"}) — {u.role_name.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Account Mini Profile */}
        {selectedUserObj ? (
          <div className="flex items-center gap-3 bg-surface-container px-3 py-1.5 rounded-xl border border-outline-variant/20">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
              {selectedUserObj.username.slice(0, 2)}
            </div>
            <div className="text-xs">
              <span className="font-bold text-on-surface">{selectedUserObj.full_name || selectedUserObj.username}</span>
              <span className="text-on-surface-variant ml-2 text-[10px]">({selectedUserObj.email})</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-container-high text-secondary">
              {selectedUserObj.role_name}
            </span>
          </div>
        ) : (
          <div className="text-xs text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Menampilkan data gabungan seluruh akun pengguna
          </div>
        )}
      </div>

      {/* KPI Cards: Segregated / Consolidated Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Total Liquidity */}
        <div className="bg-surface-container-low p-space-md rounded-2xl border border-outline-variant/15 flex items-center gap-space-md">
          <div className="w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              {selectedUserObj ? "Likuiditas Akun Ini" : "Total Likuiditas Seluruh Akun"}
            </p>
            <p className="text-base lg:text-lg font-black text-primary truncate mt-0.5">
              {formatRupiah(selectedUserObj ? selectedUserObj.total_liquidity : overviewData.global_summary?.total_liquidity)}
            </p>
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-surface-container-low p-space-md rounded-2xl border border-outline-variant/15 flex items-center gap-space-md">
          <div className="w-11 h-11 rounded-xl bg-error/20 text-error flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">trending_down</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total Pengeluaran</p>
            <p className="text-base lg:text-lg font-black text-error truncate mt-0.5">
              {formatRupiah(selectedUserObj ? selectedUserObj.total_expense : overviewData.global_summary?.total_expense)}
            </p>
          </div>
        </div>

        {/* Total Income */}
        <div className="bg-surface-container-low p-space-md rounded-2xl border border-outline-variant/15 flex items-center gap-space-md">
          <div className="w-11 h-11 rounded-xl bg-tertiary/20 text-tertiary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">trending_up</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total Pemasukan</p>
            <p className="text-base lg:text-lg font-black text-tertiary truncate mt-0.5">
              {formatRupiah(selectedUserObj ? selectedUserObj.total_income : overviewData.global_summary?.total_income)}
            </p>
          </div>
        </div>

        {/* Total Outstanding Debt */}
        <div className="bg-surface-container-low p-space-md rounded-2xl border border-outline-variant/15 flex items-center gap-space-md">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">receipt_long</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Beban Hutang Berjalan</p>
            <p className="text-base lg:text-lg font-black text-amber-400 truncate mt-0.5">
              {formatRupiah(selectedUserObj ? selectedUserObj.total_debt : overviewData.global_summary?.total_debt)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-2 px-space-md py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === "transactions"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt</span>
          <span>Log Transaksi Lintas Akun</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 text-inherit font-mono">{txTotal}</span>
        </button>

        <button
          onClick={() => setActiveTab("wallets")}
          className={`flex items-center gap-2 px-space-md py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === "wallets"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          <span>Dompet & Kas Akun</span>
        </button>

        <button
          onClick={() => setActiveTab("debts")}
          className={`flex items-center gap-2 px-space-md py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === "debts"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">credit_card_off</span>
          <span>Buku Utang & Piutang</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-space-md py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === "users"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            <span>Kelola Akun & Role User</span>
          </button>
        )}
      </div>

      {/* TAB 1: TRANSAKSI LINTAS AKUN */}
      {activeTab === "transactions" && (
        <div className="space-y-space-md">
          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm bg-surface-container-low p-space-md rounded-2xl border border-outline-variant/15">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Filter */}
              <div className="flex items-center bg-surface-container rounded-xl p-1 border border-outline-variant/15">
                <button
                  onClick={() => {
                    setTxTypeFilter("");
                    setTxPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    txTypeFilter === "" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => {
                    setTxTypeFilter("expense");
                    setTxPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    txTypeFilter === "expense" ? "bg-error text-on-error shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  onClick={() => {
                    setTxTypeFilter("income");
                    setTxPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    txTypeFilter === "income" ? "bg-tertiary text-on-tertiary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              {/* Items per page */}
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span>Limit:</span>
                <select
                  value={txLimit}
                  onChange={(e) => {
                    setTxLimit(parseInt(e.target.value));
                    setTxPage(1);
                  }}
                  className="bg-surface-container text-on-surface px-2 py-1 rounded-lg border border-outline-variant/20 font-bold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Quick Search in View */}
            <div className="relative min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
              <input
                type="text"
                placeholder="Cari merchant, kategori, akun..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full bg-surface-container pl-9 pr-3 py-1.5 rounded-xl text-xs text-on-surface placeholder:text-outline border border-outline-variant/20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Info Banner for Finance Role */}
          {!isAdmin && isFinance && (
            <div className="flex items-center gap-2 p-space-sm bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-medium">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>
                <strong>Mode Pengawasan Finance:</strong> Anda memiliki kendali penuh atas READ transaksi seluruh akun pengguna. Hak hapus
                dan sunting transaksi dipegang oleh Administrator.
              </span>
            </div>
          )}

          {/* Table Transactions */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container/70 border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-space-md">Akun Pembuat (Creator)</th>
                    <th className="py-3 px-space-md">Tanggal</th>
                    <th className="py-3 px-space-md">Kategori & Merchant</th>
                    <th className="py-3 px-space-md">Dompet Asal</th>
                    <th className="py-3 px-space-md">Nominal</th>
                    <th className="py-3 px-space-md">Catatan</th>
                    {isAdmin && <th className="py-3 px-space-md text-right">Aksi CRUD</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-on-surface-variant">
                        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p>Memuat data transaksi lintas akun...</p>
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl text-outline mb-1">receipt_long</span>
                        <p className="font-semibold">Belum ada catatan transaksi yang sesuai</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface-container/50 transition-colors">
                        {/* Creator Info Badge */}
                        <td className="py-3 px-space-md whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {tx.user_name ? tx.user_name.slice(0, 2) : "U"}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-on-surface text-xs leading-tight">
                                {tx.user_full_name || tx.user_name || `User #${tx.user_id}`}
                              </span>
                              <span className="text-[10px] text-primary font-mono">@{tx.user_name || `uid:${tx.user_id}`}</span>
                            </div>
                          </div>
                        </td>

                        {/* Tanggal */}
                        <td className="py-3 px-space-md whitespace-nowrap text-on-surface-variant font-mono">
                          {tx.transaction_date}
                        </td>

                        {/* Kategori & Merchant */}
                        <td className="py-3 px-space-md">
                          <div className="flex flex-col">
                            <span className="font-bold text-on-surface">{tx.category || "Lain-lain"}</span>
                            <span className="text-on-surface-variant text-[11px]">{tx.merchant || "-"}</span>
                          </div>
                        </td>

                        {/* Dompet Asal */}
                        <td className="py-3 px-space-md whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-surface-container text-on-surface font-semibold text-[11px]">
                            {tx.wallet_name || "Dompet"}
                          </span>
                        </td>

                        {/* Nominal */}
                        <td className="py-3 px-space-md whitespace-nowrap">
                          <span
                            className={`font-extrabold font-mono text-xs ${
                              tx.type === "income" ? "text-tertiary" : "text-error"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"} {formatRupiah(tx.amount)}
                          </span>
                        </td>

                        {/* Catatan */}
                        <td className="py-3 px-space-md max-w-[200px] truncate text-on-surface-variant text-[11px]" title={tx.notes}>
                          {tx.notes || "-"}
                        </td>

                        {/* Admin Action CRUD Buttons */}
                        {isAdmin && (
                          <td className="py-3 px-space-md text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(tx)}
                                title="Edit Transaksi (Admin CRUD)"
                                className="w-7 h-7 rounded-lg bg-surface-container hover:bg-primary/20 text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                onClick={() => handleOpenDelete(tx)}
                                title="Hapus Transaksi (Soft Delete & Pulihkan Saldo)"
                                className="w-7 h-7 rounded-lg bg-surface-container hover:bg-error/20 text-on-surface-variant hover:text-error flex items-center justify-center transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-space-md bg-surface-container/40 border-t border-outline-variant/15 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-on-surface-variant">
              <span>
                Menampilkan {filteredTransactions.length} dari {txTotal} total transaksi
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  Sebelumnya
                </button>
                <span className="px-2 font-mono font-bold text-on-surface">
                  Halaman {txPage} dari {Math.ceil(txTotal / txLimit) || 1}
                </span>
                <button
                  disabled={txPage >= Math.ceil(txTotal / txLimit)}
                  onClick={() => setTxPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOMPET & KAS AKUN */}
      {activeTab === "wallets" && (
        <div className="space-y-space-md">
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm">
            <div className="p-space-md bg-surface-container/60 border-b border-outline-variant/15 flex items-center justify-between">
              <h2 className="font-bold text-sm text-on-surface">Portofolio Saldo & Dompet Seluruh Akun</h2>
              <span className="text-xs text-on-surface-variant font-mono">{wallets.length} Dompet Terdaftar</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container/70 border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-space-md">Pemilik Akun</th>
                    <th className="py-3 px-space-md">Nama Dompet</th>
                    <th className="py-3 px-space-md">Tipe</th>
                    <th className="py-3 px-space-md">No. Rekening / Akun</th>
                    <th className="py-3 px-space-md">Saldo / Sisa Limit</th>
                    <th className="py-3 px-space-md">Limit Kartu Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {loadingWallets ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                        Memuat data dompet...
                      </td>
                    </tr>
                  ) : wallets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                        Tidak ada data dompet ditemukan
                      </td>
                    </tr>
                  ) : (
                    wallets.map((wl) => (
                      <tr key={wl.id} className="hover:bg-surface-container/50 transition-colors">
                        <td className="py-3 px-space-md">
                          <span className="font-bold text-on-surface">{wl.user_full_name || wl.user_name || `User #${wl.user_id}`}</span>
                          <span className="text-[10px] text-primary block font-mono">@{wl.user_name}</span>
                        </td>
                        <td className="py-3 px-space-md font-bold text-on-surface">{wl.name}</td>
                        <td className="py-3 px-space-md">
                          <span className="px-2 py-0.5 rounded-lg bg-surface-container text-[11px] font-semibold text-secondary">
                            {wl.type}
                          </span>
                        </td>
                        <td className="py-3 px-space-md font-mono text-on-surface-variant">{wl.account_number || "-"}</td>
                        <td className="py-3 px-space-md font-mono font-bold text-primary">{formatRupiah(wl.balance)}</td>
                        <td className="py-3 px-space-md font-mono text-on-surface-variant">
                          {wl.credit_limit > 0 ? formatRupiah(wl.credit_limit) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUKU UTANG & PIUTANG */}
      {activeTab === "debts" && (
        <div className="space-y-space-md">
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm">
            <div className="p-space-md bg-surface-container/60 border-b border-outline-variant/15 flex items-center justify-between">
              <h2 className="font-bold text-sm text-on-surface">Rekapitulasi Utang & Piutang Per Akun</h2>
              <span className="text-xs text-on-surface-variant font-mono">{debts.length} Catatan</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container/70 border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-space-md">Pemilik Akun</th>
                    <th className="py-3 px-space-md">Jenis</th>
                    <th className="py-3 px-space-md">Kontak / Pihak Terkait</th>
                    <th className="py-3 px-space-md">Total Tagihan</th>
                    <th className="py-3 px-space-md">Sisa Pembayaran</th>
                    <th className="py-3 px-space-md">Jatuh Tempo</th>
                    <th className="py-3 px-space-md">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {loadingDebts ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                        Memuat data utang piutang...
                      </td>
                    </tr>
                  ) : debts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                        Tidak ada data utang piutang
                      </td>
                    </tr>
                  ) : (
                    debts.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-container/50 transition-colors">
                        <td className="py-3 px-space-md">
                          <span className="font-bold text-on-surface">{d.user_full_name || d.user_name || `User #${d.user_id}`}</span>
                          <span className="text-[10px] text-primary block font-mono">@{d.user_name}</span>
                        </td>
                        <td className="py-3 px-space-md">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                              d.type === "hutang"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {d.type}
                          </span>
                        </td>
                        <td className="py-3 px-space-md">
                          <span className="font-bold text-on-surface">{d.contact_name}</span>
                          {d.contact_phone && <span className="block text-[10px] text-outline font-mono">{d.contact_phone}</span>}
                        </td>
                        <td className="py-3 px-space-md font-mono">{formatRupiah(d.total_amount)}</td>
                        <td className="py-3 px-space-md font-mono font-bold text-error">{formatRupiah(d.remaining)}</td>
                        <td className="py-3 px-space-md font-mono text-on-surface-variant">{d.due_date || "-"}</td>
                        <td className="py-3 px-space-md">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              d.status === "paid"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : d.status === "overdue"
                                ? "bg-error/20 text-error"
                                : "bg-surface-container-high text-on-surface-variant"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USER & ROLE MANAGEMENT (Admin Only) */}
      {activeTab === "users" && isAdmin && (
        <div className="space-y-space-md">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-on-surface">Manajemen Pengguna & Penugasan Role</h2>
            <button
              onClick={() => setNewUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow transition-all hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Tambah Pengguna Baru</span>
            </button>
          </div>

          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container/70 border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-space-md">User</th>
                    <th className="py-3 px-space-md">Email</th>
                    <th className="py-3 px-space-md">Status Email</th>
                    <th className="py-3 px-space-md">Role & Wewenang</th>
                    <th className="py-3 px-space-md text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                        Memuat data pengguna...
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-container/50 transition-colors">
                        <td className="py-3 px-space-md">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
                              {u.username.slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-bold text-on-surface">{u.full_name || u.username}</span>
                              <span className="text-[10px] text-outline block font-mono">@{u.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-space-md font-mono text-on-surface-variant">{u.email}</td>
                        <td className="py-3 px-space-md">
                          {u.is_verified ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400">
                              Terverifikasi
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-space-md">
                          <select
                            disabled={u.id === currentUser?.id}
                            value={u.role_name}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-surface-container text-on-surface px-2.5 py-1 rounded-lg text-xs font-bold border border-outline-variant/20 focus:outline-none disabled:opacity-50 cursor-pointer"
                          >
                            <option value="admin">ADMIN (All CRUD)</option>
                            <option value="finance">FINANCE (Read Transaksi)</option>
                            <option value="user">USER (Standard)</option>
                          </select>
                        </td>
                        <td className="py-3 px-space-md text-right">
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              title="Hapus Akun Pengguna"
                              className="w-7 h-7 rounded-lg bg-surface-container hover:bg-error/20 text-on-surface-variant hover:text-error inline-flex items-center justify-center transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE TRANSACTION ON BEHALF OF USER (Admin Only) */}
      {createTxModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-low w-full max-w-lg rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">
            <div className="p-space-md bg-surface-container border-b border-outline-variant/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_card</span>
                <h3 className="font-bold text-sm text-on-surface">Catat Transaksi untuk Pengguna</h3>
              </div>
              <button
                onClick={() => setCreateTxModal(false)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-space-md space-y-space-md text-xs">
              {/* Target User */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Target Akun Pengguna *</label>
                <select
                  required
                  value={txForm.target_user_id}
                  onChange={(e) => handleTargetUserSelect(e.target.value)}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                >
                  <option value="">-- Pilih Akun Pemilik Data --</option>
                  {overviewData.users_overview?.map((u) => (
                    <option key={u.user_id} value={u.user_id.toString()}>
                      {u.username} ({u.full_name || "Tanpa Nama"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Wallet */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Dompet Asal / Tujuan *</label>
                <select
                  required
                  value={txForm.wallet_id}
                  onChange={(e) => setTxForm({ ...txForm, wallet_id: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                >
                  <option value="">-- Pilih Dompet Pengguna --</option>
                  {targetUserWallets.map((w) => (
                    <option key={w.id} value={w.id.toString()}>
                      {w.name} ({w.type}) — Saldo: {formatRupiah(w.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type & Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Tipe Transaksi</label>
                  <select
                    value={txForm.type}
                    onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
                    className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                  >
                    <option value="expense">Pengeluaran (Expense)</option>
                    <option value="income">Pemasukan (Income)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Nominal (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 50000"
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-mono font-bold border border-outline-variant/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category & Merchant */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Kategori *</label>
                  <input
                    type="text"
                    required
                    placeholder="Makan, Transport, Gaji, dll"
                    value={txForm.category}
                    onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                    className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Merchant / Pihak</label>
                  <input
                    type="text"
                    placeholder="Toko, Vendor, Karyawan"
                    value={txForm.merchant}
                    onChange={(e) => setTxForm({ ...txForm, merchant: e.target.value })}
                    className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={txForm.transaction_date}
                  onChange={(e) => setTxForm({ ...txForm, transaction_date: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-mono border border-outline-variant/20 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan transaksi..."
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface border border-outline-variant/20 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
                <button
                  type="button"
                  onClick={() => setCreateTxModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold shadow"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT TRANSACTION (Admin Only) */}
      {editTxModal && targetTxForEdit && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-low w-full max-w-lg rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">
            <div className="p-space-md bg-surface-container border-b border-outline-variant/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit</span>
                <h3 className="font-bold text-sm text-on-surface">Edit Transaksi #{targetTxForEdit.id}</h3>
              </div>
              <button
                onClick={() => setEditTxModal(false)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-space-md space-y-space-md text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-between">
                <span>Akun: <strong>@{targetTxForEdit.user_name}</strong></span>
                <span>Dompet: <strong>{targetTxForEdit.wallet_name}</strong></span>
              </div>

              {/* Amount */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Nominal (Rp) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={targetTxForEdit.amount}
                  onChange={(e) => setTargetTxForEdit({ ...targetTxForEdit, amount: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-mono font-bold border border-outline-variant/20 focus:outline-none"
                />
              </div>

              {/* Category & Merchant */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Kategori</label>
                  <input
                    type="text"
                    value={targetTxForEdit.category}
                    onChange={(e) => setTargetTxForEdit({ ...targetTxForEdit, category: e.target.value })}
                    className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Merchant</label>
                  <input
                    type="text"
                    value={targetTxForEdit.merchant}
                    onChange={(e) => setTargetTxForEdit({ ...targetTxForEdit, merchant: e.target.value })}
                    className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={targetTxForEdit.transaction_date}
                  onChange={(e) => setTargetTxForEdit({ ...targetTxForEdit, transaction_date: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-mono border border-outline-variant/20 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={targetTxForEdit.notes}
                  onChange={(e) => setTargetTxForEdit({ ...targetTxForEdit, notes: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface border border-outline-variant/20 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
                <button
                  type="button"
                  onClick={() => setEditTxModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold shadow"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION (Admin Only) */}
      {deleteConfirmModal && targetTxForDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-low w-full max-w-md rounded-2xl border border-error/30 shadow-2xl p-space-lg text-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-error/20 text-error flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">delete_forever</span>
            </div>
            <div className="text-center">
              <h3 className="font-extrabold text-base text-on-surface">Konfirmasi Hapus Transaksi</h3>
              <p className="text-on-surface-variant mt-1">
                Transaksi <strong>{targetTxForDelete.category}</strong> senilai{" "}
                <strong className="text-error font-mono">{formatRupiah(targetTxForDelete.amount)}</strong> milik akun{" "}
                <strong>@{targetTxForDelete.user_name}</strong> akan ditandai sebagai soft delete.
              </p>
              <div className="mt-3 p-2 rounded-xl bg-surface-container text-[11px] text-primary text-left">
                ℹ️ Saldo pada dompet <strong>{targetTxForDelete.wallet_name}</strong> akan otomatis dipulihkan.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-error hover:bg-error/90 text-on-error font-bold shadow"
              >
                Ya, Hapus & Pulihkan Saldo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE NEW USER (Admin Only) */}
      {newUserModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-low w-full max-w-md rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden text-xs">
            <div className="p-space-md bg-surface-container border-b border-outline-variant/15 flex items-center justify-between">
              <h3 className="font-bold text-sm text-on-surface">Tambah Pengguna Baru</h3>
              <button
                onClick={() => setNewUserModal(false)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-space-md space-y-space-md">
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="username_baru"
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="email@example.com"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Role *</label>
                <select
                  value={newUserForm.role_id}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role_id: parseInt(e.target.value) })}
                  className="w-full bg-surface-container px-3 py-2 rounded-xl text-on-surface font-semibold border border-outline-variant/20 focus:outline-none"
                >
                  <option value={3}>User (Pengguna Biasa)</option>
                  <option value={2}>Finance (Manager Keuangan - Read Transaksi)</option>
                  <option value={1}>Admin (Administrator - All CRUD)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
                <button
                  type="button"
                  onClick={() => setNewUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold shadow"
                >
                  Buat Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
