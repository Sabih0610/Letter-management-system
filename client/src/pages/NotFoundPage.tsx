import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="rounded-2xl bg-white p-8 text-center shadow-card">
        <h1 className="font-heading text-3xl font-bold text-ink">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">The requested route does not exist.</p>
        <Link to="/" className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

