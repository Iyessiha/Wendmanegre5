"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Printer, Check, Banknote, X, Trash2, ArrowRight, Search } from "lucide-react";
import { useClients, useCaisses } from "@/lib/hooks";
import {
  useFactures, creerFacture, changerStatutFacture, supprimerFacture, convertirEnFacture, enregistrerPaiement,
  type TypeDoc, type StatutDoc, type Facture,
} from "@/lib/hooks-factures";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

const STATUT: Record<StatutDoc, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-sand-200 text-ink-600" },
  validee:   { label: "Validée",   cls: "bg-blue-100 text-blue-700" },
  payee:     { label: "Payée",     cls: "bg-leaf-100 text-leaf-600" },
  annulee:   { label: "Annulée",   cls: "bg-ember-100 text-ember-600" },
};
const FILTRES = [
  { v: "tous", l: "Tous" }, { v: "brouillon", l: "Brouillons" },
  { v: "validee", l: "Validées" }, { v: "payee", l: "Payées" }, { v: "annulee", l: "Annulées" },
];

export default function FacturationModule({ docType }: { docType: TypeDoc }) {
  const type = docType;
  const [statut, setStatut] = useState("tous");
  const { data: factures, refetch } = useFactures({ type, statut });
  const { data: clients } = useClients();
  const { data: caisses } = useCaisses();
  const [q, setQ] = useState("");

  // Encaissement (paiements partiels)
  const [payFor, setPayFor] = useState<Facture | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ montant: "", mode: "Espèces", caisse_id: "", date: new Date().toISOString().slice(0, 10) });

  function ouvrirPaiement(f: Facture) {
    setPayErr(null);
    setPayForm({ montant: String(f.reste_a_payer ?? f.montant_total), mode: "Espèces", caisse_id: "", date: new Date().toISOString().slice(0, 10) });
    setPayFor(f);
  }
  async function submitPaiement() {
    if (!payFor) return;
    const montant = Number(payForm.montant);
    if (!montant || montant <= 0) { setPayErr("Montant invalide."); return; }
    if (montant > (payFor.reste_a_payer ?? payFor.montant_total)) { setPayErr("Le montant dépasse le reste à payer."); return; }
    setPayBusy(true); setPayErr(null);
    try {
      await enregistrerPaiement({ facture_id: payFor.id, montant, mode: payForm.mode, date_paiement: payForm.date, caisse_id: payForm.caisse_id || null, user_id: userId });
      setPayFor(null); refetch();
    } catch (e: any) { setPayErr(e?.message ?? "Erreur lors de l'encaissement."); }
    setPayBusy(false);
  }

  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState<{ client_id: string; date_facture: string; echeance: string; notes: string; lignes: { designation: string; quantite: string; prix_unitaire: string }[] }>(
    { client_id: "", date_facture: new Date().toISOString().slice(0, 10), echeance: "", notes: "", lignes: [{ designation: "", quantite: "1", prix_unitaire: "" }] }
  );

  const total = form.lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const setLigne = (i: number, patch: Partial<{ designation: string; quantite: string; prix_unitaire: string }>) =>
    setForm(f => ({ ...f, lignes: f.lignes.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));

  const rows = useMemo(() => factures.filter(f =>
    (f.client_nom ?? "").toLowerCase().includes(q.toLowerCase()) || f.id.toLowerCase().includes(q.toLowerCase())
  ), [factures, q]);

  const totalAffiche = rows.filter(f => f.statut !== "annulee").reduce((s, f) => s + f.montant_total, 0);

  function ouvrir() {
    setErreur(null);
    setForm({ client_id: "", date_facture: new Date().toISOString().slice(0, 10), echeance: "", notes: "", lignes: [{ designation: "", quantite: "1", prix_unitaire: "" }] });
    setOpen(true);
  }

  async function submit() {
    if (!form.client_id) { setErreur("Choisissez un commerçant."); return; }
    const lignes = form.lignes.filter(l => l.designation.trim() && Number(l.quantite) > 0)
      .map(l => ({ designation: l.designation, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire) || 0 }));
    if (lignes.length === 0) { setErreur("Ajoutez au moins une ligne."); return; }
    setBusy(true); setErreur(null);
    try {
      await creerFacture({ type, client_id: form.client_id, date_facture: form.date_facture, echeance: form.echeance || null, notes: form.notes || undefined, user_id: userId, lignes });
      setOpen(false); refetch();
    } catch (e: any) { setErreur(e?.message ?? "Erreur lors de la création."); }
    setBusy(false);
  }

  async function setStatutDoc(id: string, s: StatutDoc) {
    try { await changerStatutFacture(id, s); refetch(); } catch (e: any) { alert(e?.message ?? "Erreur."); }
  }
  async function supprimer(id: string) {
    if (!confirm(`Supprimer définitivement ${id} ?`)) return;
    try { await supprimerFacture(id); refetch(); } catch (e: any) { alert(e?.message ?? "Erreur."); }
  }
  async function convertir(id: string) {
    try { const newId = await convertirEnFacture(id, userId); refetch(); alert(`Facture ${newId} créée à partir de la commande.`); }
    catch (e: any) { alert(e?.message ?? "Erreur."); }
  }

  const motDoc = type === "facture" ? "facture" : "commande";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={docType === "facture" ? "Facturation" : "Commandes clients"}
        subtitle={`${rows.length} ${motDoc}s · ${formatXOF(totalAffiche)}`}
        action={<Btn onClick={ouvrir}><Plus size={16} /> <span className="hidden sm:inline">Nouvelle {motDoc}</span></Btn>}
      />

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
        <Search size={17} className="text-ink-400 flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une référence ou un commerçant…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTRES.map(s => (
          <button key={s.v} onClick={() => setStatut(s.v)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${statut === s.v ? "bg-clay text-sand-50" : "bg-white/70 border border-sand-200 text-ink-500 hover:bg-sand-200"}`}>
            {s.l}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3 font-medium">Référence</th>
                <th className="px-5 py-3 font-medium">Commerçant</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 text-right font-medium">Montant</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(f => (
                <tr key={f.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                  <td className="num px-5 py-3.5 text-ink-700">{f.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ink">{f.client_nom}</div>
                    <div className="text-[11px] text-ink-400">{f.client_ville}</div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-500 text-[13px]">{formatDate(f.date_facture)}</td>
                  <td className="num px-5 py-3.5 text-right">
                    <div className="font-semibold text-ink">{formatXOF(f.montant_total)}</div>
                    {f.type === "facture" && (f.total_paye ?? 0) > 0 && f.statut !== "payee" && (
                      <div className="text-[11px] text-ember-600">reste {formatXOF(f.reste_a_payer ?? 0)}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5"><Badge className={STATUT[f.statut].cls}>{STATUT[f.statut].label}</Badge></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`/receipt/facture/${encodeURIComponent(f.id)}`} target="_blank" rel="noreferrer"
                        title="Imprimer" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-clay"><Printer size={15} /></a>
                      {f.statut === "brouillon" && (
                        <button onClick={() => setStatutDoc(f.id, "validee")} title="Valider"
                          className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-blue-700"><Check size={15} /></button>
                      )}
                      {f.type === "facture" && f.statut === "validee" && (f.reste_a_payer ?? f.montant_total) > 0 && (
                        <button onClick={() => ouvrirPaiement(f)} title="Encaisser un paiement"
                          className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-leaf-600"><Banknote size={15} /></button>
                      )}
                      {f.type === "commande" && f.statut !== "annulee" && (
                        <button onClick={() => convertir(f.id)} title="Convertir en facture"
                          className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-clay"><ArrowRight size={15} /></button>
                      )}
                      {f.statut !== "annulee" && f.statut !== "payee" && (
                        <button onClick={() => setStatutDoc(f.id, "annulee")} title="Annuler"
                          className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ember-600"><X size={15} /></button>
                      )}
                      {f.statut === "brouillon" && (
                        <button onClick={() => supprimer(f.id)} title="Supprimer"
                          className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ember-600"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-400">Aucune {motDoc} pour ce filtre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal création */}
      <Modal open={open} onClose={() => setOpen(false)} title={`Nouvelle ${motDoc}`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commerçant">
            <select className={inputCls} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">— Choisir —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input className={inputCls} type="date" value={form.date_facture} onChange={e => setForm(f => ({ ...f, date_facture: e.target.value }))} />
          </Field>
        </div>
        <Field label="Échéance (optionnel)">
          <input className={inputCls} type="date" value={form.echeance} onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))} />
        </Field>

        <div className="mt-2 mb-1 text-[12px] font-medium text-ink-600">Lignes</div>
        <div className="space-y-2">
          {form.lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className={inputCls + " col-span-6"} value={l.designation} onChange={e => setLigne(i, { designation: e.target.value })} placeholder="Désignation" />
              <input className={inputCls + " num col-span-2"} type="number" value={l.quantite} onChange={e => setLigne(i, { quantite: e.target.value })} placeholder="Qté" />
              <input className={inputCls + " num col-span-3"} type="number" value={l.prix_unitaire} onChange={e => setLigne(i, { prix_unitaire: e.target.value })} placeholder="P.U." />
              <button onClick={() => setForm(f => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }))}
                className="col-span-1 flex items-center justify-center rounded-lg text-ink-400 hover:text-ember-600" disabled={form.lignes.length === 1}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setForm(f => ({ ...f, lignes: [...f.lignes, { designation: "", quantite: "1", prix_unitaire: "" }] }))}
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-clay hover:underline">
          <Plus size={14} /> Ajouter une ligne
        </button>

        <Field label="Notes (optionnel)">
          <input className={inputCls} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>

        <div className="mt-3 flex items-center justify-between border-t border-sand-200 pt-3">
          <span className="text-[13px] text-ink-500">Total</span>
          <span className="num text-lg font-semibold text-ink">{formatXOF(total)}</span>
        </div>

        {erreur && <p className="mt-2 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpen(false)}>Annuler</Btn>
          <Btn onClick={submit} className={busy ? "opacity-50" : ""}>{busy ? "Création…" : `Créer la ${motDoc}`}</Btn>
        </div>
      </Modal>

      {/* Modal encaissement */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={`Encaisser — ${payFor?.id ?? ""}`}>
        {payFor && (
          <div className="mb-3 rounded-xl bg-sand-100 px-4 py-3 text-[13px]">
            <div className="flex justify-between"><span className="text-ink-500">Total facture</span><span className="num font-medium">{formatXOF(payFor.montant_total)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Déjà payé</span><span className="num">{formatXOF(payFor.total_paye ?? 0)}</span></div>
            <div className="mt-1 flex justify-between border-t border-sand-200 pt-1"><span className="font-medium text-ink-600">Reste à payer</span><span className="num font-semibold text-ember-600">{formatXOF(payFor.reste_a_payer ?? 0)}</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant"><input className={inputCls + " num"} type="number" value={payForm.montant} onChange={e => setPayForm(f => ({ ...f, montant: e.target.value }))} /></Field>
          <Field label="Date"><input className={inputCls} type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode de paiement">
            <select className={inputCls} value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
              {["Espèces", "Versement", "Orange Money", "Moov Money", "Virement"].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Caisse créditée (optionnel)">
            <select className={inputCls} value={payForm.caisse_id} onChange={e => setPayForm(f => ({ ...f, caisse_id: e.target.value }))}>
              <option value="">— Aucune —</option>
              {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
        </div>
        {payErr && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{payErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setPayFor(null)}>Annuler</Btn>
          <Btn onClick={submitPaiement} className={payBusy ? "opacity-50" : ""}>{payBusy ? "Encaissement…" : "Encaisser"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
