"use client";

import { useSyncExternalStore } from "react";

// Recent searches live on this device only (no account needed), newest first.
const KEY = "osfp.recent-searches";
const MAX = 6;
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: string[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // private mode: keep it for this visit only
  }
  listeners.forEach((l) => l());
}

const EMPTY: string[] = [];

export function useRecentSearches() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
  return { list, remember, clear };
}

// Module-level so they keep the same identity between renders.
function remember(q: string) {
  const text = q.trim().replace(/\s+/g, " ").slice(0, 40);
  if (text.length < 2) return;
  write([text, ...read().filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, MAX));
}

function clear() {
  write([]);
}
