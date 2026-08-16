import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabaseConfigured } from "../lib/supabase";
import { authErrorMessage } from "../lib/format";

export function Login() {
  const { session, role, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session && role) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-paper px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <p className="text-xs tracking-[0.24em] text-muted uppercase">QuibiFriends</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">存货后台</h1>
        <p className="mt-2 text-sm text-muted">使用管理员开通的邮箱账号登录。本系统不提供注册。</p>

        {!supabaseConfigured && (
          <p className="mt-4 rounded-lg bg-copper/10 px-3 py-2 text-sm text-copper">
            尚未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请复制 .env.example 为 .env 后重启。
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm text-muted">
            邮箱
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper/70 px-3 py-2 text-ink outline-none focus:border-pine"
            />
          </label>
          <label className="block text-sm text-muted">
            密码
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper/70 px-3 py-2 text-ink outline-none focus:border-pine"
            />
          </label>
          {error && <p className="text-sm text-copper">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !supabaseConfigured}
            className="w-full rounded-lg bg-pine py-2.5 text-sm font-medium text-white hover:bg-pine-dark disabled:opacity-60"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
