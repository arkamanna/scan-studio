"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, LoaderCircle, Mic, MicOff, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { CollapsibleCard } from "./design-controls";
import type { AgentReply } from "@/lib/qr-agent-schema";
import { applyAgentDesign, contentToResult, describeState, type AgentMessage } from "@/lib/qr-agent";
import type { Result } from "@/lib/payloads";
import type { QrDesign } from "@/lib/qr-design";
import { emit } from "@/lib/app-events";

/** Stop listening after this much silence (or when the user taps the mic again). */
const SILENCE_MS = 2500;
/** Give up if nothing at all is heard for this long. */
const NO_SPEECH_MS = 8000;

const TAB_NAMES: Record<string, string> = {
  qr: "QR Code", barcode: "Barcode", datamatrix: "Data Matrix", aztec: "Aztec", pdf417: "PDF417", gs1: "GS1", postal: "Postal", more: "More", scan: "Scan",
};

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; questions?: AgentReply["questions"]; status: AgentReply["status"]; applied?: string };

const SUGGESTIONS = [
  "Wi‑Fi QR for my café network BeanHouse, password latte2026, warm brown colours",
  "Link to arkamanna.com with a purple gradient and rounded dots, then download it",
  "EAN-13 barcode for 590123412345",
  "Which code should I use for a boarding pass?",
];

/* Minimal Web Speech API typing (not in TypeScript's DOM lib yet). */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const speechCtor = () =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition ??
      null);

