import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PublicReportPage } from "./pages/PublicReportPage";
import { TransparansiPage } from "./pages/TransparansiPage";
import { PublicReportDetailPage } from "./pages/PublicReportDetailPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { CreateUserPage } from "./pages/admin/CreateUserPage";
import { StaffListPage } from "./pages/admin/StaffListPage";
import { MeDashboard } from "./pages/me/MeDashboard";
import { MeTasksPage } from "./pages/me/MeTasksPage";
import { SupportDashboard } from "./pages/support/SupportDashboard";
import { ReportDetailPage } from "./pages/support/ReportDetailPage";

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/lapor" element={<PublicReportPage />} />
            <Route path="/laporan/transparansi" element={<TransparansiPage />} />
            <Route path="/laporan/transparansi/:id" element={<PublicReportDetailPage />} />

            {/* Admin Protected Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="create-user" element={<CreateUserPage />} />
              <Route path="staff" element={<StaffListPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
            </Route>

            {/* ME Protected Routes */}
            <Route
              path="/me"
              element={
                <ProtectedRoute allowedRoles={["ME"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MeDashboard />} />
              <Route path="tasks" element={<MeTasksPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
            </Route>

            {/* Support Protected Routes */}
            <Route
              path="/support"
              element={
                <ProtectedRoute allowedRoles={["SUPPORT"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SupportDashboard />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
