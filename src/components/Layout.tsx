import { NavLink, Outlet } from "react-router-dom";
import { Boxes, History, LogOut, PackagePlus, Truck, Warehouse } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../lib/role";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
    isActive ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
  }`;

export function Layout() {
  const { user, role, signOut } = useAuth();

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-paper lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="shrink-0 overflow-x-auto bg-pine-dark text-white lg:overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <div>
            <p className="text-[0.6875rem] tracking-[0.22em] text-white/50 uppercase">Stock</p>
            <h1 className="text-lg font-semibold">存货管理</h1>
          </div>
          <p className="hidden text-xs text-white/55 lg:mt-6 lg:block">
            {user?.email}
            <span className="mt-1 block text-white/80">{roleLabel(role)}</span>
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3">
          <NavLink to="/" end className={linkClass}>
            <Boxes size={32} />
            存货总览
          </NavLink>
          {role === "admin" && (
            <NavLink to="/goods" className={linkClass}>
              <PackagePlus size={32} />
              商品管理
            </NavLink>
          )}
          <NavLink to="/shipments" className={linkClass}>
            <Truck size={32} />
            发货记录
          </NavLink>
          <NavLink to="/restocks" className={linkClass}>
            <Warehouse size={32} />
            补货记录
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <History size={32} />
            历史流水
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/8 hover:text-white lg:mt-6"
          >
            <LogOut size={32} />
            退出登录
          </button>
        </nav>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
