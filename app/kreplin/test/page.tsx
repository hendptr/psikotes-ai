'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Keyboard from "@/components/kreplin/keyboard";
import {
  getOfflineKreplinQueue,
  saveOfflineKreplinResult,
  syncOfflineKreplinResults,
} from "@/lib/kreplin-offline";

type ResultLog = {
  timestamp: number;
  isCorrect: boolean;
  section: number;
};

type TestMode = "manual" | "auto" | "tryout";

const TRYOUT_SECTIONS = 60;
const TRYOUT_TIME_PER_SECTION = 30; // seconds

function buildPerSectionStats(logs: ResultLog[], totalSections: number | null) {
  if (!totalSections || totalSections <= 0) {
    return [];
  }
  const stats = Array.from({ length: totalSections }, (_, index) => ({
    index: index + 1,
    correct: 0,
    total: 0,
  }));
  logs.forEach((log) => {
    if (log.section >= 1 && log.section <= totalSections) {
      const slot = stats[log.section - 1];
      slot.total += 1;
      if (log.isCorrect) {
        slot.correct += 1;
      }
    }
  });
  return stats;
}

function buildSpeedTimeline(logs: ResultLog[]) {
  const buckets = new Map<number, { correct: number; total: number }>();
  logs.forEach((log) => {
    const bucketIndex = Math.floor(log.timestamp / 60);
    const bucket = buckets.get(bucketIndex) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (log.isCorrect) {
      bucket.correct += 1;
    }
    buckets.set(bucketIndex, bucket);
  });
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, value]) => ({ index, ...value }));
}

