"use client";
import { useMemo, useState } from "react";
import { Boxes, AlertTriangle, TrendingDown, Plus, Search, Edit2, ArrowUpDown } from "lucide-react";
import { useProduits } from "@/lib/hooks";
import { PageHeader, Card, Badge, Btn, Field, inputCls } from "@/components/ui";
import { formatXOF } from "@/lib/format";

export default function StockPage() {
  const { data: produits, loading } = useProduits();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("tous");

  const rows = useMemo(()=> produits.filter(p => {
    if (filtre === "alerte" && (p.stock??0) > ((p as any).seuil_alerte??10)) return false;
    if (filtre === "rupture" && (p.stock??0) > 0) return false;
    if (q && !p.nom.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [produits, q, filtre]);

  const totalProduits = produits.length;
  const enAlerte = produits.filter(p=>(p.stock??0)<=(((p as any).seuil_alerte)??10)&&(p.stock??0)>0).length;
  const enRupture = produits.filter(p=>(p.stock??0)===0).length;
  const valeurStock = produits.reduce((s,p)=>s+(p.stock??0)*((p as any).prix_achat??0),0);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Stock & Inventaire" subtitle={`${totalProduits} références · ${enAlerte} alertes · ${enRupture} ruptures`}/>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {l:"Références",     v:String(totalProduits), i:<Boxes size={14} className="text-blue-500"/>},
          {l:"Alertes stock",  v:String(enAlerte),      i:<AlertTriangle size={14} className="text-amber-500"/>},
          {l:"Ruptures",       v:String(enRupture),     i:<TrendingDown size={14} className="text-ember-500"/>},
          {l:"Valeur stock",   v:formatXOF(valeurStock),i:<Boxes size={14} className="text-leaf-500"/>},
        ].map(s=>(
          <Card key={s.l} className="p-3 flex items-center gap-3">
            {s.i}
            <div>
              <div className="text-[10px] text-ink-400">{s.l}</div>
              <div className="num text-base font-bold text-ink">{s.v}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3 py-2">
          <Search size={14} className="text-ink-400"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un produit…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-400"/>
        </div>
        {["tous","alerte","rupture"].map(f=>(
          <button key={f} onClick={()=>setFiltre(f)}
            className={`rounded-lg px-3 py-2 text-[13px] font-medium ${filtre===f?"bg-clay text-sand-50":"bg-white/70 border border-sand-200 text-ink-500 hover:bg-sand-100"}`}>
            {f==="tous"?"Tous":f==="alerte"?"⚠ Alertes":"🔴 Ruptures"}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-[11px] uppercase text-ink-400 bg-sand-50">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Seuil</th>
                <th className="px-4 py-3 text-right font-medium">Prix vente</th>
                <th className="px-4 py-3 text-right font-medium">Valeur</th>
                <th className="px-4 py-3 font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p:any)=>{
                const seuil = p.seuil_alerte??10;
                const stock = p.stock??0;
                const etat = stock===0?"rupture":stock<=seuil?"alerte":"ok";
                return (
                  <tr key={p.id} className="border-b border-sand-50 last:border-0 hover:bg-sand-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink text-[13px]">{p.nom}</div>
                      {p.categorie&&<div className="text-[11px] text-ink-400">{p.categorie}</div>}
                    </td>
                    <td className={`num px-4 py-3 text-right font-bold ${etat==="rupture"?"text-ember-600":etat==="alerte"?"text-amber-700":"text-leaf-600"}`}>{stock}</td>
                    <td className="num px-4 py-3 text-right text-ink-400">{seuil}</td>
                    <td className="num px-4 py-3 text-right text-ink">{p.prix_vente?formatXOF(p.prix_vente):"—"}</td>
                    <td className="num px-4 py-3 text-right text-ink">{p.prix_achat?formatXOF(stock*p.prix_achat):"—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={etat==="rupture"?"bg-ember-100 text-ember-600":etat==="alerte"?"bg-amber-100 text-amber-700":"bg-leaf-100 text-leaf-600"}>
                        {etat==="rupture"?"Rupture":etat==="alerte"?"Alerte":"OK"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {rows.length===0&&<tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">Aucun produit.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
