import { cn } from "../../lib/utils";

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === tab
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:bg-white/80",
          )}
          type="button"
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
