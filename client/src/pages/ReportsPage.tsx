import { useEffect, useState } from "react";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { ReportsApi } from "../lib/api";

export function ReportsPage() {
  const [metrics, setMetrics] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    async function load() {
      const response = await ReportsApi.summary();
      setMetrics(response.metrics);
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <Header title="Reports" subtitle="Operational report snapshots with core correspondence KPIs." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{metric.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

