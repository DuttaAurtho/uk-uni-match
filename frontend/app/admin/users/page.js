"use client";

import { useEffect, useRef, useState } from "react";
import { api, avatarUrl } from "../../lib/api";
import { IconSend, IconUser } from "../../components/icons";

const POLL_MS = 5000;

export default function AdminUsersPage() {
  const [users, setUsers] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  async function loadLists() {
    try {
      const [usersData, threadsData] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/chat/threads"),
      ]);
      setUsers(usersData.users);
      setThreads(threadsData.threads);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadLists();
    const interval = setInterval(loadLists, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.get(`/admin/chat/${selectedId}`);
        if (!cancelled) setMessages(data.messages);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const body = input.trim();
    if (!body || !selectedId) return;
    setInput("");
    try {
      const data = await api.post(`/admin/chat/${selectedId}`, { body });
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
      setInput(body);
    }
  }

  const threadById = Object.fromEntries(threads.map((t) => [t.user_id, t]));
  const selectedUser = users?.find((u) => u.id === selectedId);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Users & chat
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Every registered user, and your conversations with them.
      </p>

      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="grid md:grid-cols-[280px_1fr] gap-4 bg-surface border border-border rounded-xl overflow-hidden" style={{ height: "32rem" }}>
        <div className="border-r border-border overflow-y-auto">
          {users?.map((u) => {
            const thread = threadById[u.id];
            return (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={`w-full text-left px-4 py-3 border-b border-border flex items-center gap-3 transition-colors ${
                  selectedId === u.id ? "bg-navy/5" : "hover:bg-background"
                }`}
              >
                <img
                  src={avatarUrl(u.avatar_seed)}
                  alt=""
                  className="w-8 h-8 rounded-full bg-background border border-border shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{u.email}</p>
                  <p className="text-xs text-text-muted truncate">
                    {thread?.last_message || (u.is_verified ? "No messages yet" : "Not verified")}
                  </p>
                </div>
                {thread?.unread_count > 0 && (
                  <span className="shrink-0 grid place-items-center min-w-[1.25rem] h-5 px-1 rounded-full bg-gold text-navy text-[11px] font-semibold">
                    {thread.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col min-w-0">
          {!selectedUser ? (
            <div className="flex-1 grid place-items-center text-sm text-text-secondary">
              Select a user to view the conversation.
            </div>
          ) : (
            <>
              <div className="border-b border-border px-4 py-3 shrink-0">
                <p className="text-sm font-medium text-text-primary">{selectedUser.email}</p>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-text-secondary text-center mt-8">No messages yet.</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2 items-start ${m.sender_role === "admin" ? "flex-row-reverse" : ""}`}
                  >
                    {m.sender_role === "user" && (
                      <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-navy/5 text-navy-light mt-0.5">
                        <IconUser width={14} height={14} />
                      </span>
                    )}
                    <p
                      className={`text-sm px-3 py-2 max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                        m.sender_role === "admin"
                          ? "bg-navy text-white rounded-lg rounded-tr-none"
                          : "bg-background text-text-primary rounded-lg rounded-tl-none"
                      }`}
                    >
                      {m.body}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSend} className="border-t border-border p-3 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply…"
                  className="focus-gold flex-1 text-sm border border-border rounded-md px-3 py-2 bg-white"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send"
                  className="shrink-0 grid place-items-center w-9 h-9 rounded-md bg-navy hover:bg-navy-light text-gold disabled:opacity-50 transition-colors"
                >
                  <IconSend width={15} height={15} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
