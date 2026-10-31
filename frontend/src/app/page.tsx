"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sprout, GraduationCap, HeartPulse, Wallet, Landmark, Leaf,
  Sparkles, Send, Plus, ImagePlus, X, Loader2, Bot,
  Wifi, WifiOff, Bookmark, ArrowUpRight
} from "lucide-react";

import {
  checkBackend,
  getModules,
  sendMessage,
  sendAgricultureMessage,
  sendAgricultureImage,
  saveAgricultureRecommendation
} from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: "chat" | "image";
};

const moduleData = [
  {
    id: "agriculture",
    title: "Agriculture",
    description: "Crop and farming assistance",
    icon: Sprout,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    href: "/agriculture"
  },
  {
    id: "education",
    title: "Education",
    description: "Learning and assessments",
    icon: GraduationCap,
    color: "text-blue-600",
    bg: "bg-blue-50",
    href: "/education"
  },
  {
    id: "healthcare",
    title: "Healthcare",
    description: "Health information support",
    icon: HeartPulse,
    color: "text-rose-600",
    bg: "bg-rose-50",
    href: "/healthcare"
  },
  {
    id: "finance",
    title: "Finance",
    description: "Budget and savings",
    icon: Wallet,
    color: "text-amber-600",
    bg: "bg-amber-50",
    href: "/finance"
  },
  {
    id: "government",
    title: "Government",
    description: "Schemes and services",
    icon: Landmark,
    color: "text-violet-600",
    bg: "bg-violet-50",
    href: "/government"
  },
  {
    id: "environment",
    title: "Environment",
    description: "Environmental assistance",
    icon: Leaf,
    color: "text-teal-600",
    bg: "bg-teal-50",
    href: "/environment"
  }
];

