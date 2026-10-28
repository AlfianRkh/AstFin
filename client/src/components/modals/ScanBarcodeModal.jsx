import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function ScanBarcodeModal({
  isOpen,
  onClose,
  onScan,
  title = "Pindai Barcode Produk",
  description = "Arahkan kamera ke barcode produk (EAN, UPC, Code128) atau unggah foto barcode.",
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [facingMode, setFacingMode] = useState("environment"); // environment | user
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isStoppingRef = useRef(false);

  // Play audio beep on successful scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext may be restricted by autoplay policy
    }
  };

  const handleSuccessfulScan = (decodedText) => {
    playBeep();
    stopScanner().then(() => {
      onScan(decodedText.trim());
      onClose();
    });
  };

  const startScanner = async () => {
    setErrorMessage("");
    const elementId = "barcode-scanner-viewport";

    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.333333,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame scan error - ignore to keep loop active
        }
      );

      setCameraActive(true);
    } catch (err) {
      console.warn("Camera start failed:", err);
      setCameraActive(false);
      setErrorMessage(
        err?.message || "Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan opsi Unggah Foto."
      );
    }
  };

  const stopScanner = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (err) {
      console.warn("Error stopping scanner:", err);
    } finally {
      isStoppingRef.current = false;
      setCameraActive(false);
    }
  };

  // Toggle camera front/back
  const toggleFacingMode = async () => {
    await stopScanner();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Handle barcode scanning from uploaded image file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage("");

    try {
      const html5QrCode = new Html5Qrcode("barcode-scanner-file-temp");
      const result = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();

      if (result) {
        handleSuccessfulScan(result);
      } else {
        setErrorMessage("Barcode tidak terdeteksi pada gambar. Coba ambil foto lebih jelas.");
      }
    } catch (err) {
      setErrorMessage("Tidak dapat menemukan barcode pada foto ini: " + (err?.message || "Coba foto lebih dekat dan terang"));
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle manual code submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playBeep();
    stopScanner().then(() => {
      onScan(manualCode.trim());
      onClose();
    });
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMessage("");
      setManualCode("");
      // Small delay to ensure modal DOM is mounted
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-on-surface">{title}</h3>
              <p className="text-[11px] text-outline-variant line-clamp-1">{description}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner().then(onClose);
            }}
            className="p-1.5 rounded-full hover:bg-surface-container text-outline-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scanner Viewport Container */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-outline-variant/20 shadow-inner">
            {/* Viewport Div for html5-qrcode */}
            <div id="barcode-scanner-viewport" className="w-full h-full" />
            <div id="barcode-scanner-file-temp" className="hidden" />

            {/* Reticle / Target Box Overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-36 border-2 border-primary/80 rounded-2xl relative shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
                  {/* Corners */}
                  <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr" />
                  <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br" />

                  {/* Red / Primary Laser Animation Line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                </div>
                <div className="absolute bottom-3 text-center px-4 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-white/90">
                  Arahkan barcode ke kotak di atas
                </div>
              </div>
            )}

            {/* Error or Permission fallback */}
            {!cameraActive && (
              <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-surface-container-high/90 text-on-surface space-y-3">
                <span className="material-symbols-outlined text-4xl text-outline-variant">
                  no_photography
                </span>
                <p className="text-xs text-outline-variant max-w-xs">
                  {errorMessage || "Memulai kamera pemindai..."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={startScanner}
                    className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Coba Lagi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-surface-container-highest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-xl hover:border-primary transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">image</span>
                    <span>Unggah Foto</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Controls below camera */}
          <div className="flex items-center justify-between gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="flex-1 py-2 px-3 bg-surface-container-high border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface hover:border-primary/50 flex items-center justify-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">add_photo_alternate</span>
              <span>{isProcessingFile ? "Membaca..." : "Pindai dari Foto"}</span>
            </button>

            {cameraActive && (
              <button
                type="button"
                onClick={toggleFacingMode}
                className="py-2 px-3 bg-surface-container-high border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface hover:border-primary/50 flex items-center justify-center gap-1.5 transition-all"
                title="Ganti Kamera Depan/Belakang"
              >
                <span className="material-symbols-outlined text-[16px]">cameraswitch</span>
                <span className="hidden sm:inline">Kamera</span>
              </button>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div className="pt-2 border-t border-outline-variant/15">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Atau ketik angka barcode (misal 899...)"
                className="flex-1 bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                Pilih
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
