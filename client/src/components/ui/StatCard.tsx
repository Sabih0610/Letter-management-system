import { Card } from "./Card";

interface StatCardProps {
  title: string;
  value: string | number;
  accent?: "teal" | "amber" | "red" | "slate";
}

const accentStyles = {
  teal: "border-l-accent text-accent",
  amber: "border-l-amber text-amber",
  red: "border-l-danger text-danger",
  slate: "border-l-ink text-ink",
};

export function StatCard({ title, value, accent = "slate" }: StatCardProps) {
  return (
    <Card className={`border-l-4 ${accentStyles[accent]} animate-fadeInUp`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </Card>
  );
}

