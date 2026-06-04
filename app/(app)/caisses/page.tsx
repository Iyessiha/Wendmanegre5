"use client";

import { useState } from "react";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, User as UserIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

export default function CaissesPage() {
  const { caisses, users, mouvements, alimenterCaisse } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ montant: "", libelle: "Approvisionnement" });

  const total = caisses.reduce((s, c) => s + c.solde, 0);

  function submit(caisseId: string) {
    const m = Number(form.montant);
    if (!m) return;
    alimenterCaisse(caisseId, m, form.libelle);
    setForm({ montant: "", libelle: "Approvisionnement" });
    setOpen(null);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Caisses"
        subtitle={`Trésorerie totale : ${formatXOF(total)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {caisses.map((c) => {
          const emp = users.find((u) => u.id === c.assigneeA);
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf-100 text-leaf-600">
                      <Wallet size={18} />
                    </span>
                    <div>
                      <h3 className="display text-base font-bold text-ink">{c.nom}</h3>
                      <div className="text-[12px] text-ink-400">{c.agence}</div>
                    </div>
                  </div>
                </div>
                <Btn variant="soft" onClick={() => setOpen(c.id)} className="!px-3 !py-2">
                  <Plus size={15} /> Alimenter
                </Btn>
              </div>

              <div className="num mt-4 text-3xl font-semibold text-ink">{formatXOF(c.solde)}</div>

              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <UserIcon size={14} className="text-ink-400" />
                {emp ? (
                  <span className="text-ink-700">
                    {emp.nom} <Badge className="ml-1 bg-sand-200 text-ink-700">{emp.role}</Badge>
                  </span>
                ) : (
                  <span className="text-ink-400">Non assignée (réserve)</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Historique mouvements */}
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h3 className="display text-lg font-bold text-ink">Mouvements de caisse</h3>
        </div>
        <div className="divide-y divide-sand-100">
          {mouvements.slice(0, 12).map((m) => {
            const c = caisses.find((x) => x.id === m.caisseId);
            const positif = m.montant > 0;
            return (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-sand-100/60">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${positif ? "bg-leaf-100 text-leaf-600" : "bg-clay-100 text-clay-700"}`}>
                    {positif ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink">{m.libelle}</div>
                    <div className="text-[11px] text-ink-400">{c?.nom} · {formatDate(m.date)}</div>
                  </div>
                </div>
                <div className={`num text-sm font-semibold ${positif ? "text-leaf-600" : "text-clay-700"}`}>
                  {positif ? "+" : ""}{formatXOF(m.montant)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title="Alimenter la caisse">
        <Field label="Montant (XOF)">
          <input className={inputCls + " num"} type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="1000000" />
        </Field>
        <Field label="Libellé">
          <input className={inputCls} value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpen(null)}>Annuler</Btn>
          <Btn onClick={() => open && submit(open)}>Confirmer</Btn>
        </div>
      </Modal>
    </div>
  );
}
