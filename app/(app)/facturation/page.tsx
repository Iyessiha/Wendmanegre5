"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText, CreditCard, Receipt, BarChart2, Plus, RefreshCw,
  CheckCircle, AlertCircle, TrendingUp, TrendingDown, Trash2,
} from "lucide-react";
import FacturationModule from "@/components/FacturationModule";
import { useFactures } from "@/lib/hooks-factures";
import { useCaisses, useClients } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";
import { useRealtimeRefetch } from "@/lib/realtime";

// ── Dépenses ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { v:"loyer",          l:"Loyer",              icon:"🏠" },
  { v:"salaire",        l:"Salaire",            icon:"👤" },
  { v:"fourniture",     l:"Fourniture",         icon:"📦" },
  { v:"transport",      l:"Transport",          icon:"🚗" },
  { v:"communication",  l:"Communication",      icon:"📱" },
  { v:"commission",     l:"Commission agent",   icon:"💰" },
  { v:"impot",          l:"Impôt / taxe",       icon:"📋" },
  { v:"maintenance",    l:"Maintenance",        icon:"🔧" },
  { v:"autre",          l:"Autre",              icon:"📝" },
];
const CAT_BADGE: Record<string,string> = {
  loyer:"bg-blue-100 text-blue-700",salaire:"bg-purple-100 text-purple-700",
  fourniture:"bg-sand-200 text-ink-600",transport:"bg-amber-100 text-amber-700",
  communication:"bg-teal-100 text-teal-700",commission:"bg-leaf-100 text-leaf-600",
  impot:"bg-ember-100 text-ember-600",maintenance:"bg-orange-100 text-orange-700",
  autre:"bg-sand-200 text-ink-500",
};

function useDepenses() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await (getClient() as any).from("depenses")
      .select("*").eq("actif",true).order("date",{ascending:false});
    setData(rows ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["depenses"], refetch, 600);
  return { data, loading, refetch };
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"factures",   label:"Factures clients",  icon:FileText  },
  { id:"reglements", label:"Règlements",         icon:CreditCard},
  { id:"depenses",   label:"Dépenses",           icon:Receipt   },
  { id:"stats",      label:"Statistiques",       icon:BarChart2 },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Page principale ───────────────────────────────────────────────────────────
