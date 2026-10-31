"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Lecture = {
  id: string;
  video_id: string;
  video_url: string;
  title: string;
  summary: string;
  notes?: string;
  transcript?: string;
  concepts: string[];
  formulas: string[];
  created_at: string;
};

type Tab = "analyze" | "library";

type LectureQuiz = {
  quiz_id: string;
  lecture_id: string;
  difficulty: string;
  total_questions: number;
  questions: {
    id: string;
    question: string;
    options: string[];
  }[];
};

type QuizResult = {
  score: number;
  total: number;
  percentage: number;
  results: {
    question_id: string;
    correct: boolean;
    correct_answer: number;
    explanation: string;
  }[];
};

type QuizAttempt = {
  id: string;
  quiz_id: string;
  lecture_id: string;
  score: number;
  total: number;
  percentage: number;
  created_at: string;
};

export default function YouTubeLectureIntelligence() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tab, setTab] = useState<Tab>("analyze");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [source, setSource] = useState("");
  const [quiz, setQuiz] = useState<LectureQuiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizCount, setQuizCount] = useState(5);
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}/api/youtube-lectures${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Request failed");
    }

    return data as T;
  }

  async function loadLibrary() {
    try {
      const data = await request<{ lectures: Lecture[] }>("");
      setLectures(data.lectures);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load library");
    }
  }

  async function loadQuizHistory(lectureId: string) {
    setHistoryLoading(true);
    try {
      const data = await request<{
        success: boolean;
        history: QuizAttempt[];
      }>(`/${encodeURIComponent(lectureId)}/quiz/history`);

      setQuizHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load quiz history");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  async function analyzeLecture() {
    if (!url.trim()) {
      setError("Please enter a YouTube video URL.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setAnswer("");
    setLecture(null);

    try {
      const data = await request<{
        success: boolean;
        source: string;
        lecture: Lecture;
      }>("/analyze", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          transcript: transcript.trim() || null,
        }),
      });

      setLecture(data.lecture);
      void loadQuizHistory(data.lecture.id);
      setSource(data.source);
      setNotice("Lecture analyzed and saved successfully.");
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function openLecture(id: string) {
    setLoading(true);
    setError("");
    setNotice("");
    setAnswer("");

    try {
      const data = await request<{ lecture: Lecture }>(
        `/${encodeURIComponent(id)}`
      );

      setLecture(data.lecture);
      void loadQuizHistory(data.lecture.id);
      setUrl(data.lecture.video_url);
      setSource("saved_library");
      setTab("analyze");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open lecture");
    } finally {
      setLoading(false);
    }
  }

  async function askQuestion() {
    if (!lecture || !question.trim()) return;

    setAsking(true);
    setError("");
    setAnswer("");

    try {
      const data = await request<{ answer: string }>(
        `/${encodeURIComponent(lecture.id)}/ask`,
        {
          method: "POST",
          body: JSON.stringify({ question: question.trim() }),
        }
      );

      setAnswer(data.answer);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question failed");
    } finally {
      setAsking(false);
    }
  }

  async function generateLectureQuiz() {
    if (!lecture) return;

    setQuizLoading(true);
    setError("");
    setNotice("");
    setQuiz(null);
    setQuizResult(null);
    setQuizAnswers({});

    try {
      const data = await request<{ success: boolean; quiz: LectureQuiz }>(
        `/${encodeURIComponent(lecture.id)}/quiz`,
        {
          method: "POST",
          body: JSON.stringify({
            count: quizCount,
            difficulty: quizDifficulty,
          }),
        }
      );

      setQuiz(data.quiz);
      setNotice("Your lecture-based practice quiz is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed");
    } finally {
      setQuizLoading(false);
    }
  }

  async function submitLectureQuiz() {
    if (!quiz) return;

    if (Object.keys(quizAnswers).length !== quiz.questions.length) {
      setError("Please answer every question before submitting.");
      return;
    }

    setQuizLoading(true);
    setError("");

    try {
      const data = await request<{ success: boolean; result: QuizResult }>(
        `/quiz/${encodeURIComponent(quiz.quiz_id)}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ answers: quizAnswers }),
        }
      );

      setQuizResult(data.result);
      await loadQuizHistory(quiz.lecture_id);
      setNotice("Quiz evaluated and saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz submission failed");
    } finally {
      setQuizLoading(false);
    }
  }

  function printNotes() {
    if (!lecture) return;
    window.print();
  }

  function newLecture() {
    setLecture(null);
    setUrl("");
    setTranscript("");
    setQuestion("");
    setAnswer("");
    setError("");
    setNotice("");
    setQuiz(null);
    setQuizResult(null);
    setQuizAnswers({});
    setQuizHistory([]);
    setTab("analyze");
  }

  return (
    <section className="space-y-6 rounded-3xl border border-violet-200/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-2xl md:p-8">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .lecture-print-area,
          .lecture-print-area * {
            visibility: visible !important;
          }
          .lecture-print-area {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            color: #111827 !important;
            background: white !important;
            padding: 24px !important;
          }
          .lecture-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-semibold tracking-wider text-violet-200">
            SARVAM EDUCATION AI · NEW
          </div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            YouTube Lecture Intelligence
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Transform educational lectures into structured notes, summaries,
            concepts and interactive learning sessions.
          </p>
        </div>

        <button
          onClick={newLecture}
          className="lecture-no-print rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          + New Lecture
        </button>
      </div>

      <div className="lecture-no-print flex gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setTab("analyze")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === "analyze"
              ? "bg-violet-500 text-white"
              : "bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
        >
          Analyze Lecture
        </button>

        <button
          onClick={() => {
            setTab("library");
            void loadLibrary();
          }}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === "library"
              ? "bg-violet-500 text-white"
              : "bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
        >
          My Lecture Library ({lectures.length})
        </button>
      </div>

      {tab === "analyze" && !lecture && (
        <div className="lecture-no-print space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm font-semibold">
            YouTube Video URL
          </label>

          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
          />

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Manual Transcript (Optional)
            </label>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste the lecture transcript here if YouTube captions are unavailable..."
              rows={5}
              className="w-full resize-y rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
            <p className="mt-1 text-xs text-slate-400">
              Maximum 300,000 characters. Manual transcript takes priority
              over automatic captions.
            </p>
          </div>

          <button
            onClick={analyzeLecture}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-semibold shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing Lecture..." : "✦ Generate AI Study Material"}
          </button>
        </div>
      )}

      {tab === "library" && (
        <div className="space-y-3">
          {lectures.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
              No saved lectures yet. Analyze your first lecture to get started.
            </div>
          ) : (
            lectures.map((item) => (
              <button
                key={item.id}
                onClick={() => void openLecture(item.id)}
                className="block w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-violet-400/50 hover:bg-white/10"
              >
                <div className="font-semibold">{item.title}</div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                  {item.summary}
                </p>
                <div className="mt-3 text-xs text-violet-300">
                  Open study material →
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {lecture && (
        <div className="lecture-print-area space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Your Lecture Study Material</h3>
              <p className="mt-1 text-xs text-slate-400">
                Source: {source === "manual" ? "Manual transcript" : source === "youtube_captions" ? "YouTube captions" : "Saved library"}
              </p>
            </div>

            <button
              onClick={printNotes}
              className="lecture-no-print rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              ↓ Export / Save PDF
            </button>
          </div>

          <article className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h4 className="text-lg font-bold text-violet-200">AI Summary</h4>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
              {lecture.summary}
            </p>
          </article>

          <article className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h4 className="text-lg font-bold text-violet-200">Detailed Notes</h4>
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
              {lecture.notes || lecture.summary}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h4 className="mb-3 text-lg font-bold text-violet-200">Key Concepts</h4>
            {lecture.concepts?.length ? (
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-200">
                {lecture.concepts.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No separate concepts were extracted.</p>
            )}
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h4 className="mb-3 text-lg font-bold text-violet-200">Formula Sheet</h4>
            {lecture.formulas?.length ? (
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-200">
                {lecture.formulas.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                No explicit formulas found in the lecture.
              </p>
            )}
          </article>

          <div className="lecture-no-print space-y-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
            <div>
              <h4 className="text-lg font-bold">Ask Your Lecture</h4>
              <p className="mt-1 text-xs text-slate-300">
                Ask questions and receive answers grounded in the stored lecture transcript.
              </p>
            </div>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What are the most important concepts explained in this lecture?"
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-violet-400"
            />

            <button
              onClick={askQuestion}
              disabled={asking || !question.trim()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {asking ? "Thinking..." : "Ask Question"}
            </button>

            {answer && (
              <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-slate-200">
                {answer}
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <h5 className="font-semibold">Generate Quiz From This Lecture</h5>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-300">
                  Number of questions
                  <select
                    value={quizCount}
                    onChange={(event) => setQuizCount(Number(event.target.value))}
                    disabled={quizLoading || !!quiz}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value={5}>5 Questions</option>
                    <option value={7}>7 Questions</option>
                    <option value={10}>10 Questions</option>
                  </select>
                </label>

                <label className="text-xs text-slate-300">
                  Difficulty
                  <select
                    value={quizDifficulty}
                    onChange={(event) => setQuizDifficulty(event.target.value)}
                    disabled={quizLoading || !!quiz}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>

              <button
                onClick={generateLectureQuiz}
                disabled={quizLoading}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {quizLoading ? "Generating Quiz..." : quiz ? "Generate New Quiz" : "✦ Generate Lecture Quiz"}
              </button>
            </div>

            {quiz && (
              <div className="space-y-5 rounded-xl border border-violet-400/20 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-bold">Lecture Practice Quiz</h5>
                  <span className="text-xs text-violet-300">
                    {quiz.total_questions} Questions · {quiz.difficulty}
                  </span>
                </div>

                {quiz.questions.map((item, index) => {
                  const result = quizResult?.results.find(
                    (entry) => entry.question_id === item.id
                  );

                  return (
                    <div key={item.id} className="space-y-3 border-b border-white/10 pb-5 last:border-0">
                      <p className="text-sm font-semibold">
                        {index + 1}. {item.question}
                      </p>

                      <div className="space-y-2">
                        {item.options.map((option, optionIndex) => {
                          const selected = quizAnswers[item.id] === optionIndex;
                          const correct = result?.correct_answer === optionIndex;

                          return (
                            <button
                              key={optionIndex}
                              type="button"
                              disabled={!!quizResult || quizLoading}
                              onClick={() => {
                                setQuizAnswers((previous) => ({
                                  ...previous,
                                  [item.id]: optionIndex,
                                }));
                              }}
                              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${
                                quizResult && correct
                                  ? "border-emerald-400 bg-emerald-500/15"
                                  : quizResult && selected && !result?.correct
                                    ? "border-red-400 bg-red-500/15"
                                    : selected
                                      ? "border-violet-400 bg-violet-500/20"
                                      : "border-white/10 bg-white/5 hover:bg-white/10"
                              }`}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs">
                                {String.fromCharCode(65 + optionIndex)}
                              </span>
                              <span>{option}</span>
                              {quizResult && correct && (
                                <span className="ml-auto text-xs text-emerald-300">Correct</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {result && (
                        <div className="rounded-lg bg-white/5 p-3 text-xs leading-6 text-slate-300">
                          <span className={result.correct ? "text-emerald-300" : "text-red-300"}>
                            {result.correct ? "Correct answer" : "Incorrect answer"}
                          </span>
                          <p className="mt-1">{result.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!quizResult ? (
                  <button
                    onClick={submitLectureQuiz}
                    disabled={quizLoading}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {quizLoading ? "Evaluating..." : "Submit Answers"}
                  </button>
                ) : (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
                    <p className="text-sm text-emerald-200">Your Quiz Result</p>
                    <p className="mt-2 text-4xl font-bold">
                      {quizResult.percentage}%
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {quizResult.score} out of {quizResult.total} correct
                    </p>
                    <button
                      onClick={() => {
                        setQuiz(null);
                        setQuizResult(null);
                        setQuizAnswers({});
                      }}
                      className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Try Another Quiz
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h5 className="font-semibold">Recent Quiz Attempts</h5>
                <span className="text-xs text-slate-400">
                  {quizHistory.length} saved
                </span>
              </div>

              {historyLoading ? (
                <p className="text-sm text-slate-400">Loading quiz history...</p>
              ) : quizHistory.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No quiz attempts yet. Complete a lecture quiz to see your progress here.
                </p>
              ) : (
                <div className="space-y-2">
                  {quizHistory.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {attempt.score}/{attempt.total} correct
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(attempt.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-violet-300">
                        {attempt.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-slate-400">
        SARVAM processes available captions or the transcript you provide.
        It does not independently watch or listen to the video. Transcript
        availability depends on YouTube caption settings and access.
      </p>
    </section>
  );
}