export default function QRAgent({
  design,
  contentLabel,
  onApply,
}: {
  design: QrDesign;
  contentLabel: string | null;
  onApply: (r: { result?: Result; label?: string; design: QrDesign }) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [askFirst, setAskFirst] = useState(true);
  const [basic, setBasic] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  const wantRef = useRef(false);
  const silenceRef = useRef<number | undefined>(undefined);
  const heardRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVoiceOk(Boolean(speechCtor())), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const stopVoice = () => {
    wantRef.current = false;
    window.clearTimeout(silenceRef.current);
    recRef.current?.stop();
  };

  useEffect(() => stopVoice, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    stopVoice();
    const history: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(history);
    setInput("");
    setAnswers({});
    setBusy(true);
    try {
      const res = await fetch("/api/qr-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map<AgentMessage>((t) => ({
            role: t.role,
            content: t.role === "assistant" && t.questions?.length ? `${t.content}\n${t.questions.map((q) => `- ${q.question} (${q.options.join(" / ")})`).join("\n")}` : t.content,
          })),
          askFirst,
          state: describeState(design, contentLabel),
          today: new Date().toString().slice(0, 21),
        }),
      });
      const data = (await res.json()) as { reply?: AgentReply; mode?: "ai" | "basic"; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error || "The agent couldn’t answer just now.");
      setBasic(data.mode === "basic");
      const reply = data.reply;

      const applied: string[] = [];
      if (reply.status === "create") {
        const built = reply.content ? contentToResult(reply.content) : null;
        if (built || reply.design) {
          onApply({ result: built?.result, label: built?.label, design: applyAgentDesign(design, reply.design) });
          applied.push(built ? built.label : "Design updated");
        }
        if (reply.ecc || reply.actions?.length) {
          emit("ss:qr", { ecc: reply.ecc ?? undefined, actions: reply.actions ?? undefined });
          if (reply.ecc) applied.push(`Error correction ${reply.ecc}`);
          reply.actions?.forEach((a) => applied.push(a.replace("_", " ").replace("download png", "Downloaded PNG").replace("download svg", "Downloaded SVG")));
        }
        if (reply.code) {
          emit("ss:fill", reply.code);
          applied.push(`${TAB_NAMES[reply.code.tab]} tab · ${reply.code.value}`);
        }
      }
      if (reply.navigate && !reply.code) {
        emit("ss:tab", { tab: reply.navigate });
        applied.push(`Opened ${TAB_NAMES[reply.navigate]}`);
      }
      setTurns((t) => [...t, { role: "assistant", content: reply.message, questions: reply.status === "ask" ? reply.questions : null, status: reply.status, applied: applied.join(" · ") || undefined }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", content: (e as Error).message || "Something went wrong. Please try again.", status: "reply" }]);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Browsers end recognition after a short pause, so keep restarting it until the user has been quiet for
   * SILENCE_MS (or taps the mic). Each session's text is appended to what was already heard.
   */
  const toggleVoice = () => {
    if (listening) {
      stopVoice();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    wantRef.current = true;
    heardRef.current = false;
    let text = input ? `${input.trim()} ` : "";

    const armSilence = (ms: number) => {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = window.setTimeout(stopVoice, ms);
    };

    const session = () => {
      const rec = new Ctor();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      baseRef.current = text;
      rec.onresult = (e) => {
        let finalText = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        text = baseRef.current + finalText;
        setInput(text + interim);
        heardRef.current = true;
        armSilence(SILENCE_MS);
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        wantRef.current = false;
        setVoiceError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone permission was blocked." : "Couldn’t hear that, please try again.");
      };
      rec.onend = () => {
        if (wantRef.current) {
          if (text && !text.endsWith(" ")) text += " ";
          try {
            session();
            return;
          } catch {
            /* fall through and stop */
          }
        }
        window.clearTimeout(silenceRef.current);
        setListening(false);
        setInput((v) => v.trim());
      };
      recRef.current = rec;
      rec.start();
    };

    setVoiceError(null);
    setListening(true);
    armSilence(NO_SPEECH_MS);
    session();
  };

  const reset = () => {
    stopVoice();
    setTurns([]);
    setInput("");
    setAnswers({});
  };

  const last = turns.at(-1);
  const pending = last?.role === "assistant" && last.questions?.length ? last.questions : null;
  const submitAnswers = () => {
    if (!pending) return;
    const lines = pending.map((q, i) => `${q.question} ${answers[i]?.trim() || "you choose"}`);
    send(lines.join("\n"));
  };

  return (
    <CollapsibleCard
      title="QR Agent"
      subtitle="Describe what you need by typing or speaking. It designs QR codes, fills in any other code type and answers questions about the app."
      icon={<Sparkles size={18} />}
      action={
        turns.length > 0 && (
          <button type="button" onClick={reset} className="btn-ghost shrink-0 px-3 py-2 text-xs" title="Start a new conversation">
            <RotateCcw size={14} /> New
          </button>
        )
      }
    >
      <div className="space-y-4">
        <div ref={listRef} className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Try one of these, or say it in your own words:</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left text-sm text-slate-300 transition hover:border-violet-400/40 hover:text-white"
                  >
                    <Wand2 size={14} className="mr-2 inline text-violet-300" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3.5 py-2 text-sm text-white [overflow-wrap:anywhere]">
                  {t.content}
                </p>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-violet-300">
                  <Bot size={15} />
                </span>
                <div className={`min-w-0 max-w-[90%] space-y-2 rounded-2xl rounded-tl-md px-3.5 py-2 text-sm ${t.status === "off_topic" ? "border border-amber-400/20 bg-amber-400/10 text-amber-100" : "bg-white/[0.05] text-slate-200"}`}>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{t.content}</p>
                  {t.applied && (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs text-emerald-200">
                      <Sparkles size={12} /> Applied: {t.applied}
                    </p>
                  )}
                  {t.questions && t.questions.length > 0 && i === turns.length - 1 ? (
                    <div className="space-y-3 pt-1">
                      {t.questions.map((q, qi) => (
                        <div key={qi} className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-300">{q.question}</p>
                          {q.options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((o) => (
                                <button
                                  key={o}
                                  type="button"
                                  onClick={() => setAnswers((a) => ({ ...a, [qi]: o }))}
                                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs transition ${
                                    answers[qi] === o ? "border-violet-400/60 bg-violet-500/30 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"
                                  }`}
                                >
                                  {o}
                                </button>
                              ))}
                            </div>
                          )}
                          <input
                            className="input py-1.5 text-xs"
                            placeholder={q.options.length ? "Or type your own…" : "Type your answer…"}
                            value={q.options.includes(answers[qi] ?? "") ? "" : (answers[qi] ?? "")}
                            onChange={(e) => setAnswers((a) => ({ ...a, [qi]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && submitAnswers()}
                          />
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={submitAnswers}>
                          <ArrowUp size={14} /> Continue
                        </button>
                        {t.questions.some((q) => q.options.length) && (
                          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => send("You choose the design.")}>
                            You choose
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <LoaderCircle size={16} className="animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            rows={2}
            value={input}
            maxLength={1200}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={listening ? "Listening… pause for a moment when you’re done" : "e.g. A QR for my Instagram @arka with a pink gradient and hearts"}
            className="input min-h-[52px] flex-1 resize-none text-sm leading-relaxed"
          />
          {voiceOk && (
            <button
              type="button"
              onClick={toggleVoice}
              className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border transition ${
                listening ? "animate-pulse border-rose-400/50 bg-rose-500/20 text-rose-200" : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
              }`}
              title={listening ? "Stop listening" : "Speak your request"}
              aria-label={listening ? "Stop listening" : "Speak your request"}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button type="submit" className="btn-primary size-11 shrink-0 p-0" disabled={busy || !input.trim()} aria-label="Send">
            <ArrowUp size={18} />
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="size-4 accent-violet-500" checked={askFirst} onChange={(e) => setAskFirst(e.target.checked)} />
            Ask me about the design first
          </label>
          {voiceError ? <span className="text-amber-300">{voiceError}</span> : basic ? <span>Basic mode: AI is unavailable, simple requests still work.</span> : null}
        </div>
      </div>
    </CollapsibleCard>
  );
}
