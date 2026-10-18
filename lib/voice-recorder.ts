/**
 * Records the microphone until the speaker goes quiet, for browsers without the Web Speech API (Firefox, Brave…).
 * The recording is then transcribed on the server.
 */

export const canRecord = () =>
  typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== "undefined";

const pickMimeType = () =>
  ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

export type Recording = {
  /** Stops now and keeps what was recorded. */
  stop: () => void;
  /** Stops now and throws the recording away. */
  cancel: () => void;
  /** The recording, or null when nothing was said (or it was cancelled). */
  done: Promise<Blob | null>;
};

export async function startRecording({ silenceMs, noSpeechMs, maxMs = 60_000 }: { silenceMs: number; noSpeechMs: number; maxMs?: number }): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = AudioCtx ? new AudioCtx() : null;
  const analyser = ctx?.createAnalyser();
  if (ctx && analyser) {
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
  }
  const samples = new Float32Array(analyser?.fftSize ?? 0);

  let heard = false;
  let cancelled = false;
  let floor = 0.01;
  const started = Date.now();
  let lastVoice = started;

  const finish = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };

  const timer = window.setInterval(() => {
    const now = Date.now();
    if (analyser) {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const level = Math.sqrt(sum / samples.length);
      if (now - started < 400) floor = Math.max(floor, level);
      else if (level > Math.max(0.02, floor * 2.5)) {
        heard = true;
        lastVoice = now;
      } else floor = floor * 0.98 + level * 0.02;
    } else {
      heard = true;
    }
    if ((heard && now - lastVoice > silenceMs) || (!heard && now - started > noSpeechMs) || now - started > maxMs) finish();
  }, 100);

  const done = new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      resolve(cancelled || !heard || !chunks.length ? null : new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
    };
  });

  recorder.start(250);
  return {
    stop: () => {
      heard = heard || Date.now() - started > 1000;
      finish();
    },
    cancel: () => {
      cancelled = true;
      finish();
    },
    done,
  };
}
