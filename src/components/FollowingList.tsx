"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { readJson } from "@/lib/clientImage";

interface Item {
  scope: string;
  kind: "site" | "builder" | "build";
  title: string;
  subtitle: string | null;
  url: string;
}

/** Builds and Builders this person follows, with an Unfollow control on each. */
export default function FollowingList() {
  const { authenticated, getAccessToken } = usePrivy();
  const [items, setItems] = useState<Item[] | null>(null);
  const [hasEmail, setHasEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/follows", { headers: { Authorization: `Bearer ${token}` } });
      const data = await readJson(res);
      if (!res.ok) {
        setError((data.error as string) ?? "Couldn't load your follows.");
        return;
      }
      setHasEmail(data.hasEmail !== false);
      setItems((data.follows as Item[]) ?? []);
    } catch {
      setError("Couldn't load your follows.");
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, load]);

  async function unfollow(scope: string) {
    const prev = items;
    setItems((cur) => (cur ?? []).filter((i) => i.scope !== scope));
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/follows?scope=${encodeURIComponent(scope)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
      setError("Couldn't unfollow. Please try again.");
    }
  }

  if (error) return <p className="form-error">{error}</p>;
  if (items === null) return <p className="lede">Loading…</p>;
  if (!hasEmail) {
    return <p className="lede">Add an email address to your account to follow builds and Builders.</p>;
  }
  if (items.length === 0) {
    return (
      <p className="lede">
        You&rsquo;re not following anything yet. Tap <strong>Follow</strong> on a <a href="/">build or Builder page</a> to
        get email updates here.
      </p>
    );
  }

  const groups: { label: string; kind: Item["kind"] }[] = [
    { label: "Builders", kind: "builder" },
    { label: "Builds", kind: "build" },
    { label: "Site", kind: "site" },
  ];
  return (
    <div className="following-list">
      {groups.map((g) => {
        const rows = items.filter((i) => i.kind === g.kind);
        if (rows.length === 0) return null;
        return (
          <div key={g.kind}>
            <p className="kicker">{g.label}</p>
            <table className="admin-table">
              <tbody>
                {rows.map((i) => (
                  <tr key={i.scope}>
                    <td>{i.url ? <a href={i.url}>{i.title}</a> : i.title}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-secondary" type="button" onClick={() => unfollow(i.scope)}>
                        Unfollow
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
