import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export function WhatsAppReminderSetting() {
  const [activeTab, setActiveTab] = useState("queue"); // "queue", "config", "triggers", "templates", "logs"
  const [settings, setSettings] = useState(null);
  const [queueData, setQueueData] = useState({ items: [], total_alerts: 0, pantry_alerts: 0, debt_alerts: 0, radar_alerts: 0, daily_digest: "", digest_wa_link: "" });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [filterModule, setFilterModule] = useState("all");

  // Template editor active selection
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("template_pantry_expiry");

  // Test send state
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Copy status
  const [copiedDigest, setCopiedDigest] = useState(false);
  const [cronExecuting, setCronExecuting] = useState(false);
  const [cronReport, setCronReport] = useState(null);
  const [copiedCronUrl, setCopiedCronUrl] = useState(false);
  const [copiedCronSecret, setCopiedCronSecret] = useState(false);

  const handleRunCronTest = async (force = true) => {
    setCronExecuting(true);
    setCronReport(null);
    try {
      const res = await api.runManualScanner(force);
      setCronReport(res.data);
      reloadQueue();
    } catch (err) {
      alert("Gagal menjalankan cron scanner: " + err.message);
    } finally {
      setCronExecuting(false);
    }
  };

  // Fetch initial settings & queue
  const loadData = async () => {
    try {
      const [settRes, queueRes] = await Promise.all([
        api.getWhatsAppSettings(),
        api.getWhatsAppQueue(),
      ]);
      setSettings(settRes.data);
      setTestPhone(settRes.data.phone_number || "");
      setQueueData(queueRes.data || { items: [] });
    } catch (err) {
      console.error("Gagal memuat pengaturan WhatsApp:", err);
    } finally {
      setLoading(false);
    }
  };

  const reloadQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await api.getWhatsAppQueue();
      setQueueData(res.data || { items: [] });
    } catch (err) {
      console.error("Gagal menyegarkan antrean:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await api.getWhatsAppLogs();
      setLogs(res.data || []);
    } catch (err) {
      console.error("Gagal memuat log WhatsApp:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    } else if (activeTab === "queue") {
      reloadQueue();
    }
  }, [activeTab]);

  // Handle Save Settings
  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateWhatsAppSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      reloadQueue();
    } catch (err) {
      alert("Gagal menyimpan pengaturan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle Dispatch / Send WhatsApp for single queue item
  const handleDispatchItem = async (item) => {
    try {
      // First try to record in backend dispatch log
      await api.dispatchWhatsAppAlert({
        alert_id: item.id,
        type: item.type,
        title: item.title,
        phone_number: item.phone || settings?.phone_number || "",
        message: item.message,
      });
      // Open WhatsApp web or app in new window
      if (item.wa_link) {
        window.open(item.wa_link, "_blank", "noopener,noreferrer");
      }
      reloadQueue();
    } catch (err) {
      console.error("Dispatch error:", err);
      // Still open link even if logging failed
      if (item.wa_link) {
        window.open(item.wa_link, "_blank", "noopener,noreferrer");
      }
    }
  };

  // Handle Send Daily Digest
  const handleSendDailyDigest = () => {
    if (!queueData.daily_digest) return;
    if (queueData.digest_wa_link) {
      window.open(queueData.digest_wa_link, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyDigest = () => {
    if (!queueData.daily_digest) return;
    navigator.clipboard.writeText(queueData.daily_digest);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2500);
  };

  // Handle Test WhatsApp Send
  const handleTestSend = async () => {
    const target = testPhone || settings?.phone_number;
    if (!target) {
      alert("Masukkan nomor WhatsApp penerima terlebih dahulu!");
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.testSendWhatsApp({
        phone_number: target,
        message: testMessage,
        provider: settings?.provider || "wa_me",
        api_key: settings?.api_key || "",
        gateway_url: settings?.gateway_url || "",
      });
      setTestResult(res.data);
      if (res.data?.wa_link && settings?.provider === "wa_me") {
        window.open(res.data.wa_link, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert("Gagal uji coba WhatsApp: " + err.message);
    } finally {
      setTestSending(false);
    }
  };

  // Helper to insert template variable placeholder
  const insertVariable = (varName) => {
    if (!settings) return;
    const currentVal = settings[selectedTemplateKey] || "";
    setSettings({
      ...settings,
      [selectedTemplateKey]: currentVal + " " + varName,
    });
  };

  // Helper: Format raw whatsapp text to HTML for realistic chat preview
  const formatWhatsAppText = (text) => {
    if (!text) return "";
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Bold: *text*
    formatted = formatted.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    // Italic: _text_
    formatted = formatted.replace(/_(.*?)_/g, "<em>$1</em>");
    // Strikethrough: ~text~
    formatted = formatted.replace(/~(.*?)~/g, "<del>$1</del>");
    // Line breaks
    formatted = formatted.replace(/\n/g, "<br />");
    return formatted;
  };

  // Filtered queue items
  const filteredQueueItems = (queueData.items || []).filter((item) => {
    if (filterModule === "all") return true;
    if (filterModule === "pantry" && (item.type === "pantry_expiry" || item.type === "low_stock")) return true;
    if (filterModule === "debt" && (item.type === "debt_due" || item.type === "debt_overdue")) return true;
    if (filterModule === "radar" && item.type === "radar_target") return true;
    return true;
  });

  const templatesConfig = [
    {
      key: "template_pantry_expiry",
      label: "🧊 Kedaluwarsa Dapur",
      desc: "Dikirim saat bahan mendekati atau telah melewati tanggal kadaluarsa.",
      variables: [
        { label: "Nama User", code: "{nama}" },
        { label: "Nama Bahan", code: "{nama_produk}" },
        { label: "Jumlah", code: "{jumlah}" },
        { label: "Satuan", code: "{satuan}" },
        { label: "Kategori Zona", code: "{kategori}" },
        { label: "Sisa Hari", code: "{hari_sisa}" },
        { label: "Tgl Kedaluwarsa", code: "{tgl_kadaluarsa}" },
      ],
      previewSample: {
        nama: "Alex",
        nama_produk: "Telur Ayam Omega-3",
        jumlah: "6",
        satuan: "butir",
        kategori: "Kulkas Dingin",
        hari_sisa: "1",
        tgl_kadaluarsa: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      },
    },
    {
      key: "template_debt_due",
      label: "💳 Cicilan Jatuh Tempo H-1",
      desc: "Dikirim H-1 sebelum kewajiban cicilan / utang jatuh tempo.",
      variables: [
        { label: "Nama User", code: "{nama}" },
        { label: "Nama Kontak/Kreditor", code: "{nama_kontak}" },
        { label: "Nominal Tagihan", code: "{nominal}" },
        { label: "Tgl Jatuh Tempo", code: "{jatuh_tempo}" },
        { label: "Sisa Hari", code: "{hari_sisa}" },
      ],
      previewSample: {
        nama: "Alex",
        nama_kontak: "Kartu Kredit BCA Smart",
        nominal: "1.250.000",
        jatuh_tempo: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        hari_sisa: "1",
      },
    },
    {
      key: "template_debt_overdue",
      label: "🚨 Lewat Jatuh Tempo (Overdue)",
      desc: "Peringatan mendesak saat tagihan sudah melewati tanggal jatuh tempo.",
      variables: [
        { label: "Nama User", code: "{nama}" },
        { label: "Nama Kontak", code: "{nama_kontak}" },
        { label: "Nominal", code: "{nominal}" },
        { label: "Jatuh Tempo", code: "{jatuh_tempo}" },
        { label: "Terlambat (Hari)", code: "{hari_sisa}" },
      ],
      previewSample: {
        nama: "Alex",
        nama_kontak: "Cicilan Laptop Tech",
        nominal: "750.000",
        jatuh_tempo: "2026-10-25",
        hari_sisa: "4",
      },
    },
    {
      key: "template_low_stock",
      label: "📦 Stok Pantry Menipis",
      desc: "Pengingat belanja restock saat kuantitas bahan berada di bawah batas minimum.",
      variables: [
        { label: "Nama User", code: "{nama}" },
        { label: "Nama Produk", code: "{nama_produk}" },
        { label: "Jumlah Sisa", code: "{jumlah}" },
        { label: "Batas Min", code: "{min_jumlah}" },
        { label: "Satuan", code: "{satuan}" },
        { label: "Kategori", code: "{kategori}" },
      ],
      previewSample: {
        nama: "Alex",
        nama_produk: "Minyak Goreng Sawit",
        jumlah: "1",
        min_jumlah: "2",
        satuan: "pouch",
        kategori: "Lemari Kering",
      },
    },
    {
      key: "template_radar_target",
      label: "🎯 Radar Sinyal Promo Target",
      desc: "Notifikasi saat barang incaran turun ke harga target yang dipatok.",
      variables: [
        { label: "Nama User", code: "{nama}" },
        { label: "Nama Barang", code: "{nama_produk}" },
        { label: "Harga Terkini", code: "{harga_sekarang}" },
        { label: "Target Harga", code: "{target_harga}" },
        { label: "Platform Toko", code: "{platform}" },
        { label: "Deal Score %", code: "{deal_score}" },
      ],
      previewSample: {
        nama: "Alex",
        nama_produk: "Mechanical Keyboard Wireless",
        harga_sekarang: "499.000",
        target_harga: "550.000",
        platform: "Tokopedia",
        deal_score: "94",
      },
    },
  ];

  const currentTemplateObj = templatesConfig.find((t) => t.key === selectedTemplateKey) || templatesConfig[0];

  // Generate live sample text for preview
  const getRenderedPreview = () => {
    if (!settings) return "";
    let raw = settings[selectedTemplateKey] || "";
    const sample = currentTemplateObj.previewSample || {};
    Object.keys(sample).forEach((k) => {
      raw = raw.replace(new RegExp(`\\{${k}\\}`, "g"), sample[k]);
    });
    return raw;
  };

  if (loading && !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-surface-container-high border-t-primary animate-spin mb-3"></div>
        <p className="text-xs text-outline font-semibold">Memuat Konfigurasi Pengingat WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full overflow-visible px-3 sm:px-space-md lg:px-margin-desktop py-space-md lg:py-space-xl">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]"></div>
        <div className="pointer-events-none absolute -top-20 left-10 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-[100px]"></div>

        {/* Page Header */}
        <header className="flex flex-col gap-space-md pb-space-lg border-b border-outline-variant/30 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col max-w-3xl">
            <div className="flex items-center gap-space-sm mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/20 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                WHATSAPP AUTOMATION ENGINE
              </span>
              <span className="text-[10px] text-outline tracking-wider uppercase font-semibold">
                Cross-System Attention Hub v2.4
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight break-words flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">chat</span>
              </span>
              <span>Pengaturan Pengingat WhatsApp</span>
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
              Otomatisasi pengingat langsung ke WhatsApp untuk bahan dapur yang tersimpan mendekati kedaluwarsa, cicilan & utang yang harus dibayar H-1, stok logistik menipis, dan sinyal belanja radar.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => handleRunCronTest(true)}
              disabled={cronExecuting}
              title="Picu pemindaian dan eksekusi blast pengingat harian secara instan"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all bg-surface-container-high hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
            >
              <span className={`material-symbols-outlined text-[18px] ${cronExecuting ? "animate-spin" : ""}`}>
                {cronExecuting ? "sync" : "bolt"}
              </span>
              <span>{cronExecuting ? "Memindai Cron..." : "⚡ Test Cron Blast"}</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                saveSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {saveSuccess ? "check_circle" : saving ? "sync" : "save"}
              </span>
              <span>{saveSuccess ? "Tersimpan!" : saving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
            </button>
          </div>
        </header>

        {/* Top Status & Summary Bar */}
        <section className="mt-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
          {/* Master Switch Card */}
          <div className="rounded-xl bg-surface-container p-space-md shadow-md flex items-center justify-between border border-outline-variant/10">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Status Pengingat</span>
              <span className={`text-base font-bold mt-0.5 flex items-center gap-2 ${settings?.is_enabled ? "text-emerald-400" : "text-outline"}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${settings?.is_enabled ? "bg-emerald-400 animate-ping" : "bg-outline"}`}></span>
                {settings?.is_enabled ? "Sistem Aktif" : "Dinonaktifkan"}
              </span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">
                {settings?.is_enabled ? "Notifikasi dikirim sesuai aturan" : "Semua pengingat disenyapkan"}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.is_enabled || false}
                onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Connected Phone Card */}
          <div className="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between border border-outline-variant/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Nomor Tujuan WA</span>
              <span className="material-symbols-outlined text-emerald-400 text-[18px]">phone_iphone</span>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-on-surface truncate block">
                {settings?.phone_number ? settings.phone_number : "Belum Ditetapkan"}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {settings?.phone_number ? "Nomor terverifikasi aktif" : "Isi di tab Konfigurasi"}
              </span>
            </div>
          </div>

          {/* Delivery Method Card */}
          <div className="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between border border-outline-variant/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Metode Pengiriman</span>
              <span className="material-symbols-outlined text-secondary text-[18px]">send</span>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-secondary capitalize truncate block">
                {settings?.provider === "wa_me" ? "1-Click Direct wa.me" : settings?.provider || "Direct"}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {settings?.provider === "wa_me" ? "Resmi, 100% Bebas Biaya API" : "Otomatis via Gateway API"}
              </span>
            </div>
          </div>

          {/* Attention Queue Counter */}
          <div className="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between border border-outline-variant/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Perhatian Hari Ini</span>
              <span className="material-symbols-outlined text-error text-[18px]">notifications_active</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-error">
                {queueData.total_alerts || 0}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {queueData.pantry_alerts || 0} Dapur • {queueData.debt_alerts || 0} Cicilan
              </span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="mt-space-lg flex items-center gap-2 border-b border-outline-variant/20 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap ${
              activeTab === "queue"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">notification_important</span>
            <span>Antrean Perhatian Hari Ini</span>
            {queueData.total_alerts > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === "queue" ? "bg-white text-emerald-600" : "bg-error text-white"}`}>
                {queueData.total_alerts}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("triggers")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap ${
              activeTab === "triggers"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Aturan & Pemicu Pengingat</span>
          </button>

          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap ${
              activeTab === "templates"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            <span>Kustomisasi Template & Preview WA</span>
          </button>

          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap ${
              activeTab === "config"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span>Nomor & Gateway API</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap ${
              activeTab === "logs"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Riwayat Pengiriman</span>
          </button>
        </div>

        {/* TAB 1: ACTIONABLE ATTENTION QUEUE */}
        {activeTab === "queue" && (
          <div className="mt-space-lg flex flex-col gap-space-lg">
            {/* Action Bar & Daily Digest Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-surface-container to-surface-container p-space-md lg:p-space-lg shadow-md border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
              <div className="flex items-start gap-space-md">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-[28px]">mark_chat_unread</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
                    <span>Rekap Perhatian Komprehensif Hari Ini</span>
                    {queueData.total_alerts > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-error/20 text-error text-[10px] font-bold animate-pulse">
                        {queueData.total_alerts} Perlu Ditindaklanjuti
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        Semua Aman Terkendali
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5 max-w-2xl">
                    Gabungkan seluruh perhatian kedaluwarsa produk, cicilan H-1, dan stok habis dalam satu format ringkasan WhatsApp yang rapi untuk dikirim sekaligus.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
                <button
                  onClick={reloadQueue}
                  disabled={queueLoading}
                  className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors"
                >
                  <span className={`material-symbols-outlined text-[16px] ${queueLoading ? "animate-spin" : ""}`}>
                    sync
                  </span>
                  <span>Perbarui Live</span>
                </button>

                <button
                  onClick={handleCopyDigest}
                  className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  <span>{copiedDigest ? "Tersalin!" : "Salin Rekap"}</span>
                </button>

                <button
                  onClick={handleSendDailyDigest}
                  disabled={queueData.total_alerts === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>Kirim Rekap Harian via WA</span>
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-outline uppercase mr-1">Filter Kategori:</span>
              <button
                onClick={() => setFilterModule("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterModule === "all" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                }`}
              >
                Semua ({queueData.items?.length || 0})
              </button>
              <button
                onClick={() => setFilterModule("pantry")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterModule === "pantry" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                }`}
              >
                🧊 Dapur & Kedaluwarsa ({queueData.pantry_alerts || 0})
              </button>
              <button
                onClick={() => setFilterModule("debt")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterModule === "debt" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                }`}
              >
                💳 Cicilan H-1 & Utang ({queueData.debt_alerts || 0})
              </button>
              <button
                onClick={() => setFilterModule("radar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterModule === "radar" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                }`}
              >
                🎯 Radar Target ({queueData.radar_alerts || 0})
              </button>
            </div>

            {/* Queue Items List */}
            {filteredQueueItems.length === 0 ? (
              <div className="rounded-2xl bg-surface-container p-space-xl flex flex-col items-center justify-center text-center shadow-md border border-outline-variant/10 min-h-[300px]">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-space-sm">
                  <span className="material-symbols-outlined text-[36px]">verified</span>
                </div>
                <h4 className="text-base font-bold text-on-surface">Tidak Ada Perhatian yang Perlu Diingatkan</h4>
                <p className="text-xs text-on-surface-variant max-w-md mt-1">
                  Saat ini tidak ada bahan dapur yang mendekati kedaluwarsa atau cicilan yang harus dibayar H-1. Sistem akan otomatis memindai setiap kali ada data baru.
                </p>
                <div className="flex items-center gap-3 mt-space-md">
                  <Link to="/dapur-inventaris" className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface">
                    Periksa Dapur
                  </Link>
                  <Link to="/finansial-kas" className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface">
                    Periksa Buku Utang
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-space-md">
                {filteredQueueItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 hover:border-emerald-500/30 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md"
                  >
                    <div className="flex items-start gap-space-md min-w-0 flex-1">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        item.severity === "critical"
                          ? "bg-error/20 text-error"
                          : item.type === "radar_target"
                          ? "bg-secondary/20 text-secondary"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        <span className="material-symbols-outlined text-[24px]">
                          {item.type === "pantry_expiry" ? "kitchen" : item.type === "low_stock" ? "inventory_2" : item.type.startsWith("debt") ? "receipt_long" : "radar"}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            item.severity === "critical"
                              ? "bg-error/20 text-error border border-error/30"
                              : item.type === "radar_target"
                              ? "bg-secondary/20 text-secondary border border-secondary/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}>
                            {item.module_name}
                          </span>

                          {item.daysLeft !== undefined && item.type === "debt_due" && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              {item.daysLeft === 0 ? "JATUH TEMPO HARI INI" : `H-${item.daysLeft} JATUH TEMPO`}
                            </span>
                          )}

                          {item.daysLeft !== undefined && item.type === "pantry_expiry" && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.daysLeft <= 0 ? "bg-error/20 text-error" : "bg-amber-500/20 text-amber-400"}`}>
                              {item.daysLeft < 0 ? `LEWAT ${-item.daysLeft} HARI` : item.daysLeft === 0 ? "KADALUWARSA HARI INI" : `SISA ${item.daysLeft} HARI`}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-on-surface mt-1 truncate">{item.title}</h4>
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{item.description}</p>

                        {/* WhatsApp Message Preview Quote */}
                        <div className="mt-2 p-2.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/10 text-[11px] text-on-surface-variant font-mono whitespace-pre-wrap line-clamp-2">
                          💬 "{item.message}"
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch lg:self-auto shrink-0 justify-end">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.message);
                          alert("Teks WhatsApp telah disalin ke clipboard!");
                        }}
                        className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-outline hover:text-on-surface transition-colors"
                        title="Salin Teks"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>

                      <button
                        onClick={() => handleDispatchItem(item)}
                        className="flex-1 lg:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                      >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        <span>⚡ Kirim via WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REMINDER TRIGGERS & RULES */}
        {activeTab === "triggers" && settings && (
          <div className="mt-space-lg grid grid-cols-1 gap-space-lg max-w-4xl">
            {/* Rule 1: Pantry Expiry Reminder */}
            <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-space-md">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">kitchen</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">1. Pengingat Produk Dapur Mendekati Kedaluwarsa</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Peringatan otomatis sebelum bahan makanan & logistik dapur mencapai tanggal kedaluwarsanya.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.pantry_expiry_enabled}
                    onChange={(e) => setSettings({ ...settings, pantry_expiry_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {settings.pantry_expiry_enabled && (
                <div className="pt-space-sm border-t border-outline-variant/10 flex flex-col gap-space-sm">
                  <label className="text-xs font-semibold text-on-surface">
                    Ambang Batas Hari: Ingatkan sejak H-berapa hari sebelum kedaluwarsa?
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[1, 2, 3, 5, 7].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSettings({ ...settings, pantry_days_before: days })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          settings.pantry_days_before === days
                            ? "bg-emerald-500 text-white"
                            : "bg-surface-container-high hover:bg-surface-bright text-on-surface-variant"
                        }`}
                      >
                        H-{days} {days === 1 ? "(1 Hari Sebelumnya)" : days === 3 ? "(Standar H-3)" : days === 7 ? "(1 Minggu)" : `(${days} Hari)`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-outline">
                    💡 Bahan dengan sisa hari &le; <b>{settings.pantry_days_before} hari</b> akan otomatis dimasukkan ke antrean perhatian dan rekap harian WhatsApp.
                  </p>
                </div>
              )}
            </div>

            {/* Rule 2: Debt Due / Installment Reminder */}
            <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-space-md">
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">2. Pengingat Cicilan & Tagihan Jatuh Tempo (H-1)</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Peringatan untuk cicilan, utang kreditur, maupun tagihan piutang sebelum jatuh tempo agar tidak terkena denda.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.debt_due_enabled}
                    onChange={(e) => setSettings({ ...settings, debt_due_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {settings.debt_due_enabled && (
                <div className="pt-space-sm border-t border-outline-variant/10 flex flex-col gap-space-sm">
                  <label className="text-xs font-semibold text-on-surface">
                    Ambang Batas Hari: Ingatkan sejak H-berapa hari sebelum jatuh tempo?
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[1, 2, 3, 5].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSettings({ ...settings, debt_days_before: days })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          settings.debt_days_before === days
                            ? "bg-emerald-500 text-white"
                            : "bg-surface-container-high hover:bg-surface-bright text-on-surface-variant"
                        }`}
                      >
                        H-{days} {days === 1 ? "(H-1 Besok Bayar Cicilan)" : `(${days} Hari Sebelumnya)`}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between p-3 rounded-xl bg-surface-container-high/60">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">Sertakan Peringatan Lewat Jatuh Tempo (Overdue)</span>
                      <span className="text-[11px] text-on-surface-variant">Kirim peringatan tegas jika cicilan/tagihan belum dilunasi setelah tanggal tempo.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.debt_overdue_enabled}
                        onChange={(e) => setSettings({ ...settings, debt_overdue_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-error"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Rule 3: Pantry Low Stock */}
            <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-space-md">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">3. Pengingat Stok Bahan Dapur Kritis (Low Stock)</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Peringatan saat jumlah stok fisik di pantry/kulkas jatuh di bawah batas minimum kuantitas.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.pantry_low_stock_enabled}
                    onChange={(e) => setSettings({ ...settings, pantry_low_stock_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            {/* Rule 4: Radar Target Hit */}
            <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-space-md">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">radar</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">4. Sinyal Radar Belanja: Target Harga Tercapai</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Peringatan saat barang di wishlist pengadaan turun menyentuh atau berada di bawah harga patokan target.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.radar_target_enabled}
                    onChange={(e) => setSettings({ ...settings, radar_target_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>{saving ? "Menyimpan..." : "Simpan Aturan Pengingat"}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MESSAGE TEMPLATES & LIVE WHATSAPP CHAT PREVIEW */}
        {activeTab === "templates" && settings && (
          <div className="mt-space-lg grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            {/* Left: Template Editor (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-space-md">
              <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
                <div>
                  <h3 className="text-base font-bold text-on-surface">Editor Kustomisasi Template Pesan WhatsApp</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Pilih tipe pengingat untuk mengubah format kalimat yang dikirimkan. Sisipkan variabel dinamis dengan mengklik chip tombol.
                  </p>
                </div>

                {/* Template selector pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {templatesConfig.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setSelectedTemplateKey(t.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                        selectedTemplateKey === t.key
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-surface-container-high hover:bg-surface-bright text-on-surface-variant"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/10 text-xs text-on-surface-variant">
                  ℹ️ {currentTemplateObj.desc}
                </div>

                {/* Variable chips */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                    Klik untuk Menambahkan Variabel Dinamis:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {currentTemplateObj.variables.map((v) => (
                      <button
                        key={v.code}
                        type="button"
                        onClick={() => insertVariable(v.code)}
                        className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 text-on-surface text-[11px] font-mono border border-outline-variant/20 transition-all flex items-center gap-1"
                        title={`Sisipkan ${v.label}`}
                      >
                        <span className="text-emerald-400 font-bold">+</span>
                        <span>{v.code}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea Editor */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Format Pesan WhatsApp:</label>
                  <textarea
                    rows={6}
                    value={settings[selectedTemplateKey] || ""}
                    onChange={(e) => setSettings({ ...settings, [selectedTemplateKey]: e.target.value })}
                    className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-3 text-xs text-on-surface font-mono focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
                    placeholder="Tulis format pesan WhatsApp..."
                  />
                  <span className="text-[10px] text-outline">
                    Gunakan <b>*teks*</b> untuk tebal, <i>_teks_</i> untuk miring, dan emotikon WhatsApp.
                  </span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Simpan Template</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Realistic WhatsApp Smartphone Mockup (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[340px] rounded-[36px] bg-[#121b22] border-[8px] border-[#202c33] shadow-2xl overflow-hidden flex flex-col h-[520px]">
                {/* Smartphone Status Bar */}
                <div className="h-6 bg-[#1f2c34] px-4 flex items-center justify-between text-[10px] text-gray-300 font-medium">
                  <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">wifi</span>
                    <span className="material-symbols-outlined text-[12px]">battery_full</span>
                  </div>
                </div>

                {/* WhatsApp Chat Header */}
                <div className="bg-[#1f2c34] px-3 py-2 flex items-center justify-between border-b border-[#2a3942]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-100 leading-none">OmniLife Bot</span>
                      <span className="text-[9px] text-emerald-400 mt-0.5">Online • Pengingat Aktif</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="material-symbols-outlined text-[18px]">videocam</span>
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                  </div>
                </div>

                {/* WhatsApp Chat Wallpaper / Messages Body */}
                <div
                  className="flex-1 p-3 overflow-y-auto flex flex-col justify-end gap-2"
                  style={{
                    backgroundColor: "#0b141a",
                    backgroundImage: "radial-gradient(#1f2c34 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                  }}
                >
                  {/* Encrypted notice */}
                  <div className="self-center bg-[#182229] text-[#8696a0] text-[9px] px-3 py-1 rounded-md text-center shadow-sm max-w-[240px]">
                    🔒 Pesan dan panggilan terenkripsi secara end-to-end.
                  </div>

                  {/* WhatsApp Received Message Bubble */}
                  <div className="self-start max-w-[90%] bg-[#005c4b] text-gray-100 rounded-2xl rounded-tl-sm p-3 shadow-md relative text-xs leading-relaxed">
                    <div
                      className="break-words"
                      dangerouslySetInnerHTML={{ __html: formatWhatsAppText(getRenderedPreview()) }}
                    />
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-emerald-200/70">
                      <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-cyan-300 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Input Footer */}
                <div className="bg-[#1f2c34] p-2 flex items-center gap-2 border-t border-[#2a3942]">
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">sentiment_satisfied</span>
                  <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 text-[11px] text-gray-400">
                    Ketik pesan...
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-outline mt-2 font-medium">
                Live Interactive WhatsApp Smartphone Mockup
              </span>
            </div>
          </div>
        )}

        {/* TAB 4: CONFIGURATION & GATEWAY */}
        {activeTab === "config" && settings && (
          <div className="mt-space-lg grid grid-cols-1 lg:grid-cols-12 gap-space-lg max-w-5xl">
            {/* Left: Phone & Provider Configuration (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-space-md">
              <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
                <div>
                  <h3 className="text-base font-bold text-on-surface">Konfigurasi Pengiriman & Nomor WhatsApp</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Tentukan nomor WhatsApp tujuan dan pilih apakah ingin menggunakan tautan resmi wa.me (gratis) atau gateway otomatis.
                  </p>
                </div>

                {/* Phone Number Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Nomor WhatsApp Penerima Notifikasi *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline font-bold text-xs">
                      ID +62
                    </span>
                    <input
                      type="text"
                      value={settings.phone_number}
                      onChange={(e) => {
                        setSettings({ ...settings, phone_number: e.target.value });
                        setTestPhone(e.target.value);
                      }}
                      placeholder="81234567890 atau 0812..."
                      className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant/30 py-2.5 pl-16 pr-4 text-xs text-on-surface font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-outline">
                    Format otomatis dinormalisasi ke standar internasional (contoh: 081234567890 menjadi 6281234567890).
                  </span>
                </div>

                {/* Reminder Time */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Jadwal Jam Pengingat Harian</label>
                  <input
                    type="time"
                    value={settings.reminder_time || "08:00"}
                    onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                    className="w-40 rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-outline">
                    Waktu pengiriman rekap harian rekomendasi (misal pukul 08:00 pagi sebelum beraktivitas).
                  </span>
                </div>

                {/* Delivery Provider Options */}
                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
                  <label className="text-xs font-bold text-on-surface">Metode Pengiriman:</label>

                  {/* Option 1: Direct Link */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    settings.provider === "wa_me"
                      ? "bg-emerald-500/10 border-emerald-500 text-on-surface"
                      : "bg-surface-container-high/60 border-outline-variant/20 text-on-surface-variant hover:bg-surface-bright"
                  }`}>
                    <input
                      type="radio"
                      name="provider"
                      value="wa_me"
                      checked={settings.provider === "wa_me"}
                      onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                      className="mt-0.5 text-emerald-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-on-surface">Direct 1-Click WhatsApp (wa.me)</span>
                        <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          Gratis & Resmi
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant mt-0.5">
                        Membuka langsung aplikasi WhatsApp Web atau mobile dengan pesan yang sudah terisi otomatis. Tidak memerlukan biaya server pihak ketiga atau langganan API berbayar.
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Fonnte */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    settings.provider === "fonnte"
                      ? "bg-emerald-500/10 border-emerald-500 text-on-surface"
                      : "bg-surface-container-high/60 border-outline-variant/20 text-on-surface-variant hover:bg-surface-bright"
                  }`}>
                    <input
                      type="radio"
                      name="provider"
                      value="fonnte"
                      checked={settings.provider === "fonnte"}
                      onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                      className="mt-0.5 text-emerald-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">Fonnte API Gateway (Latar Belakang)</span>
                      <span className="text-[11px] text-on-surface-variant mt-0.5">
                        Mengirim pesan WhatsApp secara otomatis di server background menggunakan Fonnte Device Token.
                      </span>
                    </div>
                  </label>

                  {/* Option 3: Wablas */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    settings.provider === "wablas"
                      ? "bg-emerald-500/10 border-emerald-500 text-on-surface"
                      : "bg-surface-container-high/60 border-outline-variant/20 text-on-surface-variant hover:bg-surface-bright"
                  }`}>
                    <input
                      type="radio"
                      name="provider"
                      value="wablas"
                      checked={settings.provider === "wablas"}
                      onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                      className="mt-0.5 text-emerald-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">Wablas Gateway API</span>
                      <span className="text-[11px] text-on-surface-variant mt-0.5">
                        Integrasi pengiriman pesan otomatis melalui layanan Wablas API.
                      </span>
                    </div>
                  </label>

                  {/* Option 4: Custom Gateway */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    settings.provider === "custom_gateway"
                      ? "bg-emerald-500/10 border-emerald-500 text-on-surface"
                      : "bg-surface-container-high/60 border-outline-variant/20 text-on-surface-variant hover:bg-surface-bright"
                  }`}>
                    <input
                      type="radio"
                      name="provider"
                      value="custom_gateway"
                      checked={settings.provider === "custom_gateway"}
                      onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                      className="mt-0.5 text-emerald-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">Custom Webhook / HTTP Gateway API</span>
                      <span className="text-[11px] text-on-surface-variant mt-0.5">
                        Gunakan gateway mandiri seperti Baileys, Go-WhatsApp, atau endpoint webhook khusus perusahaan.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Gateway credentials if provider is not wa_me */}
                {settings.provider !== "wa_me" && (
                  <div className="p-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/20 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface">API Key / Token Gateway</label>
                      <input
                        type="password"
                        value={settings.api_key}
                        onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                        placeholder="Masukkan token API..."
                        className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2.5 text-xs text-on-surface focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {(settings.provider === "wablas" || settings.provider === "custom_gateway") && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-on-surface">Endpoint URL Gateway</label>
                        <input
                          type="text"
                          value={settings.gateway_url}
                          onChange={(e) => setSettings({ ...settings, gateway_url: e.target.value })}
                          placeholder="https://api.yourdomain.com/send-wa"
                          className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2.5 text-xs text-on-surface focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Live Test Send Card (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-space-md">
              <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">science</span>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Uji Coba Pengiriman Langsung</h3>
                    <p className="text-[11px] text-on-surface-variant">Tes verifikasi koneksi ke nomor WhatsApp Anda</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Nomor Uji Coba</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2.5 text-xs text-on-surface font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Pesan Uji Coba</label>
                  <textarea
                    rows={3}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Halo! Ini pesan tes pengingat dari OmniLife Nexus..."
                    className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2.5 text-xs text-on-surface focus:outline-none focus:border-emerald-500 resize-none font-mono text-[11px]"
                  />
                </div>

                <button
                  onClick={handleTestSend}
                  disabled={testSending}
                  className="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-emerald-500 text-on-surface hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 border border-outline-variant/20 shadow-sm"
                >
                  <span className={`material-symbols-outlined text-[18px] ${testSending ? "animate-spin" : ""}`}>
                    {testSending ? "sync" : "send"}
                  </span>
                  <span>{testSending ? "Memproses Uji Coba..." : "Kirim Pesan Uji Coba"}</span>
                </button>

                {testResult && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex flex-col gap-1">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Uji coba berhasil diproses ({testResult.status})!
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Target: {testResult.phone}
                    </span>
                    {testResult.wa_link && (
                      <a
                        href={testResult.wa_link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 text-emerald-400 underline font-semibold flex items-center gap-1"
                      >
                        <span>Buka Tautan Uji Coba WhatsApp</span>
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Webhook Cron Trigger Guide Card for Render / cron-job.org */}
              <div className="rounded-2xl bg-surface-container p-space-md lg:p-space-lg shadow-md border border-emerald-500/20 flex flex-col gap-space-md">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Webhook Cron Trigger (Render Deploy)</h3>
                    <p className="text-[11px] text-on-surface-variant">URL pemicu otomatis harian untuk Render / cron-job.org</p>
                  </div>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Daftarkan URL di bawah ke layanan penjadwal gratis seperti <b>cron-job.org</b> atau fitur <b>Render Cron Job</b> agar scanner kedaluwarsa & cicilan H-1 berjalan otomatis setiap hari tanpa perlu membuka browser.
                </p>

                {/* Webhook URL Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-outline uppercase tracking-wider">URL Webhook Cron (GET/POST)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/api/v1/whatsapp/cron-trigger?secret=omnilife_cron_secret_2026`}
                      className="flex-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2 text-[11px] text-emerald-400 font-mono truncate select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/v1/whatsapp/cron-trigger?secret=omnilife_cron_secret_2026`);
                        setCopiedCronUrl(true);
                        setTimeout(() => setCopiedCronUrl(false), 2500);
                      }}
                      className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface transition-colors shrink-0"
                    >
                      {copiedCronUrl ? "Tersalin!" : "Salin URL"}
                    </button>
                  </div>
                </div>

                {/* Secret Key Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Secret Key Pengaman (Header: X-Cron-Secret)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value="omnilife_cron_secret_2026"
                      className="flex-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-2 text-[11px] text-on-surface font-mono select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("omnilife_cron_secret_2026");
                        setCopiedCronSecret(true);
                        setTimeout(() => setCopiedCronSecret(false), 2500);
                      }}
                      className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface transition-colors shrink-0"
                    >
                      {copiedCronSecret ? "Tersalin!" : "Salin Key"}
                    </button>
                  </div>
                  <span className="text-[10px] text-outline">
                    Dapat dikustomisasi via environment variable <code className="text-secondary font-mono">CRON_SECRET</code> di Render.
                  </span>
                </div>

                {/* Execution Button */}
                <button
                  type="button"
                  onClick={() => handleRunCronTest(true)}
                  disabled={cronExecuting}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className={`material-symbols-outlined text-[18px] ${cronExecuting ? "animate-spin" : ""}`}>
                    {cronExecuting ? "sync" : "bolt"}
                  </span>
                  <span>{cronExecuting ? "Sedang Memindai Semua Data..." : "⚡ Eksekusi Cron Test Sekarang"}</span>
                </button>

                {/* Cron Report Card */}
                {cronReport && (
                  <div className="p-3 rounded-xl bg-surface-container-high border border-emerald-500/30 text-xs flex flex-col gap-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">task_alt</span>
                      Laporan Eksekusi Cron Scanner
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-surface-container-lowest">
                        <span className="text-outline block">Akun Dipindai:</span>
                        <b className="text-on-surface">{cronReport.users_scanned || 0} user</b>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-container-lowest">
                        <span className="text-outline block">Perhatian Ditemukan:</span>
                        <b className="text-on-surface">{cronReport.total_alerts || 0} alert</b>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-container-lowest">
                        <span className="text-outline block">Pesan Diblast:</span>
                        <b className="text-emerald-400">{cronReport.users_blasted || 0} terkirim</b>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-container-lowest">
                        <span className="text-outline block">Dilewati (Anti-Spam):</span>
                        <b className="text-outline">{cronReport.users_skipped || 0} akun</b>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: REMINDER LOGS */}
        {activeTab === "logs" && (
          <div className="mt-space-lg flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm">
              <div>
                <h3 className="text-base font-bold text-on-surface">Riwayat & Log Pengiriman Pengingat</h3>
                <p className="text-xs text-on-surface-variant">Catatan pengiriman pesan WhatsApp dan pembukaan tautan penagihan.</p>
              </div>
              <button
                onClick={loadLogs}
                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Segarkan</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="rounded-2xl bg-surface-container p-space-xl flex flex-col items-center justify-center text-center shadow-md border border-outline-variant/10 min-h-[250px]">
                <span className="material-symbols-outlined text-outline text-[40px] mb-2">history</span>
                <h4 className="text-sm font-bold text-on-surface">Belum Ada Riwayat Log Pengiriman</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Setiap kali pengingat WhatsApp dikirim atau tautan dibuka, catatannya akan otomatis tersimpan di sini.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-surface-container shadow-md border border-outline-variant/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-container-high/60 border-b border-outline-variant/20 text-outline uppercase font-bold text-[10px]">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Tipe Pengingat</th>
                        <th className="py-3 px-4">Judul / Subjek</th>
                        <th className="py-3 px-4">Nomor Tujuan</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-outline font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 px-4 font-semibold uppercase text-[10px]">
                            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                              {log.reminder_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold max-w-xs truncate">
                            {log.title}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                            {log.recipient_phone}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === "sent"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : log.status === "link_generated"
                                ? "bg-secondary/20 text-secondary"
                                : "bg-error/20 text-error"
                            }`}>
                              {log.status === "sent" ? "Terkirim" : log.status === "link_generated" ? "Link Dibuka" : "Gagal"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
