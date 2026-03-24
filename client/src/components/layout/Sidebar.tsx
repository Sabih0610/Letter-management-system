import {
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Mail,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/series", label: "Series", icon: FolderOpen },
  { to: "/search", label: "Search", icon: Search },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex min-h-screen w-[280px] flex-col border-r border-[#253152] bg-[#18233f] text-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/90 shadow-sm">
          <Mail size={20} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold leading-tight">CSMS</h1>
          <p className="text-xs text-slate-300">Correspondence Manager</p>
        </div>
      </div>
      <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Navigation</p>
      <nav className="flex-1 space-y-1 px-3 pb-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                isActive ? "bg-[#2a3759] text-white" : "text-slate-200 hover:bg-[#233354]",
              )
            }
          >
            <link.icon size={16} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-[#253152] p-4">
        <div className="rounded-xl bg-[#223254] px-4 py-3">
          <p className="text-sm font-semibold">{user?.full_name}</p>
          <p className="text-xs text-slate-300">{user?.role?.name}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-500/80 px-3 py-2 text-sm hover:bg-[#233354]"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
  );
}
