import dayjs from "dayjs";
import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-4xl font-bold leading-tight text-[#0f172a]">{title}</h2>
        <p className="mt-1 text-lg text-slate-600">
          {subtitle ?? `Operational date: ${dayjs().format("DD MMMM YYYY")}`}
        </p>
      </div>
      {action}
    </header>
  );
}
