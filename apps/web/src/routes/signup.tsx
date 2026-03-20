import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await api.auth.signup({ email, password, name });
      setUser(user);
      navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
            Create account
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Get started with Notes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md px-3 py-2 text-sm"
              style={{ backgroundColor: "rgba(235,87,87,0.1)", color: "var(--color-danger)" }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Already have an account?{" "}
          <Link to="/login" className="font-medium" style={{ color: "var(--color-primary)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
