"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendEnvironmentAssistantMessage, getEnvironmentHistory } from "@/lib/api";

type EnvironmentRecord = {
  id: string;
  title: string;
  data: Record<string, string>;
  created_at: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "Mere area mein air pollution kam karne ke practical steps batao.",
  "AQI kya hota hai aur ise kaise samjhein?",
  "Waste segregation ka simple action plan banao.",
  "Local water pollution issue ko report karne ke steps batao.",
  "Plastic waste reduce karne ke liye 7-day plan banao.",
  "Community tree plantation drive ka plan banao.",
];

export default function EnvironmentAIChat({
  records,
}: {
  records: EnvironmentRecord[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    const savedId = window.localStorage.getItem("sarvam_environment_conversation_id");
    if (!savedId) {
      setRestoring(false);
      return () => { active = false; };
    }
    setConversationId(savedId);
    getEnvironmentHistory(savedId)
      .then((history) => {
        if (!active) return;
        const restored = Array.isArray(history.messages)
          ? history.messages
              .filter((item: any) =>
                (item.role === "user" || item.role === "assistant") &&
                typeof item.content === "string"
              )
              .map((item: any) => ({ role: item.role, content: item.content }))
          : [];
        setMessages(restored);
      })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem("sarvam_environment_conversation_id");
        setConversationId(null);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => { active = false; };
  }, []);


  async function sendMessage(text: string) {
    const message = text.trim();

    if (!message || loading || restoring) return;

    setInput("");
    setError("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: message },
    ]);
    setLoading(true);

    try {
      const result = await sendEnvironmentAssistantMessage(
        message,
        records.map((record) => ({
          title: record.title,
          created_at: record.created_at,
          data: record.data,
        })),
        conversationId
      );

      if (result.conversation_id) {
        setConversationId(result.conversation_id);
        window.localStorage.setItem("sarvam_environment_conversation_id", result.conversation_id);
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: result.reply },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Environment AI request failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Environment AI Assistant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Understand environmental issues and turn them into practical action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (loading) return;
              window.localStorage.removeItem("sarvam_environment_conversation_id");
              setConversationId(null);
              setMessages([]);
              setInput("");
              setError("");
            }}
            disabled={loading || restoring}
            className="rounded-full border px-3 py-1 text-xs transition hover:bg-muted disabled:opacity-50"
          >
            New Chat
          </button>
          <span className="rounded-full border px-3 py-1 text-xs">SARVAM AI</span>
        </div>
      </div>

      {restoring && (
        <p className="text-xs text-muted-foreground">Restoring chat history...</p>
      )}
      {messages.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ask about air quality, pollution, waste management, water
            conservation or sustainable community action.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void sendMessage(suggestion)}
                disabled={loading || restoring}
                className="rounded-xl border p-3 text-left text-sm transition hover:bg-muted disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[520px] space-y-4 overflow-y-auto rounded-xl bg-muted/30 p-3">
          {messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card"
                }`}
              >
                {message.role === "assistant" ? (
              <div className="w-full min-w-0 overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="my-3 text-xl font-bold">{children}</h1>,
                    h2: ({ children }) => <h2 className="my-3 text-lg font-bold">{children}</h2>,
                    h3: ({ children }) => <h3 className="my-2 text-base font-bold">{children}</h3>,
                    p: ({ children }) => <p className="my-2 leading-7">{children}</p>,
                    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>,
                    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>,
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    table: ({ children }) => (
                      <div className="my-3 w-full overflow-x-auto rounded-lg border border-slate-300">
                        <table className="w-full border-collapse text-left text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-slate-200">{children}</thead>,
                    th: ({ children }) => <th className="border border-slate-300 px-3 py-2 font-semibold">{children}</th>,
                    td: ({ children }) => <td className="border border-slate-300 px-3 py-2 align-top">{children}</td>,
                  }}
                >
                  {message.content.replace(/<br\s*\/?>/gi, "  \n")}
                </ReactMarkdown>
              </div>
            ) : message.content}
              </div>
            </div>
          ))}

          {loading && (
            <p className="text-sm text-muted-foreground">
              SARVAM AI is preparing environmental guidance...
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about pollution, AQI or environmental action..."
          maxLength={5000}
          disabled={loading || restoring}
          className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading || restoring || !input.trim()}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        Environmental guidance is informational. AI does not directly measure
        pollution, submit complaints or replace official environmental advisories.
      </p>
    </section>
  );
}