"use client";

import { useEffect, useState } from "react";
import { Radio, Plus, ArrowDownCircle, ArrowUpCircle, Edit2, Trash2, Phone } from "lucide-react";
import {
  useOperateurs, creerOperateur, modifierOperateur, supprimerOperateur, ajusterFlotte,
  type Operateur,
} from "@/lib/hooks-operateurs";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { PhotoProfil } from "@/components/FicheMedia";
import { formatXOF } from "@/lib/format";

const TYPES = [
  { v: "mobile_money", l: "Mobile Money" },
  { v: "telecom", l: "Télécom" },
  { v: "banque", l: "Banque" },
  { v: "autre", l: "Autre" },
];
const typeLabel = (t: string) => TYPES.find(x => x.v === t)?.l ?? t;

export default function OperateursPage() {
  const { data: operateurs, refetch } = useOperateurs();
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const actifs = operateurs.filter(o => o.actif);
  const totalFlotte = actifs.reduce((s, o) => s + o.solde_flotte, 0);

  // Création / édition
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [errForm, setErrForm] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", nom: "", type: "mobile_money", commission_taux: "", telephone_support: "", couleur: "#6B7280" });
  function ouvrirNew() { setErrForm(null); setEditId(null); setForm({ id: "", nom: "", type: "mobile_money", commission_taux: "", telephone_support: "", couleur: "#FF6600" }); setOpenForm(true); }
  function ouvrirEdit(o: Operateur) { setErrForm(null); setEditId(o.id); setForm({ id: o.id, nom: o.nom, type: o.type, commission_taux: String(o.commission_taux), telephone_support: o.telephone_support ?? "", couleur: o.couleur ?? "#6B7280" }); setOpenForm(true); }
  async function submitForm() {
    if (!form.nom.trim()) { setErrForm("Le nom est requis."); return; }
    if (!editId && !form.id.trim()) { setErrForm("Le code est requis (ex. OM, MOOV)."); return; }
    setBusy(true); setErrForm(null);
    try {
      if (editId) {
        await modifierOperateur(editId, { nom: form.nom.trim(), type: form.type as any, commission_taux: Number(form.commission_taux) || 0, telephone_support: form.telephone_support || null, couleur: form.couleur } as any);
      } else {
        await creerOperateur({ id: form.id, nom: form.nom.trim(), type: form.type, commission_taux: Number(form.commission_taux) || 0, telephone_support: form.telephone_support || undefined, couleur: form.couleur });
      }
      setOpenForm(false); refetch();
    } catch (e: any) { setErrForm(e?.message ?? "Erreur."); }
    setBusy(false);
  }
  async function supprimer(o: Operateur) {
    if (!confirm(`Désactiver l'opérateur ${o.nom} ?`)) return;
    try { await supprimerOperateur(o.id); refetch(); } catch (e: any) { alert(e?.message ?? "Erreur."); }
  }

  // Mouvement de flotte
  const [flotteOp, setFlotteOp] = useState<Operateur | null>(null);
  const [flotteForm, setFlotteForm] = useState({ type: "appro", montant: "", libelle: "" });
  const [errFlotte, setErrFlotte] = useState<string | null>(null);
  function ouvrirFlotte(o: Operateur, type: "appro" | "retrait") { setErrFlotte(null); setFlotteForm({ type, montant: "", libelle: type === "appro" ? "Approvisionnement flotte" : "Retrait flotte" }); setFlotteOp(o); }
  async function submitFlotte() {
    if (!flotteOp) return;
    const m = Number(flotteForm.montant);
    if (!m || m <= 0) { setErrFlotte("Montant invalide."); return; }
    setBusy(true); setErrFlotte(null);
    try { await ajusterFlotte({ operateur_id: flotteOp.id, type: flotteForm.type as any, montant: m, libelle: flotteForm.libelle, user_id: userId }); setFlotteOp(null); refetch(); }
    catch (e: any) { setErrFlotte(e?.message ?? "Erreur."); }
    setBusy(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Opérateurs"
        subtitle={`${actifs.length} opérateurs actifs · flotte totale ${formatXOF(totalFlotte)}`}
        action={<Btn onClick={ouvrirNew}><Plus size={16} /> <span className="hidden sm:inline">Nouvel opérateur</span></Btn>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {operateurs.map(o => (
          <Card key={o.id} className={`p-5 ${o.actif ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white" style={{ background: o.couleur ?? "#6B7280" }}>
                  {o.photo_url ? <img src={o.photo_url} alt={o.nom} className="h-full w-full object-cover" /> : o.id.slice(0, 3)}
                </span>
                <div>
                  <h3 className="display text-base font-bold text-ink">{o.nom}</h3>
                  <Badge className="bg-sand-200 text-ink-600">{typeLabel(o.type)}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => ouvrirEdit(o)} title="Modifier" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink"><Edit2 size={15} /></button>
                <button onClick={() => supprimer(o)} title="Désactiver" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ember-600"><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[12px] text-ink-400">Flotte e-money disponible</div>
              <div className="num text-2xl font-semibold text-ink">{formatXOF(o.solde_flotte)}</div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[12px] text-ink-500">
              <span>Commission : <strong className="text-ink-700">{o.commission_taux}%</strong></span>
              {o.telephone_support && <span className="inline-flex items-center gap-1"><Phone size={12} /> {o.telephone_support}</span>}
            </div>

            <div className="mt-4 flex gap-2">
              <Btn variant="soft" onClick={() => ouvrirFlotte(o, "appro")} className="!px-3 !py-2 flex-1"><ArrowDownCircle size={15} /> Approvisionner</Btn>
              <Btn variant="ghost" onClick={() => ouvrirFlotte(o, "retrait")} className="!px-3 !py-2"><ArrowUpCircle size={15} /></Btn>
            </div>

            <div className="mt-3 flex justify-center">
              <PhotoProfil entite="operateur" id={o.id} nom={o.nom} photoUrl={o.photo_url} />
            </div>
          </Card>
        ))}
        {operateurs.length === 0 && <Card className="p-6 text-center text-[13px] text-ink-400 sm:col-span-2 lg:col-span-3">Aucun opérateur. Ajoutez Orange Money, Moov Money…</Card>}
      </div>

      {/* Création / édition */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editId ? `Modifier — ${form.nom}` : "Nouvel opérateur"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code"><input className={inputCls + " num"} value={form.id} disabled={!!editId} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} placeholder="OM" /></Field>
          <Field label="Nom"><input className={inputCls} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Orange Money" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Commission (%)"><input className={inputCls + " num"} type="number" step="0.1" value={form.commission_taux} onChange={e => setForm(f => ({ ...f, commission_taux: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone support"><input className={inputCls} value={form.telephone_support} onChange={e => setForm(f => ({ ...f, telephone_support: e.target.value }))} /></Field>
          <Field label="Couleur"><input className={inputCls + " h-[42px] p-1"} type="color" value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))} /></Field>
        </div>
        {errForm && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{errForm}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenForm(false)}>Annuler</Btn>
          <Btn onClick={submitForm} className={busy ? "opacity-50" : ""}>{busy ? "…" : editId ? "Enregistrer" : "Créer"}</Btn>
        </div>
      </Modal>

      {/* Flotte */}
      <Modal open={!!flotteOp} onClose={() => setFlotteOp(null)} title={`${flotteForm.type === "appro" ? "Approvisionner" : "Retrait"} — ${flotteOp?.nom ?? ""}`}>
        {flotteOp && <div className="mb-3 rounded-xl bg-sand-100 px-4 py-2.5 text-[13px] text-ink-600">Flotte actuelle : <strong className="num">{formatXOF(flotteOp.solde_flotte)}</strong></div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputCls} value={flotteForm.type} onChange={e => setFlotteForm(f => ({ ...f, type: e.target.value }))}>
              <option value="appro">Approvisionnement (+)</option>
              <option value="retrait">Retrait (−)</option>
              <option value="ajustement">Ajustement (+)</option>
            </select>
          </Field>
          <Field label="Montant (XOF)"><input className={inputCls + " num"} type="number" value={flotteForm.montant} onChange={e => setFlotteForm(f => ({ ...f, montant: e.target.value }))} /></Field>
        </div>
        <Field label="Libellé"><input className={inputCls} value={flotteForm.libelle} onChange={e => setFlotteForm(f => ({ ...f, libelle: e.target.value }))} /></Field>
        {errFlotte && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{errFlotte}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setFlotteOp(null)}>Annuler</Btn>
          <Btn onClick={submitFlotte} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Valider"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
