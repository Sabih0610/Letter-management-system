import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { ApprovalsApi, SeriesApi } from "../lib/api";

type QueueItem = Awaited<ReturnType<typeof ApprovalsApi.pending>>[number];

export function ApprovalsWorkbenchPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [comments, setComments] = useState("");
  const [sentBackReason, setSentBackReason] = useState("");
  const [history, setHistory] = useState<
    Array<{ id: string; decision: string; comments?: string; sent_back_reason?: string; created_at: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => queue.find((entry) => entry.approval_id === selectedApprovalId) ?? null,
    [queue, selectedApprovalId],
  );

  async function loadQueue() {
    setIsLoading(true);
    try {
      const pending = await ApprovalsApi.pending();
      setQueue(pending);
      const selectedStillExists = pending.some((entry) => entry.approval_id === selectedApprovalId);
      if (pending.length && (!selectedApprovalId || !selectedStillExists)) {
        setSelectedApprovalId(pending[0].approval_id);
      }
      if (!pending.length) {
        setSelectedApprovalId("");
      }
      setMessage(null);
    } catch {
      setQueue([]);
      setSelectedApprovalId("");
      setMessage("Pending approvals are available for approver/admin roles only.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadHistory() {
      if (!selectedItem?.item_id) {
        setHistory([]);
        return;
      }
      const itemHistory = await SeriesApi.approvalHistory(selectedItem.item_id);
      setHistory(itemHistory);
    }
    void loadHistory();
  }, [selectedItem?.item_id]);

  async function submitDecision(decision: "approved" | "sent_back" | "rejected") {
    if (!selectedItem) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await ApprovalsApi.decide(selectedItem.approval_id, {
        decision,
        comments: comments || undefined,
        sent_back_reason: decision === "sent_back" ? sentBackReason || undefined : undefined,
      });
      setComments("");
      setSentBackReason("");
      setMessage(`Decision recorded: ${decision.replace("_", " ")}`);
      setSelectedApprovalId("");
      await loadQueue();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Approvals Workbench" subtitle="Review pending outgoing drafts, decide, and maintain approval traceability." />

      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <Card>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading pending approvals...</p>
        ) : queue.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Series</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Letter</th>
                  <th className="px-3 py-2">Submitted By</th>
                  <th className="px-3 py-2">Submitted At</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => (
                  <tr key={entry.approval_id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink">{entry.series_number}</p>
                      <p className="text-xs text-slate-500">{entry.organization_name}</p>
                    </td>
                    <td className="px-3 py-2">
                      #{entry.sequence_no} - {entry.item_subject}
                    </td>
                    <td className="px-3 py-2">{entry.letter_number ?? "-"}</td>
                    <td className="px-3 py-2">{entry.submitted_by_name ?? "-"}</td>
                    <td className="px-3 py-2">{new Date(entry.submitted_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedApprovalId(entry.approval_id)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          selectedApprovalId === entry.approval_id
                            ? "bg-teal-600 text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No pending approvals assigned.</p>
        )}
      </Card>

      {selectedItem ? (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Series</p>
              <p className="font-semibold text-ink">{selectedItem.series_number}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedItem.series_subject}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedItem.organization_name}</p>
              <Link to={`/series/${selectedItem.series_id}`} className="mt-2 inline-block text-sm text-teal-700 hover:underline">
                Open Full Timeline
              </Link>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Draft Summary</p>
              <p className="font-semibold text-ink">
                Item #{selectedItem.sequence_no} ({selectedItem.item_type})
              </p>
              <p className="mt-1 text-sm text-slate-600">Letter: {selectedItem.letter_number ?? "-"}</p>
              <p className="mt-1 text-sm text-slate-700">{selectedItem.final_draft_excerpt || "Draft text not saved yet."}</p>
            </div>

            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Comments"
              className="min-h-[100px] rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <textarea
              value={sentBackReason}
              onChange={(event) => setSentBackReason(event.target.value)}
              placeholder="Reason (required only if sending back)"
              className="min-h-[90px] rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void submitDecision("approved")}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={isSaving || !sentBackReason.trim()}
                onClick={() => void submitDecision("sent_back")}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Send Back
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void submitDecision("rejected")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-ink">Approval History</p>
            <div className="mt-2 space-y-2">
              {history.length ? (
                history.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p>
                      <span className="font-semibold">Decision:</span> {entry.decision}
                    </p>
                    <p>
                      <span className="font-semibold">Comments:</span> {entry.comments || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Sent Back Reason:</span> {entry.sent_back_reason || "-"}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No approval history yet.</p>
              )}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
