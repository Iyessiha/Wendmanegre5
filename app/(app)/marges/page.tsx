"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, BarChart3, AlertCircle } from "lucide-react";
import { getClient } from "@/lib/supabase";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const CAT_LABEL: Record<string,string> = {
  loyer:"Loyer / Local", salaires:"Salaires", fournitures:"Fournitures",
  charges_operateur:"Charges Opérateur", transport:"Transport",
  communication:"Communication", amortissement:"Amortissement",
  taxes:"Taxes & Impôts", autres:"Autres charges",
};
const CAT_COLOR: Record<string,string> = {
  loyer:"bg-blue-100 text-blue-700", salaires:"bg-purple-100 text-purple-700",
  fournitures:"bg-amber-100 text-amber-700", charges_operateur:"bg-orange-100 text-orange-700",
  transport:"bg-teal-100 text-teal-700", communication:"bg-pink-100 text-pink-700",
  amortissement:"bg-sand-200 text-ink-600", taxes:"bg-ember-100 text-ember-600",
  autres:"bg-sand-200 text-ink-500",
};

interface MargeRow { periode:string; commissions_mm:number; revenus_factures:number; total_revenus:number; total_charges:number; benefice_net:number; nb_transactions:number; }
interface Charge { id:string; libelle:string; categorie:string; montant:number; date_charge:string; periode:string|null; notes:string|null; }