function TesKoran() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as TestMode) ?? "auto";
  const isTryout = mode === "tryout";

  const minutesParam = searchParams.get("minutes");
  const durationParam = searchParams.get("duration");
  const requestedDuration = minutesParam
    ? parseInt(minutesParam, 10) * 60
    : parseInt(durationParam ?? "600", 10);
  const customDuration = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? requestedDuration
    : 600;
  const initialDuration = isTryout ? TRYOUT_SECTIONS * TRYOUT_TIME_PER_SECTION : customDuration;

  const [previousTopNumber, setPreviousTopNumber] = useState<number | null>(null);
  const [currentTopNumber, setCurrentTopNumber] = useState(0);
  const [currentBottomNumber, setCurrentBottomNumber] = useState(0);
  const [nextBottomNumber, setNextBottomNumber] = useState(0);

  const [isTestRunning, setIsTestRunning] = useState(false);
  const [resultsLog, setResultsLog] = useState<ResultLog[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [totalTimeLeft, setTotalTimeLeft] = useState(initialDuration);
  const [sectionTimeLeft, setSectionTimeLeft] = useState(TRYOUT_TIME_PER_SECTION);
  const [currentSection, setCurrentSection] = useState(1);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [manualBuffer, setManualBuffer] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const hasEndedRef = useRef(false);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (isTestRunning) {
      timerId = setInterval(() => {
        setTotalTimeLeft((prev) => Math.max(0, prev - 1));
        if (isTryout) {
          setSectionTimeLeft((prev) => Math.max(0, prev - 1));
        }
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isTestRunning, isTryout]);

  useEffect(() => {
    if (!isTryout || !isTestRunning) return;
    if (sectionTimeLeft > 0) return;
    if (currentSection >= TRYOUT_SECTIONS) {
      endTest();
      return;
    }
    setCurrentSection((prev) => prev + 1);
    setSectionTimeLeft(TRYOUT_TIME_PER_SECTION);
    resetNumbersForNewSection();
  }, [sectionTimeLeft, isTryout, isTestRunning, currentSection]);

  useEffect(() => {
    if (totalTimeLeft <= 0 && isTestRunning) {
      endTest();
    }
  }, [totalTimeLeft, isTestRunning]);

  useEffect(() => {
    if (isTryout && currentSection > 1 && currentSection <= TRYOUT_SECTIONS) {
      setShowSectionModal(true);
      const timeoutId = setTimeout(() => setShowSectionModal(false), 1200);
      return () => clearTimeout(timeoutId);
    }
  }, [currentSection, isTryout]);

  useEffect(() => {
    startTest();
    const updateQueueCount = () => setPendingOfflineCount(getOfflineKreplinQueue().length);
    updateQueueCount();

    const handleOnline = () => {
      setIsOffline(false);
      void syncOfflineKreplinResults().then(({ remaining }) => {
        setPendingOfflineCount(remaining.length);
      });
    };
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      if (navigator.onLine) {
        void syncOfflineKreplinResults().then(({ remaining }) => {
          setPendingOfflineCount(remaining.length);
        });
      }
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetNumbersForNewSection = () => {
    setPreviousTopNumber(null);
    setCurrentTopNumber(Math.floor(Math.random() * 10));
    setCurrentBottomNumber(Math.floor(Math.random() * 10));
    setNextBottomNumber(Math.floor(Math.random() * 10));
  };

  const startTest = () => {
    setIsTestRunning(true);
    setStartTime(Date.now());
    setSaving(false);
    hasEndedRef.current = false;
    resetNumbersForNewSection();
  };

  const endTest = async () => {
    if (saving || hasEndedRef.current) return;
    hasEndedRef.current = true;
    setIsTestRunning(false);
    setSaving(true);

    const totalAnswered = resultsLog.length;
    const totalCorrect = resultsLog.filter((item) => item.isCorrect).length;
    const totalIncorrect = totalAnswered - totalCorrect;
    const accuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

    const perSectionStats = buildPerSectionStats(
      resultsLog,
      isTryout ? TRYOUT_SECTIONS : null
    );
    const speedTimeline = buildSpeedTimeline(resultsLog);

    const payload = {
      mode,
      durationSeconds: initialDuration,
      totalSections: isTryout ? TRYOUT_SECTIONS : null,
      totalAnswered,
      totalCorrect,
      totalIncorrect,
      accuracy,
      perSectionStats,
      speedTimeline,
    };

    const offlineResult = {
      id: `offline-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...payload,
    };

    const fallbackToOffline = () => {
      saveOfflineKreplinResult(offlineResult);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("kreplinFallbackResult", JSON.stringify(offlineResult));
      }
      setPendingOfflineCount(getOfflineKreplinQueue().length);
      router.push(`/kreplin/results?local=${offlineResult.id}`);
    };

    try {
      const response = await fetch("/api/kreplin-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Gagal menyimpan hasil.");
      }
      const json = await response.json();
      router.push(`/kreplin/results?resultId=${json.resultId}`);
    } catch (error) {
      console.error(error);
      fallbackToOffline();
    } finally {
      setSaving(false);
    }
  };

  const processAnswer = (answerKey: string) => {
    if (!answerKey || showSectionModal || !isTestRunning) return;

    const userAnswer = parseInt(answerKey.slice(-1), 10);
    if (Number.isNaN(userAnswer)) return;

    const sum = currentTopNumber + currentBottomNumber;
    const isCorrect = userAnswer === sum % 10;

    setResultsLog((prev) => [
      ...prev,
      {
        timestamp: (Date.now() - startTime) / 1000,
        isCorrect,
        section: currentSection,
      },
    ]);

    setPreviousTopNumber(currentTopNumber);
    setCurrentTopNumber(currentBottomNumber);
    setCurrentBottomNumber(nextBottomNumber);
    setNextBottomNumber(Math.floor(Math.random() * 10));
  };

  const handleKeyPress = (key: string) => {
    if (mode === "manual") {
      setManualBuffer((prev) => (prev + key).slice(-2));
    } else {
      processAnswer(key);
    }
  };

  const handleSubmit = () => {
    if (!manualBuffer) return;
    processAnswer(manualBuffer);
    setManualBuffer("");
  };

  const handleBackspace = () => {
    setManualBuffer((prev) => prev.slice(0, -1));
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const completionRate = useMemo(() => {
    return initialDuration > 0 ? (1 - totalTimeLeft / initialDuration) * 100 : 0;
  }, [initialDuration, totalTimeLeft]);

  return (
    <div className="flex h-screen flex-col gap-4 bg-slate-50 px-3 py-4">
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-3xl bg-white px-10 py-8 text-center shadow-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Kolom berikutnya</p>
            <p className="text-4xl font-semibold text-slate-900">Kolom {currentSection}</p>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tes Kreplin</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isTryout ? "Simulasi 60 Kolom" : "Latihan Bebas"}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          {isTryout && (
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs">
              Kolom {currentSection}/{TRYOUT_SECTIONS}
            </span>
          )}
          <span className="rounded-full bg-slate-900 px-4 py-2 font-mono text-lg text-white">
            {formatTime(totalTimeLeft)}
          </span>
        </div>
      </header>

      {(isOffline || pendingOfflineCount > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {isOffline
            ? "Mode offline: jawaban tetap disimpan lokal dan akan diunggah otomatis saat online."
            : `Ada ${pendingOfflineCount} hasil Tes Kreplin menunggu diunggah ke server.`}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
          <span>Progress</span>
          <span>{completionRate.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-center shadow">
        <div className="h-12 text-4xl font-semibold text-slate-300">
          {previousTopNumber ?? ""}
        </div>
        <div className="text-7xl font-bold text-slate-900">{currentTopNumber}</div>
        <div className="text-3xl text-slate-400">+</div>
        <div className="text-7xl font-bold text-slate-900">{currentBottomNumber}</div>
        <div className="h-12 text-4xl font-semibold text-slate-300 pt-2">{nextBottomNumber}</div>
        {mode === "manual" && (
          <div className="mt-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Jawabanmu</p>
            <p className="text-4xl font-semibold text-slate-800">{manualBuffer || "-"}</p>
          </div>
        )}
      </main>

      <footer className="flex flex-col items-center gap-3 pb-2">
        <Keyboard
          mode={mode === "manual" ? "manual" : "auto"}
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onSubmit={handleSubmit}
        />
        {saving && <p className="text-xs text-slate-500">Menyimpan hasil...</p>}
      </footer>
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <TesKoran />
    </Suspense>
  );
}
