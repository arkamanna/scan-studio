"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flashlight, FlashlightOff, LoaderCircle, RefreshCw, ScanLine, ShieldAlert, SwitchCamera, Upload } from "lucide-react";
import { getLiveDetector, type DetectedBarcode as Detected, type Found } from "@/lib/detector";

type Status = "idle" | "starting" | "scanning" | "paused" | "error";
type Facing = "user" | "environment";
type CameraChoice = { deviceId?: string; facing?: Facing };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A code must leave the frame for this long before it counts as a new scan. */
const REPEAT_WINDOW_MS = 1500;
const SCAN_INTERVAL_MS = 40;
/** Longest side of the frame handed to the wasm decoder; bigger frames are slower without reading better. */
const DECODE_MAX_SIDE = 960;

function cameraError(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera permission was blocked. Allow camera access for this site in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return (e as Error)?.message || "Couldn’t start the camera.";
}

export default function CameraScanner({
  onDetect,
  continuous,
  onUseUpload,
}: {
  onDetect: (found: Found[]) => void;
  continuous: boolean;
  onUseUpload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const seenRef = useRef(new Map<string, number>());
  const onDetectRef = useRef(onDetect);
  const continuousRef = useRef(continuous);
  onDetectRef.current = onDetect;
  continuousRef.current = continuous;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [insecure, setInsecure] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>();
  const [facing, setFacing] = useState<Facing>("environment");
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const draw = (codes: Detected[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    const scale = Math.max(cw / video.videoWidth, ch / video.videoHeight);
    const ox = (cw - video.videoWidth * scale) / 2;
    const oy = (ch - video.videoHeight * scale) / 2;
    for (const code of codes) {
      ctx.beginPath();
      code.cornerPoints.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x * scale + ox, p.y * scale + oy));
      ctx.closePath();
      ctx.fillStyle = "rgba(139, 92, 246, 0.25)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#22d3ee";
      ctx.stroke();
    }
  };

  const feedback = () => {
    navigator.vibrate?.(70);
    const ctx = audioRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1046;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  };

  /** Asks for the chosen camera; exact matches first, then looser constraints (iPhones reject some exact requests). */
  const openStream = async ({ deviceId: id, facing: face }: CameraChoice) => {
    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const attempts: MediaTrackConstraints[] = id
      ? [{ deviceId: { exact: id }, ...size }, { deviceId: { exact: id } }, { deviceId: id }]
      : [{ facingMode: { exact: face ?? "environment" }, ...size }, { facingMode: { ideal: face ?? "environment" }, ...size }, {}];
    let lastError: unknown;
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video });
      } catch (e) {
        lastError = e;
        if ((e as DOMException)?.name === "NotAllowedError") break;
      }
    }
    throw lastError;
  };

  const start = async (choice: CameraChoice = {}) => {
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setInsecure(true);
      setStatus("error");
      return;
    }
    setStatus("starting");
    try {
      audioRef.current ??= new AudioContext();
    } catch {
      /* sound is optional */
    }
    const hadStream = Boolean(streamRef.current);
    stop();
    const video = videoRef.current!;
    video.srcObject = null;
    // Mobile browsers need a moment to release the previous camera before another one can open.
    if (hadStream) await sleep(250);
    try {
      const stream = await openStream(choice);
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setDeviceId(settings.deviceId);
      if (settings.facingMode === "user" || settings.facingMode === "environment") setFacing(settings.facingMode);
      else if (choice.facing) setFacing(choice.facing);
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
      setTorch({ supported: Boolean(caps.torch), on: false });
      if (caps.focusMode?.includes("continuous")) {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput"));
      seenRef.current.clear();
      setStatus("scanning");
      getLiveDetector();
    } catch (e) {
      setError(cameraError(e));
      setStatus("error");
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  const resume = () => {
    // Codes still in front of the camera stay "seen", so they don't instantly re-trigger the last result.
    const now = Date.now();
    seenRef.current.forEach((_, raw) => seenRef.current.set(raw, now));
    draw([]);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    videoRef.current?.play();
    setStatus("scanning");
  };

  useEffect(() => {
    if (status !== "scanning") return;
    let stopped = false;
    let timer: number | undefined;
    let frame = 0;

    /** Grabs the next region to decode: mostly the centre (where the guide box is), every third frame the whole view. */
    const grab = (video: HTMLVideoElement) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const whole = frame++ % 3 === 2;
      const sw = whole ? vw : Math.round(vw * 0.7);
      const sh = whole ? vh : Math.round(vh * 0.7);
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);
      const scale = Math.min(1, DECODE_MAX_SIDE / Math.max(sw, sh));
      const canvas = (frameRef.current ??= document.createElement("canvas"));
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      canvas.getContext("2d", { willReadFrequently: true })!.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return { canvas, sx, sy, scale };
    };

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        try {
          const { detector, native } = await getLiveDetector();
          let codes: Detected[];
          if (native) {
            codes = await detector.detect(video);
          } else {
            const { canvas, sx, sy, scale } = grab(video);
            codes = (await detector.detect(canvas)).map((c) => ({
              ...c,
              cornerPoints: c.cornerPoints.map((p) => ({ x: sx + p.x / scale, y: sy + p.y / scale })) as Detected["cornerPoints"],
            }));
          }
          if (stopped) return;
          draw(codes);
          const now = Date.now();
          const fresh = codes.filter((c) => now - (seenRef.current.get(c.rawValue) ?? 0) > REPEAT_WINDOW_MS);
          codes.forEach((c) => seenRef.current.set(c.rawValue, now));
          if (fresh.length) {
            feedback();
            onDetectRef.current(fresh.map((c) => ({ raw: c.rawValue, format: c.format })));
            if (!continuousRef.current) {
              video.pause();
              setStatus("paused");
              return;
            }
          }
        } catch {
          /* decoder still warming up or frame not ready */
        }
      }
      timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
    };

    tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [status]);

  const live = status === "scanning" || status === "paused";

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative aspect-[3/4] w-full scroll-mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black sm:aspect-[4/3]">
        <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 size-full object-cover ${live ? "" : "invisible"}`} />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

        {live && (
          <div className="pointer-events-none absolute inset-[12%] sm:inset-x-[22%] sm:inset-y-[10%]">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
              <span key={c} className={`absolute size-10 border-white/90 ${c}`} />
            ))}
            {status === "scanning" && <span className="scan-line absolute inset-x-2 h-0.5 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_2px_rgba(34,211,238,0.6)]" />}
          </div>
        )}

        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {status === "starting" ? (
              <>
                <LoaderCircle size={36} className="animate-spin text-violet-300" />
                <p className="text-sm text-slate-300">Waiting for camera permission…</p>
              </>
            ) : insecure ? (
              <>
                <ShieldAlert size={40} className="text-amber-300" />
                <p className="max-w-sm text-sm text-slate-300">
                  Browsers only allow the camera on secure (<b>https://</b>) sites or <b>localhost</b>. Open the deployed Vercel site, or use
                  image upload instead.
                </p>
                <button type="button" className="btn-ghost" onClick={onUseUpload}>
                  <Upload size={16} /> Upload an image instead
                </button>
              </>
            ) : (
              <>
                <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30">
                  {status === "error" ? <CameraOff size={28} className="text-amber-300" /> : <Camera size={28} />}
                </span>
                {error ? <p className="max-w-sm text-sm text-amber-200">{error}</p> : <p className="max-w-xs text-sm text-slate-400">Point your camera at any QR code or barcode. We’ll ask for camera permission first.</p>}
                <button type="button" className="btn-primary" onClick={() => start(deviceId ? { deviceId } : { facing })}>
                  <Camera size={16} /> {error ? "Try again" : "Start camera"}
                </button>
              </>
            )}
          </div>
        )}

        {status === "paused" && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/80 to-transparent p-5 pt-12">
            <button type="button" className="btn-primary" onClick={resume}>
              <ScanLine size={16} /> Scan another code
            </button>
          </div>
        )}
      </div>

      {live && (
        <div className="flex flex-wrap items-center gap-2">
          {cameras.length > 1 && (
            <button type="button" className="btn-ghost py-2" onClick={() => start({ facing: facing === "user" ? "environment" : "user" })} title="Switch between front and back camera">
              <SwitchCamera size={16} /> Flip
            </button>
          )}
          {cameras.length > 2 && (
            <select value={deviceId} onChange={(e) => start({ deviceId: e.target.value })} className="input w-auto min-w-0 max-w-[50%] flex-1 cursor-pointer py-2">
              {cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}
          {torch.supported && (
            <button type="button" className="btn-ghost py-2" onClick={toggleTorch}>
              {torch.on ? <FlashlightOff size={16} /> : <Flashlight size={16} />} {torch.on ? "Light off" : "Light"}
            </button>
          )}
          <button type="button" className="btn-ghost py-2" onClick={() => start(deviceId ? { deviceId } : { facing })} title="Restart camera">
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="btn-ghost ml-auto py-2"
            onClick={() => {
              stop();
              draw([]);
              setStatus("idle");
            }}
          >
            <CameraOff size={16} /> Stop
          </button>
        </div>
      )}
    </div>
  );
}
