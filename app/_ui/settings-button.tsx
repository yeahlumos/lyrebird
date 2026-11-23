import type { ComponentProps } from "react";
import { Settings } from "lucide-react";

export default function SettingsButton({ className = "", title, "aria-label": label, type = "button", ...props }: Omit<ComponentProps<"button">, "children">) {
  return <button {...props} type={type} title={title ?? label} aria-label={label} className={`site-settings-button ${className}`}>
    <Settings size={21} strokeWidth={1.7} aria-hidden="true" />
  </button>;
}
