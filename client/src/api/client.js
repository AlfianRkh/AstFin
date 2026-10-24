const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem("omni_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/register")) {
    localStorage.removeItem("omni_token");
    localStorage.removeItem("omni_user");
    window.dispatchEvent(new Event("auth:unauthorized"));
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (userData) => request("/auth/register", { method: "POST", body: JSON.stringify(userData) }),
  getMe: () => request("/auth/me"),
  getRoles: () => request("/auth/roles"),

  // Admin
  getUsers: () => request("/admin/users"),
  updateUserRole: (id, roleName) => request(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role_name: roleName }) }),

  // Dashboard
  getDashboardSummary: () => request("/dashboard/summary"),

  // Wallets
  getWallets: () => request("/wallets"),
  createWallet: (data) => request("/wallets", { method: "POST", body: JSON.stringify(data) }),
  updateWallet: (id, data) => request(`/wallets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteWallet: (id) => request(`/wallets/${id}`, { method: "DELETE" }),
  payCreditCard: (id, data) => request(`/wallets/${id}/pay-card`, { method: "POST", body: JSON.stringify(data) }),
  adjustCreditLimit: (id, data) => request(`/wallets/${id}/adjust-limit`, { method: "POST", body: JSON.stringify(data) }),

  // Envelopes
  getEnvelopes: () => request("/envelopes"),
  createEnvelope: (data) => request("/envelopes", { method: "POST", body: JSON.stringify(data) }),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/transactions${q ? `?${q}` : ""}`);
  },
  createTransaction: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),
  scanReceiptOCR: (data) => request("/transactions/scan-ocr", { method: "POST", body: JSON.stringify(data) }),
  getTransactionCategories: (type = "") => request(`/transaction-categories${type ? `?type=${type}` : ""}`),
  createTransactionCategory: (data) => request("/transaction-categories", { method: "POST", body: JSON.stringify(data) }),

  // Debts
  getDebts: (type = "") => request(`/debts${type ? `?type=${type}` : ""}`),
  createDebt: (data) => request("/debts", { method: "POST", body: JSON.stringify(data) }),
  recordDebtPayment: (data) => request("/debts/payment", { method: "POST", body: JSON.stringify(data) }),
  deleteDebt: (id) => request(`/debts/${id}`, { method: "DELETE" }),

  // Radar
  getRadarItems: () => request("/radar"),
  createRadarItem: (data) => request("/radar", { method: "POST", body: JSON.stringify(data) }),
  updateRadarItem: (id, data) => request(`/radar/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRadarItem: (id) => request(`/radar/${id}`, { method: "DELETE" }),
  getRadarSettings: () => request("/radar/settings"),
  updateRadarSettings: (data) => request("/radar/settings", { method: "POST", body: JSON.stringify(data) }),
  getRadarCategories: () => request("/radar-categories"),
  createRadarCategory: (data) => request("/radar-categories", { method: "POST", body: JSON.stringify(data) }),
  getRadarPlatforms: () => request("/radar-platforms"),
  createRadarPlatform: (data) => request("/radar-platforms", { method: "POST", body: JSON.stringify(data) }),

  // Pantry
  getPantryItems: (category = "") => request(`/pantry${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  createPantryItem: (data) => request("/pantry", { method: "POST", body: JSON.stringify(data) }),
  updatePantryQty: (id, data) => request(`/pantry/${id}/quantity`, { method: "PUT", body: JSON.stringify(data) }),
  deletePantryItem: (id) => request(`/pantry/${id}`, { method: "DELETE" }),
  getPantryStorageZones: () => request("/pantry/zones"),
  createPantryStorageZone: (data) => request("/pantry/zones", { method: "POST", body: JSON.stringify(data) }),

  // Shopping List
  getShoppingList: () => request("/shopping"),
  addShoppingItem: (data) => request("/shopping", { method: "POST", body: JSON.stringify(data) }),
  checkoutShoppingList: (data) => request("/shopping/checkout", { method: "POST", body: JSON.stringify(data) }),
  toggleShoppingItem: (id) => request(`/shopping/${id}/toggle`, { method: "PUT" }),
  deleteShoppingItem: (id) => request(`/shopping/${id}`, { method: "DELETE" }),
};
