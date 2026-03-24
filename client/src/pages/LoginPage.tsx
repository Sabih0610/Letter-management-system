import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError("Login failed. Verify credentials or bootstrap admin first.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-page px-4 py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <h1 className="font-heading text-3xl font-bold text-ink">Correspondence System</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to manage correspondence series and official letters.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-ink"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-ink"
              required
            />
          </label>
          {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-ink px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
