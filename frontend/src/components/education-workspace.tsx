"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Loader2, GraduationCap, Save } from "lucide-react";
import {
  sendEducationMessage,
  getEducationHistory,
  getStudentProfile,
  updateStudentProfile,
  type EducationMessage,
  type StudentProfile,
} from "@/lib/api";

const STORAGE_KEY = "sarvam_education_conversation_id";

export default function EducationWorkspace() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EducationMessage[]>([
    {
      role: "assistant",
      content: "Namaste! I am SARVAM Education AI. Ask me a question, request notes, generate a quiz or create a study plan.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<StudentProfile>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function restore() {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (!savedId) return;

      try {
        if (!active) return;
        setConversationId(savedId);

        try {
          const history = await getEducationHistory(savedId);
          if (active && history.length) {
            setMessages(history.map(({ role, content }) => ({ role, content })));
          }
        } catch (error) {
          console.error("Education history restore failed:", error);
        }

        try {
          const savedProfile = await getStudentProfile(savedId);
          if (active) setProfile(savedProfile);
        } catch (error) {
          console.error("Student profile restore failed:", error);
        }
      } catch {
        if (active) localStorage.removeItem(STORAGE_KEY);
      }
    }

    restore();
    return () => { active = false; };
  }, []);

  async function handleSend(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || loading) return;

    setMessages((previous) => [...previous, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    window.setTimeout(() => {
      chatRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    try {
      const result = await sendEducationMessage(message, conversationId);
      setConversationId(result.conversation_id);
      localStorage.setItem(STORAGE_KEY, result.conversation_id);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: result.reply },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Education AI is temporarily unavailable.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!conversationId) {
      setProfileMessage("Send your first message before saving your profile.");
      return;
    }

    setSavingProfile(true);
    setProfileMessage("");

    try {
      const saved = await updateStudentProfile(conversationId, profile);
      setProfile(saved);
      setProfileMessage("Student profile saved successfully.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  function handleNewConversation() {
    if (loading || savingProfile) return;

    localStorage.removeItem(STORAGE_KEY);
    setConversationId(null);
    setProfile({});
    setProfileMessage("");
    setMessages([{
      role: "assistant",
      content: "Welcome back! What would you like to learn today?",
    }]);
    setInput("");
  }

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-3 text-white">
            <GraduationCap size={23} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">SARVAM Education AI</h3>
            <p className="text-xs text-slate-600">Personalized learning assistant</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-3">
          <span className="rounded-lg bg-white p-2">Concept explanations</span>
          <span className="rounded-lg bg-white p-2">Study notes</span>
          <span className="rounded-lg bg-white p-2">Practice quizzes</span>
          <span className="rounded-lg bg-white p-2">Study planning</span>
          <span className="rounded-lg bg-white p-2">Doubt solving</span>
          <span className="rounded-lg bg-white p-2">Learning support</span>
        </div>
      </div>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="font-bold text-slate-900">Quick Learning Actions</h3>
          <p className="mt-1 text-xs text-slate-500">Choose a learning task to prepare a prompt for SARVAM AI.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Create Study Plan", prompt: "Create a personalized 7-day study plan. First ask me for any missing details you need." },
            { title: "Generate Practice Quiz", prompt: "Generate a 10-question practice quiz on my chosen subject. Ask me which topic and difficulty I want." },
            { title: "Make Study Notes", prompt: "Help me create clear, structured revision notes. Ask me for the subject and topic." },
            { title: "Explain a Concept", prompt: "Act as my personal tutor. Ask me which concept I want to understand, then explain it in simple language, step by step. Include a practical example, important points and a short understanding check." },
            { title: "Exam Preparation", prompt: "Act as my exam preparation mentor. First ask me for my exam date, subjects, syllabus and daily available study time. Then create a realistic revision strategy, topic priorities and a daily preparation timetable." },
            { title: "Practice Questions", prompt: "Act as my practice-question generator. First ask me for subject, topic, difficulty and number of questions. Generate topic-wise questions, let me attempt them, then evaluate my answers and explain the correct solutions." },
          ].map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={() => {
                if (
                  action.title === "Create Study Plan" ||
                  action.title === "Generate Practice Quiz" ||
                  action.title === "Make Study Notes"
                ) {
                  window.dispatchEvent(
                    new CustomEvent("sarvam:education-quick-action", {
                      detail: { action: action.title },
                    })
                  );
                  return;
                }

                void handleSend(action.prompt);
              }}
              disabled={loading}
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
            >
              <span className="text-sm font-semibold text-slate-800">{action.title}</span>
              <span className="mt-1 block text-xs text-slate-500">Prepare AI prompt →</span>
            </button>
          ))}
        </div>
      </section>
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Student Profile</h3>
            <p className="text-xs text-slate-500">Save details to personalize learning</p>
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile || !conversationId}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["grade", "Class / Grade", "e.g. Class 12"],
            ["subjects", "Subjects", "e.g. Physics, Maths, Biology"],
            ["learning_level", "Learning level", "e.g. Beginner"],
            ["goals", "Learning goals", "e.g. Board exam preparation"],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="text-xs font-semibold text-slate-600">
              {label}
              <input
                value={String(profile[key] ?? "")}
                onChange={(event) => setProfile((old) => ({ ...old, [key]: event.target.value }))}
                placeholder={placeholder}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500"
              />
            </label>
          ))}
        </div>
        {profileMessage && <p className="mt-3 text-xs text-slate-600">{profileMessage}</p>}
      </div>

      <div ref={chatRef} id="education-learning-chat" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Bot size={20} />
            <span className="font-bold">Learning Chat</span>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            + New Chat
          </button>
        </div>

        <div className="max-h-[480px] min-h-[280px] space-y-4 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-600 p-1.5 text-white">
                  <Bot size={20} />
                </div>
              )}
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                message.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"
              }`}>
                {message.role === "assistant" ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : message.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={17} className="animate-spin" />
              Education AI is thinking...
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t p-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question or describe what you want to learn..."
            maxLength={5000}
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Send size={17} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">
        AI can make mistakes. Verify important academic information independently.
      </p>
    </div>
  );
}