export default function FacturationPage() {
  const [tab, setTab] = useState<TabId>("factures");
  const { data: factures } = useFactures({ type:"facture" });
  const { data: caisses } = useCaisses();
  const { data: clients } = useClients();
  const { data: depenses, refetch: rfDep } = useDepenses();

  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  // ── Sync Dolibarr ─────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok:boolean; msg:string }|null>(null);

  async function syncDolibarr() {
    setSyncing(true); setSyncMsg(null);
    try {
      const sb = getClient() as any;
      const { data, error } = await sb.functions.invoke("sync-factures", { method:"POST" });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error ?? "Erreur Dolibarr");
      setSyncMsg({ ok:true, msg:`${data.upserted} factures synchronisées (${data.total} traitées)` });
    } catch(e:any){ setSyncMsg({ ok:false, msg:e?.message ?? "Erreur de connexion" }); }
    setSyncing(false);
    setTimeout(()=>setSyncMsg(null),7000);
  }

  // ── Stats factures ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const actives = factures.filter(f => f.statut !== "annulee");
    const impayees = actives.filter(f => Number(f.reste_a_payer??0) > 0);
    const payees   = actives.filter(f => f.statut === "payee");
    const totalCA  = actives.reduce((s,f)=>s+f.montant_total,0);
    const encours  = impayees.reduce((s,f)=>s+Number(f.reste_a_payer??0),0);
    const recouv   = payees.reduce((s,f)=>s+f.montant_total,0);
    const taux     = totalCA > 0 ? (recouv/totalCA)*100 : 0;
    const parMois: Record<string,number> = {};
    actives.forEach(f=>{
      const m = (f.date_facture??f.created_at).slice(0,7);
      parMois[m] = (parMois[m]??0) + f.montant_total;
    });
    return { total:actives.length, impayees:impayees.length, totalCA, encours, taux, parMois };
  }, [factures]);

  const statsDepenses = useMemo(() => {
    const total = depenses.reduce((s,d)=>s+d.montant,0);
    const parCat: Record<string,number> = {};
    depenses.forEach(d=>{ parCat[d.categorie]=(parCat[d.categorie]??0)+d.montant; });
    return { total, parCat };
  }, [depenses]);

  // ── Règlements (factures_paiements) ───────────────────────────────────────
  const [reglements, setReglements] = useState<any[]>([]);
  useEffect(() => {
    (getClient() as any).from("factures_paiements").select("*,facture:factures(id,client_id,clients(nom))")
      .order("date_paiement",{ascending:false}).limit(100)
      .then(({ data }:any) => setReglements(data??[]));
  }, [tab]);

  // ── Dépense : modal ───────────────────────────────────────────────────────
  const [openDep, setOpenDep] = useState(false);
  const [depForm, setDepForm] = useState({ date:new Date().toISOString().slice(0,10), designation:"", categorie:"loyer", montant:"", mode:"Espèces", reference:"", caisse_id:"", notes:"" });
  const [depBusy, setDepBusy] = useState(false);
  const [depErr, setDepErr] = useState<string|null>(null);

  useEffect(() => {
    if (caisses[0] && !depForm.caisse_id) setDepForm(f=>({...f,caisse_id:(caisses[0] as any).id}));
  }, [caisses]);

  async function submitDep() {
    if (!depForm.designation.trim()) { setDepErr("Désignation requise."); return; }
    const m=Number(depForm.montant);
    if (!m||m<=0) { setDepErr("Montant invalide."); return; }
    setDepBusy(true); setDepErr(null);
    const { error } = await (getClient() as any).from("depenses").insert({
      ...depForm, montant:m, user_id:userId||null,
      caisse_id:depForm.caisse_id||null, reference:depForm.reference||null, notes:depForm.notes||null,
    });
    if (error) { setDepErr(error.message); setDepBusy(false); return; }
    setOpenDep(false);
    setDepForm({ date:new Date().toISOString().slice(0,10), designation:"", categorie:"loyer", montant:"", mode:"Espèces", reference:"", caisse_id:(caisses[0] as any)?.id??"", notes:"" });
    rfDep();
    setDepBusy(false);
  }

  async function supprimerDep(id:string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    await (getClient() as any).from("depenses").update({actif:false}).eq("id",id);
    rfDep();
  }

  // ── Render header action ──────────────────────────────────────────────────
  const headerAction = tab === "factures" ? (
    <Btn variant="soft" onClick={syncDolibarr} className={syncing?"opacity-60":""}>
      <RefreshCw size={14} className={syncing?"animate-spin":""}/>
      {syncing ? "Synchronisation…" : "Sync Dolibarr"}
    </Btn>
  ) : tab === "depenses" ? (
    <Btn onClick={()=>{setDepErr(null);setOpenDep(true);}}>
      <Plus size={14}/> Nouvelle dépense
    </Btn>
  ) : null;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Facturation" subtitle={`${stats.total} factures · encours ${formatXOF(stats.encours)}`} action={headerAction}/>

      {/* Message sync */}
      {syncMsg && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium
          ${syncMsg.ok?"bg-leaf-50 border-leaf-200 text-leaf-700":"bg-ember-50 border-ember-200 text-ember-700"}`}>
          {syncMsg.ok?<CheckCircle size={14}/>:<AlertCircle size={14}/>} {syncMsg.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors
              ${tab===t.id?"bg-clay text-sand-50":"bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
            <t.icon size={14}/> {t.label}
          </button>
        ))}
      </div>

      {/* ── FACTURES CLIENTS ──────────────────────────────────────────────── */}
      {tab==="factures" && <FacturationModule docType="facture"/>}

      {/* ── RÈGLEMENTS ───────────────────────────────────────────────────── */}
      {tab==="reglements" && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {l:"CA total facturé",v:formatXOF(stats.totalCA)},
              {l:"Encours impayé",  v:formatXOF(stats.encours),accent:true},
              {l:"Taux recouvrement",v:`${stats.taux.toFixed(1)}%`},
              {l:"Factures impayées",v:String(stats.impayees)},
            ].map(s=>(
              <Card key={s.l} className="p-4">
                <div className="text-[12px] text-ink-400">{s.l}</div>
                <div className={`num mt-1 text-lg font-bold ${s.accent?"text-clay-700":"text-ink"}`}>{s.v}</div>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="border-b border-sand-100 px-4 py-3 font-semibold text-ink">Paiements reçus</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                    {["Date","Facture","Client","Mode","Montant"].map(h=>(
                      <th key={h} className={`px-4 py-3 font-medium ${h==="Montant"?"text-right":"text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reglements.map((r:any)=>(
                    <tr key={r.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                      <td className="px-4 py-3 text-[13px] text-ink-500">{formatDate(r.date_paiement)}</td>
                      <td className="num px-4 py-3 text-[13px] text-ink">{r.facture_id}</td>
                      <td className="px-4 py-3 text-[13px] text-ink">{r.facture?.clients?.nom ?? r.facture?.client_id ?? "—"}</td>
                      <td className="px-4 py-3"><Badge className="bg-sand-200 text-ink-600">{r.mode}</Badge></td>
                      <td className="num px-4 py-3 text-right font-semibold text-leaf-600">{formatXOF(r.montant)}</td>
                    </tr>
                  ))}
                  {reglements.length===0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">Aucun règlement enregistré.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── DÉPENSES ─────────────────────────────────────────────────────── */}
      {tab==="depenses" && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-[12px] text-ink-400">Total dépenses</div>
              <div className="num mt-1 text-xl font-bold text-clay-700">{formatXOF(statsDepenses.total)}</div>
            </Card>
            {Object.entries(statsDepenses.parCat).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([cat,m])=>(
              <Card key={cat} className="p-4">
                <div className="text-[12px] text-ink-400">{CATEGORIES.find(c=>c.v===cat)?.l ?? cat}</div>
                <div className="num mt-1 text-lg font-bold text-ink">{formatXOF(m)}</div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                    {["Date","Désignation","Catégorie","Mode","Montant",""].map(h=>(
                      <th key={h} className={`px-4 py-3 font-medium ${h==="Montant"?"text-right":""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {depenses.map(d=>{
                    const cat = CATEGORIES.find(c=>c.v===d.categorie);
                    return (
                      <tr key={d.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                        <td className="px-4 py-3 text-[13px] text-ink-500">{formatDate(d.date)}</td>
                        <td className="px-4 py-3 text-[13px] font-medium text-ink">{d.designation}</td>
                        <td className="px-4 py-3"><Badge className={CAT_BADGE[d.categorie]??'bg-sand-200 text-ink-500'}>{cat?.icon} {cat?.l??d.categorie}</Badge></td>
                        <td className="px-4 py-3 text-[13px] text-ink-500">{d.mode}</td>
                        <td className="num px-4 py-3 text-right font-semibold text-clay-700">−{formatXOF(d.montant)}</td>
                        <td className="px-4 py-3">
                          <button onClick={()=>supprimerDep(d.id)} className="p-1.5 rounded-lg hover:bg-ember-100 text-ink-400 hover:text-ember-500 tap">
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {depenses.length===0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">Aucune dépense enregistrée.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── STATISTIQUES ─────────────────────────────────────────────────── */}
      {tab==="stats" && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {l:"CA total facturé",    v:formatXOF(stats.totalCA),     icon:<TrendingUp size={16} className="text-leaf-600"/>},
              {l:"Encours impayé",      v:formatXOF(stats.encours),     icon:<TrendingDown size={16} className="text-clay-700"/>},
              {l:"Taux recouvrement",   v:`${stats.taux.toFixed(1)}%`,  icon:<TrendingUp size={16} className="text-leaf-600"/>},
              {l:"Dépenses totales",    v:formatXOF(statsDepenses.total),icon:<TrendingDown size={16} className="text-clay-700"/>},
            ].map(s=>(
              <Card key={s.l} className="p-4">
                <div className="flex items-center gap-2 text-ink-400">{s.icon}<span className="text-[12px]">{s.l}</span></div>
                <div className="num mt-1 text-lg font-bold text-ink">{s.v}</div>
              </Card>
            ))}
          </div>

          {/* CA par mois */}
          <Card className="p-5">
            <h3 className="display mb-4 text-base font-bold text-ink">Chiffre d'affaires par mois</h3>
            <div className="space-y-2">
              {Object.entries(stats.parMois).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6).map(([m,v])=>{
                const max = Math.max(...Object.values(stats.parMois));
                const pct = max > 0 ? (v/max)*100 : 0;
                const [y,mo] = m.split("-");
                const label = `${["","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][Number(mo)]} ${y}`;
                return (
                  <div key={m} className="flex items-center gap-3">
                    <div className="w-16 text-[12px] text-ink-500 shrink-0">{label}</div>
                    <div className="flex-1 rounded-full bg-sand-200 h-2"><div className="h-2 rounded-full bg-clay" style={{width:`${pct}%`}}/></div>
                    <div className="num text-[13px] font-semibold text-ink w-28 text-right">{formatXOF(v)}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Dépenses par catégorie */}
          <Card className="p-5">
            <h3 className="display mb-4 text-base font-bold text-ink">Dépenses par catégorie</h3>
            <div className="space-y-2">
              {Object.entries(statsDepenses.parCat).sort((a,b)=>b[1]-a[1]).map(([cat,v])=>{
                const max = Math.max(...Object.values(statsDepenses.parCat));
                const pct = max > 0 ? (v/max)*100 : 0;
                const cat_ = CATEGORIES.find(c=>c.v===cat);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-28 text-[12px] text-ink-500 shrink-0">{cat_?.icon} {cat_?.l??cat}</div>
                    <div className="flex-1 rounded-full bg-sand-200 h-2"><div className="h-2 rounded-full bg-blue-500" style={{width:`${pct}%`}}/></div>
                    <div className="num text-[13px] font-semibold text-ink w-28 text-right">{formatXOF(v)}</div>
                  </div>
                );
              })}
              {Object.keys(statsDepenses.parCat).length===0 && <p className="text-[13px] text-ink-400">Aucune dépense enregistrée.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal nouvelle dépense ────────────────────────────────────────── */}
      <Modal open={openDep} onClose={()=>setOpenDep(false)} title="Nouvelle dépense">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input className={inputCls} type="date" value={depForm.date} onChange={e=>setDepForm(f=>({...f,date:e.target.value}))}/></Field>
          <Field label="Catégorie">
            <select className={inputCls} value={depForm.categorie} onChange={e=>setDepForm(f=>({...f,categorie:e.target.value}))}>
              {CATEGORIES.map(c=><option key={c.v} value={c.v}>{c.icon} {c.l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Désignation ★"><input className={inputCls} value={depForm.designation} onChange={e=>setDepForm(f=>({...f,designation:e.target.value}))} placeholder="Loyer local Yako…"/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (XOF)"><input className={inputCls+" num"} type="number" value={depForm.montant} onChange={e=>setDepForm(f=>({...f,montant:e.target.value}))}/></Field>
          <Field label="Mode de paiement">
            <select className={inputCls} value={depForm.mode} onChange={e=>setDepForm(f=>({...f,mode:e.target.value}))}>
              {["Espèces","Orange Money","Moov Money","Virement","Chèque"].map(m=><option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caisse">
            <select className={inputCls} value={depForm.caisse_id} onChange={e=>setDepForm(f=>({...f,caisse_id:e.target.value}))}>
              <option value="">— Aucune —</option>
              {caisses.map((c:any)=><option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Référence"><input className={inputCls} value={depForm.reference} onChange={e=>setDepForm(f=>({...f,reference:e.target.value}))}/></Field>
        </div>
        <Field label="Notes"><textarea className={inputCls} rows={2} value={depForm.notes} onChange={e=>setDepForm(f=>({...f,notes:e.target.value}))}/></Field>
        {depErr && <p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600">{depErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenDep(false)}>Annuler</Btn>
          <Btn onClick={submitDep} className={depBusy?"opacity-50":""}>{depBusy?"…":"Enregistrer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
