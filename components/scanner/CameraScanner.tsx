"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flashlight, FlashlightOff, LoaderCircle, RefreshCw, ScanLine, ShieldAlert, Upload } from "lucide-react";
import { getDetector, type DetectedBarcode as Detected, type Found } from "@/lib/detector";

type Status = "idle" | "starting" | "scanning" | "paused" | "error";

const REPEAT_WINDOW_MS = 3000;
const SCAN_INTERVAL_MS = 120;

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

  const start = async (id?: string) => {
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
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: id ? { deviceId: { exact: id } } : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      setDeviceId(track.getSettings().deviceId);
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorch({ supported: Boolean(caps.torch), on: false });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput"));
      seenRef.current.clear();
      setStatus("scanning");
      getDetector();
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
    seenRef.current.clear();
    draw([]);
    videoRef.current?.play();
    setStatus("scanning");
  };

  useEffect(() => {
    if (status !== "scanning") return;
    let stopped = false;
    let timer: number | undefined;

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        try {
          const detector = await getDetector();
          const codes = await detector.detect(video);
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
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/10 bg-black sm:aspect-[4/3]">
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
                <button type="button" className="btn-primary" onClick={() => start(deviceId)}>
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
            <select value={deviceId} onChange={(e) => start(e.target.value)} className="input w-auto max-w-[60%] flex-1 cursor-pointer py-2">
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
          <button type="button" className="btn-ghost py-2" onClick={() => start(deviceId)} title="Restart camera">
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
