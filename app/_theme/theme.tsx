"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import "./theme.css";

const storageKey = "lyrebird-theme";
const legacyKey = "lyrebird-diary-theme";
const changeEvent = "lyrebird-theme-change";
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === legacyKey || event.key === null) callback(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, callback);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(changeEvent, callback); };
}
let fallback = false;
function snapshot() {
  try { return (localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey)) === "dark"; }
  catch { return fallback; }
}
export function useTheme() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
export function GlobalTheme() {
  const dark = useTheme();
  useEffect(() => {
    document.body.classList.toggle("global-dark", dark);
    return () => document.body.classList.remove("global-dark");
  }, [dark]);
  return null;
}

export function ThemeToggle({ dark, className }: { dark: boolean; className: string }) {
  const label = dark ? "切换浅色模式" : "切换深色模式";
  return <button type="button" className={className} aria-label={label} title={label} aria-pressed={dark} onClick={() => {
    fallback = !dark;
    try { localStorage.setItem(storageKey, dark ? "light" : "dark"); } catch { /* The current session can still switch themes. */ }
    window.dispatchEvent(new Event(changeEvent));
  }}>{dark ? <Sun size={19} /> : <Moon size={19} />}<span>{dark ? "已开启" : "已关闭"}</span></button>;
}
