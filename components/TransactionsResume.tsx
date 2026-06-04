"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useTransactions, resumeJour, labelType } from "@/lib/hooks-transactions";
import { Card } from "@/components/ui";
import { formatXOF } from "@/lib/format";

const TYPE_BADGE: Record<string, string> = {
  DEPOT: "bg-leaf-100 text-leaf-600", RETRAIT: "bg-clay/15 text-clay-700", ENVOI: "bg-blue-100 text-blue-700",
  RECEPTION: "bg-gold/20 text-gold-700", CREDIT: "bg-sand-200 text-ink-600", REMBOURSEMENT: "bg-leaf-100 text-leaf-600",
};

export default function TransactionsResume() {
  const { data: transactions } = useTransactions({ limit: 50 });
  const resume = useMemo(() => resumeJour(transactions), [transactions]);
  const recentes = transactions.slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
        <h3 className="display flex items-center gap-2 text-lg font-bold text-ink"><ArrowLeftRight size={17} className="text-clay" /> Transactions</h3>
        <Link href="/transactions" className="inline-flex items-center gap-1 text-[13px] font-medium text-clay hover:underline">Tout voir <ChevronRight size={14} /></Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-sand-100 border-b border-sand-100">
        <div className="px-4 py-3"><div className="text-[11px] text-ink-400">Aujourd'hui</div><div className="num text-lg font-bold text-ink">{resume.nombre}</div></div>
        <div className="px-4 py-3"><div className="text-[11px] text-ink-400">Volume</div><div className="num text-lg font-bold text-ink">{formatXOF(resume.volume)}</div></div>
        <div className="px-4 py-3"><div className="text-[11px] text-ink-400">Commissions</div><div className="num text-lg font-bold text-leaf-600">{formatXOF(resume.commissions)}</div></div>
      </div>

      <div className="divide-y divide-sand-100">
        {recentes.map(t => (
          <div key={t.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[t.type] ?? "bg-sand-200 text-ink-600"}`}>{labelType(t.type)}</span>
              <div className="text-[13px] text-ink-700">{t.nom_client || t.telephone_client || t.operateur || "—"}</div>
            </div>
            <div className="num text-[13px] font-semibold text-ink">{formatXOF(t.montant)}</div>
          </div>
        ))}
        {recentes.length === 0 && (
          <div className="px-5 py-6 text-center text-[13px] text-ink-400">
            Aucune transaction. <Link href="/transactions" className="text-clay hover:underline">En enregistrer une</Link>.
          </div>
        )}
      </div>
    </Card>
  );
}
