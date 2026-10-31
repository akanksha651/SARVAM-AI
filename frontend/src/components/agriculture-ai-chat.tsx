"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Send, Loader2, ImagePlus, X, Plus } from "lucide-react";
import {
  sendAgricultureMessage,
  sendAgricultureImage,
  getAgricultureHistory,
  saveAgricultureRecommendation,
} from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: "chat" | "image";
};

export default function AgricultureAIChat({
  onActivityUpdated,
}: {
  onActivityUpdated?: () => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Namaste! I am SARVAM Agriculture AI. Ask me about crops, diseases, soil, irrigation, fertilizers or farming problems. You can also upload a crop image for analysis.",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const imageLock = useRef(false);

  useEffect(() => {
    let active = true;

    async function restoreConversation() {
      const savedId = localStorage.getItem("sarvam_agriculture_conversation_id");
      if (!savedId) return;

      try {
        const history = await getAgricultureHistory(savedId);
        if (!active) return;

        setConversationId(history.conversation_id);
        if (Array.isArray(history.messages) && history.messages.length > 0) {
          setMessages(
            history.messages.map((item: { role: "user" | "assistant"; content: string }) => ({
              role: item.role,
              content: item.content,
            }))
          );
        }
      } catch {
        localStorage.removeItem("sarvam_agriculture_conversation_id");
      }
    }

    restoreConversation();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function updateConversation(id: string) {
    setConversationId(id);
    localStorage.setItem("sarvam_agriculture_conversation_id", id);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || imageLoading || imageLock.current) return;

    setMessages((old) => [...old, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const result = await sendAgricultureMessage(text, conversationId);

      if (result.conversation_id) updateConversation(result.conversation_id);

      setMessages((old) => [
        ...old,
        { role: "assistant", content: result.reply, source: "chat" },
      ]);
      onActivityUpdated?.();
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Unable to connect to Agriculture AI. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeImage() {
    if (!selectedImage || imageLoading || loading || imageLock.current) return;

    imageLock.current = true;
    setImageLoading(true);

    const prompt =
      imageDescription.trim() ||
      "Please analyze this crop image. Identify only what is visually supported and suggest practical next steps.";

    setMessages((old) => [...old, { role: "user", content: prompt }]);

    try {
      const result = await sendAgricultureImage(selectedImage, prompt, conversationId);

      if (result.conversation_id) updateConversation(result.conversation_id);

      setMessages((old) => [
        ...old,
        { role: "assistant", content: result.reply, source: "image" },
      ]);

      setSelectedImage(null);
      setImagePreview("");
      setImageDescription("");
      onActivityUpdated?.();
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Image analysis failed. Please try again.",
        },
      ]);
    } finally {
      imageLock.current = false;
      setImageLoading(false);
    }
  }

  function handleNewConversation() {
    if (loading || imageLoading) return;

    localStorage.removeItem("sarvam_agriculture_conversation_id");
    setConversationId(null);
    setMessages([
      {
        role: "assistant",
        content: "Namaste! I am SARVAM Agriculture AI. Tell me about your crop or farming problem.",
      },
    ]);
    setInput("");
    setSelectedImage(null);
    setImagePreview("");
    setImageDescription("");
  }

  async function handleSave(message: Message) {
    if (!conversationId || !message.content.trim()) {
      alert("Start a conversation before saving a recommendation.");
      return;
    }

    try {
      await saveAgricultureRecommendation(
        conversationId,
        message.content,
        message.source || "chat"
      );
      alert("Recommendation saved successfully!");
      onActivityUpdated?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save recommendation.");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-green-900 to-emerald-700 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-3">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="font-bold">SARVAM Agriculture AI</h2>
            <p className="text-xs text-green-100">Crop guidance and image analysis</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={loading || imageLoading}
          className="flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          <Plus size={15} /> New Conversation
        </button>
      </div>

      <div className="max-h-[480px] min-h-[300px] space-y-5 overflow-y-auto p-5">
        {messages.map((message, index) => (
          <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && (
              <div className="h-9 w-9 shrink-0 rounded-full bg-green-800 p-2 text-white">
                <Bot size={20} />
              </div>
            )}

            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 ${
              message.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
            }`}>
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

              {message.role === "assistant" && message.source && (
                <button
                  type="button"
                  onClick={() => handleSave(message)}
                  className="mt-3 block rounded-lg border border-green-700 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                >
                  + Save Recommendation
                </button>
              )}
            </div>

            {message.role === "user" && (
              <div className="h-9 w-9 shrink-0 rounded-full bg-blue-100 p-2 text-blue-700">
                <User size={20} />
              </div>
            )}
          </div>
        ))}

        {(loading || imageLoading) && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            {imageLoading ? "Analyzing crop image..." : "Agriculture AI is thinking..."}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4">
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <ImagePlus size={16} /> UPLOAD CROP / LEAF IMAGE
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={loading || imageLoading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            if (file.size > 8 * 1024 * 1024) {
              alert("Image must be smaller than 8 MB.");
              event.target.value = "";
              return;
            }

            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              alert("Please select a JPG, PNG or WEBP image.");
              event.target.value = "";
              return;
            }

            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
          }}
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-green-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />

        {imagePreview && (
          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <Image
              src={imagePreview}
              alt="Selected crop preview"
              width={220}
              height={220}
              unoptimized
              className="max-h-52 rounded-lg object-contain"
            />
            <textarea
              value={imageDescription}
              onChange={(event) => setImageDescription(event.target.value)}
              placeholder="Describe the crop, symptoms or farming problem (optional)..."
              disabled={imageLoading}
              maxLength={2000}
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview("");
                  setImageDescription("");
                }}
                disabled={imageLoading}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600"
              >
                <X size={14} /> Remove
              </button>
              <button
                type="button"
                onClick={handleAnalyzeImage}
                disabled={imageLoading || !selectedImage}
                className="rounded-lg bg-green-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {imageLoading ? "Analyzing..." : "Analyze Image"}
              </button>
            </div>
          </div>
        )}
      </div>

      <form
        className="flex gap-3 border-t border-slate-200 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about crops, soil, irrigation, pests..."
          disabled={loading || imageLoading}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-600"
        />
        <button
          type="submit"
          disabled={loading || imageLoading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
        >
          <Send size={17} /> Send
        </button>
      </form>
      <p className="px-4 pb-4 text-center text-xs text-slate-400">
        AI suggestions may be inaccurate. Verify important agricultural decisions locally.
      </p>
    </section>
  );
}
