"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Plus, MapPin, ChevronRight, Edit2, Power,
  Truck, Phone, Mail, Building2, AlertTriangle,
} from "lucide-react";
import { useClients, usePrets, upsertClient } from "@/lib/hooks";
import { useFournisseurs } from "@/lib/hooks-stock";
import { getClient } from "@/lib/supabase";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF } from "@/lib/format";
import { useRealtimeRefetch } from "@/lib/realtime";

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"commercants", label:"Commerçants",  icon:Building2 },
  { id:"fournisseurs",label:"Fournisseurs", icon:Truck     },
] as const;
type TabId = typeof TABS[number]["id"];

const TYPE_BADGE: Record<string,string> = {
  OPERATEUR:   "bg-orange-100 text-orange-700",
  DISTRIBUTEUR:"bg-blue-100 text-blue-700",
  FABRICANT:   "bg-purple-100 text-purple-700",
  AUTRE:       "bg-sand-200 text-ink-500",
};

// ── Page principale ───────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [tab, setTab] = useState<TabId>("commercants");

  // ── Commerçants ────────────────────────────────────────────────────────────
  const { data: clients, loading: loadClients, refetch: rfClients } = useClients();
  const { data: prets } = usePrets();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"tous"|"actifs"|"inactifs"|"depassement">("tous");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string|null>(null);
  const [form, setForm] = useState({ id:"", nom:"", nom_alternatif:"", ville:"", telephone:"", plafond:"", identifiant_pro1:"", identifiant_pro2:"", actif:true });

  type Row = (typeof clients)[number] & { encours:number; nbPrets:number };

  const rows: Row[] = useMemo(() => clients.map(c => {
    const sesPrets = prets.filter(p => p.client_id === c.id);
    const encours = sesPrets.filter(p => p.statut!=="rembourse"&&p.statut!=="annule").reduce((s,p)=>s+(p.reste_a_payer??0),0);
    return { ...c, encours, nbPrets:sesPrets.length };
  }).filter(c => {
    const texte = c.nom.toLowerCase().includes(q.toLowerCase()) ||
      c.id.toLowerCase().includes(q.toLowerCase()) ||
      (c.ville??"").toLowerCase().includes(q.toLowerCase());
    if (!texte) return false;
    if (filtre==="actifs")      return c.actif !== false;
    if (filtre==="inactifs")    return c.actif === false;
    if (filtre==="depassement") return (c.plafond??0)>0 && c.encours>(c.plafond??0);
    return true;
  }).sort((a,b) => b.encours - a.encours), [clients, prets, q, filtre]);

  function ouvrirNew() {
    setErreur(null);
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth()+1).padStart(2,"0");
    const n = String(clients.length+1).padStart(5,"0");
    setForm({ id:`CU${yy}${mm}-${n}`, nom:"", nom_alternatif:"", ville:"Yako", telephone:"", plafond:"500000", identifiant_pro1:"", identifiant_pro2:"", actif:true });
    setEditId(null); setOpenNew(true);
  }
  function ouvrirEdit(c: any) {
    setErreur(null);
    setForm({ id:c.id, nom:c.nom, nom_alternatif:c.nom_alternatif??"", ville:c.ville??"", telephone:c.telephone??"", plafond:String(c.plafond??500000), identifiant_pro1:c.identifiant_pro1??"", identifiant_pro2:c.identifiant_pro2??"", actif:c.actif!==false });
    setEditId(c.id); setOpenNew(true);
  }
  async function sauvegarder() {
    if (!form.nom.trim()) { setErreur("Nom requis."); return; }
    setSaving(true); setErreur(null);
    try {
      await upsertClient({ id:form.id, nom:form.nom.trim(), nom_alternatif:form.nom_alternatif||undefined, ville:form.ville||"Yako", telephone:form.telephone||undefined, plafond:Number(form.plafond)||500000, identifiant_pro1:form.identifiant_pro1||undefined, identifiant_pro2:form.identifiant_pro2||undefined, actif:form.actif });
      setOpenNew(false); rfClients();
    } catch(e:any){ setErreur(e?.message??"Erreur."); }
    setSaving(false);
  }

  const nbActifs = useMemo(()=>clients.filter(c=>c.actif!==false).length,[clients]);
  const encoursTot = useMemo(()=>rows.reduce((s,r)=>s+r.encours,0),[rows]);

  // ── Fournisseurs ───────────────────────────────────────────────────────────
  const { data: fournisseurs, refetch: rfFourn } = useFournisseurs();
  const [qF, setQF] = useState("");
  const [openNewF, setOpenNewF] = useState(false);
  const [editF, setEditF] = useState<any|null>(null);
  const [fBusy, setFBusy] = useState(false);
  const [fErr, setFErr] = useState<string|null>(null);
  const [fForm, setFForm] = useState({ nom:"", type:"OPERATEUR", telephone:"", email:"", adresse:"", contact:"", delai_livraison:"3", conditions_paiement:"Avance", notes:"" });

  const fournFiltrés = useMemo(()=>fournisseurs.filter(f=>(f.nom??"").toLowerCase().includes(qF.toLowerCase())||(f.type??"").toLowerCase().includes(qF.toLowerCase())),[fournisseurs,qF]);

  function ouvrirNewF() { setFErr(null); setFForm({nom:"",type:"OPERATEUR",telephone:"",email:"",adresse:"",contact:"",delai_livraison:"3",conditions_paiement:"Avance",notes:""}); setEditF(null); setOpenNewF(true); }
  function ouvrirEditF(f:any) { setFErr(null); setFForm({nom:f.nom,type:f.type,telephone:f.telephone??"",email:f.email??"",adresse:f.adresse??"",contact:f.contact??"",delai_livraison:String(f.delai_livraison??"3"),conditions_paiement:f.conditions_paiement??"Avance",notes:f.notes??""}); setEditF(f); setOpenNewF(true); }

  async function sauvegarderF() {
    if (!fForm.nom.trim()) { setFErr("Nom requis."); return; }
    setFBusy(true); setFErr(null);
    const sb = getClient() as any;
    const payload = { nom:fForm.nom.trim(), type:fForm.type, telephone:fForm.telephone||null, email:fForm.email||null, adresse:fForm.adresse||null, contact:fForm.contact||null, delai_livraison:Number(fForm.delai_livraison)||3, conditions_paiement:fForm.conditions_paiement, notes:fForm.notes||null, actif:true };
    if (editF) await sb.from("fournisseurs").update(payload).eq("id",editF.id);
    else await sb.from("fournisseurs").insert(payload);
    setOpenNewF(false); rfFourn(); setFBusy(false);
  }

  // ── Header action contextuel ───────────────────────────────────────────────
  const headerAction = tab==="commercants" ? (
    <Btn onClick={ouvrirNew}><Plus size={15}/> Nouveau commerçant</Btn>
  ) : (
    <Btn onClick={ouvrirNewF}><Plus size={15}/> Nouveau fournisseur</Btn>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={tab==="commercants" ? "Commerçants" : "Fournisseurs"}
        subtitle={tab==="commercants"
          ? `${nbActifs} actifs · encours ${formatXOF(encoursTot)}`
          : `${fournisseurs.filter(f=>f.actif).length} fournisseurs actifs`}
        action={headerAction}
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors
              ${tab===t.id?"bg-clay text-sand-50":"bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
            <t.icon size={14}/> {t.label}
          </button>
        ))}
      </div>

      {/* ── COMMERÇANTS ───────────────────────────────────────────────────── */}
      {tab==="commercants" && (
        <div>
          {/* Filtres */}
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5">
              <Search size={16} className="text-ink-400"/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, ID, ville…" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"/>
            </div>
            {(["tous","actifs","inactifs","depassement"] as const).map(f=>(
              <button key={f} onClick={()=>setFiltre(f)}
                className={`rounded-xl px-3 py-2 text-[13px] font-medium ${filtre===f?"bg-clay text-sand-50":"bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
                {f==="depassement"?"⚠ Dépassement":f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>

          {/* Liste commerçants */}
          <div className="space-y-2">
            {rows.slice(0,100).map(c => {
              const depasse = (c.plafond??0)>0 && c.encours>(c.plafond??0);
              return (
                <Card key={c.id} className={`overflow-hidden transition-all hover:shadow-md ${!c.actif?"opacity-55":""}`}>
                  <div className="flex items-center gap-3 p-4">
                    {/* Avatar */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold
                      ${depasse?"bg-ember-100 text-ember-700":"bg-clay-100 text-clay-700"}`}>
                      {c.nom.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink truncate">{c.nom}</span>
                        {depasse && <AlertTriangle size={13} className="shrink-0 text-ember-500"/>}
                        {!c.actif && <Badge className="bg-sand-200 text-ink-400">Inactif</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[12px] text-ink-400">
                        {c.ville && <span className="flex items-center gap-1"><MapPin size={11}/>{c.ville}</span>}
                        {c.telephone && <span className="num">{c.telephone}</span>}
                        <span className="num text-ink-300">{c.id}</span>
                      </div>
                    </div>
                    {/* Encours */}
                    <div className="shrink-0 text-right hidden sm:block">
                      {c.encours > 0 && (
                        <>
                          <div className={`num text-[13px] font-bold ${depasse?"text-ember-600":"text-clay-700"}`}>{formatXOF(c.encours)}</div>
                          <div className="text-[11px] text-ink-400">encours</div>
                        </>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-1">
                      <button onClick={()=>ouvrirEdit(c)} className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 tap"><Edit2 size={14}/></button>
                      <Link href={`/clients/${c.id}`} className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 tap"><ChevronRight size={15}/></Link>
                    </div>
                  </div>
                  {/* Barre encours */}
                  {(c.plafond??0) > 0 && c.encours > 0 && (
                    <div className="h-1 bg-sand-100">
                      <div className={`h-1 ${depasse?"bg-ember-500":"bg-clay"}`} style={{width:`${Math.min(100,c.encours/(c.plafond??1)*100)}%`}}/>
                    </div>
                  )}
                </Card>
              );
            })}
            {rows.length === 0 && !loadClients && (
              <Card className="p-10 text-center text-[13px] text-ink-400">Aucun commerçant trouvé.</Card>
            )}
            {rows.length > 100 && (
              <div className="text-center text-[12px] text-ink-400 py-2">… {rows.length-100} autres commerçants — affinez la recherche</div>
            )}
          </div>
        </div>
      )}

      {/* ── FOURNISSEURS ──────────────────────────────────────────────────── */}
      {tab==="fournisseurs" && (
        <div>
          {/* Résumé */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l:"Total",         v:String(fournisseurs.length) },
              { l:"Actifs",        v:String(fournisseurs.filter(f=>f.actif).length) },
              { l:"Dettes totales",v:formatXOF(fournisseurs.reduce((s,f)=>s+(f.solde_du??0),0)), accent:true },
              { l:"Commandes passées",v:String(fournisseurs.reduce((s,f)=>s+(f.nb_commandes??0),0)) },
            ].map(s=>(
              <Card key={s.l} className="p-4">
                <div className="text-[12px] text-ink-400">{s.l}</div>
                <div className={`num mt-1 text-xl font-bold ${(s as any).accent&&fournisseurs.some(f=>(f.solde_du??0)>0)?"text-clay-700":"text-ink"}`}>{s.v}</div>
              </Card>
            ))}
          </div>

          {/* Recherche */}
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5">
            <Search size={15} className="text-ink-400"/>
            <input value={qF} onChange={e=>setQF(e.target.value)} placeholder="Rechercher un fournisseur…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-400"/>
          </div>

          {/* Liste fournisseurs */}
          <div className="grid gap-3 sm:grid-cols-2">
            {fournFiltrés.map(f=>(
              <Card key={f.id} className={`p-5 ${!f.actif?"opacity-55":""}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink truncate">{f.nom}</span>
                      <Badge className={TYPE_BADGE[f.type]??'bg-sand-200 text-ink-500'}>{f.type}</Badge>
                    </div>
                    {f.contact && <div className="text-[12px] text-ink-400 mt-0.5">{f.contact}</div>}
                  </div>
                  <button onClick={()=>ouvrirEditF(f)} className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 shrink-0 tap"><Edit2 size={14}/></button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  {f.telephone && <div className="flex items-center gap-1.5 text-ink-600"><Phone size={11} className="text-ink-300"/>{f.telephone}</div>}
                  {f.email     && <div className="flex items-center gap-1.5 text-ink-600"><Mail size={11} className="text-ink-300"/>{f.email}</div>}
                  {f.adresse   && <div className="flex items-center gap-1.5 text-ink-600 col-span-2"><MapPin size={11} className="text-ink-300"/>{f.adresse}</div>}
                  <div className="text-ink-500">⏱ Délai : <span className="font-medium">{f.delai_livraison}j</span></div>
                  <div className="text-ink-500">💳 {f.conditions_paiement}</div>
                  {f.nb_commandes && <div className="text-ink-500">📦 {f.nb_commandes} commandes</div>}
                </div>
                {(f.solde_du??0) > 0 && (
                  <div className="mt-3 rounded-xl bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600">
                    Dette en cours : <span className="num font-bold">{formatXOF(f.solde_du)}</span>
                  </div>
                )}
                {f.derniere_commande && (
                  <div className="mt-2 text-[11px] text-ink-400">Dernière commande : {new Date(f.derniere_commande).toLocaleDateString("fr-FR")}</div>
                )}
              </Card>
            ))}
            {fournFiltrés.length===0 && <Card className="p-10 text-center text-[13px] text-ink-400 sm:col-span-2">Aucun fournisseur.</Card>}
          </div>
        </div>
      )}

      {/* ── Modal Commerçant ──────────────────────────────────────────────── */}
      <Modal open={openNew} onClose={()=>setOpenNew(false)} title={editId ? `Modifier — ${form.nom}` : "Nouveau commerçant"}>
        <Field label="Nom complet ★"><input className={inputCls} value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} autoFocus/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom alternatif"><input className={inputCls} value={form.nom_alternatif} onChange={e=>setForm(f=>({...f,nom_alternatif:e.target.value}))}/></Field>
          <Field label="Ville"><input className={inputCls} value={form.ville} onChange={e=>setForm(f=>({...f,ville:e.target.value}))}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className={inputCls+" num"} value={form.telephone} onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}/></Field>
          <Field label="Plafond crédit (XOF)"><input className={inputCls+" num"} type="number" value={form.plafond} onChange={e=>setForm(f=>({...f,plafond:e.target.value}))}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CNIB / ID pro 1"><input className={inputCls+" num"} value={form.identifiant_pro1} onChange={e=>setForm(f=>({...f,identifiant_pro1:e.target.value}))}/></Field>
          <Field label="ID pro 2"><input className={inputCls+" num"} value={form.identifiant_pro2} onChange={e=>setForm(f=>({...f,identifiant_pro2:e.target.value}))}/></Field>
        </div>
        {editId && (
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="actif" checked={form.actif} onChange={e=>setForm(f=>({...f,actif:e.target.checked}))}/>
            <label htmlFor="actif" className="text-[13px] text-ink">Commerçant actif</label>
          </div>
        )}
        {erreur && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenNew(false)}>Annuler</Btn>
          <Btn onClick={sauvegarder} className={saving?"opacity-50":""}>{saving?"…":"Enregistrer"}</Btn>
        </div>
      </Modal>

      {/* ── Modal Fournisseur ─────────────────────────────────────────────── */}
      <Modal open={openNewF} onClose={()=>setOpenNewF(false)} title={editF ? `Modifier — ${editF.nom}` : "Nouveau fournisseur"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom ★"><input className={inputCls} value={fForm.nom} onChange={e=>setFForm(f=>({...f,nom:e.target.value}))} autoFocus/></Field>
          <Field label="Type">
            <select className={inputCls} value={fForm.type} onChange={e=>setFForm(f=>({...f,type:e.target.value}))}>
              {["OPERATEUR","DISTRIBUTEUR","FABRICANT","AUTRE"].map(t=><option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className={inputCls+" num"} value={fForm.telephone} onChange={e=>setFForm(f=>({...f,telephone:e.target.value}))}/></Field>
          <Field label="Email"><input className={inputCls} type="email" value={fForm.email} onChange={e=>setFForm(f=>({...f,email:e.target.value}))}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact (personne)"><input className={inputCls} value={fForm.contact} onChange={e=>setFForm(f=>({...f,contact:e.target.value}))}/></Field>
          <Field label="Adresse"><input className={inputCls} value={fForm.adresse} onChange={e=>setFForm(f=>({...f,adresse:e.target.value}))}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Délai livraison (jours)"><input className={inputCls+" num"} type="number" value={fForm.delai_livraison} onChange={e=>setFForm(f=>({...f,delai_livraison:e.target.value}))}/></Field>
          <Field label="Conditions paiement">
            <select className={inputCls} value={fForm.conditions_paiement} onChange={e=>setFForm(f=>({...f,conditions_paiement:e.target.value}))}>
              {["Avance","À réception","Espèces","30 jours","Virement"].map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className={inputCls} rows={2} value={fForm.notes} onChange={e=>setFForm(f=>({...f,notes:e.target.value}))}/></Field>
        {fErr && <p className="rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{fErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenNewF(false)}>Annuler</Btn>
          <Btn onClick={sauvegarderF} className={fBusy?"opacity-50":""}>{fBusy?"…":"Enregistrer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
