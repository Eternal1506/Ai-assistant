"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Send,
  Mail,
  Calendar,
  LogOut,
  LogIn,
  Loader2,
  Bot,
  User,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Show my last 5 emails",
  "What's on my calendar today?",
  "Schedule a meeting tomorrow at 2pm",
  "Send an email to...",
];

export default function ChatUI() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.message },
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `Sorry, something went wrong: ${String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-6 px-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-indigo-600 rounded-xl p-3">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AI Assistant</h1>
        </div>
        <p className="text-gray-400 text-center max-w-md">
          Connect your Gmail and Google Calendar to get started. Your assistant
          can read emails, send messages, and manage your schedule.
        </p>
        <div className="flex gap-4 text-gray-500 text-sm">
          <span className="flex items-center gap-1.5">
            <Mail size={14} /> Gmail
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={14} /> Google Calendar
          </span>
        </div>
        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors mt-2"
        >
          <LogIn size={18} />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 rounded-lg p-1.5">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold leading-tight">
              AI Assistant
            </h1>
            <p className="text-gray-500 text-xs">
              Gmail · Google Calendar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <img
            src={session.user?.image ?? ""}
            alt="avatar"
            className="w-8 h-8 rounded-full"
          />
          <span className="text-gray-400 text-sm hidden sm:block">
            {session.user?.name}
          </span>
          <button
            onClick={() => signOut()}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="text-center space-y-6 mt-12">
            <p className="text-gray-500">
              Ask me anything about your emails or calendar.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="bg-indigo-600 rounded-lg p-1.5 h-fit mt-0.5 shrink-0">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-gray-800 text-gray-100 rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="bg-gray-700 rounded-lg p-1.5 h-fit mt-0.5 shrink-0">
                <User size={16} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="bg-indigo-600 rounded-lg p-1.5 h-fit mt-0.5">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about emails or calendar events..."
            className="flex-1 bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
