import type { PropsWithChildren } from "react";
import { PanelLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[#f2f5fb]">
      <div className="mx-auto flex min-h-screen max-w-[1880px]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="h-[58px] border-b border-slate-200 bg-white px-6">
            <div className="flex h-full items-center text-slate-700">
              <PanelLeft size={17} />
            </div>
          </header>
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
