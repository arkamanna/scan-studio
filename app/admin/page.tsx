"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, LoaderCircle, LogOut, RefreshCw, Trash2, X } from "lucide-react";
import type { Endorsement } from "@/lib/endorsements";

const KEY_STORAGE = "scan-studio:admin-key";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<{ pending: Endorsement[]; approved: Endorsement[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const call = useCallback(
    async (method: "GET" | "POST", body?: object, k = key) => {
      const res = await fetch("/api/admin", {
        method,
        headers: { "x-admin-key": k, ...(body && { "Content-Type": "application/json" }) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    },
    [key],
  );

  const load = useCallback(
    async (k = key) => {
      setBusy("load");
      setMessage(null);
      try {
        setData(await call("GET", undefined, k));
        setKey(k);
        sessionStorage.setItem(KEY_STORAGE, k);
      } catch (e) {
        setMessage((e as Error).message);
        setData(null);
      } finally {
        setBusy(null);
      }
    },
    [call, key],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY_STORAGE);
    if (saved) load(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (action: string, id?: string) => {
    setBusy(`${action}:${id ?? ""}`);
    setMessage(null);
    try {
      const res = await call("POST", { action, id });
      if (action === "purge-uploads") setMessage(`Deleted ${res.deleted} uploaded file${res.deleted === 1 ? "" : "s"}.`);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="mx-auto grid min-h-screen max-w-sm place-items-center px-4">
        <form
          className="card w-full space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            load(input);
          }}
        >
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-violet-300" />
            <h1 className="font-semibold">Scan Studio admin</h1>
          </div>
          <input className="input" type="password" placeholder="Admin key" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
          {message && <p className="text-sm text-amber-300">{message}</p>}
          <button className="btn-primary w-full" disabled={!input || busy === "load"}>
            {busy === "load" && <LoaderCircle size={16} className="animate-spin" />} Sign in
          </button>
        </form>
      </div>
    );
  }

  const Item = ({ e, status }: { e: Endorsement; status: "pending" | "approved" }) => (
    <li className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="whitespace-pre-wrap text-sm text-slate-200">{e.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-white">{e.name}</span>
        {e.role && <span>· {e.role}</span>}
        {e.linkedin && (
          <a href={e.linkedin} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
            LinkedIn
          </a>
        )}
        <span>· {new Date(e.createdAt).toLocaleString()}</span>
        <span className="ml-auto flex gap-2">
          {status === "pending" ? (
            <>
              <button className="btn-primary px-3 py-1.5 text-xs" disabled={!!busy} onClick={() => act("approve", e.id)}>
                <Check size={14} /> Approve
              </button>
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={!!busy} onClick={() => act("reject", e.id)}>
                <X size={14} /> Reject
              </button>
            </>
          ) : (
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={!!busy} onClick={() => act("unpublish", e.id)}>
              <Trash2 size={14} /> Remove
            </button>
          )}
        </span>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <button className="btn-ghost ml-auto px-3 py-2" onClick={() => load()} disabled={!!busy}>
          <RefreshCw size={15} className={busy === "load" ? "animate-spin" : ""} /> Refresh
        </button>
        <button
          className="btn-ghost px-3 py-2"
          onClick={() => {
            sessionStorage.removeItem(KEY_STORAGE);
            setData(null);
            setKey("");
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>

      {message && <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">{message}</p>}

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Waiting for approval ({data.pending.length})</h2>
        {data.pending.length ? (
          <ul className="space-y-3">{data.pending.map((e) => <Item key={e.id} e={e} status="pending" />)}</ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing to review.</p>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Published ({data.approved.length})</h2>
        {data.approved.length ? (
          <ul className="space-y-3">{data.approved.map((e) => <Item key={e.id} e={e} status="approved" />)}</ul>
        ) : (
          <p className="text-sm text-slate-500">No published endorsements yet.</p>
        )}
      </section>

      <section className="card space-y-3 border-red-500/30 p-5">
        <h2 className="font-semibold text-red-300">Danger zone</h2>
        <p className="text-sm text-slate-400">Delete every photo and file people have shared as QR links. Their QR codes will stop working. Endorsements are kept.</p>
        <button
          className="btn-ghost border-red-500/40 text-red-200 hover:bg-red-500/10"
          disabled={!!busy}
          onClick={() => confirm("Delete ALL uploaded photos and files? This cannot be undone.") && act("purge-uploads")}
        >
          {busy === "purge-uploads:" ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete all uploaded files
        </button>
      </section>
    </div>
  );
}
