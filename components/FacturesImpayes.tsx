"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { useImpayes } from "@/lib/hooks-factures";
import { Card } from "@/components/ui";
import { formatXOF } from "@/lib/format";

export default function FacturesImpayes({ limit = 6 }: { limit?: number }) {
  const { data } = useImpayes();
  if (data.nbFactures === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
        <h3 className="display flex items-center gap-2 text-lg font-bold text-ink">
          <AlertCircle size={17} className="text-ember-600" /> Factures impayées
        </h3>
        <Link href="/facturation" className="inline-flex items-center gap-1 text-[13px] font-medium text-clay hover:underline">
          Tout voir <ChevronRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-sand-100 border-b border-sand-100">
        <div className="px-4 py-3">
          <div className="text-[11px] text-ink-400">Total dû</div>
          <div className="num text-lg font-bold text-ember-600">{formatXOF(data.totalReste)}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] text-ink-400">Factures</div>
          <div className="num text-lg font-bold text-ink">{data.nbFactures}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] text-ink-400">Commerçants</div>
          <div className="num text-lg font-bold text-ink">{data.nbCommercants}</div>
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">Commerçants les plus endettés</div>
        <div className="divide-y divide-sand-100">
          {data.top.slice(0, limit).map((c, i) => (
            <Link key={c.client_id} href={`/clients/${c.client_id}`}
              className="flex items-center justify-between py-2.5 hover:bg-sand-100/60">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sand-200 text-[11px] font-semibold text-ink-600">{i + 1}</span>
                <div>
                  <div className="text-[13px] font-medium text-ink">{c.nom}</div>
                  <div className="text-[11px] text-ink-400">{c.nb} facture{c.nb > 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="num text-[13px] font-semibold text-ember-600">{formatXOF(c.reste)}</div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
