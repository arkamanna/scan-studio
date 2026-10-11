"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, FileText, ImageIcon, LoaderCircle, RotateCcw, ScanText, X } from "lucide-react";
import { upload, uploadPresigned } from "@vercel/blob/client";
import { Chips, Field, Select, TargetPicker, TextArea } from "./ui";
import { TEXT_TARGETS, type OnResult } from "@/lib/payloads";
import { DOCUMENT_ACCEPT, extractText } from "@/lib/extract";

type Kind = "photo" | "document";
type Output = "text" | "file";

const OCR_LANGS = [
  { id: "eng", label: "English" },
  { id: "eng+hin", label: "English + Hindi" },
  { id: "eng+ben", label: "English + Bengali" },
  { id: "spa", label: "Spanish" },
  { id: "fra", label: "French" },
  { id: "deu", label: "German" },
  { id: "por", label: "Portuguese" },
  { id: "chi_sim", label: "Chinese (Simplified)" },
  { id: "jpn", label: "Japanese" },
  { id: "ara", label: "Arabic" },
];

const formatSize = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function FileForm({ kind, onResult }: { kind: Kind; onResult: OnResult }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lang, setLang] = useState("eng");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [target, setTarget] = useState("plain");
  const [output, setOutput] = useState<Output>("text");

  const [uploadsEnabled, setUploadsEnabled] = useState<boolean | null>(null);
  const [uploadMode, setUploadMode] = useState<"token" | "presigned" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setUploadsEnabled(Boolean(d.uploadsEnabled));
        setUploadMode(d.uploadMode ?? null);
      })
      .catch(() => setUploadsEnabled(false));
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  useEffect(() => {
    if (output === "file") {
      onResult(uploadedUrl ? { payload: uploadedUrl, opensIn: kind === "photo" ? "Browser · full photo" : "Browser · document viewer" } : null);
      return;
    }
    const value = text.trim();
    if (!value) return onResult(null);
    const t = TEXT_TARGETS.find((x) => x.id === target)!;
    onResult({ payload: t.build(value), opensIn: t.app });
  }, [output, uploadedUrl, text, target, kind, onResult]);

  const run = useCallback(
    async (f: File, ocrLang: string) => {
      setBusy(true);
      setError(null);
      setProgress(0);
      setStatus("Starting");
      try {
        const extracted = await extractText(f, ocrLang, (p, s) => {
          setProgress(p);
          setStatus(s);
        });
        setText(extracted);
        if (!extracted) setError("No readable text was found in this file.");
      } catch (e) {
        setError((e as Error).message || "Couldn’t read this file.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (kind === "photo" && !f.type.startsWith("image/")) return setError("Please choose an image file.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setText("");
    setUploadedUrl(null);
    run(f, lang);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setText("");
    setError(null);
    setUploadedUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const doUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const send = uploadMode === "presigned" ? uploadPresigned : upload;
      const blob = await send(file.name, file, { access: "public", handleUploadUrl: "/api/upload" });
      const isPrivate = new URL(blob.url).hostname.includes(".private.");
      const shareUrl = isPrivate ? `${window.location.origin}/f/${blob.pathname.split("/").map(encodeURIComponent).join("/")}` : blob.url;
      setUploadedUrl(shareUrl);
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const Icon = kind === "photo" ? ImageIcon : FileText;

  return (
    <div className="space-y-5">
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files[0]);
          }}
          className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? "border-violet-400 bg-violet-500/10" : "border-white/15 bg-black/20 hover:border-white/30 hover:bg-white/[0.03]"
          }`}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 text-white transition group-hover:scale-105">
            <Icon size={26} />
          </span>
          <span className="text-sm font-medium text-slate-200">
            {kind === "photo" ? "Drop a photo, or tap to take / choose one" : "Drop a document, or tap to browse"}
          </span>
          <span className="text-xs text-slate-500">
            {kind === "photo" ? "JPG, PNG, WebP · text is read on your device" : "PDF (incl. scanned), DOCX, TXT, MD, CSV, JSON…"}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-16 rounded-xl object-cover" />
          ) : (
            <span className="grid size-16 place-items-center rounded-xl bg-white/5 text-slate-300">
              <Icon size={24} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
          </div>
          <button type="button" onClick={() => run(file, lang)} disabled={busy} className="btn-ghost px-2.5" title="Read text again">
            <RotateCcw size={16} />
          </button>
          <button type="button" onClick={reset} className="btn-ghost px-2.5" title="Remove">
            <X size={16} />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={kind === "photo" ? "image/*" : DOCUMENT_ACCEPT}
        onChange={(e) => accept(e.target.files?.[0])}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Put into the QR">
          <Chips
            options={[
              { id: "text" as Output, label: "Extracted text", icon: <ScanText size={14} /> },
              { id: "file" as Output, label: kind === "photo" ? "The photo (link)" : "The file (link)", icon: <CloudUpload size={14} /> },
            ]}
            value={output}
            onChange={setOutput}
          />
        </Field>
        {output === "text" && (
          <Field label="Text language">
            <Select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) run(file, e.target.value);
              }}
            >
              {OCR_LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {busy && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <LoaderCircle size={16} className="animate-spin text-violet-400" />
            {status}…
            <span className="ml-auto tabular-nums text-slate-500">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        </div>
      )}

      {error && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{error}</p>}

      {output === "text" ? (
        file &&
        !busy && (
          <>
            <Field label="Extracted text — edit freely" hint={`${text.length.toLocaleString()} characters`}>
              <TextArea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text found in your file will appear here…" />
            </Field>
            <TargetPicker targets={TEXT_TARGETS} value={target} onChange={setTarget} />
          </>
        )
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
          {uploadsEnabled === false ? (
            <p>
              File links need <span className="font-medium text-white">Vercel Blob</span> storage. Connect a Blob store to this project in
              the Vercel dashboard (Storage → Blob), then redeploy.
            </p>
          ) : uploadedUrl ? (
            <p className="break-all">
              Uploaded ✓ <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">{uploadedUrl}</a>
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1">Upload the original so anyone scanning can view or download it (max 25 MB).</p>
              <button type="button" className="btn-primary" disabled={!file || uploading || uploadsEnabled === null} onClick={doUpload}>
                {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                {uploading ? "Uploading…" : "Upload & create link"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
