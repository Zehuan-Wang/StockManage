import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../lib/types";
import { supabaseConfigured } from "../lib/supabase";

export function ProtectedRoute({ allow }: { allow?: Role[] }) {
  const { loading, session, role, signOut } = useAuth();
  const location = useLocation();

  if (!supabaseConfigured) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="grid min-h-svh place-items-center bg-paper text-muted">
        正在验证登录状态…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!role || (allow && !allow.includes(role))) {
    return (
      <div className="grid min-h-svh place-items-center bg-paper px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-ink">无权访问</h1>
          <p className="mt-2 text-sm text-muted">当前账号不在 public.admins 中，或 role 不是 admin / manager。</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-pine px-4 py-2 text-sm text-white"
          >
            退出并重新登录
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