const suggestions = [
  "Help me solve a real-world problem",
  "Explain a complex topic simply",
  "Create a practical step-by-step plan"
];

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("Checking");
  const [modules, setModules] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState("general");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm SARVAM AI. Ask me anything or choose a specialist module below. How can I help you today?"
    }
  ]);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [imageLoading, setImageLoading] = useState(false);

  const imageRequestLock = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFreshChat = messages.length <= 1;

  useEffect(() => {
    async function initialize() {
      try {
        const [health, data] = await Promise.all([
          checkBackend(),
          getModules()
        ]);

        setBackendStatus(
          health.status === "healthy" ? "Connected" : "Offline"
        );

        setModules(
          data.modules.map((module: { id: string }) => module.id)
        );

      } catch {
        setBackendStatus("Offline");
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, imageLoading]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleNewConversation() {
    if (loading || imageLoading) return;

    localStorage.removeItem("sarvam_agriculture_conversation_id");

    setConversationId(null);
    setSelectedModule("general");
    setMessages([
      {
        role: "assistant",
        content: "Hello! I'm SARVAM AI. Ask me anything or choose a specialist module below. How can I help you today?"
      }
    ]);

    setInput("");
    setSelectedImage(null);
    setImagePreview("");
    setImageDescription("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSaveRecommendation(message: Message) {
    if (!conversationId || !message.content.trim()) return;

    try {
      await saveAgricultureRecommendation(
        conversationId,
        message.content,
        message.source || "chat"
      );
      alert("Recommendation saved successfully!");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save recommendation."
      );
    }
  }

  async function handleSend() {
    const text = input.trim();

    if (!text || loading || imageLoading || imageRequestLock.current) return;

    setMessages(previous => [...previous, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const result =
        selectedModule === "agriculture"
          ? await sendAgricultureMessage(text, conversationId)
          : await sendMessage(text);

      if (selectedModule === "agriculture" && result.conversation_id) {
        setConversationId(result.conversation_id);
        localStorage.setItem(
          "sarvam_agriculture_conversation_id",
          result.conversation_id
        );
      }

      setMessages(previous => [
        ...previous,
        { role: "assistant", content: result.reply, source: "chat" }
      ]);
    } catch (error) {
      setMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: error instanceof Error
            ? error.message
            : "Unable to connect to SARVAM AI. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeImage() {
    if (!selectedImage || imageLoading || imageRequestLock.current) return;

    imageRequestLock.current = true;
    setImageLoading(true);

    const analysisMessage =
      imageDescription.trim() ||
      "Please analyze this crop image. Identify only what is visually supported.";

    setMessages(previous => [
      ...previous,
      { role: "user", content: analysisMessage }
    ]);

    try {
      const result = await sendAgricultureImage(
        selectedImage,
        analysisMessage,
        conversationId
      );

      if (result.conversation_id) {
        setConversationId(result.conversation_id);
        localStorage.setItem(
          "sarvam_agriculture_conversation_id",
          result.conversation_id
        );
      }

      setMessages(previous => [
        ...previous,
        { role: "assistant", content: result.reply, source: "image" }
      ]);

      setSelectedImage(null);
      setImagePreview("");
      setImageDescription("");

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: error instanceof Error
            ? error.message
            : "Image analysis failed. Please try again."
        }
      ]);
    } finally {
      imageRequestLock.current = false;
      setImageLoading(false);
    }
  }

  function handleImageSelect(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Please select an image smaller than 10 MB.");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f6fc] font-sans text-slate-900">
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-7 lg:px-10">

        <header className="flex items-center justify-between border-b border-slate-200/70 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/15">
              <Sparkles size={21} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">SARVAM</h1>
              <p className="text-[11px] font-medium tracking-wider text-slate-500">
                INTELLIGENCE FOR EVERYONE
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
              {backendStatus === "Connected" ? (
                <Wifi size={14} className="text-emerald-600" />
              ) : (
                <WifiOff size={14} className="text-amber-600" />
              )}
              <span>
                {backendStatus === "Checking" ? "Connecting" : backendStatus}
              </span>
              <span className={`h-2 w-2 rounded-full ${
                backendStatus === "Connected"
                  ? "bg-emerald-500"
                  : backendStatus === "Offline"
                  ? "bg-red-500"
                  : "bg-amber-400"
              }`} />
            </div>

            <button
              type="button"
              onClick={handleNewConversation}
              disabled={loading || imageLoading}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-5xl pt-9 sm:pt-12">
          {isFreshChat && (
            <div className="relative mb-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#10152e] via-[#20245b] to-[#5531a8] px-5 py-12 text-center shadow-2xl shadow-indigo-200/70 sm:px-10 sm:py-16">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
                <Sparkles size={27} />
              </div>

              <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-indigo-200">
                Your intelligent AI companion
              </p>

              <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                One AI. <span className="bg-gradient-to-r from-indigo-200 via-white to-violet-200 bg-clip-text text-transparent">Many possibilities.</span>
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-indigo-100/80 sm:text-base">
                Ask questions, explore ideas and solve everyday challenges with one intelligent assistant.
              </p>
            </div>
          )}

          {isFreshChat && (
            <div className="mb-9">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.19em] text-slate-500">
                  Explore specialist AI
                </h3>
                <span className="text-xs text-slate-400">6 domains</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {moduleData.map(module => {
                  const Icon = module.icon;
                  const available = modules.length === 0 || modules.includes(module.id);

                  return (
                    <Link
                      key={module.id}
                      href={module.href}
                      className={`group relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl border border-white bg-white/90 p-4 shadow-sm shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/70 sm:p-5 ${
                        !available ? "opacity-60" : ""
                      }`}
                    >
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${module.bg} ${module.color}`}>
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">
                          {module.title}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">
                          {module.description}
                        </p>
                      </div>
                      <ArrowUpRight size={15} className="shrink-0 text-slate-300 transition group-hover:text-slate-700" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-[1.8rem] border border-white bg-white shadow-2xl shadow-slate-200/80 ring-1 ring-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/50 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="text-[15px] font-extrabold tracking-tight text-slate-900">SARVAM Assistant</p>
                  <p className="text-[11px] text-slate-500">Powered by AI</p>
                </div>
              </div>

              <select
                aria-label="Choose AI assistant"
                value={selectedModule}
                onChange={event => setSelectedModule(event.target.value)}
                disabled={loading || imageLoading}
                className="max-w-[190px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-400"
              >
                <option value="general">General Assistant</option>
                <option value="agriculture">Agriculture Specialist</option>
              </select>
            </div>

            <div className="max-h-[480px] min-h-[230px] space-y-6 overflow-y-auto bg-gradient-to-b from-white via-white to-indigo-50/40 px-4 py-6 sm:px-6">
              {messages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                      <Sparkles size={16} />
                    </div>
                  )}

                  <div className={`min-w-0 max-w-[88%] rounded-2xl px-5 py-4 text-sm leading-7 shadow-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-[#171c3c] to-[#37308b] text-white shadow-lg shadow-indigo-200/50"
                      : "rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm"
                  }`}>
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none break-words prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-7 prose-li:my-1 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:break-words prose-table:block prose-table:overflow-x-auto prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    )}

                    {message.role === "assistant" &&
                      selectedModule === "agriculture" &&
                      conversationId && (
                        <button
                          type="button"
                          onClick={() => handleSaveRecommendation(message)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                        >
                          <Bookmark size={13} />
                          Save recommendation
                        </button>
                      )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                      <span className="text-xs font-bold">You</span>
                    </div>
                  )}
                </div>
              ))}

              {(loading || imageLoading) && (
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    <Sparkles size={16} />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
                    <Loader2 size={15} className="animate-spin" />
                    SARVAM is thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {isFreshChat && (
              <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6">
                {suggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {selectedModule === "agriculture" && (
              <div className="mx-4 mb-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-3 sm:mx-6">
                {imagePreview ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Image
                      src={imagePreview}
                      alt="Selected crop"
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-lg border border-emerald-100 object-cover"
                    />
                    <input
                      value={imageDescription}
                      onChange={event => setImageDescription(event.target.value)}
                      placeholder="Describe what you want to know (optional)"
                      className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview("");
                        setImageDescription("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      disabled={imageLoading}
                      className="rounded-lg p-2 text-slate-500 hover:bg-white"
                      aria-label="Remove selected image"
                    >
                      <X size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={handleAnalyzeImage}
                      disabled={imageLoading || !selectedImage}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Analyze image
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800">
                    You can also upload a crop image for visual analysis.
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-inner transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100/80">
                {selectedModule === "agriculture" && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={event => handleImageSelect(event.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || imageLoading}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
                      aria-label="Upload crop image"
                      title="Upload crop image"
                    >
                      <ImagePlus size={19} />
                    </button>
                  </>
                )}

                <textarea
                  rows={1}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Message SARVAM..."
                  disabled={loading || imageLoading}
                  className="max-h-32 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading || imageLoading || !input.trim()}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-300/50 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-300/60 hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send size={16} />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>

              <p className="mt-2 text-center text-[11px] font-medium tracking-wide text-slate-400">
                SARVAM AI can make mistakes. Verify important information independently.
              </p>
            </div>
          </section>

          <footer className="py-7 text-center text-xs text-slate-400">
            SARVAM AI · One platform for everyday solutions
          </footer>
        </section>
      </div>
    </main>
  );
}
