import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { MetaApi, SeriesApi } from "../lib/api";
import type { Category, Series } from "../types";

type ReceiptMode = "by_hand" | "courier" | "email";

interface IncomingFormState {
  create_mode: "new_series" | "existing_series";
  series_id: string;
  category_id: string;
  subject: string;
  organization_name: string;
  sender_name: string;
  sender_organization: string;
  date_on_letter: string;
  received_date: string;
  incoming_status: string;
  remarks: string;
}

const initialState: IncomingFormState = {
  create_mode: "new_series",
  series_id: "",
  category_id: "",
  subject: "",
  organization_name: "",
  sender_name: "",
  sender_organization: "",
  date_on_letter: "",
  received_date: "",
  incoming_status: "received",
  remarks: "",
};

export function IncomingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const querySeriesId = useMemo(() => new URLSearchParams(location.search).get("seriesId") ?? "", [location.search]);

  const [state, setState] = useState<IncomingFormState>(initialState);
  const [seriesList, setSeriesList] = useState<Series[]>(
    () => SeriesApi.peekList({ query: undefined, status: undefined })?.items ?? [],
  );
  const [categories, setCategories] = useState<Category[]>(() => MetaApi.peekCategories() ?? []);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [receiptMode, setReceiptMode] = useState<ReceiptMode>("by_hand");
  const [modeSpecificData, setModeSpecificData] = useState<Record<string, string>>({});
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const [seriesResponse, categoriesResponse] = await Promise.all([SeriesApi.list(), MetaApi.categories()]);
      const activeSeries = seriesResponse.items.filter((series) => series.status !== "closed");
      setSeriesList(activeSeries);
      setCategories(categoriesResponse);

      if (categoriesResponse.length) {
        setState((prev) => ({ ...prev, category_id: categoriesResponse[0].id }));
      }

      if (querySeriesId) {
        const details = await SeriesApi.get(querySeriesId);
        setSelectedSeries(details);
        setState((prev) => ({
          ...prev,
          create_mode: "existing_series",
          series_id: details.id,
          subject: prev.subject || details.subject,
          organization_name: details.organization_name,
          sender_organization: prev.sender_organization || details.organization_name,
        }));
      } else if (activeSeries.length) {
        setState((prev) => ({ ...prev, series_id: activeSeries[0].id }));
      }
    }
    void bootstrap();
  }, [querySeriesId]);

  useEffect(() => {
    async function syncSelectedSeries() {
      if (state.create_mode !== "existing_series" || !state.series_id) {
        setSelectedSeries(null);
        return;
      }
      if (selectedSeries?.id === state.series_id) {
        return;
      }
      const details = await SeriesApi.get(state.series_id);
      setSelectedSeries(details);
      setState((prev) => ({
        ...prev,
        organization_name: details.organization_name,
        sender_organization: prev.sender_organization || details.organization_name,
        subject: prev.subject || details.subject,
      }));
    }
    void syncSelectedSeries();
  }, [state.create_mode, state.series_id, selectedSeries?.id]);

  function updateModeSpecificField(key: string, value: string) {
    setModeSpecificData((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      let targetSeriesId = state.series_id;
      if (state.create_mode === "new_series") {
        const created = await SeriesApi.create({
          category_id: state.category_id,
          subject: state.subject,
          organization_name: state.organization_name,
          started_with: "incoming",
          priority: "medium",
        });
        targetSeriesId = created.id;
      }

      const savedItem = await SeriesApi.addItem(targetSeriesId, {
        direction: "incoming",
        item_type: "incoming_letter",
        subject: state.subject,
        sender_name: state.sender_name || null,
        sender_organization: state.sender_organization || null,
        date_on_letter: state.date_on_letter || null,
        received_date: state.received_date || null,
        mode: receiptMode,
        incoming_status: state.incoming_status,
        remarks: state.remarks || null,
        mode_specific_data: modeSpecificData,
      });

      if (attachmentFiles.length) {
        await SeriesApi.uploadAttachments(targetSeriesId, savedItem.id, attachmentFiles, "main_letter");
      }

      setMessage(`Incoming logged. Diary Number: ${savedItem.diary_number || "-"}`);
      navigate(`/series/${targetSeriesId}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to={selectedSeries ? `/series/${selectedSeries.id}` : "/series"}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f3a78] hover:underline"
      >
        <ArrowLeft size={16} />
        Back to Series
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-4xl font-bold text-[#0f172a]">Log Incoming Letter</h2>
          <p className="text-lg text-slate-600">
            Series: {selectedSeries?.series_number ?? "Not selected"} · Sequence will auto assign
          </p>
        </div>
        <span className="rounded-full border border-slate-300 bg-white px-4 py-1 text-sm font-semibold text-slate-700">
          Diary: Auto on Save
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {!querySeriesId ? (
          <Card>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={state.create_mode}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, create_mode: event.target.value as IncomingFormState["create_mode"] }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="new_series">Start New Series</option>
                <option value="existing_series">Add to Existing Series</option>
              </select>
              {state.create_mode === "existing_series" ? (
                <select
                  value={state.series_id}
                  onChange={(event) => setState((prev) => ({ ...prev, series_id: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                >
                  <option value="">Select Series</option>
                  {seriesList.map((series) => (
                    <option key={series.id} value={series.id}>
                      {series.series_number} - {series.subject}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={state.category_id}
                  onChange={(event) => setState((prev) => ({ ...prev, category_id: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Card>
        ) : null}

        <Card className="space-y-4">
          <h3 className="font-heading text-2xl font-bold text-[#0f172a]">Letter Details</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={state.sender_name}
              onChange={(event) => setState((prev) => ({ ...prev, sender_name: event.target.value }))}
              placeholder="Sender Name / Person"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <input
              value={state.sender_organization}
              onChange={(event) => setState((prev) => ({ ...prev, sender_organization: event.target.value }))}
              placeholder="Sender Organization"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <textarea
              value={state.subject}
              onChange={(event) => setState((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject of the letter"
              className="min-h-[100px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
              required
            />
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date on Letter</span>
              <input
                type="date"
                value={state.date_on_letter ? state.date_on_letter.slice(0, 10) : ""}
                onChange={(event) => setState((prev) => ({ ...prev, date_on_letter: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date Received</span>
              <input
                type="date"
                value={state.received_date ? state.received_date.slice(0, 10) : ""}
                onChange={(event) => setState((prev) => ({ ...prev, received_date: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </label>
            <select
              value={state.incoming_status}
              onChange={(event) => setState((prev) => ({ ...prev, incoming_status: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="received">Received</option>
              <option value="logged">Logged</option>
              <option value="under_review">Under Review</option>
              <option value="action_required">Action Required</option>
              <option value="filed">Filed</option>
            </select>
            <textarea
              value={state.remarks}
              onChange={(event) => setState((prev) => ({ ...prev, remarks: event.target.value }))}
              placeholder="Remarks / Notes"
              className="min-h-[100px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="font-heading text-2xl font-bold text-[#0f172a]">Receipt Details</h3>
          <div>
            <p className="text-sm font-semibold text-slate-700">Receipt Mode</p>
            <div className="mt-2 flex gap-2">
              {(["by_hand", "courier", "email"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setReceiptMode(mode);
                    setModeSpecificData({});
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    receiptMode === mode
                      ? "bg-[#24448f] text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {mode === "by_hand" ? "By Hand" : mode === "courier" ? "Courier" : "Email"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
            {receiptMode === "by_hand" ? (
              <>
                <input
                  placeholder="Received From"
                  onChange={(event) => updateModeSpecificField("received_from", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Received By"
                  onChange={(event) => updateModeSpecificField("received_by", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Time Received"
                  onChange={(event) => updateModeSpecificField("time_received", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Acknowledgement / Remarks"
                  onChange={(event) => updateModeSpecificField("acknowledgement", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </>
            ) : null}
            {receiptMode === "courier" ? (
              <>
                <input
                  placeholder="Courier Company"
                  onChange={(event) => updateModeSpecificField("courier_company", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Tracking Number"
                  onChange={(event) => updateModeSpecificField("tracking_number", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Time Received"
                  onChange={(event) => updateModeSpecificField("time_received", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                  <input type="checkbox" onChange={(event) => updateModeSpecificField("pod_available", String(event.target.checked))} />
                  Proof of Delivery Available
                </label>
              </>
            ) : null}
            {receiptMode === "email" ? (
              <>
                <input
                  placeholder="Email From"
                  onChange={(event) => updateModeSpecificField("email_from", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Email Received At"
                  onChange={(event) => updateModeSpecificField("email_to", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Email Subject"
                  onChange={(event) => updateModeSpecificField("email_subject", event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
                />
              </>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3 className="font-heading text-2xl font-bold text-[#0f172a]">Attachments</h3>
          <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-600">Drag & drop files or click to browse</p>
            <input
              type="file"
              multiple
              onChange={(event) => setAttachmentFiles(Array.from(event.target.files ?? []))}
              className="mx-auto mt-3 block text-sm"
            />
          </div>
        </Card>

        {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

        <div className="flex justify-end gap-3">
          <Link
            to={selectedSeries ? `/series/${selectedSeries.id}` : "/series"}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-[#7f93bf] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6f84b1] disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Incoming Letter"}
          </button>
        </div>
      </form>
    </div>
  );
}
