import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FilePenLine,
  FolderOpen,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { DashboardApi } from "../lib/api";
import type { DashboardData } from "../types";

const summaryCards: Array<{
  key: keyof DashboardData["summary"];
  label: string;
  icon: typeof FolderOpen;
  color: string;
  bg: string;
}> = [
  {
    key: "total_open_series",
    label: "Open Series",
    icon: FolderOpen,
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  {
    key: "total_pending_approval",
    label: "Pending Approval",
    icon: Clock3,
    color: "text-amber-700",
    bg: "bg-amber-100",
  },
  {
    key: "total_overdue",
    label: "Overdue",
    icon: AlertTriangle,
    color: "text-red-700",
    bg: "bg-red-100",
  },
  {
    key: "total_awaiting_external_response",
    label: "Awaiting Response",
    icon: ExternalLink,
    color: "text-violet-700",
    bg: "bg-violet-100",
  },
  {
    key: "total_drafts_in_progress",
    label: "Drafts In Progress",
    icon: FilePenLine,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
  },
  {
    key: "recently_closed",
    label: "Recently Closed",
    icon: CheckCircle2,
    color: "text-green-700",
    bg: "bg-green-100",
  },
];

export function DashboardPage() {
  const cachedData = DashboardApi.peek({ include_activity: true }) ?? null;
  const [data, setData] = useState<DashboardData | null>(cachedData);
  const [isLoading, setIsLoading] = useState(!cachedData);

  useEffect(() => {
    let isActive = true;
    async function load() {
      try {
        const response = await DashboardApi.get({ include_activity: true });
        if (isActive) {
          setData(response);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      isActive = false;
    };
  }, []);

  const sortedCategoryCards = useMemo(() => {
    return [...(data?.categories ?? [])].sort((a, b) => a.category_name.localeCompare(b.category_name));
  }, [data?.categories]);

  if (isLoading) {
    return <p className="text-slate-600">Loading dashboard...</p>;
  }
  if (!data) {
    return <p className="text-red-600">Dashboard data unavailable.</p>;
  }

  return (
    <div className="space-y-6">
      <Header title="Dashboard" subtitle="Correspondence overview and activity" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} className="space-y-3">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{card.label}</p>
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="text-3xl font-semibold text-[#0f172a]">{data.summary[card.key]}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-9">
          <h3 className="font-heading text-3xl font-bold text-[#0f172a]">By Category</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedCategoryCards.map((category) => (
              <Card key={category.category_id}>
                <h4 className="font-heading text-2xl font-bold text-[#0f172a]">{category.category_name}</h4>
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="flex items-center justify-between text-slate-700">
                    <span>Open</span>
                    <span className="font-semibold text-[#0f172a]">{category.open_series}</span>
                  </p>
                  <p className="flex items-center justify-between text-slate-700">
                    <span>Pending Draft</span>
                    <span className="font-semibold text-[#0f172a]">{category.pending_draft}</span>
                  </p>
                  <p className="flex items-center justify-between text-slate-700">
                    <span>Pending Approval</span>
                    <span className="font-semibold text-[#0f172a]">{category.pending_approval}</span>
                  </p>
                  <p className="flex items-center justify-between text-slate-700">
                    <span>Awaiting Resp.</span>
                    <span className="font-semibold text-[#0f172a]">{category.awaiting_external_response}</span>
                  </p>
                  <p className="flex items-center justify-between text-slate-700">
                    <span>Overdue</span>
                    <span className="font-semibold text-red-600">{category.overdue_items}</span>
                  </p>
                  <p className="flex items-center justify-between text-slate-700">
                    <span>Closed (month)</span>
                    <span className="font-semibold text-[#0f172a]">{category.closed_this_month}</span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="xl:col-span-3">
          <h3 className="font-heading text-3xl font-bold text-[#0f172a]">Recent Activity</h3>
          <div className="mt-4 space-y-2">
            {data.recent_activity.length ? (
              data.recent_activity.map((entry) => (
                <Card key={`${entry.timestamp}-${entry.entity_id ?? entry.action}`} className="px-4 py-3">
                  <p className="text-sm text-[#0f172a]">
                    {entry.action.replaceAll(".", " ")} {entry.entity_id ? `(${entry.entity_id})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                </Card>
              ))
            ) : (
              <Card>
                <p className="text-sm text-slate-500">No recent activity available.</p>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
