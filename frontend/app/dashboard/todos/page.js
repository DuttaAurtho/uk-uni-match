"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { IconCalendar, IconCheck, IconTrash, IconPlus } from "../../components/icons";

export default function TodosPage() {
  const [todos, setTodos] = useState(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/me/todos")
      .then((data) => setTodos(data.todos))
      .catch((err) => setError(err.message));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const data = await api.post("/me/todos", { title: title.trim(), due_date: dueDate || null });
      setTodos(data.todos);
      setTitle("");
      setDueDate("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(todo) {
    try {
      const data = await api.patch(`/me/todos/${todo.id}`, { is_done: !todo.is_done });
      setTodos(data.todos);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      const data = await api.delete(`/me/todos/${id}`);
      setTodos(data.todos);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        To-do list
      </h1>
      <p className="text-sm text-text-secondary mb-6">Keep track of application tasks and deadlines.</p>

      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-4">{error}</p>}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="focus-gold flex-1 text-sm border border-border rounded-md px-3 py-2.5 bg-white"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="focus-gold text-sm border border-border rounded-md px-3 py-2.5 bg-white"
        />
        <button
          type="submit"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors"
        >
          <IconPlus width={15} height={15} />
          Add
        </button>
      </form>

      <div className="space-y-2">
        {todos?.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">No tasks yet — add one above.</p>
        )}
        {todos?.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3"
          >
            <button
              onClick={() => handleToggle(todo)}
              aria-label={todo.is_done ? "Mark as not done" : "Mark as done"}
              className={`shrink-0 grid place-items-center w-5 h-5 rounded border transition-colors ${
                todo.is_done ? "bg-success border-success text-white" : "border-border text-transparent"
              }`}
            >
              <IconCheck width={12} height={12} />
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${todo.is_done ? "line-through text-text-muted" : "text-text-primary"}`}>
                {todo.title}
              </p>
              {todo.due_date && (
                <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                  <IconCalendar width={11} height={11} />
                  {todo.due_date}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDelete(todo.id)}
              aria-label="Delete task"
              className="shrink-0 text-text-muted hover:text-danger transition-colors"
            >
              <IconTrash width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
