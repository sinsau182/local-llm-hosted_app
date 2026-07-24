"use client";

import { useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api/client";
import { appConfig } from "@/config/app-config";
import type { SpeechFormat, TranscriptionResponse } from "@/lib/types/api";

// Kokoro's built-in voices (a-prefixed = American English). The backend falls
// back to its configured default when the field is left blank.
const VOICES = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sky",
  "am_adam",
  "am_michael",
  "bf_emma",
  "bm_george",
];

const FORMATS: SpeechFormat[] = ["mp3", "wav", "opus", "flac"];

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export default function AudioPage() {
  if (!appConfig.features.audioPage) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Audio</p>
        <h1 className="font-display text-4xl font-semibold">Speech &amp; transcription</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          Text-to-speech runs on Kokoro and speech-to-text on Whisper — both are CPU-only
          sidecars that stay always-on, so requests are served synchronously (no queue).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TextToSpeech />
        <SpeechToText />
      </div>
    </section>
  );
}

// ─── Text → Speech (Kokoro) ──────────────────────────────────────────────────
function TextToSpeech() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(VOICES[0]);
  const [format, setFormat] = useState<SpeechFormat>("mp3");
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Revoke the previous object URL whenever it changes / on unmount.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function generate() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await apiClient.synthesizeSpeech({
        input: text.trim(),
        voice,
        response_format: format,
        speed,
      });
      setAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
      <div>
        <h2 className="font-display text-2xl font-semibold">Text to speech</h2>
        <p className="text-sm text-ink/60">Kokoro-82M · CPU</p>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
        rows={5}
        placeholder="Type the text you want spoken…"
        className="w-full resize-y rounded-2xl border border-ink/15 bg-sand/40 p-3 text-sm outline-none focus:border-ink/40"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs uppercase tracking-[0.14em] text-ink/50">Voice</span>
          <select
            value={voice}
            onChange={(event) => setVoice(event.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-sand/40 p-2"
          >
            {VOICES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase tracking-[0.14em] text-ink/50">Format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as SpeechFormat)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-sand/40 p-2"
          >
            {FORMATS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-sm">
        <span className="text-xs uppercase tracking-[0.14em] text-ink/50">Speed · {speed.toFixed(2)}×</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="mt-1 w-full"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void generate()} disabled={loading || !text.trim()}>
          {loading ? "Synthesizing…" : "Generate speech"}
        </Button>
        {audioUrl && (
          <a href={audioUrl} download={`speech.${format}`} className="text-sm underline text-ink/70">
            Download
          </a>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {audioUrl && <audio src={audioUrl} controls className="w-full" />}
    </article>
  );
}

// ─── Speech → Text (Whisper) ─────────────────────────────────────────────────
function SpeechToText() {
  const [file, setFile] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResponse | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setFile(picked);
    setFileName(picked?.name ?? "");
    setResult(null);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setFile(blob);
        setFileName("recording.webm");
        setResult(null);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function transcribe() {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.transcribe(file, { filename: fileName || "audio.webm" });
      setResult(response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
      <div>
        <h2 className="font-display text-2xl font-semibold">Speech to text</h2>
        <p className="text-sm text-ink/60">Whisper large-v3 · CPU</p>
      </div>

      <label className="text-sm">
        <span className="text-xs uppercase tracking-[0.14em] text-ink/50">Audio file</span>
        <input
          type="file"
          accept="audio/*"
          onChange={onPick}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sand"
        />
      </label>

      {canRecord && (
        <div className="flex items-center gap-3">
          {recording ? (
            <Button type="button" onClick={stopRecording} className="bg-red-600">
              Stop recording
            </Button>
          ) : (
            <Button type="button" onClick={() => void startRecording()}>
              Record from mic
            </Button>
          )}
          {fileName && <span className="truncate text-sm text-ink/60">{fileName}</span>}
        </div>
      )}

      <Button type="button" onClick={() => void transcribe()} disabled={loading || !file}>
        {loading ? "Transcribing…" : "Transcribe"}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-2xl border border-ink/10 bg-sand/50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-ink/50">
            Transcript{result.language ? ` · ${result.language}` : ""}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{result.text || "(no speech detected)"}</p>
        </div>
      )}
    </article>
  );
}
