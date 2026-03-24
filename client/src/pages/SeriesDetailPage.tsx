import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleX,
  Hash,
  Paperclip,
  Plus,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { MetaApi, SeriesApi } from "../lib/api";
import type { Category, CorrespondenceItem, Series } from "../types";

const statusStyles: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  awaiting_internal_draft: "bg-amber-100 text-amber-700",
  awaiting_approval: "bg-violet-100 text-violet-700",
  awaiting_external_response: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

export function SeriesDetailPage() {
  const { seriesId = "" } = useParams();
  const cachedSeries = seriesId ? SeriesApi.peek(seriesId) ?? null : null;
  const cachedItems = seriesId ? SeriesApi.peekItems(seriesId) : undefined;
  const cachedCategories = MetaApi.peekCategories() ?? [];
  const [series, setSeries] = useState<Series | null>(cachedSeries);
  const [items, setItems] = useState<CorrespondenceItem[]>(cachedItems?.items ?? []);
  const [categories, setCategories] = useState<Category[]>(cachedCategories);
  const [isLoading, setIsLoading] = useState(() => !(cachedSeries && cachedItems));
  const [isClosing, setIsClosing] = useState(false);

  async function load(showLoader: boolean) {
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const [seriesRes, itemsRes, categoriesRes] = await Promise.all([
        SeriesApi.get(seriesId),
        SeriesApi.items(seriesId),
        MetaApi.categories(),
      ]);
      setSeries(seriesRes);
      setItems(itemsRes.items);
      setCategories(categoriesRes);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (seriesId) {
      const localSeries = SeriesApi.peek(seriesId);
      const localItems = SeriesApi.peekItems(seriesId);
      const localCategories = MetaApi.peekCategories();
      if (localSeries) {
        setSeries(localSeries);
      }
      if (localItems) {
        setItems(localItems.items);
      }
      if (localCategories) {
        setCategories(localCategories);
      }
      void load(!(localSeries && localItems));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  const categoryName = useMemo(
    () => categories.find((category) => category.id === series?.category_id)?.name ?? "Category",
    [categories, series?.category_id],
  );

  async function closeSeries() {
    if (!seriesId) return;
    setIsClosing(true);
    try {
      await SeriesApi.close(seriesId);
      await load(true);
    } finally {
      setIsClosing(false);
    }
  }

  if (isLoading) {
    return <p className="text-slate-600">Loading series detail...</p>;
  }
  if (!series) {
    return <p className="text-red-600">Series not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link to="/series" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f3a78] hover:underline">
        <ArrowLeft size={16} />
        Back to Series
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-4xl font-bold text-[#0f172a]">{series.subject}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{series.series_number}</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  statusStyles[series.status] || "bg-slate-100 text-slate-700"
                }`}
              >
                {series.status.replaceAll("_", " ")}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  priorityStyles[series.priority] || "bg-slate-100 text-slate-700"
                }`}
              >
                {series.priority}
              </span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">{categoryName}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/incoming?seriesId=${series.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Plus size={16} />
              Add Incoming
            </Link>
            <Link
              to={`/outgoing?seriesId=${series.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#24448f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f3a78]"
            >
              <ArrowUpRight size={16} />
              Add Outgoing
            </Link>
            <button
              type="button"
              onClick={closeSeries}
              disabled={isClosing || series.status === "closed"}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <CircleX size={16} />
              Close
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-start gap-2 text-slate-700">
              <Building2 size={18} className="mt-1 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Organization</p>
                <p className="font-semibold text-[#0f172a]">{series.organization_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <UserRound size={18} className="mt-1 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Assigned To</p>
                <p className="font-semibold text-[#0f172a]">{series.assigned_to_user_id ? series.assigned_to_user_id : "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <CalendarDays size={18} className="mt-1 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Opened</p>
                <p className="font-semibold text-[#0f172a]">{new Date(series.opened_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <Hash size={18} className="mt-1 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Total Exchanges</p>
                <p className="font-semibold text-[#0f172a]">{series.total_exchanges}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <section>
        <h3 className="font-heading text-3xl font-bold text-[#0f172a]">Correspondence Timeline</h3>
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="relative pl-14">
              <div className="absolute left-[22px] top-0 h-full w-px bg-slate-300" />
              <div
                className={`absolute left-0 top-6 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                  item.direction === "incoming"
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700"
                }`}
              >
                {item.direction === "incoming" ? <ArrowDownRightIcon /> : <ArrowUpRight size={16} />}
              </div>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        item.direction === "incoming" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      #{item.sequence_no} · {item.direction}
                    </span>
                    {item.diary_number ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.diary_number}
                      </span>
                    ) : null}
                    {item.letter_number ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.letter_number}
                      </span>
                    ) : null}
                    {item.incoming_status ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.incoming_status.replaceAll("_", " ")}
                      </span>
                    ) : null}
                    {item.outgoing_status ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.outgoing_status.replaceAll("_", " ")}
                      </span>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Paperclip size={14} />
                    {(item.mode_specific_data && Object.keys(item.mode_specific_data).length) || 0}
                  </span>
                </div>

                <h4 className="mt-2 text-3xl font-semibold text-[#0f172a]">{item.subject}</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {item.direction === "incoming"
                    ? `From: ${item.sender_name || item.sender_organization || "-"}`
                    : `To: ${item.recipient_name || item.recipient_organization || "-"}`}{" "}
                  · {new Date(item.created_at).toLocaleDateString()} · Via {item.mode.replaceAll("_", " ")}
                </p>
                {item.remarks ? <p className="mt-2 text-sm italic text-slate-600">{item.remarks}</p> : null}
              </Card>
            </div>
          ))}
          {!items.length ? (
            <Card>
              <p className="text-sm text-slate-500">No exchanges have been logged in this series yet.</p>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ArrowDownRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}
