import dayjs from "dayjs";
import type { CorrespondenceItem } from "../../types";

interface TimelineProps {
  items: CorrespondenceItem[];
}

export function Timeline({ items }: TimelineProps) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">No exchanges have been logged yet.</p>;
  }

  return (
    <ol className="space-y-6">
      {items.map((item) => (
        <li key={item.id} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span
            className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${
              item.direction === "incoming" ? "bg-amber-500" : "bg-teal-600"
            }`}
          />
          <div className="ml-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-ink">
              #{item.sequence_no} {item.subject}
            </h4>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {item.direction.toUpperCase()}
            </span>
          </div>
          <div className="ml-3 mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-3">
            <span>Diary: {item.diary_number ?? "-"}</span>
            <span>Letter: {item.letter_number ?? "-"}</span>
            <span>{dayjs(item.created_at).format("DD MMM YYYY, hh:mm A")}</span>
          </div>
          {item.remarks ? <p className="ml-3 mt-3 text-sm text-slate-700">{item.remarks}</p> : null}
        </li>
      ))}
    </ol>
  );
}

