"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flashlight, FlashlightOff, LoaderCircle, RefreshCw, ScanLine, ShieldAlert, SwitchCamera, Upload } from "lucide-react";
import { getDetector, getLiveDetector, type DetectedBarcode as Detected, type Found } from "@/lib/detector";

type Status = "idle" | "starting" | "scanning" | "paused" | "error";
type Facing = "user" | "environment";
type CameraChoice = { deviceId?: string; facing?: Facing };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sideOf = (label: string): Facing | null =>
  /front|user|facetime|selfie/i.test(label) ? "user" : /back|rear|environment|world/i.test(label) ? "environment" : null;

/** A code must leave the frame for this long before it counts as a new scan. */
const REPEAT_WINDOW_MS = 1500;
const SCAN_INTERVAL_MS = 40;
/** Longest side handed to the decoder for wide views; bigger frames are slower without reading better. */
const DECODE_MAX_SIDE = 960;
const ZOOM_STEPS = [1, 2, 3, 4];

/**
 * Decode passes, cycled frame by frame: share of the view to crop, longest side to decode at, and how far a crop
 * may be enlarged. zxing needs roughly 3 pixels per module, so tiny codes get full-resolution and enlarged centre
 * crops; the wider passes catch codes held off-centre.
 */
const PASSES: { share: number; maxSide: number; maxScale: number }[] = [
  { share: 0.45, maxSide: 1600, maxScale: 1 },
  { share: 0.75, maxSide: DECODE_MAX_SIDE, maxScale: 1 },
  { share: 0.2, maxSide: 1200, maxScale: 3 },
  { share: 0.45, maxSide: 1600, maxScale: 1 },
  { share: 1, maxSide: DECODE_MAX_SIDE, maxScale: 1 },
  { share: 0.12, maxSide: 1000, maxScale: 4 },
];

