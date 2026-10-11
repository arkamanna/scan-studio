"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, FileText, KeyRound, LoaderCircle, LogOut, RefreshCw, Trash2, X } from "lucide-react";
import type { Endorsement, StoredFile } from "@/lib/endorsements";

const KEY_STORAGE = "scan-studio:admin-key";
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif)$/i;

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;

const displayName = (pathname: string) =>
  (pathname.split("/").pop() ?? pathname).replace(/-[A-Za-z0-9]{20,}(?=\.[^.]+$|$)/, "");

function FileBrowser({
  files,
  busy,
  onDelete,
}: {
  files: StoredFile[];
  busy: boolean;
  onDelete: (pathnames: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((p) => files.some((f) => f.pathname === p))));
  }, [files]);

  const toggle = (p: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const allSelected = files.length > 0 && selected.size === files.length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const selectedSize = files.filter((f) => selected.has(f.pathname)).reduce((sum, f) => sum + f.size, 0);

  const deleteSelected = async () => {
    const list = [...selected];
    if (!confirm(`Delete ${list.length} file${list.length === 1 ? "" : "s"}? Their QR codes will stop working. This cannot be undone.`)) return;
    await onDelete(list);
    setSelected(new Set());
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">
          Stored files ({files.length}
          {files.length > 0 && ` · ${formatBytes(totalSize)}`})
        </h2>
        {files.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="size-4 accent-violet-500"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(files.map((f) => f.pathname)))}
              />
              Select all
            </label>
            <button
              className="btn-ghost border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
              disabled={busy || selected.size === 0}
              onClick={deleteSelected}
            >
              <Trash2 size={14} /> Delete selected{selected.size > 0 && ` (${selected.size} · ${formatBytes(selectedSize)})`}
            </button>
          </div>
        )}
      </div>

      {files.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((f) => {
            const isSelected = selected.has(f.pathname);
            const isImage = IMAGE_EXT.test(f.pathname) && f.previewUrl;
            return (
              <li
                key={f.pathname}
                className={`group relative overflow-hidden rounded-2xl border bg-black/20 transition ${
                  isSelected ? "border-violet-400 ring-2 ring-violet-400/40" : "border-white/10"
                }`}
              >
                <button type="button" className="block aspect-square w-full" onClick={() => toggle(f.pathname)} aria-pressed={isSelected}>
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl!} alt={displayName(f.pathname)} loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-slate-500">
                      <FileText size={36} />
                    </span>
                  )}
                </button>
                <input
                  type="checkbox"
                  className="absolute left-2 top-2 size-5 cursor-pointer accent-violet-500"
                  checked={isSelected}
                  onChange={() => toggle(f.pathname)}
                  aria-label={`Select ${displayName(f.pathname)}`}
                />
                {f.previewUrl && (
                  <a
                    href={f.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-slate-200 opacity-0 transition hover:text-white group-hover:opacity-100"
                    aria-label="Open file"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <div className="space-y-0.5 border-t border-white/10 px-3 py-2">
                  <p className="truncate text-xs font-medium text-slate-200" title={f.pathname}>
                    {displayName(f.pathname)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No stored files.</p>
      )}
    </section>
  );
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<{ pending: Endorsement[]; approved: Endorsement[]; files: StoredFile[] } | null>(null);
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

  const act = async (action: string, id?: string, pathnames?: string[]) => {
    setBusy(`${action}:${id ?? ""}`);
    setMessage(null);
    try {
      const res = await call("POST", { action, id, pathnames });
      if (action === "purge-uploads" || action === "delete-files") {
        setMessage(`Deleted ${res.deleted} uploaded file${res.deleted === 1 ? "" : "s"}.`);
      }
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

      <FileBrowser files={data.files} busy={!!busy} onDelete={(pathnames) => act("delete-files", undefined, pathnames)} />

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
