"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  sendHealthcareMessage,
  getHealthcareHistory,
} from "@/lib/api";

type HealthRecord = {
  id: string;
  title: string;
  data: Record<string, string>;
  created_at: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function HealthcareAIChat({
  workspaceId,
  records,
}: {
  workspaceId: string;
  records: HealthRecord[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function restoreConversation() {
      try {
        let id = localStorage.getItem("sarvam_healthcare_conversation_id");

        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem("sarvam_healthcare_conversation_id", id);
        }

        if (!active) return;
        setConversationId(id);

        const history = await getHealthcareHistory(id);
        if (!active) return;

        setMessages(
          (history.messages || []).map((item: ChatMessage) => ({
            role: item.role,
            content: item.content,
          }))
        );
      } catch {
        if (active) setMessages([]);
      } finally {
        if (active) setRestoring(false);
      }
    }

    void restoreConversation();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || loading || !conversationId) return;

    setInput("");
    setError("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: message },
    ]);
    setLoading(true);

    try {
      const healthContext = records.slice(0, 40).map((record) => ({
        title: record.title,
        data: Object.fromEntries(
          Object.entries(record.data || {}).filter(
            ([, value]) => typeof value === "string"
          )
        ),
        created_at: record.created_at,
      }));

      const response = await sendHealthcareMessage(
        message,
        conversationId,
        healthContext
      );

      if (response.conversation_id && response.conversation_id !== conversationId) {
        setConversationId(response.conversation_id);
        localStorage.setItem(
          "sarvam_healthcare_conversation_id",
          response.conversation_id
        );
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: response.reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Healthcare AI is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    if (loading) return;

    const id = crypto.randomUUID();
    localStorage.setItem("sarvam_healthcare_conversation_id", id);
    setConversationId(id);
    setMessages([]);
    setInput("");
    setError("");
  }

  const suggestions = [
    "Help me prepare for a doctor appointment",
    "How should I organize my symptoms?",
    "Explain common blood test terms",
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-white p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
            SARVAM AI Healthcare
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Healthcare Assistant
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            General health information and doctor-visit preparation.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewConversation}
          disabled={loading}
          className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          + New chat
        </button>
      </div>

      <div className="max-h-[440px] min-h-[230px] space-y-4 overflow-y-auto p-4 sm:p-5">
        {restoring ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Restoring your conversation...
          </p>
        ) : messages.length === 0 ? (
          <div className="py-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-2xl">
              +
            </div>
            <h3 className="mt-3 font-semibold text-slate-800">
              How can I help you today?
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Ask a general health question or prepare for a doctor visit.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-rose-300 hover:bg-rose-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "rounded-br-md bg-rose-600 text-white"
                    : "rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800"
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
          ))
        )}

        {loading && (
          <div className="text-sm text-slate-500">
            Healthcare AI is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mx-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask your healthcare question..."
            rows={2}
            maxLength={5000}
            disabled={loading || restoring}
            className="min-h-[52px] flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || restoring || !conversationId}
            className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This assistant does not diagnose or prescribe. For emergencies,
          contact local emergency services immediately.
        </p>
      </form>
    </section>
  );
}