"use client";

import { FormEvent, useState } from "react";

/** Password prompt shown instead of a privately published Build page. */
export default function PrivateBuildGate({ slug }: { slug: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="stripe"></div>
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 16px" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, marginBottom: 8 }}>Private build</h1>
        <p style={{ marginBottom: 20 }}>
          This build page is shared privately. Enter the password you were given to view it.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: "#a33", margin: "8px 0" }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy || !password.trim()}>
            {busy ? "Checking…" : "View build"}
          </button>
        </form>
      </main>
    </>
  );
}
