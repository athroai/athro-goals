"use client";

import { useState, useRef, useEffect } from "react";

export function EditableDate({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    const trimmed = input.trim();
    if (trimmed && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      onChange(trimmed);
    } else {
      setInput(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
  };

  if (!value && !editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setInput("dd/mm/yyyy");
          setEditing(true);
        }}
        className="rounded-full border border-dashed border-[rgba(228,201,126,0.3)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
      >
        Add date
      </button>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="dd/mm/yyyy"
        className="w-24 rounded-full border border-[var(--gold)]/40 bg-transparent px-3 py-1 text-xs text-[var(--light)] outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setInput(value);
        setEditing(true);
      }}
      className="rounded-full bg-[rgba(228,201,126,0.2)] px-3 py-1 text-xs font-medium text-[var(--gold)] hover:bg-[rgba(228,201,126,0.3)]"
    >
      {value}
    </button>
  );
}
