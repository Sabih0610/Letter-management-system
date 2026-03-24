import { useState } from "react";
import type { FormEvent } from "react";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { SearchApi } from "../lib/api";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("");
  const [dispatchMode, setDispatchMode] = useState("");
  const [results, setResults] = useState<
    Array<{
      series_id: string;
      series_number: string;
      item_id?: string;
      diary_number?: string;
      letter_number?: string;
      subject: string;
      organization_name: string;
      direction?: string;
      tracking_number?: string;
    }>
  >([]);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    const response = await SearchApi.search({
      query: query || undefined,
      direction: direction || undefined,
      dispatch_mode: dispatchMode || undefined,
    });
    setResults(response.items);
  }

  return (
    <div className="space-y-6">
      <Header title="Global Search" subtitle="Search by series no, diary no, letter no, subject, sender, recipient, tracking." />
      <Card>
        <form onSubmit={runSearch} className="grid gap-3 md:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search term"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Direction: All</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
          <select
            value={dispatchMode}
            onChange={(event) => setDispatchMode(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Dispatch: All</option>
            <option value="by_hand">By Hand</option>
            <option value="courier">Courier</option>
            <option value="email">Email</option>
          </select>
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 md:col-span-4">
            Search
          </button>
        </form>
      </Card>
      <Card>
        <h3 className="font-heading text-lg font-semibold text-ink">Search Results</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Series No</th>
                <th className="px-3 py-2">Diary No</th>
                <th className="px-3 py-2">Letter No</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={`${result.series_id}-${result.item_id}`} className="border-b border-slate-100">
                  <td className="px-3 py-2">{result.series_number}</td>
                  <td className="px-3 py-2">{result.diary_number || "-"}</td>
                  <td className="px-3 py-2">{result.letter_number || "-"}</td>
                  <td className="px-3 py-2">{result.subject}</td>
                  <td className="px-3 py-2">{result.organization_name}</td>
                  <td className="px-3 py-2">{result.direction || "-"}</td>
                  <td className="px-3 py-2">{result.tracking_number || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
