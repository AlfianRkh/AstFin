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
    const err = new Error(data.error || data.message || `Request failed with status ${response.status}`);
    err.data = data;
    err.status = response.status;
    err.requires_verification = data.requires_verification;
    err.email = data.email;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (userData) => request("/auth/register", { method: "POST", body: JSON.stringify(userData) }),
  verifyEmail: (data) => request("/auth/verify-email", { method: "POST", body: JSON.stringify(data) }),
  resendVerificationCode: (data) => request("/auth/resend-verification", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => request("/auth/me"),
  getRoles: () => request("/auth/roles"),

  // Admin
  getUsers: () => request("/admin/users"),
  createUser: (userData) => request("/admin/users", { method: "POST", body: JSON.stringify(userData) }),
  updateUserRole: (id, roleName) => request(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role_name: roleName }) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

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

  // Compare Price Product
  getStores: () => request("/price/stores"),
  createStore: (data) => request("/price/stores", { method: "POST", body: JSON.stringify(data) }),
  updateStore: (id, data) => request(`/price/stores/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStore: (id) => request(`/price/stores/${id}`, { method: "DELETE" }),

  getPriceCategories: () => request("/price/categories"),
  getPriceProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/price/products${q ? `?${q}` : ""}`);
  },
  createPriceProduct: (data) => request("/price/products", { method: "POST", body: JSON.stringify(data) }),
  getPriceProductDetail: (id) => request(`/price/products/${id}`),
  deletePriceProduct: (id) => request(`/price/products/${id}`, { method: "DELETE" }),
  addPriceEntry: (productId, data) => request(`/price/products/${productId}/entries`, { method: "POST", body: JSON.stringify(data) }),
  deletePriceEntry: (id) => request(`/price/entries/${id}`, { method: "DELETE" }),

  checkPrice: (data) => request("/price/check", { method: "POST", body: JSON.stringify(data) }),
  getPriceSettings: () => request("/price/settings"),
  updatePriceSettings: (data) => request("/price/settings", { method: "POST", body: JSON.stringify(data) }),

  // OSM Geocoding Proxy
  searchGeo: (query) => request(`/geo/search?q=${encodeURIComponent(query)}`),
  reverseGeo: (lat, lng) => request(`/geo/reverse?lat=${lat}&lng=${lng}`),
};
