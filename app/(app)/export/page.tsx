"use client";
import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Database, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { getClient } from "@/lib/supabase";
import { PageHeader, Card, Btn } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

type Status = "idle"|"loading"|"done"|"error";

const EXPORTS = [
  { id:"transactions",  label:"Transactions",       desc:"Toutes les transactions Mobile Money",       icon:FileSpreadsheet, color:"text-leaf-600",  bg:"bg-leaf-50"   },
  { id:"clients",       label:"Commerçants / Clients",desc:"Liste complète des commerçants",          icon:Database,        color:"text-blue-600",  bg:"bg-blue-50"   },
  { id:"factures",      label:"Factures",            desc:"Factures et état des paiements",             icon:FileText,        color:"text-purple-600",bg:"bg-purple-50" },
  { id:"prets",         label:"Prêts & Remboursements",desc:"Encours et historique des remboursements",icon:FileSpreadsheet, color:"text-amber-700", bg:"bg-amber-50"  },
  { id:"comptes",       label:"Trésorerie & Comptes", desc:"Soldes et mouvements des comptes",         icon:Database,        color:"text-teal-600",  bg:"bg-teal-50"   },
  { id:"operateurs",    label:"Opérateurs & Flottes", desc:"Soldes flottes et mouvements",             icon:FileSpreadsheet, color:"text-orange-600",bg:"bg-orange-50" },
  { id:"charges",       label:"Charges & Dépenses",  desc:"Charges enregistrées par mois",             icon:FileText,        color:"text-ember-600", bg:"bg-ember-50"  },
  { id:"complet",       label:"Export Complet",       desc:"Toutes les données (fichier ZIP/CSV)",     icon:Download,        color:"text-ink",       bg:"bg-sand-100"  },
] as const;

type ExportId = typeof EXPORTS[number]["id"];

