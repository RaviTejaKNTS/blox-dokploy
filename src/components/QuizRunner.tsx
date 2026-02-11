"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuizData, QuizOption, QuizQuestion } from "@/lib/quiz-types";

const LEVEL_CONFIG = {
  easy: 5,
  medium: 5,
  hard: 5
} as const;

const STORAGE_VERSION = 1;

type Difficulty = keyof typeof LEVEL_CONFIG;

type AttemptQuestion = QuizQuestion & { difficulty: Difficulty; options: QuizOption[] };

type QuizRunnerProps = {
  quizCode: string;
  title: string;
  description?: string | null;
  questions: QuizData;
  heroImage?: string | null;
  heroAlt?: string | null;
};

type SessionState = { status: "loading" | "ready"; userId: string | null };

type Breakdown = Record<Difficulty, { correct: number; total: number }>;

type PersistedQuestion = {
  id: string;
  difficulty: Difficulty;
  optionOrder: string[];
};

type PersistedState = {
  version: number;
  attempt: PersistedQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  showSummary: boolean;
  savedAttemptKey?: string | null;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickQuestions(pool: QuizQuestion[], seenIds: Set<string>, count: number): QuizQuestion[] {
  const unseen = pool.filter((question) => !seenIds.has(question.id));
  const picks: QuizQuestion[] = [];

  const unseenPicks = shuffle(unseen).slice(0, Math.min(count, unseen.length));
  picks.push(...unseenPicks);

  if (picks.length < count) {
    const remainingPool = pool.filter((question) => !picks.some((picked) => picked.id === question.id));
    picks.push(...shuffle(remainingPool).slice(0, count - picks.length));
  }

  return picks;
}

function buildAttemptFromPool(quizData: QuizData): AttemptQuestion[] {
  const build = (difficulty: Difficulty) => {
    const list = quizData[difficulty] ?? [];
    return list.slice(0, LEVEL_CONFIG[difficulty]).map((question) => ({
      ...question,
      difficulty,
      options: question.options ?? []
    }));
  };

  return [...build("easy"), ...build("medium"), ...build("hard")];
}

function buildAttempt(quizData: QuizData, seenQuestionIds: string[]): AttemptQuestion[] {
  const seen = new Set(seenQuestionIds);
  const easy = pickQuestions(quizData.easy ?? [], seen, LEVEL_CONFIG.easy).map((question) => ({
    ...question,
    difficulty: "easy" as const,
    options: shuffle(question.options ?? [])
  }));
  const medium = pickQuestions(quizData.medium ?? [], seen, LEVEL_CONFIG.medium).map((question) => ({
    ...question,
    difficulty: "medium" as const,
    options: shuffle(question.options ?? [])
  }));
  const hard = pickQuestions(quizData.hard ?? [], seen, LEVEL_CONFIG.hard).map((question) => ({
    ...question,
    difficulty: "hard" as const,
    options: shuffle(question.options ?? [])
  }));

  return [...easy, ...medium, ...hard];
}

function mergeSeenIds(existing: string[], additions: string[]): string[] {
  const merged = new Set(existing);
  additions.forEach((id) => merged.add(id));
  return Array.from(merged);
}

function formatDifficulty(value: Difficulty) {
  if (value === "easy") return "Easy";
  if (value === "medium") return "Medium";
  return "Hard";
}

function getStorageKey(quizCode: string) {
  return `quiz:${quizCode}:state:v${STORAGE_VERSION}`;
}

function buildQuestionMap(quizData: QuizData) {
  const map = new Map<string, { question: QuizQuestion; difficulty: Difficulty }>();
  for (const question of quizData.easy ?? []) {
    map.set(question.id, { question, difficulty: "easy" });
  }
  for (const question of quizData.medium ?? []) {
    map.set(question.id, { question, difficulty: "medium" });
  }
  for (const question of quizData.hard ?? []) {
    map.set(question.id, { question, difficulty: "hard" });
  }
  return map;
}

function toPersistedAttempt(attempt: AttemptQuestion[]): PersistedQuestion[] {
  return attempt.map((question) => ({
    id: question.id,
    difficulty: question.difficulty,
    optionOrder: (question.options ?? []).map((option) => option.id)
  }));
}

function restoreAttempt(persisted: PersistedQuestion[], quizData: QuizData): AttemptQuestion[] | null {
  if (!Array.isArray(persisted) || persisted.length !== 15) return null;
  const questionMap = buildQuestionMap(quizData);
  const attempt: AttemptQuestion[] = [];

  for (const entry of persisted) {
    if (!entry || typeof entry.id !== "string") return null;
    const source = questionMap.get(entry.id);
    if (!source) return null;
    const difficulty = source.difficulty;
    const sourceQuestion = source.question;
    const optionsById = new Map((sourceQuestion.options ?? []).map((option) => [option.id, option]));
    const orderedOptions: QuizOption[] = [];
    const seenOptionIds = new Set<string>();

    for (const optionId of entry.optionOrder ?? []) {
      const option = optionsById.get(optionId);
      if (!option || seenOptionIds.has(optionId)) continue;
      seenOptionIds.add(optionId);
      orderedOptions.push(option);
    }

    for (const option of sourceQuestion.options ?? []) {
      if (seenOptionIds.has(option.id)) continue;
      orderedOptions.push(option);
    }

    if (!orderedOptions.length || !orderedOptions.find((option) => option.id === sourceQuestion.correctOptionId)) {
      return null;
    }

    attempt.push({
      ...sourceQuestion,
      difficulty,
      options: orderedOptions
    });
  }

  const expectedOrder: Difficulty[] = [
    ...Array.from({ length: LEVEL_CONFIG.easy }, () => "easy" as const),
    ...Array.from({ length: LEVEL_CONFIG.medium }, () => "medium" as const),
    ...Array.from({ length: LEVEL_CONFIG.hard }, () => "hard" as const)
  ];

  if (attempt.length !== expectedOrder.length) return null;
  for (let i = 0; i < expectedOrder.length; i += 1) {
    if (attempt[i]?.difficulty !== expectedOrder[i]) return null;
  }

  return attempt;
}

function sanitizeAnswers(
  answers: Record<string, string>,
  attempt: AttemptQuestion[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const questionMap = new Map(attempt.map((question) => [question.id, question]));
  for (const [questionId, optionId] of Object.entries(answers)) {
    const question = questionMap.get(questionId);
    if (!question) continue;
    if ((question.options ?? []).some((option) => option.id === optionId)) {
      result[questionId] = optionId;
    }
  }
  return result;
}

export function QuizRunner(props: QuizRunnerProps) {
  const { quizCode, title, description, questions } = props;
  const heroImage = props.heroImage ?? null;
  const heroAlt = props.heroAlt ?? null;
  const [session, setSession] = useState<SessionState>({ status: "loading", userId: null });
  const [progressStatus, setProgressStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const staticAttempt = useMemo(() => buildAttemptFromPool(questions), [questions]);
  const [attempt, setAttempt] = useState<AttemptQuestion[]>(() => staticAttempt);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [savedAttemptKey, setSavedAttemptKey] = useState<string | null>(null);
  const lastSavedAttempt = useRef<string | null>(null);
  const storageKey = useMemo(() => getStorageKey(quizCode), [quizCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/quizzes/session", { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        const userId = typeof payload?.userId === "string" ? payload.userId : null;
        setSession({ status: "ready", userId });
      } catch {
        if (!cancelled) {
          setSession({ status: "ready", userId: null });
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setProgressStatus("loading");
      try {
        const res = await fetch(`/api/quizzes/progress?code=${encodeURIComponent(quizCode)}`, {
          credentials: "include"
        });
        if (!res.ok) {
          if (!cancelled) {
            setSeenQuestionIds([]);
            setProgressStatus("ready");
          }
          return;
        }
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        const ids = Array.isArray(payload?.seenQuestionIds) ? payload.seenQuestionIds : [];
        setSeenQuestionIds(ids.filter((id: unknown) => typeof id === "string" && id.trim()));
        setProgressStatus("ready");
      } catch {
        if (!cancelled) {
          setSeenQuestionIds([]);
          setProgressStatus("ready");
        }
      }
    }

    if (session.status === "ready" && session.userId) {
      void loadProgress();
      return () => {
        cancelled = true;
      };
    }

    if (session.status === "ready" && !session.userId) {
      setSeenQuestionIds([]);
      setProgressStatus("ready");
    }

    return () => {
      cancelled = true;
    };
  }, [session.status, session.userId, quizCode]);

  const readyToStart = session.status === "ready" && progressStatus === "ready";

  const startNewAttempt = useCallback(() => {
    const nextAttempt = buildAttempt(questions, seenQuestionIds);
    setAttempt(nextAttempt);
    setCurrentIndex(0);
    setAnswers({});
    setShowSummary(false);
    setSavedAttemptKey(null);
    lastSavedAttempt.current = null;
  }, [questions, seenQuestionIds]);

  useEffect(() => {
    if (!readyToStart) return;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? (JSON.parse(raw) as PersistedState) : null;
        if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.attempt)) {
          const restoredAttempt = restoreAttempt(parsed.attempt, questions);
          if (restoredAttempt) {
            const rawAnswers =
              parsed.answers && typeof parsed.answers === "object" && !Array.isArray(parsed.answers)
                ? (parsed.answers as Record<string, string>)
                : {};
            const restoredAnswers = sanitizeAnswers(rawAnswers, restoredAttempt);
            const answeredCount = Object.keys(restoredAnswers).length;
            const total = restoredAttempt.length;
            const restoredShowSummary = Boolean(parsed.showSummary && answeredCount === total);
            const safeIndex = Math.min(
              Math.max(Number.isFinite(parsed.currentIndex) ? parsed.currentIndex : 0, 0),
              Math.max(0, total - 1)
            );
            setAttempt(restoredAttempt);
            setAnswers(restoredAnswers);
            setCurrentIndex(safeIndex);
            setShowSummary(restoredShowSummary);
            setSavedAttemptKey(parsed.savedAttemptKey ?? null);
            if (parsed.savedAttemptKey) {
              lastSavedAttempt.current = parsed.savedAttemptKey;
            }
            return;
          }
        }
      } catch {
        // Ignore invalid stored state
      }
    }

    if (attempt.length === 0) {
      startNewAttempt();
    }
  }, [readyToStart, attempt.length, startNewAttempt, questions, storageKey]);

  const currentQuestion = attempt[currentIndex] ?? null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const answeredCount = Object.keys(answers).length;

  const breakdown = useMemo<Breakdown>(() => {
    const base: Breakdown = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };
    for (const question of attempt) {
      base[question.difficulty].total += 1;
      if (answers[question.id] === question.correctOptionId) {
        base[question.difficulty].correct += 1;
      }
    }
    return base;
  }, [attempt, answers]);

  const totalCorrect = breakdown.easy.correct + breakdown.medium.correct + breakdown.hard.correct;
  const totalQuestions = attempt.length;
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  useEffect(() => {
    if (!showSummary || !attempt.length) return;
    const attemptKey = attempt.map((question) => question.id).join("|");
    if (attemptKey && lastSavedAttempt.current === attemptKey) return;

    const attemptIds = attempt.map((question) => question.id);
    const merged = mergeSeenIds(seenQuestionIds, attemptIds);
    setSeenQuestionIds(merged);
    lastSavedAttempt.current = attemptKey || "saved";
    setSavedAttemptKey(attemptKey || "saved");

    if (!session.userId) return;

    void fetch("/api/quizzes/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        code: quizCode,
        questionIds: merged,
        score: totalCorrect,
        total: totalQuestions,
        breakdown
      })
    });
  }, [showSummary, session.userId, attempt, quizCode, totalCorrect, totalQuestions, breakdown, seenQuestionIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!attempt.length) return;

    const payload: PersistedState = {
      version: STORAGE_VERSION,
      attempt: toPersistedAttempt(attempt),
      currentIndex,
      answers,
      showSummary,
      savedAttemptKey
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, [attempt, currentIndex, answers, showSummary, savedAttemptKey, storageKey]);

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion || currentAnswer) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const handleNext = () => {
    if (!currentQuestion || !currentAnswer) return;
    const isLast = currentIndex >= attempt.length - 1;
    if (isLast) {
      setShowSummary(true);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleRestart = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage failures
      }
    }
    startNewAttempt();
  };

  if (!readyToStart && staticAttempt.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-surface/60 p-8 text-center text-muted">
        Preparing your quiz...
      </div>
    );
  }

  if (!attempt.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-surface/60 p-8 text-center text-muted">
        No quiz questions available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">Roblox Quiz</p>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-muted md:text-base">{description}</p> : null}
      </header>

      {!showSummary ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          {heroImage ? (
            <div className="rounded-2xl border border-border/60 bg-surface/70 p-3 shadow-soft">
              <div className="aspect-video overflow-hidden rounded-xl bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt={heroAlt || title}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-accent">
                {formatDifficulty(currentQuestion?.difficulty ?? "easy")}
              </span>
              <span>
                Question {currentIndex + 1} of {totalQuestions}
              </span>
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-surface-muted">
              <div
                className="h-2 rounded-full bg-accent transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {currentQuestion?.image ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-background/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentQuestion.image} alt="Quiz prompt" className="h-auto w-full object-cover" />
              </div>
            ) : null}

            <h2 className="mt-6 text-lg font-semibold text-foreground md:text-xl">{currentQuestion?.question}</h2>

            <div className="mt-4 grid gap-3">
              {(currentQuestion?.options ?? []).map((option, index) => {
                const label = String.fromCharCode(65 + index);
                const selected = currentAnswer === option.id;
                const isCorrect = currentQuestion?.correctOptionId === option.id;
                const showResult = Boolean(currentAnswer);
                const baseClass =
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition";
                const stateClass = showResult
                  ? selected
                    ? isCorrect
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                      : "border-rose-500 bg-rose-500/10 text-rose-700"
                    : isCorrect
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
                      : "border-border/70 bg-surface/60 text-foreground"
                  : "border-border/70 bg-surface/60 text-foreground hover:border-accent/70 hover:bg-accent/10";

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`${baseClass} ${stateClass}`}
                    onClick={() => handleSelectOption(option.id)}
                    disabled={Boolean(currentAnswer)}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-xs font-semibold uppercase">
                      {label}
                    </span>
                    <span className="flex-1">{option.text}</span>
                  </button>
                );
              })}
            </div>

            {currentAnswer ? (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  currentAnswer === currentQuestion?.correctOptionId
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-700"
                }`}
              >
                {currentAnswer === currentQuestion?.correctOptionId
                  ? "Correct!"
                  : `Wrong. The correct answer is ${
                      currentQuestion?.options.find((option) => option.id === currentQuestion.correctOptionId)?.text ?? ""
                    }.`}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-soft transition hover:shadow-lg disabled:cursor-not-allowed disabled:bg-accent/40"
                onClick={handleNext}
                disabled={!currentAnswer}
              >
                {currentIndex >= attempt.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-surface/70 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Final Score</p>
              <p className="text-3xl font-semibold text-foreground">
                {totalCorrect}/{totalQuestions}
              </p>
              <p className="text-xs text-muted">
                Correct {totalCorrect} · Wrong {Math.max(0, totalQuestions - totalCorrect)}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-soft transition hover:shadow-lg"
              onClick={handleRestart}
            >
              Play Again
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(Object.keys(LEVEL_CONFIG) as Difficulty[]).map((level) => (
              <div key={level} className="rounded-xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{formatDifficulty(level)}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {breakdown[level].correct}/{breakdown[level].total}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-xs text-muted">
            If you are logged in, we will save your quiz history to keep your progress across attempts.
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-base font-semibold text-foreground">Answer review</h3>
            <div className="space-y-3">
              {attempt.map((question, index) => {
                const selectedId = answers[question.id];
                const selectedOption = question.options.find((option) => option.id === selectedId)?.text ?? "Not answered";
                const correctOption = question.options.find((option) => option.id === question.correctOptionId)?.text ?? "";
                const isCorrect = selectedId === question.correctOptionId;

                return (
                  <div key={question.id} className="rounded-xl border border-border/60 bg-background/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {index + 1}. {question.question}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          isCorrect ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {isCorrect ? "Correct" : "Wrong"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">Your answer: {selectedOption}</p>
                    <p className="text-xs text-muted">Correct answer: {correctOption}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
