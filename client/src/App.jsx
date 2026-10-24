import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";

// Pages
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { FinansialKas } from "./pages/FinansialKas";
import { PengadaanRadar } from "./pages/PengadaanRadar";
import { DapurInventaris } from "./pages/DapurInventaris";
import { UserManagement } from "./pages/UserManagement";

// Modals
import { ScanReceiptModal } from "./components/modals/ScanReceiptModal";
import { AddWalletModal } from "./components/modals/AddWalletModal";
import { AddTransactionModal } from "./components/modals/AddTransactionModal";
import { AddDebtModal } from "./components/modals/AddDebtModal";
import { RecordPaymentModal } from "./components/modals/RecordPaymentModal";
import { AddRadarModal } from "./components/modals/AddRadarModal";
import { AddPantryModal } from "./components/modals/AddPantryModal";
import { AddEnvelopeModal } from "./components/modals/AddEnvelopeModal";

function MainLayout() {
  const { user } = useAuth();
  const [modalScan, setModalScan] = useState(false);
  const [modalWallet, setModalWallet] = useState(false);
  const [initialWalletCategory, setInitialWalletCategory] = useState("cash");
  const [modalTransaction, setModalTransaction] = useState(false);
  const [initialTransactionData, setInitialTransactionData] = useState(null);
  const [modalDebt, setModalDebt] = useState(false);
  const [initialDebtData, setInitialDebtData] = useState(null);
  const [modalPayment, setModalPayment] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState(null);
  const [modalRadar, setModalRadar] = useState(false);
  const [modalPantry, setModalPantry] = useState(false);
  const [modalEnvelope, setModalEnvelope] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const handleOpenWallet = (category = "cash") => {
    setInitialWalletCategory(category);
    setModalWallet(true);
  };

  const handleOpenTransaction = (initialData = null) => {
    setInitialTransactionData(initialData);
    setModalTransaction(true);
  };

  const handleOpenDebt = (initialData = null) => {
    setInitialDebtData(initialData);
    setModalDebt(true);
  };

  const [initialRadarData, setInitialRadarData] = useState(null);

  const handleOpenRadar = (initialData = null) => {
    setInitialRadarData(initialData);
    setModalRadar(true);
  };

  const handleOpenPayment = (debt) => {
    setSelectedDebtForPayment(debt);
    setModalPayment(true);
  };

  return (
    <div className="flex min-h-screen bg-background font-sans text-on-surface antialiased">
      <Sidebar />
      <div className="pl-72 flex-1 flex flex-col min-w-0">
        <Header onScanClick={() => setModalScan(true)} />
        <main className="relative pt-16 bg-surface min-h-screen pb-12">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  key={refreshKey}
                  onOpenScan={() => setModalScan(true)}
                  onOpenTransaction={handleOpenTransaction}
                  onOpenDebt={handleOpenDebt}
                  onOpenRadar={() => setModalRadar(true)}
                  onOpenPantry={() => setModalPantry(true)}
                />
              }
            />
            <Route
              path="/finansial-kas"
              element={
                <FinansialKas
                  key={refreshKey}
                  onOpenScan={() => setModalScan(true)}
                  onOpenTransaction={handleOpenTransaction}
                  onOpenDebt={handleOpenDebt}
                  onOpenWallet={handleOpenWallet}
                  onOpenEnvelope={() => setModalEnvelope(true)}
                  onRecordPayment={handleOpenPayment}
                />
              }
            />
            <Route
              path="/pengadaan-radar"
              element={
                <PengadaanRadar
                  key={refreshKey}
                  onOpenAddRadar={handleOpenRadar}
                  onOpenTransaction={handleOpenTransaction}
                />
              }
            />
            <Route
              path="/dapur-inventaris"
              element={
                <DapurInventaris
                  key={refreshKey}
                  onOpenAddPantry={() => setModalPantry(true)}
                  onOpenScan={() => setModalScan(true)}
                />
              }
            />
            <Route
              path="/ai-insights"
              element={
                <Dashboard
                  key={refreshKey}
                  onOpenScan={() => setModalScan(true)}
                  onOpenTransaction={handleOpenTransaction}
                  onOpenDebt={handleOpenDebt}
                  onOpenRadar={() => setModalRadar(true)}
                  onOpenPantry={() => setModalPantry(true)}
                />
              }
            />
            <Route
              path="/pengaturan-kalibrasi"
              element={
                <PengadaanRadar
                  key={refreshKey}
                  onOpenAddRadar={() => setModalRadar(true)}
                  onOpenTransaction={handleOpenTransaction}
                />
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UserManagement key={refreshKey} />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global Modals */}
      <ScanReceiptModal
        isOpen={modalScan}
        onClose={() => setModalScan(false)}
        onSuccess={triggerRefresh}
      />
      <AddWalletModal
        isOpen={modalWallet}
        initialCategory={initialWalletCategory}
        onClose={() => setModalWallet(false)}
        onSuccess={triggerRefresh}
      />
      <AddTransactionModal
        key={`tx-${refreshKey}`}
        isOpen={modalTransaction}
        initialData={initialTransactionData}
        onOpenWallet={() => setModalWallet(true)}
        onClose={() => {
          setModalTransaction(false);
          setInitialTransactionData(null);
        }}
        onSuccess={triggerRefresh}
      />
      <AddDebtModal
        key={`debt-${refreshKey}`}
        isOpen={modalDebt}
        initialData={initialDebtData}
        onOpenWallet={() => setModalWallet(true)}
        onClose={() => {
          setModalDebt(false);
          setInitialDebtData(null);
        }}
        onSuccess={triggerRefresh}
      />
      <RecordPaymentModal
        isOpen={modalPayment}
        initialDebt={selectedDebtForPayment}
        onClose={() => {
          setModalPayment(false);
          setSelectedDebtForPayment(null);
        }}
        onSuccess={triggerRefresh}
      />
      <AddRadarModal
        isOpen={modalRadar}
        initialData={initialRadarData}
        onClose={() => {
          setModalRadar(false);
          setInitialRadarData(null);
        }}
        onSuccess={triggerRefresh}
      />
      <AddPantryModal
        isOpen={modalPantry}
        onClose={() => setModalPantry(false)}
        onSuccess={triggerRefresh}
      />
      <AddEnvelopeModal
        isOpen={modalEnvelope}
        onClose={() => setModalEnvelope(false)}
        onSuccess={triggerRefresh}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