function toCSV(rows: any[]): string {
  if (!rows?.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v:any) => typeof v==="string"&&v.includes(",") ? `"${v.replace(/"/g,'""')}"` : String(v??"");
  return [cols.join(","), ...rows.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\n");
}

function downloadCSV(filename: string, content: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom+content], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

async function fetchAndDownload(id: ExportId) {
  const sb = getClient() as any;
  const date = new Date().toISOString().slice(0,10);
  switch(id) {
    case "transactions": {
      const { data } = await sb.from("v_transactions").select("type,operateur_nom,montant,frais,nom_client,telephone_client,nom_dest,date_transaction,reference,caisse_nom").order("created_at",{ascending:false});
      downloadCSV(`transactions_${date}.csv`, toCSV(data??[])); break;
    }
    case "clients": {
      const { data } = await sb.from("clients").select("nom,telephone,ville,cnib,identifiant_pro1,plafond,actif,date_creation").eq("actif",true).order("nom");
      downloadCSV(`commerçants_${date}.csv`, toCSV(data??[])); break;
    }
    case "factures": {
      const { data } = await sb.from("v_factures").select("id,client_nom,client_ville,montant_total,total_paye,reste_a_payer,statut,date_facture").order("date_facture",{ascending:false});
      downloadCSV(`factures_${date}.csv`, toCSV(data??[])); break;
    }
    case "prets": {
      const { data } = await sb.from("v_prets_encours").select("id,client_nom,client_ville,montant,type_operation,statut,date_octroi,echeance,reste_a_payer,jours_retard");
      downloadCSV(`prets_${date}.csv`, toCSV(data??[])); break;
    }
    case "comptes": {
      const [{ data: c }, { data: cb }] = await Promise.all([
        sb.from("caisses").select("nom,agence,solde,actif"),
        sb.from("comptes_bancaires").select("nom,type,banque,numero_compte,solde_dolibarr,actif"),
      ]);
      const merged = [...(c??[]).map((x:any)=>({...x,source:"SaaS"})), ...(cb??[]).map((x:any)=>({...x,source:"Dolibarr"}))];
      downloadCSV(`comptes_${date}.csv`, toCSV(merged)); break;
    }
    case "operateurs": {
      const { data } = await sb.from("operateurs").select("id,nom,solde_flotte,commission_taux,actif");
      downloadCSV(`operateurs_${date}.csv`, toCSV(data??[])); break;
    }
    case "charges": {
      const { data } = await sb.from("charges").select("libelle,categorie,montant,date_charge,periode,notes").order("date_charge",{ascending:false});
      downloadCSV(`charges_${date}.csv`, toCSV(data??[])); break;
    }
    case "complet": {
      const tables = [
        { key:"transactions", q:()=>sb.from("v_transactions").select("*") },
        { key:"clients",      q:()=>sb.from("clients").select("nom,telephone,ville,plafond") },
        { key:"factures",     q:()=>sb.from("v_factures").select("*") },
        { key:"prets",        q:()=>sb.from("v_prets_encours").select("*") },
        { key:"charges",      q:()=>sb.from("charges").select("*") },
        { key:"comptes",      q:()=>sb.from("comptes_bancaires").select("*") },
      ];
      for (const t of tables) {
        const { data } = await t.q();
        if (data?.length) downloadCSV(`${t.key}_${date}.csv`, toCSV(data));
        await new Promise(r=>setTimeout(r,200));
      }
      break;
    }
  }
}

export default function ExportPage() {
  const [statuses, setStatuses] = useState<Record<string,Status>>({});
  async function handleExport(id: ExportId) {
    setStatuses(s=>({...s,[id]:"loading"}));
    try {
      await fetchAndDownload(id);
      setStatuses(s=>({...s,[id]:"done"}));
      setTimeout(()=>setStatuses(s=>({...s,[id]:"idle"})),3000);
    } catch(e) {
      setStatuses(s=>({...s,[id]:"error"}));
      setTimeout(()=>setStatuses(s=>({...s,[id]:"idle"})),4000);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Export des données" subtitle="Téléchargez vos données en CSV · Encodage UTF-8 avec séparateur virgule"/>
      <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-[13px] text-blue-700">
        Les fichiers CSV s'ouvrent dans Excel, Google Sheets ou LibreOffice Calc. 
        Pour l'export complet, plusieurs fichiers seront téléchargés successivement.
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORTS.map(e=>{
          const Icon = e.icon;
          const st = statuses[e.id]??"idle";
          return (
            <Card key={e.id} className={`p-5 flex flex-col gap-4 ${e.id==="complet"?"sm:col-span-2 lg:col-span-3 flex-row items-center":""}`}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${e.bg}`}>
                <Icon size={22} className={e.color}/>
              </div>
              <div className="flex-1">
                <div className="font-bold text-ink text-[14px]">{e.label}</div>
                <div className="text-[12px] text-ink-500 mt-0.5">{e.desc}</div>
              </div>
              <button onClick={()=>handleExport(e.id as ExportId)} disabled={st==="loading"}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all shrink-0
                  ${st==="done" ? "bg-leaf-100 text-leaf-700"
                  : st==="error" ? "bg-ember-100 text-ember-600"
                  : st==="loading" ? "bg-sand-100 text-ink-400 cursor-wait"
                  : `${e.bg} ${e.color} hover:opacity-80`}`}>
                {st==="loading" && <Loader size={14} className="animate-spin"/>}
                {st==="done" && <CheckCircle size={14}/>}
                {st==="error" && <AlertCircle size={14}/>}
                {st==="idle" && <Download size={14}/>}
                {st==="loading"?"Export…": st==="done"?"Téléchargé !": st==="error"?"Erreur":"Télécharger CSV"}
              </button>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] text-ink-400">
        Toutes les exportations utilisent l'encodage UTF-8 (BOM) pour une compatibilité optimale avec Excel. Les montants sont en FCFA.
      </p>
    </div>
  );
}
