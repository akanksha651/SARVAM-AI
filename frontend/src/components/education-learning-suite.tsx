"use client";

import { useEffect, useMemo, useState } from "react";

type StudyTask = {
  id: string;
  day: string;
  topic: string;
  minutes: number;
  done: boolean;
};

type NoteItem = {
  id: string;
  subject: string;
  topic: string;
  content: string;
  createdAt: string;
};

type QuizQuestion = {
  question: string;
  options: Record<string, string>;
};

type QuizResult = {
  score: number;
  total_questions: number;
  percentage: number;
  results: {
    question_id: string;
    selected_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation: string;
  }[];
};

type QuizHistory = {
  id: string;
  quiz_id: string;
  topic: string;
  difficulty: string;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "sarvam_education_learning_suite_v1";
const CONVERSATION_KEY = "sarvam_education_quiz_conversation_v1";

export default function EducationLearningSuite() {
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Intermediate");
  const [days, setDays] = useState("7");
  const [minutes, setMinutes] = useState("60");
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [completed, setCompleted] = useState(0);

  const [conversationId, setConversationId] = useState("");
  const [quizId, setQuizId] = useState("");
  const [quizConversationId, setQuizConversationId] = useState("");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistory[]>([]);
  const [quizProgress, setQuizProgress] = useState({
    total_attempts: 0,
    average_percentage: 0,
    best_percentage: 0,
    total_questions_answered: 0,
  });

  const [activeTab, setActiveTab] = useState("planner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setTasks(Array.isArray(saved.tasks) ? saved.tasks : []);
        setNotes(Array.isArray(saved.notes) ? saved.notes : []);
        setCompleted(Number(saved.completed) || 0);
      }

      let id = localStorage.getItem(CONVERSATION_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(CONVERSATION_KEY, id);
      }
      setConversationId(id);
    } catch {
      setError("Could not initialize your learning workspace.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks, notes, completed })
    );
  }, [tasks, notes, completed]);

  async function apiRequest(path: string, options?: RequestInit) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Education API request failed.");
    }

    return data;
  }

  async function refreshQuizProgress(id = conversationId) {
    if (!id) return;

    const [historyData, progressData] = await Promise.all([
      apiRequest(
        `/api/education/quiz/history/${encodeURIComponent(id)}`
      ),
      apiRequest(
        `/api/education/quiz/progress/${encodeURIComponent(id)}`
      ),
    ]);

    setQuizHistory(historyData.history || []);
    setQuizProgress(progressData.progress || {
      total_attempts: 0,
      average_percentage: 0,
      best_percentage: 0,
      total_questions_answered: 0,
    });
  }

  useEffect(() => {
    if (!conversationId) return;

    refreshQuizProgress().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load quiz progress.");
    });
  }, [conversationId]);

  useEffect(() => {
    function handleQuickAction(event: Event) {
      const customEvent = event as CustomEvent<{ action: string }>;
      const action = customEvent.detail?.action;

      const destinations: Record<string, string> = {
        "Create Study Plan": "planner",
        "Generate Practice Quiz": "quiz",
        "Make Study Notes": "notes",
      };

      const destination = destinations[action || ""];

      if (destination) {
        setActiveTab(destination);
        setError("");
        setNotice(`${action} workspace opened.`);

      window.setTimeout(() => {
        document.getElementById("education-learning-suite")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 150);
      }
    }

    window.addEventListener(
      "sarvam:education-quick-action",
      handleQuickAction
    );

    return () => {
      window.removeEventListener(
        "sarvam:education-quick-action",
        handleQuickAction
      );
    };
  }, []);

  const completion = useMemo(
    () => tasks.length
      ? Math.round(tasks.filter((task) => task.done).length / tasks.length * 100)
      : 0,
    [tasks]
  );

  function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const totalDays = Math.max(1, Math.min(30, Number(days) || 7));
    const dailyMinutes = Math.max(10, Math.min(600, Number(minutes) || 60));
    const baseTopic = topic.trim() || subject;

    const phases = [
      "Understand core concepts",
      "Study worked examples",
      "Practice key questions",
      "Review mistakes",
      "Active recall and revision",
    ];

    const generated = Array.from({ length: totalDays }, (_, index) => ({
      id: crypto.randomUUID(),
      day: `Day ${index + 1}`,
      topic: `${baseTopic}: ${phases[index % phases.length]}`,
      minutes: dailyMinutes,
      done: false,
    }));

    setTasks(generated);
    setNotice(`${totalDays}-day study plan created.`);
    setError("");
  }

  async function askAI(prompt: string) {
    const data = await apiRequest("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: prompt }),
    });

    if (!data.reply) throw new Error("AI returned an empty response.");
    return String(data.reply);
  }

  async function generateNotes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!topic.trim()) {
      setError("Enter a topic first.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const content = await askAI(
        `You are SARVAM Education AI. Create clear, accurate study notes for a ${level} learner. Subject: ${subject}. Topic: ${topic}. Use headings, definitions, step-by-step explanation, key points, one worked example where relevant, common mistakes, and a 5-point quick revision section. Do not invent syllabus-specific claims.`
      );

      const item = {
        id: crypto.randomUUID(),
        subject,
        topic: topic.trim(),
        content,
        createdAt: new Date().toISOString(),
      };

      setNotes((current) => [item, ...current]);
      setNoteText(content);
      setActiveTab("notes");
      setNotice("AI study notes generated and saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate notes.");
    } finally {
      setBusy(false);
    }
  }

  async function generateQuiz() {
    if (!topic.trim()) {
      setError("Enter a topic first.");
      return;
    }

    if (!conversationId) {
      setError("Learning session is still initializing. Try again.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setQuiz([]);
    setAnswers({});
    setQuizResult(null);
    setQuizId("");
    setQuizConversationId("");

    try {
      const data = await apiRequest("/api/education/quiz/generate", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          topic: `${subject}: ${topic.trim()}`,
          difficulty: level.toLowerCase(),
          count: 5,
        }),
      });

      if (!data.quiz?.id || !Array.isArray(data.questions) || !data.questions.length) {
        throw new Error("Backend returned an invalid quiz.");
      }

      const authoritativeConversationId =
        data.conversation_id || data.quiz.conversation_id || conversationId;

      setQuizId(data.quiz.id);
      setQuizConversationId(authoritativeConversationId);
      localStorage.setItem(CONVERSATION_KEY, authoritativeConversationId);
      setConversationId(authoritativeConversationId);
      setQuiz(data.questions);
      setActiveTab("quiz");
      setNotice(`${data.questions.length} questions generated and saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!quizId || !quizConversationId || Object.keys(answers).length !== quiz.length) {
      setError("Please answer every question before submitting.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const backendAnswers: Record<string, string> = {};

      quiz.forEach((_, index) => {
        backendAnswers[String(index + 1)] = answers[index];
      });

      const data = await apiRequest(
        `/api/education/quiz/${encodeURIComponent(quizId)}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            conversation_id: quizConversationId,
            answers: backendAnswers,
          }),
        }
      );

      setQuizResult(data.result);
      await refreshQuizProgress();
      setNotice("Quiz submitted and result saved to your learning database.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit quiz.");
    } finally {
      setBusy(false);
    }
  }

  function toggleTask(id: string) {
    setTasks((current) => {
      const old = current.find((task) => task.id === id);
      if (!old) return current;

      if (!old.done) setCompleted((value) => value + 1);
      else setCompleted((value) => Math.max(0, value - 1));

      return current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      );
    });
  }

  function downloadNotes(note: NoteItem) {
    const blob = new Blob(
      [`SARVAM AI STUDY NOTES\n${note.subject} - ${note.topic}\nGenerated: ${new Date(note.createdAt).toLocaleString()}\n\n${note.content}`],
      { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SARVAM-${note.subject.replace(/[^a-z0-9]/gi, "-")}-Notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs = [
    { id: "planner", label: "Study Planner" },
    { id: "quiz", label: "Practice Quiz" },
    { id: "notes", label: "AI Notes" },
    { id: "progress", label: "My Progress" },
  ];

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Personal learning studio
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            SARVAM AI Learning Suite
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Plan study sessions, practice with AI-generated quizzes, create notes and track your learning activity.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          Quiz results synced with backend
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-xs text-blue-700">Study plan completion</p>
          <p className="mt-1 text-2xl font-bold text-blue-950">{completion}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="rounded-xl bg-violet-50 p-3">
          <p className="text-xs text-violet-700">Average quiz score</p>
          <p className="mt-1 text-2xl font-bold text-violet-950">
            {quizProgress.average_percentage}%
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">Notes saved on this device</p>
          <p className="mt-1 text-2xl font-bold text-emerald-950">{notes.length}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
            {["Mathematics", "Science", "Physics", "Chemistry", "Biology", "Computer Science", "English", "History", "Geography", "Other"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Learning level
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Topic
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Trigonometry" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {activeTab === "planner" && (
        <div className="space-y-4">
          <form onSubmit={createPlan} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
            <label className="text-sm text-slate-700">
              Plan duration (days)
              <input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="text-sm text-slate-700">
              Daily study time (minutes)
              <input type="number" min="10" max="600" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <div className="flex items-end">
              <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Create study plan</button>
            </div>
          </form>

          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Choose a subject and topic, then create your first study plan.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <label key={task.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
                  <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} className="mt-1 h-4 w-4" />
                  <span className={task.done ? "flex-1 text-sm text-slate-400 line-through" : "flex-1 text-sm text-slate-800"}>
                    <strong>{task.day}:</strong> {task.topic}
                    <span className="block text-xs text-slate-500">{task.minutes} minutes</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "quiz" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">Adaptive practice</h4>
              <p className="text-sm text-slate-500">Quiz answers are evaluated and stored by the backend.</p>
            </div>
            <button type="button" onClick={() => void generateQuiz()} disabled={busy} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Please wait..." : "Generate quiz"}
            </button>
          </div>

          {quiz.map((question, index) => {
            const result = quizResult?.results[index];
            return (
              <article key={`${index}-${question.question}`} className="space-y-3 rounded-xl border p-4">
                <p className="font-semibold text-slate-900">{index + 1}. {question.question}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(question.options).map(([key, value]) => (
                    <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                      result && key === result.correct_answer ? "border-emerald-400 bg-emerald-50" :
                      result && key === result.selected_answer ? "border-red-300 bg-red-50" :
                      "border-slate-200"
                    }`}>
                      <input type="radio" name={`question-${index}`} checked={answers[index] === key} disabled={!!quizResult || busy} onChange={() => setAnswers((current) => ({ ...current, [index]: key }))} />
                      <span><strong>{key}.</strong> {value}</span>
                    </label>
                  ))}
                </div>

                {result && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <strong>{result.is_correct ? "Correct answer" : `Correct answer: ${result.correct_answer}`}</strong>
                    <p className="mt-1 text-slate-600">{result.explanation}</p>
                  </div>
                )}
              </article>
            );
          })}

          {quiz.length > 0 && !quizResult && (
            <button type="button" disabled={busy || Object.keys(answers).length !== quiz.length} onClick={() => void submitQuiz()} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Submitting..." : "Submit answers"}
            </button>
          )}

          {quizResult && (
            <div className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-900">
              Your score: {quizResult.score} / {quizResult.total_questions} ({quizResult.percentage}%)
            </div>
          )}
        </div>
      )}

      {activeTab === "notes" && (
        <div className="space-y-4">
          <form onSubmit={generateNotes} className="flex flex-wrap gap-2">
            <button disabled={busy || !topic.trim()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Generating notes..." : "Generate AI notes for selected topic"}
            </button>
          </form>

          {notes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No notes saved yet. Enter a topic above and generate notes.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">{note.topic}</h4>
                      <p className="text-xs text-slate-500">{note.subject} · {new Date(note.createdAt).toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={() => downloadNotes(note)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Download .txt</button>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-blue-700">Read notes</summary>
                    <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">{note.content}</pre>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "progress" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-slate-500">Study tasks completed</p>
              <p className="mt-1 text-2xl font-bold">{completed}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-slate-500">Quiz attempts</p>
              <p className="mt-1 text-2xl font-bold">{quizProgress.total_attempts}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-slate-500">Questions answered</p>
              <p className="mt-1 text-2xl font-bold">{quizProgress.total_questions_answered}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-slate-500">Average score</p>
              <p className="mt-1 text-2xl font-bold">{quizProgress.average_percentage}%</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-slate-500">Best score</p>
              <p className="mt-1 text-2xl font-bold">{quizProgress.best_percentage}%</p>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">Quiz history</h4>
              <button type="button" onClick={() => void refreshQuizProgress()} className="text-xs font-semibold text-blue-700 hover:underline">Refresh</button>
            </div>

            {quizHistory.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No submitted quizzes yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {quizHistory.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.topic}</p>
                      <p className="text-xs text-slate-500">{item.difficulty} · {new Date(item.submitted_at).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                      {item.score}/{item.total_questions} · {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Quiz attempts and scores are stored in the backend learning database. Study plans and notes remain stored in this browser on this device. AI-generated learning material may contain errors; verify important facts against your textbook or teacher's syllabus.
      </p>
    </section>
  );
}