export default function MargesPage() {
  const [marges, setMarges] = useState<MargeRow[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodeFiltre, setPeriodeFiltre] = useState(new Date().toISOString().slice(0,7));

  const load = useCallback(async()=>{
    setLoading(true);
    const sb = getClient() as any;
    const [{ data: m }, { data: c }] = await Promise.all([
      sb.from("v_marges_mois").select("*").limit(12),
      sb.from("charges").select("*").order("date_charge",{ascending:false}).limit(100),
    ]);
    setMarges(m??[]); setCharges(c??[]);
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  // KPIs période sélectionnée
  const kpiPeriode = useMemo(()=>{
    const row = marges.find(m=>m.periode===periodeFiltre);
    const chargesMois = charges.filter(c=>c.periode===periodeFiltre||c.date_charge?.slice(0,7)===periodeFiltre);
    const totalChargesMois = chargesMois.reduce((s,c)=>s+c.montant,0);
    return {
      revenus: row?.total_revenus??0,
      commissions: row?.commissions_mm??0,
      factures: row?.revenus_factures??0,
      charges: row?.total_charges??totalChargesMois,
      benefice: row?.benefice_net??(row?.total_revenus??0)-totalChargesMois,
      nbTx: row?.nb_transactions??0,
      marge: row?.total_revenus?Math.round(((row.total_revenus-(row.total_charges||0))/row.total_revenus)*100):0,
    };
  },[marges,charges,periodeFiltre]);

  // Graphique historique
  const chartData = useMemo(()=>
    [...marges].reverse().slice(-6).map(m=>({
      mois: m.periode?.slice(5)??m.periode,
      Revenus: Math.round(m.total_revenus/1000),
      Charges: Math.round(m.total_charges/1000),
      Bénéfice: Math.round(m.benefice_net/1000),
    }))
  ,[marges]);

  // Charges du mois
  const chargesMois = useMemo(()=>
    charges.filter(c=>c.periode===periodeFiltre||c.date_charge?.slice(0,7)===periodeFiltre)
  ,[charges,periodeFiltre]);

  const totalChargesMois = chargesMois.reduce((s,c)=>s+c.montant,0);
  const parCategorie = useMemo(()=>{
    const m: Record<string,number>={};
    chargesMois.forEach(c=>{ m[c.categorie]=(m[c.categorie]??0)+c.montant; });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[chargesMois]);

  // Modal nouvelle charge
  const [openCharge, setOpenCharge] = useState(false);
  const [cf, setCf] = useState({ libelle:"", categorie:"autres", montant:"", date_charge:new Date().toISOString().slice(0,10), notes:"" });
  const [cBusy, setCBusy] = useState(false); const [cErr, setCErr] = useState<string|null>(null);
  async function submitCharge(){
    if(!cf.libelle||!Number(cf.montant)){setCErr("Libellé et montant requis.");return;}
    setCBusy(true);setCErr(null);
    const { error } = await (getClient() as any).from("charges").insert({ libelle:cf.libelle, categorie:cf.categorie, montant:Number(cf.montant), date_charge:cf.date_charge, periode:cf.date_charge.slice(0,7), notes:cf.notes||null });
    if(error){setCErr(error.message);}else{setOpenCharge(false);load();}
    setCBusy(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Marge & Bénéfice" subtitle="Revenus, charges et résultat net"/>

      {/* Sélecteur période */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-[13px] text-ink-500 font-medium">Période :</label>
        <input type="month" value={periodeFiltre} onChange={e=>setPeriodeFiltre(e.target.value)}
          className={inputCls+" w-44"}/>
        <Btn onClick={()=>{setCErr(null);setCf({libelle:"",categorie:"autres",montant:"",date_charge:new Date().toISOString().slice(0,10),notes:""});setOpenCharge(true);}}
          variant="soft"><Plus size={14}/> Ajouter une charge</Btn>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { l:"Revenus totaux",    v:kpiPeriode.revenus,     cls:"text-leaf-600",  sub:`${kpiPeriode.nbTx} transactions` },
          { l:"Com. Mobile Money", v:kpiPeriode.commissions, cls:"text-orange-600",sub:"Frais encaissés" },
          { l:"Charges du mois",   v:kpiPeriode.charges,     cls:"text-clay-700",  sub:`${chargesMois.length} postes` },
          { l:"Bénéfice net",      v:kpiPeriode.benefice,    cls:kpiPeriode.benefice>=0?"text-leaf-600":"text-ember-600", sub:`Marge ${kpiPeriode.marge}%` },
        ].map(s=>(
          <Card key={s.l} className="p-4">
            <div className="text-[12px] text-ink-400">{s.l}</div>
            <div className={`num mt-1 text-xl font-bold ${s.cls}`}>{formatXOF(s.v)}</div>
            <div className="text-[11px] text-ink-400 mt-0.5">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Graphiques */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-ink">Évolution 6 mois (k FCFA)</h3>
          {chartData.length>0?(
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="mois" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:10}} width={40}/>
                <Tooltip formatter={(v:any)=>formatXOF(Number(v)*1000)}/>
                <Legend/>
                <Line type="monotone" dataKey="Revenus" stroke="#4CAF50" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="Charges" stroke="#E53935" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="Bénéfice" stroke="#1976D2" strokeWidth={2.5} dot/>
              </LineChart>
            </ResponsiveContainer>
          ):<p className="text-[13px] text-ink-400 text-center py-8">Aucune donnée historique.</p>}
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-ink">Charges par catégorie</h3>
          {parCategorie.length>0?(
            <div className="space-y-2">
              {parCategorie.map(([cat,montant])=>(
                <div key={cat} className="flex items-center gap-2">
                  <Badge className={CAT_COLOR[cat]+" text-[10px]"}>{CAT_LABEL[cat]}</Badge>
                  <div className="flex-1 h-2 rounded-full bg-sand-100">
                    <div className="h-2 rounded-full bg-clay" style={{width:`${totalChargesMois?Math.round(montant/totalChargesMois*100):0}%`}}/>
                  </div>
                  <span className="num text-[12px] text-ink-600 w-28 text-right shrink-0">{formatXOF(montant)}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-sand-100 flex justify-between text-[12px] font-bold">
                <span>Total charges</span><span className="num text-clay-700">{formatXOF(totalChargesMois)}</span>
              </div>
            </div>
          ):<p className="text-[13px] text-ink-400 text-center py-6">Aucune charge ce mois. <button onClick={()=>setOpenCharge(true)} className="text-clay underline">Ajouter</button></p>}
        </Card>
      </div>

      {/* Tableau des charges */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100">
          <h3 className="text-[14px] font-bold text-ink">Charges — {periodeFiltre}</h3>
          <Btn onClick={()=>setOpenCharge(true)} variant="soft"><Plus size={13}/> Ajouter</Btn>
        </div>
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-ink-400 bg-sand-50">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Libellé</th>
                <th className="px-4 py-2.5">Catégorie</th>
                <th className="px-4 py-2.5 text-right">Montant</th>
                <th className="px-4 py-2.5"/>
              </tr>
            </thead>
            <tbody>
              {chargesMois.map(c=>(
                <tr key={c.id} className="border-b border-sand-50 last:border-0 hover:bg-sand-50/60">
                  <td className="px-4 py-2.5 text-ink-400 text-[12px]">{formatDate(c.date_charge)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink text-[13px]">{c.libelle}</td>
                  <td className="px-4 py-2.5"><Badge className={CAT_COLOR[c.categorie]}>{CAT_LABEL[c.categorie]}</Badge></td>
                  <td className="num px-4 py-2.5 text-right font-semibold text-clay-700">{formatXOF(c.montant)}</td>
                  <td className="px-2 py-2.5">
                    <button onClick={async()=>{ await (getClient() as any).from("charges").delete().eq("id",c.id); load(); }}
                      className="p-1 rounded hover:bg-ember-100 text-ember-400"><Trash2 size={13}/></button>
                  </td>
                </tr>
              ))}
              {chargesMois.length===0&&<tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">Aucune charge enregistrée pour cette période.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={openCharge} onClose={()=>setOpenCharge(false)} title="Ajouter une charge">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Libellé"><input className={inputCls} value={cf.libelle} onChange={e=>setCf(f=>({...f,libelle:e.target.value}))} placeholder="Ex: Loyer bureau"/></Field>
          <Field label="Catégorie">
            <select className={inputCls} value={cf.categorie} onChange={e=>setCf(f=>({...f,categorie:e.target.value}))}>
              {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Montant (FCFA)"><input className={inputCls+" num"} type="number" value={cf.montant} onChange={e=>setCf(f=>({...f,montant:e.target.value}))}/></Field>
          <Field label="Date"><input className={inputCls} type="date" value={cf.date_charge} onChange={e=>setCf(f=>({...f,date_charge:e.target.value}))}/></Field>
        </div>
        <Field label="Notes (optionnel)"><input className={inputCls} value={cf.notes} onChange={e=>setCf(f=>({...f,notes:e.target.value}))}/></Field>
        {cErr&&<p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600 flex items-center gap-2"><AlertCircle size={13}/>{cErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenCharge(false)}>Annuler</Btn>
          <Btn onClick={submitCharge} disabled={cBusy}>{cBusy?"…":"Enregistrer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
