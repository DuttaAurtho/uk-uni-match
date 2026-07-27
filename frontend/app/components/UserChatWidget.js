"use client";

import { useEffect, useRef, useState } from "react";
import { IconChat, IconClose, IconSend, IconUser } from "./icons";
import { api } from "../lib/api";

const POLL_MS = 5000;

// Chat with the admin, distinct from the AI ChatWidget — persisted server
// side, polled while open so replies show up without a page refresh.
export default function UserChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get("/me/chat");
        if (!cancelled) setMessages(data.messages);
      } catch {
        // transient network hiccup — next poll tries again
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  async function handleSend(e) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;

    setSending(true);
    setInput("");
    try {
      const data = await api.post("/me/chat", { body });
      setMessages(data.messages);
    } catch {
      // leave the input as-is so the user doesn't lose their message
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Message support"}
        className="fixed bottom-6 left-6 z-40 grid place-items-center w-14 h-14 rounded-full bg-navy hover:bg-navy-light text-gold shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <IconClose width={22} height={22} /> : <IconChat width={22} height={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 left-6 z-40 w-[min(24rem,calc(100vw-3rem))] h-[28rem] bg-surface border border-border rounded-xl shadow-lg flex flex-col animate-pop-in overflow-hidden">
          <div className="bg-navy text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <p className="font-[family-name:var(--font-display)] text-base leading-tight">
              Chat with our team
            </p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="shrink-0 text-white/70 hover:text-white transition-colors"
            >
              <IconClose width={16} height={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-text-secondary text-center mt-8">
                Questions about applications, deadlines, or documents? Send us a message and
                we&apos;ll reply here.
              </p>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 items-start animate-fade-in ${
                  m.sender_role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {m.sender_role === "admin" && (
                  <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-navy/5 text-navy-light mt-0.5">
                    <IconUser width={14} height={14} />
                  </span>
                )}
                <p
                  className={`text-sm px-3 py-2 max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                    m.sender_role === "user"
                      ? "bg-navy text-white rounded-lg rounded-tr-none"
                      : "bg-background text-text-primary rounded-lg rounded-tl-none"
                  }`}
                >
                  {m.body}
                </p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-border p-3 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
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
