"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus, ArrowLeftRight, Edit2, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, Building2, Smartphone, Banknote, Shield, CheckCircle, AlertCircle,
} from "lucide-react";
import {
  useComptesUnifies, useHistoriqueCompte, resumeTresorerie,
  creerCaisseUnifiee, creerCompteBancaire,
  modifierCaisse, modifierCompteBancaire,
  alimenterCompte, retirerCompte, virerEntreComptes,
  TYPE_LABEL, TYPE_BADGE, SOURCE_BADGE,
  type CompteUnifie, type TypeCompte,
} from "@/lib/hooks-tresorerie";
import { syncComptesBancaires } from "@/lib/hooks-comptes";
import { useProfiles } from "@/lib/hooks2";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

const FILTRES = ["tous", "caisse_especes", "banque", "mobile_money"] as const;
const FILTRE_LABEL: Record<string, string> = {
  tous:"Tous", caisse_especes:"Espèces", banque:"Banques", mobile_money:"Mobile Money",
};
const TYPES_DOL: TypeCompte[] = ["banque","caisse_especes","mobile_money","autre"];

export default function TresoreriePage() {
  const { data: comptes, loading, refetch } = useComptesUnifies();
  const { data: profiles } = useProfiles();
  const [filtre, setFiltre] = useState("tous");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const resume = useMemo(() => resumeTresorerie(comptes), [comptes]);
  const actifs = useMemo(() => comptes.filter(c => c.actif), [comptes]);
  const rows = useMemo(() => comptes.filter(c => {
    if (q && !c.nom.toLowerCase().includes(q.toLowerCase()) && !(c.banque||"").toLowerCase().includes(q.toLowerCase())) return false;
    if (filtre !== "tous" && c.type !== filtre) return false;
    return true;
  }), [comptes, filtre, q]);

  // Sync Dolibarr
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok:boolean; msg:string }|null>(null);
  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      const { upserted, total } = await syncComptesBancaires();
      setSyncMsg({ ok:true, msg:`${upserted} soldes mis à jour (${total} comptes Dolibarr)` });
      await refetch();
    } catch(e:any){ setSyncMsg({ ok:false, msg:e?.message??"Erreur Dolibarr" }); }
    setSyncing(false); setTimeout(()=>setSyncMsg(null),5000);
  }

  // Virement
  const [openVir, setOpenVir] = useState(false);
  const [virF, setVirF] = useState({ from:"", to:"", montant:"", libelle:"Virement interne" });
  const [virBusy, setVirBusy] = useState(false);
  const [virErr, setVirErr] = useState<string|null>(null);
  async function submitVir() {
    const m=Number(virF.montant);
    if(!virF.from||!virF.to){ setVirErr("Sélectionnez les deux comptes."); return; }
    if(virF.from===virF.to){ setVirErr("Source et destination identiques."); return; }
    if(!m||m<=0){ setVirErr("Montant invalide."); return; }
    setVirBusy(true); setVirErr(null);
    try { await virerEntreComptes(virF.from,virF.to,m,virF.libelle||"Virement interne",userId); setOpenVir(false); refetch(); }
    catch(e:any){ setVirErr(e?.message??"Erreur."); }
    setVirBusy(false);
  }

  // Alimentation / Retrait
  const [openMvt, setOpenMvt] = useState<{compte:CompteUnifie;mode:"appro"|"retrait"}|null>(null);
  const [mvtF, setMvtF] = useState({ montant:"", libelle:"" });
  const [mvtBusy, setMvtBusy] = useState(false);
  const [mvtErr, setMvtErr] = useState<string|null>(null);
  async function submitMvt() {
    if(!openMvt) return;
    const m=Number(mvtF.montant);
    if(!m||m<=0){ setMvtErr("Montant invalide."); return; }
    setMvtBusy(true); setMvtErr(null);
    try {
      if(openMvt.mode==="appro") await alimenterCompte(openMvt.compte.uid,m,mvtF.libelle||"Approvisionnement",userId);
      else await retirerCompte(openMvt.compte.uid,m,mvtF.libelle||"Retrait",userId);
      setOpenMvt(null); refetch();
    } catch(e:any){ setMvtErr(e?.message??"Erreur."); }
    setMvtBusy(false);
  }

  // Modification
  const [openEdit, setOpenEdit] = useState<CompteUnifie|null>(null);
  const [eF, setEF] = useState({ nom:"", agence:"", assignee_id:"", banque:"", numero_compte:"", iban:"", titulaire:"", type:"banque" as TypeCompte, actif:true });
  const [eBusy, setEBusy] = useState(false); const [eErr, setEErr] = useState<string|null>(null);
  function openEditM(c:CompteUnifie){ setEErr(null); setEF({ nom:c.nom, agence:c.agence??"", assignee_id:c.assignee_id??"", banque:c.banque??"", numero_compte:c.numero_compte??"", iban:c.iban??"", titulaire:c.titulaire??"", type:c.type, actif:c.actif }); setOpenEdit(c); }
  async function submitEdit() {
    if(!openEdit||!eF.nom.trim()){ setEErr("Nom requis."); return; }
    setEBusy(true); setEErr(null);
    try {
      if(openEdit.source==="caisse") await modifierCaisse(openEdit.compte_id,{ nom:eF.nom.trim(), agence:eF.agence||undefined, assignee_id:eF.assignee_id||null, actif:eF.actif });
      else await modifierCompteBancaire(openEdit.compte_id,{ nom:eF.nom.trim(), type:eF.type, banque:eF.banque||null, numero_compte:eF.numero_compte||null, iban:eF.iban||null, titulaire:eF.titulaire||null, actif:eF.actif });
      setOpenEdit(null); refetch();
    } catch(e:any){ setEErr(e?.message??"Erreur."); }
    setEBusy(false);
  }

  // Création
  const [openNew, setOpenNew] = useState(false);
  const [newType, setNewType] = useState<"caisse"|"dolibarr">("caisse");
  const [nF, setNF] = useState({ nom:"", agence:"Yako Centre", assignee_id:"", type:"banque" as TypeCompte, banque:"", numero_compte:"", iban:"", titulaire:"", solde_initial:"" });
  const [nBusy, setNBusy] = useState(false); const [nErr, setNErr] = useState<string|null>(null);
  async function submitNew() {
    if(!nF.nom.trim()){ setNErr("Nom requis."); return; }
    setNBusy(true); setNErr(null);
    try {
      if(newType==="caisse") await creerCaisseUnifiee({ nom:nF.nom.trim(), agence:nF.agence, assignee_id:nF.assignee_id||undefined });
      else await creerCompteBancaire({ nom:nF.nom.trim(), type:nF.type, banque:nF.banque||undefined, numero_compte:nF.numero_compte||undefined, iban:nF.iban||undefined, titulaire:nF.titulaire||undefined, solde_dolibarr:Number(nF.solde_initial)||0 });
      setOpenNew(false); refetch();
    } catch(e:any){ setNErr(e?.message??"Erreur."); }
    setNBusy(false);
  }

  // Historique inline
  const [detailUid, setDetailUid] = useState<string|null>(null);
  const { data: historique } = useHistoriqueCompte(detailUid??"");

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Trésorerie"
        subtitle={`${actifs.length} comptes actifs · ${formatXOF(resume.totalGlobal)} position totale`}
        action={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={handleSync} className={syncing?"opacity-50":""}>
              <RefreshCw size={14} className={syncing?"animate-spin":""} />
              {syncing?"Sync…":"Actualiser"}
            </Btn>
            <Btn variant="soft" onClick={()=>{ setVirErr(null); setVirF({from:"",to:"",montant:"",libelle:"Virement interne"}); setOpenVir(true); }}>
              <ArrowLeftRight size={14} /> Virement
            </Btn>
            <Btn onClick={()=>{ setNErr(null); setNF({nom:"",agence:"Yako Centre",assignee_id:"",type:"banque",banque:"",numero_compte:"",iban:"",titulaire:"",solde_initial:""}); setOpenNew(true); }}>
              <Plus size={14} /> Nouveau
            </Btn>
          </div>
        }
      />

      {syncMsg && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium ${syncMsg.ok?"bg-leaf-100 text-leaf-700":"bg-ember-100 text-ember-700"}`}>
          {syncMsg.ok?<CheckCircle size={14}/>:<AlertCircle size={14}/>} {syncMsg.msg}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { l:"Caisses SaaS",   v:resume.totalCaisses, i:<Shield size={14} className="text-clay"/> },
          { l:"Banques",        v:resume.totalBanques, i:<Building2 size={14} className="text-blue-600"/> },
          { l:"Espèces Dol.",   v:resume.totalEspeces, i:<Banknote size={14} className="text-leaf-600"/> },
          { l:"Flotte Mobile",  v:resume.totalMobile,  i:<Smartphone size={14} className="text-orange-500"/> },
          { l:"Position totale",v:resume.totalGlobal,  i:<Building2 size={14} className="text-ink"/> },
        ].map(s=>(
          <Card key={s.l} className="p-3">
            <div className="flex items-center gap-1.5 text-ink-400">{s.i}<span className="text-[11px]">{s.l}</span></div>
            <div className="num mt-1 text-lg font-bold text-ink">{formatXOF(s.v)}</div>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…" className={inputCls+" flex-1 min-w-[180px]"}/>
        <div className="flex gap-1">
          {FILTRES.map(f=>(
            <button key={f} onClick={()=>setFiltre(f)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${filtre===f?"bg-clay text-sand-50":"bg-white/70 border border-sand-200 text-ink-500 hover:bg-sand-100"}`}>
              {FILTRE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Grille */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(c=>(
          <Card key={c.uid} className={`overflow-hidden ${!c.actif?"opacity-55":""}`}>
            <div className="flex items-start justify-between p-4 pb-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  <Badge className={TYPE_BADGE[c.type]}>{TYPE_LABEL[c.type]}</Badge>
                  <Badge className={SOURCE_BADGE[c.source]}>{c.source==="caisse"?"SaaS":"Dolibarr"}</Badge>
                  {!c.actif&&<Badge className="bg-ember-100 text-ember-600">Inactif</Badge>}
                </div>
                <div className="font-bold text-ink truncate">{c.nom}</div>
                {c.banque&&<div className="text-[12px] text-ink-500">{c.banque}</div>}
                {c.titulaire&&<div className="text-[12px] text-ink-400">{c.titulaire}</div>}
                {c.numero_compte&&<div className="num text-[11px] text-ink-300 mt-0.5">{c.numero_compte}</div>}
              </div>
              <button onClick={()=>openEditM(c)} className="ml-2 p-1.5 rounded-lg hover:bg-sand-200 text-ink-400"><Edit2 size={14}/></button>
            </div>
            <div className="px-4 pb-3">
              <div className="num text-2xl font-bold text-ink">{formatXOF(c.solde)}</div>
              {c.agence&&<div className="text-[11px] text-ink-400">{c.agence}</div>}
            </div>
            <div className="flex border-t border-sand-100">
              <button onClick={()=>{ setMvtErr(null); setMvtF({montant:"",libelle:""}); setOpenMvt({compte:c,mode:"appro"}); }}
                className="flex flex-1 items-center justify-center gap-1 py-2.5 text-[12px] font-medium text-leaf-600 hover:bg-leaf-50 tap">
                <ArrowUpCircle size={13}/> Alimenter
              </button>
              <div className="w-px bg-sand-100"/>
              <button onClick={()=>{ setMvtErr(null); setMvtF({montant:"",libelle:""}); setOpenMvt({compte:c,mode:"retrait"}); }}
                className="flex flex-1 items-center justify-center gap-1 py-2.5 text-[12px] font-medium text-clay-700 hover:bg-clay-50 tap">
                <ArrowDownCircle size={13}/> Retirer
              </button>
              <div className="w-px bg-sand-100"/>
              <button onClick={()=>{ setVirErr(null); setVirF({from:c.uid,to:"",montant:"",libelle:"Virement interne"}); setOpenVir(true); }}
                className="flex flex-1 items-center justify-center gap-1 py-2.5 text-[12px] font-medium text-ink-600 hover:bg-sand-100 tap">
                <ArrowLeftRight size={13}/> Virer
              </button>
            </div>
            <button onClick={()=>setDetailUid(detailUid===c.uid?null:c.uid)}
              className="w-full border-t border-sand-100 px-4 py-1.5 text-[11px] text-ink-400 hover:bg-sand-50 text-left">
              {detailUid===c.uid?"▲ Masquer":"▼ Mouvements récents"}
            </button>
            {detailUid===c.uid&&(
              <div className="border-t border-sand-100 divide-y divide-sand-50 max-h-40 overflow-auto">
                {historique.length===0&&<div className="px-4 py-3 text-[12px] text-ink-400">Aucun mouvement enregistré.</div>}
                {historique.slice(0,6).map(m=>(
                  <div key={m.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <div className="text-[12px] text-ink">{m.libelle||m.type}</div>
                      <div className="text-[10px] text-ink-400">{formatDate(m.created_at?.slice(0,10))}</div>
                    </div>
                    <div className={`num text-[13px] font-semibold ${m.montant>=0?"text-leaf-600":"text-clay-700"}`}>
                      {m.montant>=0?"+":""}{formatXOF(Math.abs(m.montant))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
        {!loading&&rows.length===0&&(
          <Card className="p-8 text-center text-[13px] text-ink-400 sm:col-span-2 lg:col-span-3">Aucun compte.</Card>
        )}
      </div>

      {/* Modal Virement */}
      <Modal open={openVir} onClose={()=>setOpenVir(false)} title="Virement entre comptes">
        <Field label="De (source)">
          <select className={inputCls} value={virF.from} onChange={e=>setVirF(f=>({...f,from:e.target.value}))}>
            <option value="">— Choisir —</option>
            {actifs.map(c=><option key={c.uid} value={c.uid}>{c.nom} · {formatXOF(c.solde)}</option>)}
          </select>
        </Field>
        <Field label="Vers (destination)">
          <select className={inputCls} value={virF.to} onChange={e=>setVirF(f=>({...f,to:e.target.value}))}>
            <option value="">— Choisir —</option>
            {actifs.filter(c=>c.uid!==virF.from).map(c=><option key={c.uid} value={c.uid}>{c.nom}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (XOF)"><input className={inputCls+" num"} type="number" value={virF.montant} onChange={e=>setVirF(f=>({...f,montant:e.target.value}))}/></Field>
          <Field label="Libellé"><input className={inputCls} value={virF.libelle} onChange={e=>setVirF(f=>({...f,libelle:e.target.value}))}/></Field>
        </div>
        {virErr&&<p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{virErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenVir(false)}>Annuler</Btn>
          <Btn onClick={submitVir} className={virBusy?"opacity-50":""}>{virBusy?"…":"Valider le virement"}</Btn>
        </div>
      </Modal>

      {/* Modal Alim / Retrait */}
      <Modal open={!!openMvt} onClose={()=>setOpenMvt(null)} title={`${openMvt?.mode==="appro"?"Alimenter":"Retirer"} — ${openMvt?.compte.nom}`}>
        {openMvt&&<div className="mb-3 rounded-xl bg-sand-100 px-4 py-2.5 text-[13px]">Solde actuel : <strong className="num">{formatXOF(openMvt.compte.solde)}</strong></div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (XOF)"><input className={inputCls+" num"} type="number" value={mvtF.montant} onChange={e=>setMvtF(f=>({...f,montant:e.target.value}))}/></Field>
          <Field label="Libellé"><input className={inputCls} value={mvtF.libelle} onChange={e=>setMvtF(f=>({...f,libelle:e.target.value}))}/></Field>
        </div>
        {mvtErr&&<p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{mvtErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenMvt(null)}>Annuler</Btn>
          <Btn onClick={submitMvt} className={mvtBusy?"opacity-50":""}>{mvtBusy?"…":"Valider"}</Btn>
        </div>
      </Modal>

      {/* Modal Modification */}
      <Modal open={!!openEdit} onClose={()=>setOpenEdit(null)} title={`Modifier — ${openEdit?.nom}`}>
        {openEdit&&<>
          <Field label="Nom"><input className={inputCls} value={eF.nom} onChange={e=>setEF(f=>({...f,nom:e.target.value}))}/></Field>
          {openEdit.source==="caisse"?(
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agence"><input className={inputCls} value={eF.agence} onChange={e=>setEF(f=>({...f,agence:e.target.value}))}/></Field>
              <Field label="Caissier">
                <select className={inputCls} value={eF.assignee_id} onChange={e=>setEF(f=>({...f,assignee_id:e.target.value}))}>
                  <option value="">— Aucun —</option>
                  {profiles.map((p:any)=><option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </Field>
            </div>
          ):(
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select className={inputCls} value={eF.type} onChange={e=>setEF(f=>({...f,type:e.target.value as TypeCompte}))}>
                    {TYPES_DOL.map(t=><option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </Field>
                <Field label="Banque"><input className={inputCls} value={eF.banque} onChange={e=>setEF(f=>({...f,banque:e.target.value}))}/></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="N° compte"><input className={inputCls+" num"} value={eF.numero_compte} onChange={e=>setEF(f=>({...f,numero_compte:e.target.value}))}/></Field>
                <Field label="IBAN"><input className={inputCls+" num"} value={eF.iban} onChange={e=>setEF(f=>({...f,iban:e.target.value}))}/></Field>
              </div>
              <Field label="Titulaire"><input className={inputCls} value={eF.titulaire} onChange={e=>setEF(f=>({...f,titulaire:e.target.value}))}/></Field>
            </>
          )}
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="actif" checked={eF.actif} onChange={e=>setEF(f=>({...f,actif:e.target.checked}))}/>
            <label htmlFor="actif" className="text-[13px] text-ink">Compte actif</label>
          </div>
        </>}
        {eErr&&<p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{eErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenEdit(null)}>Annuler</Btn>
          <Btn onClick={submitEdit} className={eBusy?"opacity-50":""}>{eBusy?"…":"Enregistrer"}</Btn>
        </div>
      </Modal>

      {/* Modal Nouveau */}
      <Modal open={openNew} onClose={()=>setOpenNew(false)} title="Nouveau compte">
        <div className="mb-4 flex gap-2">
          {(["caisse","dolibarr"] as const).map(t=>(
            <button key={t} onClick={()=>setNewType(t)}
              className={`flex-1 rounded-xl py-2 text-[13px] font-medium border ${newType===t?"bg-clay text-sand-50 border-clay":"bg-white/70 border-sand-200 text-ink-600"}`}>
              {t==="caisse"?"🏧 Caisse SaaS":"🏦 Compte bancaire"}
            </button>
          ))}
        </div>
        <Field label="Nom"><input className={inputCls} value={nF.nom} onChange={e=>setNF(f=>({...f,nom:e.target.value}))}/></Field>
        {newType==="caisse"?(
          <div className="grid grid-cols-2 gap-3">
            <Field label="Agence"><input className={inputCls} value={nF.agence} onChange={e=>setNF(f=>({...f,agence:e.target.value}))}/></Field>
            <Field label="Caissier">
              <select className={inputCls} value={nF.assignee_id} onChange={e=>setNF(f=>({...f,assignee_id:e.target.value}))}>
                <option value="">— Aucun —</option>
                {profiles.map((p:any)=><option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </Field>
          </div>
        ):(
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select className={inputCls} value={nF.type} onChange={e=>setNF(f=>({...f,type:e.target.value as TypeCompte}))}>
                  {TYPES_DOL.map(t=><option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Banque / Opérateur"><input className={inputCls} value={nF.banque} onChange={e=>setNF(f=>({...f,banque:e.target.value}))}/></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="N° compte"><input className={inputCls+" num"} value={nF.numero_compte} onChange={e=>setNF(f=>({...f,numero_compte:e.target.value}))}/></Field>
              <Field label="Solde initial (XOF)"><input className={inputCls+" num"} type="number" value={nF.solde_initial} onChange={e=>setNF(f=>({...f,solde_initial:e.target.value}))}/></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IBAN"><input className={inputCls+" num"} value={nF.iban} onChange={e=>setNF(f=>({...f,iban:e.target.value}))}/></Field>
              <Field label="Titulaire"><input className={inputCls} value={nF.titulaire} onChange={e=>setNF(f=>({...f,titulaire:e.target.value}))}/></Field>
            </div>
          </>
        )}
        {nErr&&<p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{nErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenNew(false)}>Annuler</Btn>
          <Btn onClick={submitNew} className={nBusy?"opacity-50":""}>{nBusy?"…":"Créer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
