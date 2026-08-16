import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Inventory } from "./pages/Inventory";
import { GoodsManage } from "./pages/GoodsManage";
import { Shipments } from "./pages/Shipments";
import { Restocks } from "./pages/Restocks";
import { History } from "./pages/History";

function AdminOnly({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute allow={["admin", "manager"]} />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Inventory />} />
              <Route
                path="/goods"
                element={
                  <AdminOnly>
                    <GoodsManage />
                  </AdminOnly>
                }
              />
              <Route path="/shipments" element={<Shipments />} />
              <Route path="/restocks" element={<Restocks />} />
              <Route path="/history" element={<History />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
