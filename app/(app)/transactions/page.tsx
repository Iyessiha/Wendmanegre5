"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Send, HandCoins, Wallet, Download,
  Search, CheckCircle, X, User, AlertCircle, Plus,
} from "lucide-react";
import { useTransactions, enregistrerTransaction, resumeJour, TYPES_TRANSACTION, labelType, type TypeTransaction } from "@/lib/hooks-transactions";
import { useOperateurs } from "@/lib/hooks-operateurs";
import { useCaisses, useClientSearch, type ClientLight } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

// ── Types et config ───────────────────────────────────────────────────────────
const TX_ACTIONS = [
  { type: "DEPOT"         as TypeTransaction, label: "Dépôt Mobile Money",   shortLabel:"Dépôt Mobile",  desc: "Client dépose du cash → reçoit de l'eMonnaie",   icon: ArrowDownCircle, color:"text-leaf-600",   bg:"bg-leaf-50",    border:"border-leaf-200",   ring:"ring-leaf-400"   },
  { type: "RETRAIT"       as TypeTransaction, label: "Retrait Mobile Money",  shortLabel:"Retrait Mobile", desc: "Client retire du cash de son compte mobile",      icon: ArrowUpCircle,   color:"text-clay-700",  bg:"bg-clay-50",    border:"border-clay-200",   ring:"ring-clay-400"   },
  { type: "ENVOI"         as TypeTransaction, label: "Envoi d'argent",        shortLabel:"Envoi d'argent",desc: "Transfert vers un autre numéro",                  icon: Send,            color:"text-purple-600",bg:"bg-purple-50",  border:"border-purple-200", ring:"ring-purple-400" },
  { type: "CREDIT"        as TypeTransaction, label: "Octroyer un crédit",    shortLabel:"Octroyer un",   desc: "Avancer des unités ou du cash à crédit",          icon: HandCoins,       color:"text-amber-700", bg:"bg-amber-50",   border:"border-amber-200",  ring:"ring-amber-400"  },
  { type: "REMBOURSEMENT" as TypeTransaction, label: "Remboursement crédit",  shortLabel:"Remboursement crédit", desc: "Encaisser le retour d'un crédit",            icon: Wallet,          color:"text-teal-600",  bg:"bg-teal-50",    border:"border-teal-200",   ring:"ring-teal-400"   },
  { type: "RECEPTION"     as TypeTransaction, label: "Réception transfert",   shortLabel:"Réception transfert",  desc: "Client reçoit un transfert entrant",         icon: Download,        color:"text-blue-600",  bg:"bg-blue-50",    border:"border-blue-200",   ring:"ring-blue-400"   },
] as const;

const TYPE_BADGE: Record<string,string> = {
  DEPOT:"bg-leaf-100 text-leaf-600", RETRAIT:"bg-clay/15 text-clay-700",
  ENVOI:"bg-purple-100 text-purple-600", RECEPTION:"bg-blue-100 text-blue-600",
  CREDIT:"bg-amber-100 text-amber-700", REMBOURSEMENT:"bg-teal-100 text-teal-600",
};