type Zoom = { hardware: boolean; min: number; max: number; value: number };

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
  const lastRequestRef = useRef<{ choices: CameraChoice[]; avoid?: string } | null>(null);
  const [zoom, setZoom] = useState<Zoom>({ hardware: false, min: 1, max: 4, value: 1 });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const triedMultiCamRef = useRef(false);
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

  /**
   * Asks for one camera: exact match first, then looser constraints (iPhones reject some exact requests).
   * "Busy" errors are retried because phones release the previous camera asynchronously.
   */
  const openStream = async ({ deviceId: id, facing: face }: CameraChoice) => {
    const size = { width: { ideal: 2560 }, height: { ideal: 1440 } };
    const attempts: MediaTrackConstraints[] = id
      ? [{ deviceId: { exact: id }, ...size }, { deviceId: { exact: id } }]
      : [{ facingMode: { exact: face ?? "environment" }, ...size }, { facingMode: face ?? "environment" }];
    let lastError: unknown;
    for (const video of attempts) {
      for (const wait of [0, 400, 900]) {
        if (wait) await sleep(wait);
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: false, video });
        } catch (e) {
          lastError = e;
          const name = (e as DOMException)?.name;
          if (name === "NotAllowedError" || name === "SecurityError") throw e;
          if (name !== "NotReadableError" && name !== "AbortError") break;
        }
      }
    }
    throw lastError;
  };

  /**
   * Opens the first camera in `choices` that works. With `avoid`, a camera with that device id is skipped,
   * so switching never silently lands back on the camera that was already open.
   */
  const start = async (choices: CameraChoice | CameraChoice[] = {}, avoid?: string) => {
    const list = Array.isArray(choices) ? choices : [choices];
    lastRequestRef.current = { choices: list, avoid };
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
    const video = videoRef.current!;
    const release = async () => {
      const had = Boolean(streamRef.current);
      stop();
      video.srcObject = null;
      if (had) await sleep(300);
    };

    await release();
    let stream: MediaStream | null = null;
    let lastError: unknown = null;
    for (const choice of list) {
      try {
        const candidate = await openStream(choice);
        const id = candidate.getVideoTracks()[0]?.getSettings().deviceId;
        if (avoid && id === avoid && choice !== list[list.length - 1]) {
          candidate.getTracks().forEach((t) => t.stop());
          await sleep(300);
          continue;
        }
        stream = candidate;
        break;
      } catch (e) {
        lastError = e;
        if ((e as DOMException)?.name === "NotAllowedError") break;
      }
    }

    if (!stream) {
      setError(cameraError(lastError));
      setStatus("error");
      return;
    }

    try {
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setDeviceId(settings.deviceId);
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setCameras(devices);
      const label = devices.find((d) => d.deviceId === settings.deviceId)?.label ?? track.label;
      setFacing(settings.facingMode === "user" || settings.facingMode === "environment" ? settings.facingMode : (sideOf(label) ?? "environment"));
      lastRequestRef.current = { choices: [{ deviceId: settings.deviceId }] };
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
        focusMode?: string[];
        zoom?: { min: number; max: number };
      };
      setTorch({ supported: Boolean(caps.torch), on: false });
      if (caps.focusMode?.includes("continuous")) {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }
      const hwZoom = caps.zoom && caps.zoom.max > 1 ? caps.zoom : null;
      setZoom(hwZoom ? { hardware: true, min: hwZoom.min, max: Math.min(hwZoom.max, 8), value: hwZoom.min } : { hardware: false, min: 1, max: 4, value: 1 });

      // iPhone Pro models: the multi-lens "Triple/Dual Wide" back camera switches to macro for close-up codes.
      const back = !list.some((c) => c.facing === "user" || c.deviceId);
      const multi = devices.find((d) => /triple|dual wide/i.test(d.label));
      if (back && multi && multi.deviceId !== settings.deviceId && !triedMultiCamRef.current) {
        triedMultiCamRef.current = true;
        start({ deviceId: multi.deviceId });
        return;
      }
      seenRef.current.clear();
      setStatus("scanning");
      getLiveDetector();
    } catch (e) {
      stop();
      setError(cameraError(e));
      setStatus("error");
    }
  };

  /** Front/back switch: asks by facing first, then tries every other camera (best label match first). */
  const flip = () => {
    const want: Facing = facing === "user" ? "environment" : "user";
    const others = cameras
      .filter((c) => c.deviceId && c.deviceId !== deviceId)
      .sort((a, b) => Number(sideOf(b.label) === want) - Number(sideOf(a.label) === want));
    start([{ facing: want }, ...others.map((c) => ({ deviceId: c.deviceId }))], deviceId);
  };

  const retry = () => {
    const last = lastRequestRef.current;
    if (last) start(last.choices, last.avoid);
    else start({ facing });
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

  const applyZoom = async (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (zoom.hardware && track) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
      } catch {
        setZoom({ hardware: false, min: 1, max: 4, value });
        return;
      }
    }
    setZoom((z) => ({ ...z, value }));
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

    /** Grabs the next centre region to decode (see PASSES); digital zoom narrows every crop further. */
    const grab = (video: HTMLVideoElement) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const { share, maxSide, maxScale } = PASSES[frame++ % PASSES.length];
      const digital = zoomRef.current.hardware ? 1 : zoomRef.current.value;
      const f = Math.min(1, share / digital);
      const sw = Math.round(vw * f);
      const sh = Math.round(vh * f);
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);
      const scale = Math.min(maxScale, maxSide / Math.max(sw, sh));
      const canvas = (frameRef.current ??= document.createElement("canvas"));
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return { canvas, sx, sy, scale };
    };

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        try {
          const liveDetector = await getLiveDetector();
          let codes: Detected[];
          if (liveDetector.native && frame % 2 === 1 && (zoomRef.current.hardware || zoomRef.current.value === 1)) {
            frame++;
            codes = await liveDetector.detector.detect(video);
          } else {
            const { canvas, sx, sy, scale } = grab(video);
            // Built-in detectors skip Micro QR, rMQR, MaxiCode, DataBar…; every few frames let zxing look too.
            const detector = liveDetector.native && frame % 3 === 0 ? await getDetector() : liveDetector.detector;
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
      <div
        ref={containerRef}
        className="relative aspect-square max-h-[56svh] w-full scroll-mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black sm:aspect-[4/3] sm:max-h-[70vh]"
      >
        <div
          className="absolute inset-0 origin-center transition-transform duration-200"
          style={{ transform: !zoom.hardware && zoom.value > 1 ? `scale(${zoom.value})` : undefined }}
        >
          <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 size-full object-cover ${live ? "" : "invisible"}`} />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
        </div>

        {live && (
          <div className="pointer-events-none absolute inset-[16%] sm:inset-x-[24%] sm:inset-y-[12%]">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
              <span key={c} className={`absolute size-8 border-white/90 sm:size-10 ${c}`} />
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
                <button type="button" className="btn-primary" onClick={retry}>
                  <Camera size={16} /> {error ? "Try again" : "Start camera"}
                </button>
              </>
            )}
          </div>
        )}

        {status === "scanning" && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <div className="flex gap-1 rounded-full bg-black/55 p-1 backdrop-blur" role="group" aria-label="Zoom">
              {ZOOM_STEPS.filter((z) => z * zoom.min <= zoom.max).map((z) => {
                const value = z * zoom.min;
                const active = Math.abs(zoom.value - value) < 0.05;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => applyZoom(value)}
                    aria-pressed={active}
                    className={`grid size-9 place-items-center rounded-full text-xs font-semibold transition ${active ? "bg-white text-slate-900" : "text-white hover:bg-white/15"}`}
                  >
                    {z}×
                  </button>
                );
              })}
            </div>
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

      {status === "scanning" && (
        <p className="text-center text-xs text-slate-500">Tiny code? Hold the phone about 15 cm away and tap 2× or 3× instead of moving closer.</p>
      )}

      {live && (
        <div className="flex flex-wrap items-center gap-2">
          {cameras.length > 1 && (
            <button type="button" className="btn-ghost py-2" onClick={flip} title="Switch between front and back camera">
              <SwitchCamera size={16} /> Flip
            </button>
          )}
          {cameras.length > 2 && (
            <select value={deviceId} onChange={(e) => start({ deviceId: e.target.value }, deviceId)} className="input w-auto min-w-0 max-w-[50%] flex-1 cursor-pointer py-2">
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
          <button type="button" className="btn-ghost py-2" onClick={retry} title="Restart camera">
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
