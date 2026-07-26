"use client";

import { useEffect, useRef, useState } from "react";
import { IconChat, IconClose, IconSend, IconSpinner, IconGraduationCap } from "./icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatWidget({ open, onOpenChange, profile, university }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          context: {
            profile,
            university: university
              ? { name: university.name, city: university.city }
              : null,
          },
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply || "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I couldn't reach the server. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-6 right-6 z-40 grid place-items-center w-14 h-14 rounded-full bg-navy hover:bg-navy-light text-gold shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <IconClose width={22} height={22} /> : <IconChat width={22} height={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[min(24rem,calc(100vw-3rem))] h-[28rem] bg-surface border border-border rounded-xl shadow-lg flex flex-col animate-pop-in overflow-hidden">
          <div className="bg-navy text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-base leading-tight">
                Ask about UK universities
              </p>
              {university && (
                <p className="text-xs text-gold truncate">
                  Chatting about {university.name}
                </p>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close chat"
              className="shrink-0 text-white/70 hover:text-white transition-colors"
            >
              <IconClose width={16} height={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex gap-2 items-start animate-fade-in">
                <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-navy/5 text-navy-light mt-0.5">
                  <IconGraduationCap width={14} height={14} />
                </span>
                <p className="text-sm bg-background rounded-lg rounded-tl-none px-3 py-2 text-text-secondary">
                  Hi! Ask me anything about UK university applications,
                  scholarships, or visas
                  {university ? ` — or about ${university.name} specifically.` : "."}
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 items-start animate-fade-in ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {m.role === "assistant" && (
                  <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-navy/5 text-navy-light mt-0.5">
                    <IconGraduationCap width={14} height={14} />
                  </span>
                )}
                <p
                  className={`text-sm px-3 py-2 max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-navy text-white rounded-lg rounded-tr-none"
                      : "bg-background text-text-primary rounded-lg rounded-tl-none"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}

            {sending && (
              <div className="flex gap-2 items-start animate-fade-in">
                <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-navy/5 text-navy-light mt-0.5">
                  <IconGraduationCap width={14} height={14} />
                </span>
                <span className="text-sm bg-background rounded-lg rounded-tl-none px-3 py-2 text-text-secondary inline-flex items-center gap-1.5">
                  <IconSpinner width={13} height={13} />
                  Thinking…
                </span>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-border p-3 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="focus-gold flex-1 text-sm border border-border rounded-md px-3 py-2 bg-white"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="shrink-0 grid place-items-center w-9 h-9 rounded-md bg-navy hover:bg-navy-light text-gold disabled:opacity-50 transition-colors"
            >
              <IconSend width={15} height={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
