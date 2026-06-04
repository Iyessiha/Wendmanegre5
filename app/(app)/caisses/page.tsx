"use client";

import { useEffect, useState } from "react";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, User as UserIcon } from "lucide-react";
import { useCaisses, useMouvements, alimenterCaisse, transfererCaisse } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

export default function CaissesPage() {
  const { data: caisses, refetch: refetchCaisses } = useCaisses();
  const { data: mouvements, refetch: refetchMvt } = useMouvements();

  const [userId, setUserId] = useState("");
  const [openAlim, setOpenAlim] = useState<string | null>(null);
  const [openTransf, setOpenTransf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState({ montant: "", libelle: "Approvisionnement" });
  const [transf, setTransf] = useState({ toId: "", montant: "", libelle: "Transfert interne" });

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const total = caisses.reduce((s, c) => s + c.solde, 0);

  async function submitAlim(caisseId: string) {
    const m = Number(form.montant);
    if (!m) { setErreur("Indiquez un montant."); return; }
    if (!userId) { setErreur("Session non chargée, réessayez."); return; }
    setBusy(true); setErreur(null);
    try {
      await alimenterCaisse(caisseId, m, form.libelle, userId);
      setForm({ montant: "", libelle: "Approvisionnement" });
      setOpenAlim(null);
      refetchCaisses(); refetchMvt();
    } catch (e: any) { setErreur(e?.message ?? "Erreur lors de l'alimentation."); }
    setBusy(false);
  }

  async function submitTransf(fromId: string) {
    const m = Number(transf.montant);
    if (!m) { setErreur("Indiquez un montant."); return; }
    if (!transf.toId) { setErreur("Choisissez la caisse de destination."); return; }
    if (transf.toId === fromId) { setErreur("Les deux caisses doivent être différentes."); return; }
    if (!userId) { setErreur("Session non chargée, réessayez."); return; }
    setBusy(true); setErreur(null);
    try {
      await transfererCaisse({ fromId, toId: transf.toId, montant: m, libelle: transf.libelle, userId });
      setTransf({ toId: "", montant: "", libelle: "Transfert interne" });
      setOpenTransf(null);
      refetchCaisses(); refetchMvt();
    } catch (e: any) { setErreur(e?.message ?? "Erreur lors du transfert."); }
    setBusy(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Caisses" subtitle={`Trésorerie totale : ${formatXOF(total)}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {caisses.map((c) => {
          const emp = (c as any).assignee;
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf-100 text-leaf-600">
                    <Wallet size={18} />
                  </span>
                  <div>
                    <h3 className="display text-base font-bold text-ink">{c.nom}</h3>
                    <div className="text-[12px] text-ink-400">{c.agence}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Btn variant="soft" onClick={() => { setErreur(null); setOpenAlim(c.id); }} className="!px-3 !py-2">
                    <Plus size={15} /> Alimenter
                  </Btn>
                  <Btn variant="ghost" onClick={() => { setErreur(null); setTransf({ toId: "", montant: "", libelle: "Transfert interne" }); setOpenTransf(c.id); }} className="!px-3 !py-2">
                    <ArrowLeftRight size={15} />
                  </Btn>
                </div>
              </div>

              <div className="num mt-4 text-3xl font-semibold text-ink">{formatXOF(c.solde)}</div>

              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <UserIcon size={14} className="text-ink-400" />
                {emp ? (
                  <span className="text-ink-700">{emp.nom} <Badge className="ml-1 bg-sand-200 text-ink-700">{emp.role}</Badge></span>
                ) : (
                  <span className="text-ink-400">Non assignée (réserve)</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h3 className="display text-lg font-bold text-ink">Mouvements de caisse</h3>
        </div>
        <div className="divide-y divide-sand-100">
          {mouvements.slice(0, 12).map((m) => {
            const c = caisses.find((x) => x.id === (m as any).caisse_id);
            const positif = m.montant > 0;
            return (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-sand-100/60">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${positif ? "bg-leaf-100 text-leaf-600" : "bg-clay-100 text-clay-700"}`}>
                    {positif ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink">{m.libelle}</div>
                    <div className="text-[11px] text-ink-400">{c?.nom} · {formatDate((m as any).date_mvt)}</div>
                  </div>
                </div>
                <div className={`num text-sm font-semibold ${positif ? "text-leaf-600" : "text-clay-700"}`}>
                  {positif ? "+" : ""}{formatXOF(m.montant)}
                </div>
              </div>
            );
          })}
          {mouvements.length === 0 && (
            <div className="px-5 py-8 text-center text-ink-400 text-sm">Aucun mouvement enregistré.</div>
          )}
        </div>
      </Card>

      {/* Modal alimentation */}
      <Modal open={!!openAlim} onClose={() => setOpenAlim(null)} title="Alimenter la caisse">
        <Field label="Montant (XOF)">
          <input className={inputCls + " num"} type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="1000000" />
        </Field>
        <Field label="Libellé">
          <input className={inputCls} value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
        </Field>
        {erreur && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenAlim(null)}>Annuler</Btn>
          <Btn onClick={() => openAlim && submitAlim(openAlim)} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Confirmer"}</Btn>
        </div>
      </Modal>

      {/* Modal transfert */}
      <Modal open={!!openTransf} onClose={() => setOpenTransf(null)} title="Transférer entre caisses">
        <div className="mb-2 text-[13px] text-ink-500">
          Depuis : <strong className="text-ink">{caisses.find(c => c.id === openTransf)?.nom}</strong>
        </div>
        <Field label="Vers la caisse">
          <select className={inputCls} value={transf.toId} onChange={(e) => setTransf({ ...transf, toId: e.target.value })}>
            <option value="">— Choisir —</option>
            {caisses.filter(c => c.id !== openTransf).map(c => <option key={c.id} value={c.id}>{c.nom} — {c.agence}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (XOF)">
            <input className={inputCls + " num"} type="number" value={transf.montant} onChange={(e) => setTransf({ ...transf, montant: e.target.value })} placeholder="500000" />
          </Field>
          <Field label="Libellé">
            <input className={inputCls} value={transf.libelle} onChange={(e) => setTransf({ ...transf, libelle: e.target.value })} />
          </Field>
        </div>
        {erreur && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenTransf(null)}>Annuler</Btn>
          <Btn onClick={() => openTransf && submitTransf(openTransf)} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Transférer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
