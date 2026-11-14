"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;
type WakeLock = { release: () => Promise<void> };

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Hands-free browser dictation. Phones end recognition after a pause, so it
 * restarts until the person taps Stop, and keeps the screen awake meanwhile.
 */
export function useSpeechCapture(onFinal: (phrase: string) => void) {
  const [supported, setSupported] = useState(false),
    [listening, setListening] = useState(false),
    [interim, setInterim] = useState(""),
    [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null),
    wanted = useRef(false),
    wake = useRef<WakeLock | null>(null),
    final = useRef(onFinal);
  final.current = onFinal;
  useEffect(() => setSupported(Boolean(recognitionConstructor())), []);

  const releaseWake = useCallback(() => {
    void wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);
  const stop = useCallback(() => {
    wanted.current = false;
    setListening(false);
    setInterim("");
    releaseWake();
    try { recognition.current?.stop(); } catch {}
  }, [releaseWake]);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError("This browser cannot listen continuously. Use the keyboard microphone instead.");
      return;
    }
    setError("");
    const rec = new Constructor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i], phrase = result[0].transcript.trim();
        if (!phrase) continue;
        if (result.isFinal) final.current(phrase);
        else pending += `${pending ? " " : ""}${phrase}`;
      }
      setInterim(pending);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access is blocked. Allow it in your browser settings, or use the keyboard microphone.");
        stop();
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("Listening paused. Tap Start listening to continue.");
      }
    };
    rec.onend = () => {
      if (!wanted.current) return;
      try { rec.start(); } catch { stop(); }
    };
    recognition.current = rec;
    wanted.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wanted.current = false;
      setError("Unable to start listening. Try again.");
      return;
    }
    const lock = (navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<WakeLock> } }).wakeLock;
    void lock?.request("screen").then((value) => { wake.current = value; }).catch(() => {});
  }, [stop]);

  useEffect(() => () => {
    wanted.current = false;
    try { recognition.current?.abort(); } catch {}
    void wake.current?.release().catch(() => {});
  }, []);

  return { supported, listening, interim, error, start, stop };
}
