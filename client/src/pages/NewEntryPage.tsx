import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { MetaApi, SeriesApi } from "../lib/api";
import type { Category, CorrespondenceItem, Series } from "../types";

type EntryMode = "new_series" | "existing_series";
type EntryDirection = "incoming" | "outgoing";
type ReceiptOrDispatchMode = "by_hand" | "courier" | "email";

const outgoingTypeOptions = [
  { value: "fresh_new_letter", label: "Fresh New Letter" },
  { value: "reply", label: "Reply to Previous Incoming" },
  { value: "follow_up", label: "Follow-up in Existing Series" },
  { value: "reminder", label: "Reminder" },
  { value: "clarification", label: "Clarification" },
  { value: "submission_cover", label: "Submission Cover Letter" },
  { value: "acknowledgement", label: "Acknowledgement" },
  { value: "compliance_response", label: "Compliance Response" },
  { value: "extension_request", label: "Extension Request" },
];

export function NewEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<EntryMode>("new_series");
  const [direction, setDirection] = useState<EntryDirection>("incoming");

  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesItems, setSeriesItems] = useState<CorrespondenceItem[]>([]);

  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subject, setSubject] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [modeValue, setModeValue] = useState<ReceiptOrDispatchMode>("email");
  const [modeSpecificData, setModeSpecificData] = useState<Record<string, string>>({});

  const [senderName, setSenderName] = useState("");
  const [senderOrganization, setSenderOrganization] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientOrganization, setRecipientOrganization] = useState("");
  const [recipientAddressEmail, setRecipientAddressEmail] = useState("");
  const [inReferenceTo, setInReferenceTo] = useState("");
  const [replyToItemId, setReplyToItemId] = useState("");
  const [outgoingItemType, setOutgoingItemType] = useState("reply");

  const [dateOnLetter, setDateOnLetter] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [sentDate, setSentDate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const selectedSeries = useMemo(
    () => seriesList.find((series) => series.id === selectedSeriesId) ?? null,
    [selectedSeriesId, seriesList],
  );

  const incomingItems = useMemo(
    () => seriesItems.filter((item) => item.direction === "incoming"),
    [seriesItems],
  );

  useEffect(() => {
    async function bootstrap() {
      const [categoryResponse, seriesResponse] = await Promise.all([MetaApi.categories(), SeriesApi.list()]);
      const openSeries = seriesResponse.items.filter((series) => series.status !== "closed");
      setCategories(categoryResponse);
      setSeriesList(openSeries);
      if (categoryResponse.length) {
        setCategoryId(categoryResponse[0].id);
      }
      if (openSeries.length) {
        setSelectedSeriesId(openSeries[0].id);
      }
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    const queryMode = query.get("mode");
    const queryDirection = query.get("direction");
    const querySeriesId = query.get("seriesId");

    if (queryMode === "new_series" || queryMode === "existing_series") {
      setMode(queryMode);
      if (queryMode === "existing_series") {
        setStep(2);
      }
    }
    if (queryDirection === "incoming" || queryDirection === "outgoing") {
      setDirection(queryDirection);
      setStep(3);
    }
    if (querySeriesId) {
      setSelectedSeriesId(querySeriesId);
      setMode("existing_series");
      setStep(3);
    }
  }, [query]);

  useEffect(() => {
    async function loadSeriesContext() {
      if (mode !== "existing_series" || !selectedSeriesId) {
        setSeriesItems([]);
        return;
      }
      const [seriesRes, itemsRes] = await Promise.all([SeriesApi.get(selectedSeriesId), SeriesApi.items(selectedSeriesId)]);
      setSeriesItems(itemsRes.items);

      if (!subject) {
        setSubject(seriesRes.subject);
      }
      if (!organizationName) {
        setOrganizationName(seriesRes.organization_name);
      }
      if (direction === "outgoing") {
        if (!recipientOrganization) {
          setRecipientOrganization(seriesRes.organization_name);
        }
        if (!recipientName) {
          setRecipientName(seriesRes.organization_name);
        }
        const latestIncoming = [...itemsRes.items].reverse().find((item) => item.direction === "incoming");
        if (latestIncoming) {
          if (!replyToItemId) {
            setReplyToItemId(latestIncoming.id);
          }
          if (!inReferenceTo) {
            setInReferenceTo(latestIncoming.diary_number || latestIncoming.letter_number || latestIncoming.subject);
          }
        }
      }
    }
    void loadSeriesContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedSeriesId, direction]);

  useEffect(() => {
    if (direction !== "outgoing" || !replyToItemId) return;
    const target = incomingItems.find((item) => item.id === replyToItemId);
    if (!target) return;

    if (!subject) {
      setSubject(`Reply: ${target.subject}`);
    }
    if (!recipientOrganization && target.sender_organization) {
      setRecipientOrganization(target.sender_organization);
    }
    if (!recipientName && target.sender_name) {
      setRecipientName(target.sender_name);
    }
    if (!inReferenceTo) {
      setInReferenceTo(target.diary_number || target.letter_number || target.subject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyToItemId, incomingItems, direction]);

  function resetModeSpecificData(nextMode: ReceiptOrDispatchMode) {
    setModeValue(nextMode);
    setModeSpecificData({});
  }

  function updateModeSpecificField(key: string, value: string) {
    setModeSpecificData((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      let targetSeriesId = selectedSeriesId;
      if (mode === "new_series") {
        const createdSeries = await SeriesApi.create({
          category_id: categoryId,
          subject,
          organization_name: organizationName,
          started_with: direction,
          priority: "medium",
        });
        targetSeriesId = createdSeries.id;
      }

      if (!targetSeriesId) {
        setMessage("Select a series first.");
        return;
      }

      const payload =
        direction === "incoming"
          ? {
              direction: "incoming",
              item_type: "incoming_letter",
              subject,
              sender_name: senderName || null,
              sender_organization: senderOrganization || organizationName || null,
              date_on_letter: dateOnLetter || null,
              received_date: receivedDate || null,
              mode: modeValue,
              incoming_status: "logged",
              remarks: remarks || null,
              mode_specific_data: modeSpecificData,
            }
          : {
              direction: "outgoing",
              item_type: outgoingItemType,
              subject,
              recipient_name: recipientName || organizationName || null,
              recipient_organization: recipientOrganization || organizationName || null,
              recipient_address_email: recipientAddressEmail || null,
              in_reference_to: inReferenceTo || null,
              sent_date: sentDate || null,
              mode: modeValue,
              outgoing_status: "draft",
              remarks: remarks || null,
              mode_specific_data: {
                ...modeSpecificData,
                reply_to_item_id: replyToItemId || null,
              },
            };

      const savedItem = await SeriesApi.addItem(targetSeriesId, payload);
      if (attachmentFiles.length) {
        await SeriesApi.uploadAttachments(
          targetSeriesId,
          savedItem.id,
          attachmentFiles,
          direction === "incoming" ? "main_letter" : "supporting",
        );
      }

      if (direction === "outgoing") {
        navigate(`/outgoing?seriesId=${targetSeriesId}`);
      } else {
        navigate(`/series/${targetSeriesId}`);
      }
      setMessage(
        direction === "outgoing"
          ? `Outgoing draft created with letter ${savedItem.letter_number ?? "-"}`
          : `Incoming letter logged with diary ${savedItem.diary_number ?? "-"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Header title="New Entry Wizard" subtitle="Start a new series or add the next incoming/outgoing exchange in one guided flow." />

      <Card>
        <div className="grid gap-2 md:grid-cols-3">
          <div className={`rounded-lg border px-3 py-2 text-sm ${step === 1 ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}>
            Step 1: Series Choice
          </div>
          <div className={`rounded-lg border px-3 py-2 text-sm ${step === 2 ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}>
            Step 2: Incoming/Outgoing
          </div>
          <div className={`rounded-lg border px-3 py-2 text-sm ${step === 3 ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}>
            Step 3: Details & Save
          </div>
        </div>
      </Card>

      {step === 1 ? (
        <Card>
          <h3 className="font-heading text-lg font-semibold text-ink">Where should this entry go?</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("new_series")}
              className={`rounded-lg border px-4 py-3 text-left text-sm ${mode === "new_series" ? "border-teal-600 bg-teal-50" : "border-slate-300"}`}
            >
              <p className="font-semibold text-ink">Start New Series</p>
              <p className="text-slate-600">Create a new correspondence case and log first exchange.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("existing_series")}
              className={`rounded-lg border px-4 py-3 text-left text-sm ${mode === "existing_series" ? "border-teal-600 bg-teal-50" : "border-slate-300"}`}
            >
              <p className="font-semibold text-ink">Add to Existing Series</p>
              <p className="text-slate-600">Continue an open thread with next incoming or outgoing item.</p>
            </button>
          </div>
          {mode === "existing_series" ? (
            <select
              value={selectedSeriesId}
              onChange={(event) => setSelectedSeriesId(event.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Existing Series</option>
              {seriesList.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.series_number} - {series.subject}
                </option>
              ))}
            </select>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={mode === "existing_series" && !selectedSeriesId}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Continue
            </button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <h3 className="font-heading text-lg font-semibold text-ink">How does this exchange start?</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setDirection("incoming")}
              className={`rounded-lg border px-4 py-3 text-left text-sm ${direction === "incoming" ? "border-amber-500 bg-amber-50" : "border-slate-300"}`}
            >
              <p className="font-semibold text-ink">Incoming</p>
              <p className="text-slate-600">Log received letter and auto-generate diary number.</p>
            </button>
            <button
              type="button"
              onClick={() => setDirection("outgoing")}
              className={`rounded-lg border px-4 py-3 text-left text-sm ${direction === "outgoing" ? "border-teal-600 bg-teal-50" : "border-slate-300"}`}
            >
              <p className="font-semibold text-ink">Outgoing</p>
              <p className="text-slate-600">Create draft and auto-generate daily letter number.</p>
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Continue
            </button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <h3 className="font-heading text-lg font-semibold text-ink">Entry Details</h3>
          <form onSubmit={saveEntry} className="mt-4 grid gap-3 md:grid-cols-2">
            {mode === "new_series" ? (
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                Series: {selectedSeries?.series_number} - {selectedSeries?.subject}
              </div>
            )}
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Organization / Counterparty"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required={mode === "new_series"}
            />

            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              required
            />

            <select
              value={modeValue}
              onChange={(event) => resetModeSpecificData(event.target.value as ReceiptOrDispatchMode)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="by_hand">{direction === "incoming" ? "Received By Hand" : "Dispatch By Hand"}</option>
              <option value="courier">{direction === "incoming" ? "Received by Courier" : "Dispatch by Courier"}</option>
              <option value="email">{direction === "incoming" ? "Received by Email" : "Dispatch by Email"}</option>
            </select>

            {direction === "incoming" ? (
              <>
                <input
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder="Sender Person Name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={senderOrganization}
                  onChange={(event) => setSenderOrganization(event.target.value)}
                  placeholder="Sender Organization"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Date on Letter</span>
                  <input
                    type="datetime-local"
                    value={dateOnLetter}
                    onChange={(event) => setDateOnLetter(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Date Received</span>
                  <input
                    type="datetime-local"
                    value={receivedDate}
                    onChange={(event) => setReceivedDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </>
            ) : (
              <>
                <select
                  value={outgoingItemType}
                  onChange={(event) => setOutgoingItemType(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {outgoingTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Date of Letter</span>
                  <input
                    type="datetime-local"
                    value={sentDate}
                    onChange={(event) => setSentDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <input
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Recipient Name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={recipientOrganization}
                  onChange={(event) => setRecipientOrganization(event.target.value)}
                  placeholder="Recipient Organization"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={recipientAddressEmail}
                  onChange={(event) => setRecipientAddressEmail(event.target.value)}
                  placeholder="Recipient Address / Email"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                />
                <input
                  value={inReferenceTo}
                  onChange={(event) => setInReferenceTo(event.target.value)}
                  placeholder="In Reference To"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={replyToItemId}
                  onChange={(event) => setReplyToItemId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Reply Target (Optional)</option>
                  {incomingItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.sequence_no} - {item.subject}
                    </option>
                  ))}
                </select>
              </>
            )}

            {modeValue === "by_hand" ? (
              <>
                <input
                  placeholder={direction === "incoming" ? "Received From" : "Delivered By"}
                  onChange={(event) =>
                    updateModeSpecificField(direction === "incoming" ? "received_from" : "delivered_by", event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder={direction === "incoming" ? "Received By" : "Received By"}
                  onChange={(event) => updateModeSpecificField("received_by", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </>
            ) : null}

            {modeValue === "courier" ? (
              <>
                <input
                  placeholder="Courier Company"
                  onChange={(event) => updateModeSpecificField("courier_company", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Tracking Number"
                  onChange={(event) => updateModeSpecificField("tracking_number", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </>
            ) : null}

            {modeValue === "email" ? (
              <>
                <input
                  placeholder={direction === "incoming" ? "Email Received From" : "Sent To Email(s)"}
                  onChange={(event) =>
                    updateModeSpecificField(direction === "incoming" ? "email_from" : "sent_to_emails", event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder={direction === "incoming" ? "Email Subject" : "Email Subject"}
                  onChange={(event) => updateModeSpecificField("email_subject", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </>
            ) : null}

            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Remarks / Notes"
              className="min-h-[90px] rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-600">Upload Letter / Attachments (OCR enabled)</label>
              <input
                type="file"
                multiple
                onChange={(event) => setAttachmentFiles(Array.from(event.target.files ?? []))}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>

            {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 md:col-span-2">{message}</p> : null}

            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : direction === "incoming" ? "Log Incoming Letter" : "Create Outgoing Draft"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
