"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="display text-[24px] font-bold leading-tight text-ink sm:text-[30px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500 leading-relaxed">{subtitle}</p>}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-sand-200 bg-white/70 shadow-card backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string | ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 p-0">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-lg animate-fade-up rounded-t-2xl sm:rounded-2xl border border-sand-200 bg-sand-50 shadow-lift max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-sand-50 px-5 py-4 border-b border-sand-100 rounded-t-2xl">
          <h2 className="display text-lg font-bold text-ink leading-tight pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-xl p-1.5 text-ink-400 hover:bg-sand-200 hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-clay focus:ring-2 focus:ring-clay/15";

export function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "soft";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98]";
  const styles = {
    primary: "bg-clay text-sand-50 hover:bg-clay-600 shadow-card",
    ghost: "text-ink-700 hover:bg-sand-200",
    soft: "bg-sand-200 text-ink hover:bg-sand-300",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
}