// ── Composant recherche client (réutilisable dans chaque formulaire) ───────────
function ClientSearch({ label="Client / Commerçant", placeholder="Nom ou téléphone…", value, onSelect, onClear }:
  { label?:string; placeholder?:string; value:ClientLight|null; onSelect:(c:ClientLight)=>void; onClear:()=>void }) {
  const [q, setQ] = useState(value?.nom ?? "");
  const [show, setShow] = useState(false);
  const { results } = useClientSearch(q);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setShow(false)};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);
  useEffect(()=>{ setQ(value?.nom ?? ""); },[value]);
  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-[12px] font-medium text-ink-500">{label}</label>
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${value?"border-leaf-300 bg-leaf-50":"border-sand-200 bg-white/70"}`}>
        <User size={14} className={value?"text-leaf-500":"text-ink-400"}/>
        <input value={q} onChange={e=>{setQ(e.target.value);setShow(true);if(!e.target.value)onClear();}}
          onFocus={()=>setShow(true)} placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-400"/>
        {value && <button onClick={()=>{setQ("");onClear();}} className="text-ink-300 hover:text-ember-400"><X size={13}/></button>}
        {value && <CheckCircle size={13} className="text-leaf-500 shrink-0"/>}
      </div>
      {show && results.length>0 && (
        <div className="absolute z-50 w-full rounded-xl border border-clay bg-white shadow-lg mt-0.5 overflow-hidden">
          {results.map(c=>(
            <button key={c.id} onMouseDown={()=>{onSelect(c);setShow(false);}}
              className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-sand-50 border-b border-sand-50 last:border-0">
              <div>
                <div className="text-[13px] font-semibold text-ink">{c.nom}</div>
                <div className="text-[11px] text-ink-400">{c.ville ?? "—"}</div>
              </div>
              <span className="num text-[12px] text-ink-500">{c.telephone ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Formulaires distincts par type ────────────────────────────────────────────
function FormDepot({ operateurs, caisses, userId, onSuccess }:any) {
  const [client,setClient] = useState<ClientLight|null>(null);
  const [f,setF] = useState({ operateur:"",telephone:"",montant:"",frais:"",caisse_id:"",reference:"" });
  const [busy,setBusy]=useState(false); const [err,setErr]=useState<string|null>(null);
  // Caisse par défaut
  useEffect(()=>{ const d=caisses.find((c:any)=>c.assignee_id===userId)??caisses[0]; if(d)setF(x=>({...x,caisse_id:x.caisse_id||d.id})); },[caisses,userId]);
  // Commission auto
  useEffect(()=>{ const op=operateurs.find((o:any)=>o.id===f.operateur); if(op&&f.montant) setF(x=>({...x,frais:String(Math.round(Number(x.montant)*(op.commission_taux||0)/100))})); },[f.operateur,f.montant]);
  const onSelectClient=(c:ClientLight)=>{ setClient(c); setF(x=>({...x,telephone:c.telephone??x.telephone})); };
  async function submit(){
    if(!Number(f.montant)||Number(f.montant)<=0){setErr("Montant invalide.");return;}
    if(!f.caisse_id){setErr("Caisse requise.");return;}
    setBusy(true);setErr(null);
    try{
      await enregistrerTransaction({ type:"DEPOT",operateur:f.operateur||undefined,montant:Number(f.montant),frais:Number(f.frais)||0,telephone_client:f.telephone||client?.telephone||undefined,nom_client:client?.nom||undefined,reference:f.reference||undefined,caisse_id:f.caisse_id,user_id:userId,client_id:client?.id||undefined });
      onSuccess("Dépôt enregistré ✓"); setF(x=>({...x,montant:"",frais:"",reference:"",telephone:""})); setClient(null);
    }catch(e:any){setErr(e?.message??"Erreur.");}
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <ClientSearch value={client} onSelect={onSelectClient} onClear={()=>setClient(null)} label="Commerçant / Client déposant"/>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Opérateur Mobile Money">
          <select className={inputCls} value={f.operateur} onChange={e=>setF(x=>({...x,operateur:e.target.value}))}>
            <option value="">— Choisir —</option>
            {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </Field>
        <Field label="N° Mobile Money client">
          <input className={inputCls+" num"} value={f.telephone} placeholder="226XXXXXXXX" onChange={e=>setF(x=>({...x,telephone:e.target.value}))}/>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Montant déposé (XOF)"><input className={inputCls+" num"} type="number" value={f.montant} placeholder="0" onChange={e=>setF(x=>({...x,montant:e.target.value}))}/></Field>
        <Field label="Commission dealer (XOF)"><input className={inputCls+" num"} type="number" value={f.frais} placeholder="auto" onChange={e=>setF(x=>({...x,frais:e.target.value}))}/></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Caisse">
          <select className={inputCls} value={f.caisse_id} onChange={e=>setF(x=>({...x,caisse_id:e.target.value}))}>
            <option value="">— Choisir —</option>
            {caisses.map((c:any)=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Référence / Code OTP"><input className={inputCls} value={f.reference} onChange={e=>setF(x=>({...x,reference:e.target.value}))}/></Field>
      </div>
      {err&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{err}</p>}
      <Btn className="w-full" onClick={submit} disabled={busy}>{busy?"Enregistrement…":"✓ Confirmer le dépôt"}</Btn>
    </div>
  );
}

function FormRetrait({ operateurs, caisses, userId, onSuccess }:any) {
  const [client,setClient]=useState<ClientLight|null>(null);
  const [f,setF]=useState({ operateur:"",telephone:"",montant:"",frais:"",caisse_id:"",reference:"" });
  const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ const d=caisses.find((c:any)=>c.assignee_id===userId)??caisses[0]; if(d)setF(x=>({...x,caisse_id:x.caisse_id||d.id})); },[caisses,userId]);
  useEffect(()=>{ const op=operateurs.find((o:any)=>o.id===f.operateur); if(op&&f.montant) setF(x=>({...x,frais:String(Math.round(Number(x.montant)*(op.commission_taux||0)/100))})); },[f.operateur,f.montant]);
  const onSel=(c:ClientLight)=>{setClient(c);setF(x=>({...x,telephone:c.telephone??x.telephone}));};
  async function submit(){
    if(!Number(f.montant)||Number(f.montant)<=0){setErr("Montant invalide.");return;}
    setBusy(true);setErr(null);
    try{
      await enregistrerTransaction({ type:"RETRAIT",operateur:f.operateur||undefined,montant:Number(f.montant),frais:Number(f.frais)||0,telephone_client:f.telephone||undefined,nom_client:client?.nom||undefined,reference:f.reference||undefined,caisse_id:f.caisse_id||undefined,user_id:userId,client_id:client?.id||undefined });
      onSuccess("Retrait enregistré ✓"); setF(x=>({...x,montant:"",frais:"",reference:"",telephone:""})); setClient(null);
    }catch(e:any){setErr(e?.message??"Erreur.");}
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <ClientSearch value={client} onSelect={onSel} onClear={()=>setClient(null)} label="Client effectuant le retrait"/>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Opérateur">
          <select className={inputCls} value={f.operateur} onChange={e=>setF(x=>({...x,operateur:e.target.value}))}>
            <option value="">— Choisir —</option>
            {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </Field>
        <Field label="N° Mobile Money"><input className={inputCls+" num"} value={f.telephone} placeholder="226XXXXXXXX" onChange={e=>setF(x=>({...x,telephone:e.target.value}))}/></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Montant retiré (XOF)"><input className={inputCls+" num"} type="number" value={f.montant} placeholder="0" onChange={e=>setF(x=>({...x,montant:e.target.value}))}/></Field>
        <Field label="Frais retrait (XOF)"><input className={inputCls+" num"} type="number" value={f.frais} placeholder="auto" onChange={e=>setF(x=>({...x,frais:e.target.value}))}/></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Caisse">
          <select className={inputCls} value={f.caisse_id} onChange={e=>setF(x=>({...x,caisse_id:e.target.value}))}>
            <option value="">— Choisir —</option>
            {caisses.map((c:any)=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Code confirmation / Référence"><input className={inputCls} value={f.reference} onChange={e=>setF(x=>({...x,reference:e.target.value}))}/></Field>
      </div>
      {err&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{err}</p>}
      <Btn className="w-full" onClick={submit} disabled={busy}>{busy?"…":"✓ Confirmer le retrait"}</Btn>
    </div>
  );
}

function FormEnvoi({ operateurs, caisses, userId, onSuccess }:any) {
  const [expediteur,setExpediteur]=useState<ClientLight|null>(null);
  const [f,setF]=useState({ operateur_src:"",operateur_dest:"",nom_dest:"",tel_dest:"",montant:"",frais:"",caisse_id:"",reference:"" });
  const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ const d=caisses.find((c:any)=>c.assignee_id===userId)??caisses[0]; if(d)setF(x=>({...x,caisse_id:x.caisse_id||d.id})); },[caisses,userId]);
  useEffect(()=>{ const op=operateurs.find((o:any)=>o.id===f.operateur_src); if(op&&f.montant) setF(x=>({...x,frais:String(Math.round(Number(x.montant)*(op.commission_taux||0)/100))})); },[f.operateur_src,f.montant]);
  async function submit(){
    if(!Number(f.montant)||Number(f.montant)<=0){setErr("Montant invalide.");return;}
    if(!f.nom_dest&&!f.tel_dest){setErr("Destinataire requis (nom ou téléphone).");return;}
    setBusy(true);setErr(null);
    try{
      await enregistrerTransaction({ type:"ENVOI",operateur:f.operateur_src||undefined,operateur_dest:f.operateur_dest||undefined,montant:Number(f.montant),frais:Number(f.frais)||0,nom_client:expediteur?.nom||undefined,telephone_client:expediteur?.telephone||undefined,nom_dest:f.nom_dest||undefined,telephone_dest:f.tel_dest||undefined,reference:f.reference||undefined,caisse_id:f.caisse_id||undefined,user_id:userId,client_id:expediteur?.id||undefined });
      onSuccess("Envoi enregistré ✓"); setF(x=>({...x,montant:"",frais:"",reference:"",nom_dest:"",tel_dest:""})); setExpediteur(null);
    }catch(e:any){setErr(e?.message??"Erreur.");}
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <ClientSearch value={expediteur} onSelect={c=>{setExpediteur(c);}} onClear={()=>setExpediteur(null)} label="Expéditeur (optionnel)"/>
      <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide">Destinataire</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nom destinataire"><input className={inputCls} value={f.nom_dest} onChange={e=>setF(x=>({...x,nom_dest:e.target.value}))} placeholder="Nom complet"/></Field>
          <Field label="N° téléphone destinataire"><input className={inputCls+" num"} value={f.tel_dest} onChange={e=>setF(x=>({...x,tel_dest:e.target.value}))} placeholder="226XXXXXXXX"/></Field>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Opérateur source">
          <select className={inputCls} value={f.operateur_src} onChange={e=>setF(x=>({...x,operateur_src:e.target.value}))}>
            <option value="">— Choisir —</option>
            {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </Field>
        <Field label="Opérateur destination">
          <select className={inputCls} value={f.operateur_dest} onChange={e=>setF(x=>({...x,operateur_dest:e.target.value}))}>
            <option value="">— Même opérateur —</option>
            {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Montant (XOF)"><input className={inputCls+" num"} type="number" value={f.montant} onChange={e=>setF(x=>({...x,montant:e.target.value}))} placeholder="0"/></Field>
        <Field label="Frais envoi (XOF)"><input className={inputCls+" num"} type="number" value={f.frais} onChange={e=>setF(x=>({...x,frais:e.target.value}))} placeholder="auto"/></Field>
        <Field label="Référence"><input className={inputCls} value={f.reference} onChange={e=>setF(x=>({...x,reference:e.target.value}))}/></Field>
      </div>
      {err&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{err}</p>}
      <Btn className="w-full" onClick={submit} disabled={busy}>{busy?"…":"✓ Confirmer l'envoi"}</Btn>
    </div>
  );
}

function FormCredit({ operateurs, caisses, userId, onSuccess }:any) {
  const [client,setClient]=useState<ClientLight|null>(null);
  const [f,setF]=useState({ operateur:"",type_credit:"unites_om",montant:"",frais:"",echeance:"",caisse_id:"",notes:"" });
  const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
  const echeanceDefaut = new Date(Date.now()+15*86400000).toISOString().slice(0,10);
  useEffect(()=>{ setF(x=>({...x,echeance:echeanceDefaut})); },[]);
  useEffect(()=>{ const d=caisses.find((c:any)=>c.assignee_id===userId)??caisses[0]; if(d)setF(x=>({...x,caisse_id:x.caisse_id||d.id})); },[caisses,userId]);
  async function submit(){
    if(!client){setErr("Sélectionnez un commerçant.");return;}
    if(!Number(f.montant)||Number(f.montant)<=0){setErr("Montant invalide.");return;}
    setBusy(true);setErr(null);
    try{
      await enregistrerTransaction({ type:"CREDIT",operateur:f.operateur||undefined,montant:Number(f.montant),frais:Number(f.frais)||0,nom_client:client.nom,telephone_client:client.telephone||undefined,reference:f.notes||undefined,caisse_id:f.caisse_id||undefined,user_id:userId,client_id:client.id,type_credit:f.type_credit,echeance:f.echeance||undefined });
      onSuccess("Crédit enregistré ✓"); setF(x=>({...x,montant:"",frais:"",notes:""})); setClient(null);
    }catch(e:any){setErr(e?.message??"Erreur.");}
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <ClientSearch value={client} onSelect={c=>setClient(c)} onClear={()=>setClient(null)} label="Commerçant bénéficiaire (obligatoire)"/>
      {client&&<div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[12px]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 font-bold text-amber-700">{client.nom.charAt(0)}</div>
        <div><div className="font-semibold text-ink">{client.nom}</div><div className="text-ink-500">{client.telephone} · {client.ville}</div></div>
        {client.plafond&&<div className="ml-auto text-right"><div className="text-[10px] text-ink-400">Plafond</div><div className="num font-bold text-amber-700">{formatXOF(client.plafond)}</div></div>}
      </div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Type de crédit">
          <select className={inputCls} value={f.type_credit} onChange={e=>setF(x=>({...x,type_credit:e.target.value}))}>
            <option value="unites_om">Unités Orange Money</option>
            <option value="cash">Avance cash</option>
            <option value="credit_tel">Crédit téléphonique</option>
            <option value="marchandises">Marchandises</option>
          </select>
        </Field>
        <Field label="Opérateur">
          <select className={inputCls} value={f.operateur} onChange={e=>setF(x=>({...x,operateur:e.target.value}))}>
            <option value="">— Aucun —</option>
            {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Montant / Unités (XOF)"><input className={inputCls+" num"} type="number" value={f.montant} onChange={e=>setF(x=>({...x,montant:e.target.value}))} placeholder="0"/></Field>
        <Field label="Commission (XOF)"><input className={inputCls+" num"} type="number" value={f.frais} onChange={e=>setF(x=>({...x,frais:e.target.value}))} placeholder="0"/></Field>
        <Field label="Date d'échéance"><input className={inputCls} type="date" value={f.echeance} onChange={e=>setF(x=>({...x,echeance:e.target.value}))}/></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Caisse">
          <select className={inputCls} value={f.caisse_id} onChange={e=>setF(x=>({...x,caisse_id:e.target.value}))}>
            <option value="">— Choisir —</option>
            {caisses.map((c:any)=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Notes / Objet du crédit"><input className={inputCls} value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))}/></Field>
      </div>
      {err&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{err}</p>}
      <Btn className="w-full" onClick={submit} disabled={busy}>{busy?"…":"✓ Octroyer le crédit"}</Btn>
    </div>
  );
}

function FormRemboursement({ operateurs, caisses, userId, onSuccess }:any) {
  const [client,setClient]=useState<ClientLight|null>(null);
  const [f,setF]=useState({ mode:"cash",operateur:"",montant:"",caisse_id:"",reference:"",notes:"" });
  const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ const d=caisses.find((c:any)=>c.assignee_id===userId)??caisses[0]; if(d)setF(x=>({...x,caisse_id:x.caisse_id||d.id})); },[caisses,userId]);
  async function submit(){
    if(!client){setErr("Sélectionnez le commerçant qui rembourse.");return;}
    if(!Number(f.montant)||Number(f.montant)<=0){setErr("Montant invalide.");return;}
    setBusy(true);setErr(null);
    try{
      await enregistrerTransaction({ type:"REMBOURSEMENT",operateur:f.mode==="mobile"?f.operateur||undefined:undefined,montant:Number(f.montant),frais:0,nom_client:client.nom,telephone_client:client.telephone||undefined,reference:f.reference||undefined,caisse_id:f.caisse_id||undefined,user_id:userId,client_id:client.id,mode_paiement:f.mode });
      onSuccess("Remboursement enregistré ✓"); setF(x=>({...x,montant:"",reference:"",notes:""})); setClient(null);
    }catch(e:any){setErr(e?.message??"Erreur.");}
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <ClientSearch value={client} onSelect={c=>setClient(c)} onClear={()=>setClient(null)} label="Commerçant qui rembourse (obligatoire)"/>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Mode de remboursement">
          <select className={inputCls} value={f.mode} onChange={e=>setF(x=>({...x,mode:e.target.value}))}>
            <option value="cash">Espèces (cash)</option>
            <option value="mobile">Mobile Money</option>
            <option value="virement">Virement bancaire</option>
          </select>
        </Field>
        {f.mode==="mobile"&&(
          <Field label="Opérateur">
            <select className={inputCls} value={f.operateur} onChange={e=>setF(x=>({...x,operateur:e.target.value}))}>
              <option value="">— Choisir —</option>
              {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Montant remboursé (XOF)"><input className={inputCls+" num"} type="number" value={f.montant} onChange={e=>setF(x=>({...x,montant:e.target.value}))} placeholder="0"/></Field>
        <Field label="Référence crédit"><input className={inputCls} value={f.reference} onChange={e=>setF(x=>({...x,reference:e.target.value}))} placeholder="Optionnel"/></Field>
        <Field label="Caisse">
          <select className={inputCls} value={f.caisse_id} onChange={e=>setF(x=>({...x,caisse_id:e.target.value}))}>
            <option value="">— Choisir —</option>
            {caisses.map((c:any)=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
      </div>
      {err&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{err}</p>}
      <Btn className="w-full" onClick={submit} disabled={busy}>{busy?"…":"✓ Enregistrer le remboursement"}</Btn>
    </div>
  );
}

function FormReception({ operateurs, caisses, userId, onSuccess }:any) {
  const [beneficiaire,setBeneficiaire]=useState<ClientLight|null>(null);
  const [f,setF]=useState({ operateur:"",expediteur_nom:"",expediteur_tel:"",montant:"",frais:"",reference:"",caisse_id:"" });
  const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ const d=caisses.find((c:any)=>c.assignee_id===userId)??caisses[0]; if(d)setF(x=>({...x,caisse_id:x.caisse_id||d.id})); },[caisses,userId]);
  useEffect(()=>{ const op=operateurs.find((o:any)=>o.id===f.operateur); if(op&&f.montant) setF(x=>({...x,frais:String(Math.round(Number(x.montant)*(op.commission_taux||0)/100))})); },[f.operateur,f.montant]);
  async function submit(){
    if(!Number(f.montant)||Number(f.montant)<=0){setErr("Montant invalide.");return;}
    if(!f.operateur){setErr("Opérateur requis.");return;}
    setBusy(true);setErr(null);
    try{
      await enregistrerTransaction({ type:"RECEPTION",operateur:f.operateur,montant:Number(f.montant),frais:Number(f.frais)||0,nom_client:beneficiaire?.nom||undefined,telephone_client:beneficiaire?.telephone||undefined,reference:f.reference||undefined,caisse_id:f.caisse_id||undefined,user_id:userId,client_id:beneficiaire?.id||undefined,expediteur_nom:f.expediteur_nom||undefined,expediteur_tel:f.expediteur_tel||undefined });
      onSuccess("Réception enregistrée ✓"); setF(x=>({...x,montant:"",frais:"",reference:"",expediteur_nom:"",expediteur_tel:""})); setBeneficiaire(null);
    }catch(e:any){setErr(e?.message??"Erreur.");}
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <ClientSearch value={beneficiaire} onSelect={c=>setBeneficiaire(c)} onClear={()=>setBeneficiaire(null)} label="Bénéficiaire (client recevant)"/>
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Expéditeur du transfert</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nom expéditeur"><input className={inputCls} value={f.expediteur_nom} onChange={e=>setF(x=>({...x,expediteur_nom:e.target.value}))} placeholder="Nom complet"/></Field>
          <Field label="N° téléphone expéditeur"><input className={inputCls+" num"} value={f.expediteur_tel} onChange={e=>setF(x=>({...x,expediteur_tel:e.target.value}))} placeholder="226XXXXXXXX"/></Field>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Opérateur (obligatoire)">
          <select className={inputCls} value={f.operateur} onChange={e=>setF(x=>({...x,operateur:e.target.value}))}>
            <option value="">— Choisir —</option>
            {operateurs.filter((o:any)=>o.actif).map((o:any)=><option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </Field>
        <Field label="Référence du transfert"><input className={inputCls} value={f.reference} onChange={e=>setF(x=>({...x,reference:e.target.value}))} placeholder="Obligatoire"/></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Montant reçu (XOF)"><input className={inputCls+" num"} type="number" value={f.montant} onChange={e=>setF(x=>({...x,montant:e.target.value}))} placeholder="0"/></Field>
        <Field label="Commission (XOF)"><input className={inputCls+" num"} type="number" value={f.frais} onChange={e=>setF(x=>({...x,frais:e.target.value}))} placeholder="auto"/></Field>
        <Field label="Caisse">
          <select className={inputCls} value={f.caisse_id} onChange={e=>setF(x=>({...x,caisse_id:e.target.value}))}>
            <option value="">— Choisir —</option>
            {caisses.map((c:any)=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
      </div>
      {err&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{err}</p>}
      <Btn className="w-full" onClick={submit} disabled={busy}>{busy?"…":"✓ Confirmer la réception"}</Btn>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [typeFiltre, setTypeFiltre] = useState("tous");
  const [operateurFiltre, setOperateurFiltre] = useState("tous");
  const { data: transactions, refetch } = useTransactions({ type:typeFiltre, operateur:operateurFiltre });
  const { data: operateurs } = useOperateurs();
  const { data: caisses } = useCaisses();
  const [q, setQ] = useState("");

  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d=getDemoSession(); if(d)setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if(data.user)setUserId(data.user.id); });
  }, []);

  const resume = useMemo(() => resumeJour(transactions), [transactions]);
  const opNom = (code:string|null) => operateurs.find(o=>o.id===code)?.nom??code??"—";
  const caisseNom = (id:string|null) => caisses.find((c:any)=>c.id===id)?.nom??"—";
  const rows = useMemo(() => transactions.filter(t =>
    (t.nom_client??"").toLowerCase().includes(q.toLowerCase())||
    (t.telephone_client??"").includes(q)||
    (t.reference??"").toLowerCase().includes(q.toLowerCase())
  ), [transactions, q]);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [selType, setSelType] = useState<TypeTransaction|null>(null);
  const [successMsg, setSuccessMsg] = useState<string|null>(null);

  function handleSuccess(msg:string){
    setSuccessMsg(msg); refetch();
    setTimeout(()=>setSuccessMsg(null),4000);
  }
  function openType(t:TypeTransaction){ setSelType(t); setSuccessMsg(null); }

  const formProps = { operateurs, caisses, userId, onSuccess:handleSuccess };
  const action = TX_ACTIONS.find(a=>a.type===selType);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Transactions" subtitle="Dépôts, retraits, transferts et crédits"/>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { l:"Transactions aujourd'hui", v:String(resume.nombre) },
          { l:"Volume du jour", v:formatXOF(resume.volume) },
          { l:"Commissions du jour", v:formatXOF(resume.commissions), accent:true },
        ].map((s,i)=>(
          <Card key={i} className="p-4">
            <div className="text-[12px] text-ink-400">{s.l}</div>
            <div className={`num mt-1 text-lg font-bold ${s.accent?"text-leaf-600":"text-ink"}`}>{s.v}</div>
          </Card>
        ))}
      </div>

      {/* 6 boutons action */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-3">
        {TX_ACTIONS.map(a=>{
          const Icon=a.icon;
          return(
            <button key={a.type} onClick={()=>openType(a.type)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left tap hover:shadow-md ${a.bg} ${a.border}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ${a.color}`}><Icon size={22}/></div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold leading-tight ${a.color}`}>{a.label}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-ink-500 line-clamp-2">{a.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Flash succès global */}
      {successMsg&&(
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-leaf-50 border border-leaf-200 px-4 py-3 text-[13px] font-medium text-leaf-700">
          <CheckCircle size={15}/>{successMsg}
        </div>
      )}

      {/* Filtres */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5">
          <Search size={15} className="text-ink-400"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Client, téléphone, référence…" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"/>
        </div>
        <select className={inputCls+" w-auto"} value={typeFiltre} onChange={e=>setTypeFiltre(e.target.value)}>
          <option value="tous">Tous les types</option>
          {TYPES_TRANSACTION.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select className={inputCls+" w-auto"} value={operateurFiltre} onChange={e=>setOperateurFiltre(e.target.value)}>
          <option value="tous">Tous opérateurs</option>
          {operateurs.map(o=><option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Opérateur</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Caisse</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t=>(
                <tr key={t.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                  <td className="px-4 py-3 text-ink-500 text-[13px]">{formatDate(t.date_transaction??t.created_at)}</td>
                  <td className="px-4 py-3"><Badge className={TYPE_BADGE[t.type]??"bg-sand-200 text-ink-600"}>{labelType(t.type)}</Badge></td>
                  <td className="px-4 py-3 text-ink-700 text-[13px]">{opNom(t.operateur)}</td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-ink">{t.nom_client??"—"}</div>
                    {t.telephone_client&&<div className="num text-[11px] text-ink-400">{t.telephone_client}</div>}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold text-ink">{formatXOF(t.montant)}</td>
                  <td className="num px-4 py-3 text-right text-leaf-600">{t.frais?formatXOF(t.frais):"—"}</td>
                  <td className="px-4 py-3 text-ink-500 text-[13px]">{caisseNom(t.caisse_id)}</td>
                </tr>
              ))}
              {rows.length===0&&<tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">Aucune transaction. Utilisez les boutons ci-dessus.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal avec formulaire distinct par type */}
      <Modal open={!!selType} onClose={()=>setSelType(null)}
        title={
          <div className="flex items-center gap-3">
            {action&&<div className={`flex h-9 w-9 items-center justify-center rounded-xl ${action.bg} ${action.color}`}>{<action.icon size={18}/>}</div>}
            <span>{action?.label}</span>
          </div>
        }>

        {/* Sélecteur de type en haut du modal */}
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {TX_ACTIONS.map(a=>{
            const Icon=a.icon;const sel=selType===a.type;
            return(
              <button key={a.type} onClick={()=>setSelType(a.type)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition-all
                  ${sel?`${a.bg} ${a.border} ${a.color} ring-2 ${a.ring} ring-opacity-30`:"border-sand-200 text-ink-400 hover:bg-sand-50"}`}>
                <Icon size={15} className={sel?a.color:"text-ink-400"}/>
                <span className="text-center leading-tight">{a.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Formulaire spécifique */}
        {selType==="DEPOT"         && <FormDepot         {...formProps}/>}
        {selType==="RETRAIT"       && <FormRetrait        {...formProps}/>}
        {selType==="ENVOI"         && <FormEnvoi          {...formProps}/>}
        {selType==="CREDIT"        && <FormCredit         {...formProps}/>}
        {selType==="REMBOURSEMENT" && <FormRemboursement  {...formProps}/>}
        {selType==="RECEPTION"     && <FormReception      {...formProps}/>}
      </Modal>
    </div>
  );
}
