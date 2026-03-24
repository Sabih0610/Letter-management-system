import { ArrowDownRight, ArrowUpRight, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { MetaApi, SeriesApi } from "../lib/api";
import type { Category, Series } from "../types";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "awaiting_internal_draft", label: "Awaiting Internal Draft" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "awaiting_external_response", label: "Awaiting External Response" },
  { value: "closed", label: "Closed" },
];

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

const statusStyles: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  awaiting_internal_draft: "bg-amber-100 text-amber-700",
  awaiting_approval: "bg-violet-100 text-violet-700",
  awaiting_external_response: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

export function SeriesListPage() {
  const navigate = useNavigate();
  const initialSeries = SeriesApi.peekList({ query: undefined, status: undefined });
  const [items, setItems] = useState<Series[]>(() => initialSeries?.items ?? []);
  const [categories, setCategories] = useState<Category[]>(() => MetaApi.peekCategories() ?? []);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isLoading, setIsLoading] = useState(() => !initialSeries);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [createPayload, setCreatePayload] = useState({
    category_id: "",
    subject: "",
    organization_name: "",
    started_with: "incoming",
    priority: "medium",
  });

  async function load(showLoader: boolean) {
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const [seriesResponse, categoryResponse] = await Promise.all([
        SeriesApi.list({ query: debouncedQuery || undefined, status: status || undefined }),
        MetaApi.categories(),
      ]);
      setItems(seriesResponse.items);
      setCategories(categoryResponse);
      if (!createPayload.category_id && categoryResponse.length) {
        setCreatePayload((prev) => ({ ...prev, category_id: categoryResponse[0].id }));
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    const params = { query: debouncedQuery || undefined, status: status || undefined };
    const cachedSeries = SeriesApi.peekList(params);
    if (cachedSeries) {
      setItems(cachedSeries.items);
      setIsLoading(false);
    }

    const cachedCategories = MetaApi.peekCategories();
    if (cachedCategories) {
      setCategories(cachedCategories);
    }

    void load(!cachedSeries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, status]);

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  useEffect(() => {
    if (!createPayload.category_id && categories.length) {
      setCreatePayload((prev) => ({ ...prev, category_id: categories[0].id }));
    }
  }, [categories, createPayload.category_id]);

  const filteredItems = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter((item) => item.category_id === categoryFilter);
  }, [items, categoryFilter]);

  async function createSeries(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    try {
      const created = await SeriesApi.create(createPayload);
      setShowCreateForm(false);
      setCreatePayload((prev) => ({ ...prev, subject: "", organization_name: "" }));
      await load(true);
      navigate(`/series/${created.id}`);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Correspondence Series"
        subtitle={`${filteredItems.length} series found`}
        action={
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#24448f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f3a78]"
          >
            <Plus size={16} />
            New Series
          </button>
        }
      />

      {showCreateForm ? (
        <Card>
          <h3 className="font-heading text-2xl font-bold text-[#0f172a]">Create New Series</h3>
          <form onSubmit={createSeries} className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              required
              value={createPayload.category_id}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, category_id: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={createPayload.started_with}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, started_with: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="incoming">Started With Incoming</option>
              <option value="outgoing">Started With Outgoing</option>
            </select>
            <input
              required
              value={createPayload.subject}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              required
              value={createPayload.organization_name}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, organization_name: event.target.value }))}
              placeholder="Organization"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={createPayload.priority}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, priority: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent Priority</option>
            </select>
            <div className="flex justify-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-xl bg-[#24448f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f3a78] disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create Series"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-12">
          <label className="relative md:col-span-7">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search series..."
              className="w-full rounded-xl border border-slate-300 px-10 py-2.5 text-sm"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-3"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <p className="p-5 text-sm text-slate-500">Loading series...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Series No</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Organization</th>
                  <th className="px-4 py-3 font-semibold">Started</th>
                  <th className="px-4 py-3 font-semibold">Exchanges</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((series) => (
                  <tr key={series.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/series/${series.id}`}
                        className="font-semibold text-[#1f3a78] hover:underline"
                        onMouseEnter={() => {
                          void SeriesApi.get(series.id);
                          void SeriesApi.items(series.id);
                        }}
                      >
                        {series.series_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0f172a]">{series.subject}</td>
                    <td className="px-4 py-3">{categoryMap.get(series.category_id) ?? "-"}</td>
                    <td className="px-4 py-3">{series.organization_name}</td>
                    <td className="px-4 py-3">
                      {series.started_with === "incoming" ? (
                        <ArrowDownRight size={16} className="text-blue-600" />
                      ) : (
                        <ArrowUpRight size={16} className="text-green-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{series.total_exchanges}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[series.status] || "bg-slate-100 text-slate-700"}`}>
                        {series.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          priorityStyles[series.priority] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {series.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(series.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
