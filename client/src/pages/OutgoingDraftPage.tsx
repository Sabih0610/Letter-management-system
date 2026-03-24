import { ArrowLeft, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Editor } from "../components/ui/Editor";
import { Tabs } from "../components/ui/Tabs";
import { SeriesApi, UsersApi } from "../lib/api";
import type { CorrespondenceItem, Series, User } from "../types";

const tabs = ["Letter Details", "Draft Editor", "Attachments", "Dispatch Details", "Approval"];

const draftTypes = [
  { value: "fresh_new_letter", label: "Fresh New Letter" },
  { value: "reply", label: "Reply to Previous Incoming" },
  { value: "follow_up", label: "Follow-up" },
  { value: "reminder", label: "Reminder" },
  { value: "clarification", label: "Clarification" },
  { value: "submission_cover", label: "Submission Cover Letter" },
  { value: "acknowledgement", label: "Acknowledgement" },
  { value: "compliance_response", label: "Compliance Response" },
  { value: "extension_request", label: "Extension Request" },
];

type DispatchMode = "by_hand" | "courier" | "email";

export function OutgoingDraftPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const querySeriesId = useMemo(() => new URLSearchParams(location.search).get("seriesId") ?? "", [location.search]);
  const queryItemId = useMemo(() => new URLSearchParams(location.search).get("itemId") ?? "", [location.search]);

  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [seriesList, setSeriesList] = useState<Series[]>(
    () => SeriesApi.peekList({ query: undefined, status: undefined })?.items ?? [],
  );
  const [seriesItems, setSeriesItems] = useState<CorrespondenceItem[]>([]);
  const [users, setUsers] = useState<User[]>(() => UsersApi.peekList() ?? []);
  const [selectedSeriesId, setSelectedSeriesId] = useState(querySeriesId);
  const [itemId, setItemId] = useState(queryItemId);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [letterDetails, setLetterDetails] = useState({
    subject: "",
    recipient_name: "",
    recipient_organization: "",
    recipient_address_email: "",
    in_reference_to: "",
    sent_date: "",
    mode: "email",
    draft_type: "fresh_new_letter",
    reply_to_item_id: "",
    remarks: "",
  });

  const [editorBody, setEditorBody] = useState("");
  const [aiInstruction, setAiInstruction] = useState(
    "Draft a formal and professional outgoing letter based on selected context.",
  );

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [dispatchData, setDispatchData] = useState({
    mode: "by_hand" as DispatchMode,
    delivered_by: "",
    received_by: "",
    receiver_designation: "",
    courier_company: "",
    tracking_number: "",
    sent_to_emails: "",
    cc_emails: "",
    bcc_emails: "",
    email_subject: "",
    notes: "",
  });
  const [approvalTarget, setApprovalTarget] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalHistory, setApprovalHistory] = useState<
    Array<{ id: string; decision: string; comments?: string; sent_back_reason?: string; created_at: string }>
  >([]);

  const selectedSeries = useMemo(
    () => seriesList.find((series) => series.id === selectedSeriesId) ?? null,
    [seriesList, selectedSeriesId],
  );

  const incomingItems = useMemo(
    () => seriesItems.filter((item) => item.direction === "incoming"),
    [seriesItems],
  );

  useEffect(() => {
    async function load() {
      const [seriesRes, usersRes] = await Promise.all([SeriesApi.list(), UsersApi.list().catch(() => [])]);
      const openSeries = seriesRes.items.filter((series) => series.status !== "closed");
      setSeriesList(openSeries);
      setUsers(usersRes as User[]);
      if (!selectedSeriesId && openSeries.length) {
        setSelectedSeriesId(openSeries[0].id);
      }
      if (!approvalTarget && usersRes.length) {
        setApprovalTarget((usersRes as User[])[0].id);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadSeriesContext() {
      if (!selectedSeriesId) {
        setSeriesItems([]);
        return;
      }
      const itemsRes = await SeriesApi.items(selectedSeriesId);
      setSeriesItems(itemsRes.items);
      const latestIncoming = [...itemsRes.items].reverse().find((item) => item.direction === "incoming");
      if (latestIncoming && !letterDetails.reply_to_item_id) {
        setLetterDetails((prev) => ({
          ...prev,
          reply_to_item_id: latestIncoming.id,
          draft_type: prev.draft_type === "fresh_new_letter" ? "reply" : prev.draft_type,
        }));
      }
    }
    void loadSeriesContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId]);

  useEffect(() => {
    async function loadExistingItem() {
      if (!queryItemId || !selectedSeriesId) return;
      let itemPool = seriesItems;
      if (!itemPool.length) {
        const itemsRes = await SeriesApi.items(selectedSeriesId);
        itemPool = itemsRes.items;
        setSeriesItems(itemsRes.items);
      }
      const existing = itemPool.find((item) => item.id === queryItemId && item.direction === "outgoing");
      if (!existing) return;

      setItemId(existing.id);
      setLetterDetails((prev) => ({
        ...prev,
        subject: existing.subject || prev.subject,
        recipient_name: existing.recipient_name || prev.recipient_name,
        recipient_organization: existing.recipient_organization || prev.recipient_organization,
        recipient_address_email: existing.recipient_address_email || prev.recipient_address_email,
        in_reference_to: existing.in_reference_to || prev.in_reference_to,
        sent_date: existing.sent_date ? new Date(existing.sent_date).toISOString().slice(0, 10) : prev.sent_date,
        mode: existing.mode,
        draft_type: existing.item_type,
        reply_to_item_id:
          typeof existing.mode_specific_data?.reply_to_item_id === "string"
            ? existing.mode_specific_data.reply_to_item_id
            : prev.reply_to_item_id,
        remarks: existing.remarks || prev.remarks,
      }));
      setEditorBody(existing.final_draft_text || existing.ai_draft_text || "");

      const [history, dispatch] = await Promise.all([
        SeriesApi.approvalHistory(existing.id),
        SeriesApi.getDispatch(existing.id).catch(() => null),
      ]);
      setApprovalHistory(history);
      if (dispatch) {
        setDispatchData({
          mode: dispatch.mode,
          delivered_by: dispatch.delivered_by || "",
          received_by: dispatch.received_by || "",
          receiver_designation: dispatch.receiver_designation || "",
          courier_company: dispatch.courier_company || "",
          tracking_number: dispatch.tracking_number || "",
          sent_to_emails: (dispatch.sent_to_emails || []).join(", "),
          cc_emails: (dispatch.cc_emails || []).join(", "),
          bcc_emails: (dispatch.bcc_emails || []).join(", "),
          email_subject: dispatch.email_subject || "",
          notes: dispatch.notes || "",
        });
      }
    }
    void loadExistingItem();
  }, [queryItemId, selectedSeriesId, seriesItems]);

  useEffect(() => {
    if (!selectedSeries) return;
    setLetterDetails((prev) => ({
      ...prev,
      subject: prev.subject || selectedSeries.subject,
      recipient_name: prev.recipient_name || selectedSeries.organization_name,
      recipient_organization: prev.recipient_organization || selectedSeries.organization_name,
      sent_date: prev.sent_date || new Date().toISOString().slice(0, 10),
    }));
  }, [selectedSeries]);

  useEffect(() => {
    const replyTarget = incomingItems.find((item) => item.id === letterDetails.reply_to_item_id);
    if (!replyTarget) return;
    setLetterDetails((prev) => ({
      ...prev,
      recipient_name: prev.recipient_name || replyTarget.sender_name || replyTarget.sender_organization || prev.recipient_name,
      recipient_organization:
        prev.recipient_organization || replyTarget.sender_organization || prev.recipient_organization,
      in_reference_to: prev.in_reference_to || replyTarget.diary_number || replyTarget.letter_number || replyTarget.subject,
      subject: prev.subject || `Reply: ${replyTarget.subject}`,
    }));
  }, [incomingItems, letterDetails.reply_to_item_id]);

  async function saveDraftDetails(silent = false): Promise<string | null> {
    if (!selectedSeriesId) {
      if (!silent) setMessage("Select a series first.");
      return null;
    }

    const payload = {
      direction: "outgoing",
      item_type: letterDetails.draft_type,
      subject: letterDetails.subject,
      recipient_name: letterDetails.recipient_name,
      recipient_organization: letterDetails.recipient_organization,
      recipient_address_email: letterDetails.recipient_address_email,
      in_reference_to: letterDetails.in_reference_to || null,
      sent_date: letterDetails.sent_date || null,
      mode: letterDetails.mode,
      outgoing_status: "draft",
      remarks: letterDetails.remarks || null,
      mode_specific_data: { reply_to_item_id: letterDetails.reply_to_item_id || null },
    };

    setIsSaving(true);
    try {
      if (itemId) {
        await SeriesApi.updateItem(selectedSeriesId, itemId, payload);
        if (!silent) setMessage("Draft saved.");
        return itemId;
      }
      const created = await SeriesApi.addItem(selectedSeriesId, payload);
      setItemId(created.id);
      if (!silent) setMessage(`Draft saved. Letter Number: ${created.letter_number || "-"}`);
      return created.id;
    } finally {
      setIsSaving(false);
    }
  }

  async function generateAIDraft() {
    const ensuredItemId = await saveDraftDetails(true);
    if (!ensuredItemId) return;
    setIsGeneratingAI(true);
    setMessage(null);
    try {
      const response = await SeriesApi.generateAIDraft({
        item_id: ensuredItemId,
        selected_letter_item_id: letterDetails.reply_to_item_id || undefined,
        prompt_title: "Quick Draft",
        prompt_instructions: aiInstruction,
        tone: "formal",
        draft_type: letterDetails.draft_type,
        draft_purpose: letterDetails.draft_type === "reply" ? "formal_reply" : "fresh_new_letter",
        key_points: [],
        thread_scope: "last_3",
        file_scope: "main_plus_attachments",
        use_selected_letter: true,
        use_uploaded_attachments: true,
        use_previous_thread: true,
      });
      setEditorBody(response.draft_text);
      setLetterDetails((prev) => ({
        ...prev,
        subject: response.subject_suggestion || prev.subject,
        in_reference_to: response.reference_line || prev.in_reference_to,
      }));
      setActiveTab("Draft Editor");
      setMessage("AI draft generated.");
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function saveDraftEditor() {
    if (!selectedSeriesId || !itemId) {
      setMessage("Save letter details first.");
      return;
    }
    setIsSaving(true);
    try {
      await SeriesApi.updateItem(selectedSeriesId, itemId, {
        subject: letterDetails.subject,
        in_reference_to: letterDetails.in_reference_to || null,
        final_draft_text: editorBody,
        outgoing_status: "under_review",
      });
      setMessage("Draft editor changes saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadAttachments() {
    if (!selectedSeriesId || !itemId || !attachmentFiles.length) return;
    await SeriesApi.uploadAttachments(selectedSeriesId, itemId, attachmentFiles, "supporting");
    setAttachmentFiles([]);
    setMessage("Attachments uploaded.");
  }

  async function saveDispatchDetails() {
    if (!itemId) return;
    await SeriesApi.upsertDispatch(itemId, {
      ...dispatchData,
      sent_to_emails: dispatchData.sent_to_emails
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      cc_emails: dispatchData.cc_emails
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      bcc_emails: dispatchData.bcc_emails
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    setMessage("Dispatch details saved.");
  }

  async function handlePrimarySave() {
    if (activeTab === "Draft Editor") {
      await saveDraftEditor();
      return;
    }
    if (activeTab === "Attachments") {
      await uploadAttachments();
      return;
    }
    if (activeTab === "Dispatch Details") {
      await saveDispatchDetails();
      return;
    }
    await saveDraftDetails();
  }

  async function submitForApproval() {
    if (!itemId || !approvalTarget) {
      setMessage("Save draft first and choose an approver.");
      return;
    }
    await SeriesApi.submitApproval({
      item_id: itemId,
      submitted_to_user_id: approvalTarget,
      comments: approvalComment || undefined,
    });
    const history = await SeriesApi.approvalHistory(itemId);
    setApprovalHistory(history);
    setMessage("Submitted for approval.");
  }

  return (
    <div className="space-y-5 pb-24">
      <Link
        to={selectedSeries ? `/series/${selectedSeries.id}` : "/series"}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f3a78] hover:underline"
      >
        <ArrowLeft size={16} />
        Back to Series
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-4xl font-bold text-[#0f172a]">Draft Outgoing Letter</h2>
          <p className="text-lg text-slate-600">
            Series: {selectedSeries?.series_number ?? "Not selected"} · Sequence auto-assigned
          </p>
        </div>
        <span className="rounded-full border border-slate-300 bg-white px-4 py-1 text-sm font-semibold text-slate-700">
          {itemId ? "Letter Number Generated" : "Letter Number on Save"}
        </span>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

      {activeTab === "Letter Details" ? (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={selectedSeriesId}
              onChange={(event) => setSelectedSeriesId(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            >
              <option value="">Select Series</option>
              {seriesList.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.series_number} - {series.subject}
                </option>
              ))}
            </select>
            <input value={letterDetails.sent_date} onChange={(event) => setLetterDetails((prev) => ({ ...prev, sent_date: event.target.value }))} type="date" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <select
              value={letterDetails.draft_type}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, draft_type: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              {draftTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              value={letterDetails.recipient_name}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, recipient_name: event.target.value }))}
              placeholder="Recipient Name"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <input
              value={letterDetails.recipient_organization}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, recipient_organization: event.target.value }))}
              placeholder="Recipient Organization"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <input
              value={letterDetails.recipient_address_email}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, recipient_address_email: event.target.value }))}
              placeholder="Recipient Address / Email"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            />
            <textarea
              value={letterDetails.subject}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject of the outgoing letter"
              className="min-h-[100px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            />
            <input
              value={letterDetails.in_reference_to}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, in_reference_to: event.target.value }))}
              placeholder="In Reference To (optional)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            />
            <select
              value={letterDetails.reply_to_item_id}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, reply_to_item_id: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            >
              <option value="">Select incoming to reply (optional)</option>
              {incomingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.sequence_no} - {item.subject}
                </option>
              ))}
            </select>
            <textarea
              value={letterDetails.remarks}
              onChange={(event) => setLetterDetails((prev) => ({ ...prev, remarks: event.target.value }))}
              placeholder="Internal notes"
              className="min-h-[90px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
            />
          </div>
        </Card>
      ) : null}

      {activeTab === "Draft Editor" ? (
        <Card>
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={aiInstruction}
                onChange={(event) => setAiInstruction(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="AI instruction"
              />
              <button
                type="button"
                onClick={() => void generateAIDraft()}
                disabled={isGeneratingAI}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24448f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f3a78] disabled:opacity-60"
              >
                {isGeneratingAI ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Generate AI Draft
              </button>
            </div>
            <Editor value={editorBody} onChange={setEditorBody} />
          </div>
        </Card>
      ) : null}

      {activeTab === "Attachments" ? (
        <Card>
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-600">Upload letter attachments</p>
            <input
              type="file"
              multiple
              onChange={(event) => setAttachmentFiles(Array.from(event.target.files ?? []))}
              className="mx-auto mt-3 block text-sm"
            />
          </div>
        </Card>
      ) : null}

      {activeTab === "Dispatch Details" ? (
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Dispatch Mode</p>
            <div className="mt-2 flex gap-2">
              {(["by_hand", "courier", "email"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDispatchData((prev) => ({ ...prev, mode }))}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    dispatchData.mode === mode
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
            {dispatchData.mode === "by_hand" ? (
              <>
                <input
                  placeholder="Delivered By"
                  value={dispatchData.delivered_by}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, delivered_by: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Received By"
                  value={dispatchData.received_by}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, received_by: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Receiver Designation"
                  value={dispatchData.receiver_designation}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, receiver_designation: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
                />
              </>
            ) : null}

            {dispatchData.mode === "courier" ? (
              <>
                <input
                  placeholder="Courier Company"
                  value={dispatchData.courier_company}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, courier_company: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Tracking Number"
                  value={dispatchData.tracking_number}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, tracking_number: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </>
            ) : null}

            {dispatchData.mode === "email" ? (
              <>
                <input
                  placeholder="Sent To Emails (comma separated)"
                  value={dispatchData.sent_to_emails}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, sent_to_emails: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
                />
                <input
                  placeholder="CC"
                  value={dispatchData.cc_emails}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, cc_emails: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="BCC"
                  value={dispatchData.bcc_emails}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, bcc_emails: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
                <input
                  placeholder="Email Subject"
                  value={dispatchData.email_subject}
                  onChange={(event) => setDispatchData((prev) => ({ ...prev, email_subject: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2"
                />
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      {activeTab === "Approval" ? (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={approvalTarget}
              onChange={(event) => setApprovalTarget(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role.name})
                </option>
              ))}
            </select>
            <input
              value={approvalComment}
              onChange={(event) => setApprovalComment(event.target.value)}
              placeholder="Approval comment"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="mt-4 space-y-2">
            {approvalHistory.length ? (
              approvalHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">{entry.decision}</p>
                  <p className="text-slate-600">{entry.comments || "-"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">This letter has not been submitted for approval yet.</p>
            )}
          </div>
        </Card>
      ) : null}

      <div className="fixed bottom-0 left-[280px] right-0 border-t border-slate-200 bg-white/95 px-8 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(selectedSeries ? `/series/${selectedSeries.id}` : "/series")}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePrimarySave()}
            disabled={isSaving}
            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={() => void submitForApproval()}
            className="rounded-xl bg-[#7f93bf] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6f84b1]"
          >
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}
