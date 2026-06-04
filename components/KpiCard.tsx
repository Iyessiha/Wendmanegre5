"use client";

import { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = "ink",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: ReactNode;
  accent?: "ink" | "clay" | "leaf" | "ember" | "gold";
}) {
  const accents: Record<string, string> = {
    ink: "bg-ink/5 text-ink",
    clay: "bg-clay-100 text-clay-700",
    leaf: "bg-leaf-100 text-leaf-600",
    ember: "bg-ember-100 text-ember-600",
    gold: "bg-gold-100 text-clay-700",
  };
  return (
    <div className="rounded-2xl border border-sand-200 bg-white/70 p-5 shadow-card backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accents[accent]}`}>
          {icon}
        </span>
      </div>
      <div className="num mt-3 text-[26px] font-semibold leading-none text-ink">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-ink-500">{sub}</div>}
    </div>
  );
}
