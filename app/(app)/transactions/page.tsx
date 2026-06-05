"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Send, HandCoins, Wallet, Download, Search,
  CheckCircle,
} from "lucide-react";
import { useTransactions, resumeJour, TYPES_TRANSACTION, labelType, type TypeTransaction } from "@/lib/hooks-transactions";
import { useOperateurs } from "@/lib/hooks-operateurs";
import { useCaisses } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";
import TransactionModal from "@/components/TransactionModal";

// ── 6 boutons d'action rapide ────────────────────────────────────────────────
const ACTIONS = [
  { type:"DEPOT"         as TypeTransaction, label:"Dépôt Mobile Money",   desc:"Cash → eMonnaie",        icon:ArrowDownCircle, color:"text-leaf-600",   bg:"bg-leaf-50",   border:"border-leaf-200"  },
  { type:"RETRAIT"       as TypeTransaction, label:"Retrait Mobile Money",  desc:"eMonnaie → Cash",        icon:ArrowUpCircle,   color:"text-clay-700",  bg:"bg-clay-50",  border:"border-clay-200"  },
  { type:"ENVOI"         as TypeTransaction, label:"Envoi d'argent",        desc:"Transfert sortant",      icon:Send,            color:"text-purple-600",bg:"bg-purple-50",border:"border-purple-200"},
  { type:"CREDIT"        as TypeTransaction, label:"Octroyer un crédit",    desc:"Avance unités / cash",   icon:HandCoins,       color:"text-amber-700", bg:"bg-amber-50", border:"border-amber-200" },
  { type:"REMBOURSEMENT" as TypeTransaction, label:"Remboursement crédit",  desc:"Retour de crédit",       icon:Wallet,          color:"text-teal-600",  bg:"bg-teal-50",  border:"border-teal-200"  },
  { type:"RECEPTION"     as TypeTransaction, label:"Réception transfert",   desc:"Transfert entrant",      icon:Download,        color:"text-blue-600",  bg:"bg-blue-50",  border:"border-blue-200"  },
] as const;

const TYPE_BADGE: Record<string,string> = {
  DEPOT:"bg-leaf-100 text-leaf-600", RETRAIT:"bg-clay/15 text-clay-700",
  ENVOI:"bg-purple-100 text-purple-600", RECEPTION:"bg-blue-100 text-blue-600",
  CREDIT:"bg-amber-100 text-amber-700", REMBOURSEMENT:"bg-teal-100 text-teal-600",
};

export default function TransactionsPage() {
  const [typeFiltre, setTypeFiltre] = useState("tous");
  const [opFiltre, setOpFiltre]     = useState("tous");
  const { data: transactions, refetch } = useTransactions({ type: typeFiltre, operateur: opFiltre });
  const { data: operateurs } = useOperateurs();
  const { data: caisses }    = useCaisses();
  const [q, setQ] = useState("");

  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const resume = useMemo(() => resumeJour(transactions), [transactions]);
  const opNom  = (id: string|null) => operateurs.find(o => o.id === id)?.nom ?? id ?? "—";
  const cNom   = (id: string|null) => caisses.find((c:any) => c.id === id)?.nom ?? "—";

  const rows = useMemo(() => transactions.filter(t =>
    (t.nom_client ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (t.telephone_client ?? "").includes(q) ||
    (t.reference ?? "").toLowerCase().includes(q.toLowerCase())
  ), [transactions, q]);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modalType, setModalType] = useState<TypeTransaction|null>(null);
  const [successMsg, setSuccessMsg] = useState<string|null>(null);

  function openModal(t: TypeTransaction) { setModalType(t); }
  function handleSuccess() {
    setModalType(null);
    setSuccessMsg("Transaction enregistrée ✓");
    refetch();
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Transactions" subtitle="Dépôts · Retraits · Transferts · Crédits" />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { l:"Transactions aujourd'hui", v:String(resume.nombre) },
          { l:"Volume du jour",           v:formatXOF(resume.volume) },
          { l:"Commissions du jour",      v:formatXOF(resume.commissions), accent:true },
        ].map((s,i) => (
          <Card key={i} className="p-4">
            <div className="text-[12px] text-ink-400">{s.l}</div>
            <div className={`num mt-1 text-lg font-bold ${s.accent ? "text-leaf-600" : "text-ink"}`}>{s.v}</div>
          </Card>
        ))}
      </div>

      {/* Flash succès */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-[13px] font-medium text-leaf-700">
          <CheckCircle size={15}/> {successMsg}
        </div>
      )}

      {/* 6 boutons action rapide */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.type} onClick={() => openModal(a.type)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left tap transition-all hover:shadow-md active:scale-[0.98] ${a.bg} ${a.border}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ${a.color}`}>
                <Icon size={22}/>
              </div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold leading-tight ${a.color}`}>{a.label}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-ink-500">{a.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtres + recherche */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
          <Search size={15} className="text-ink-400"/>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Client, téléphone, référence…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"/>
        </div>
        <select className={inputCls + " w-auto"} value={typeFiltre} onChange={e => setTypeFiltre(e.target.value)}>
          <option value="tous">Tous les types</option>
          {TYPES_TRANSACTION.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={opFiltre} onChange={e => setOpFiltre(e.target.value)}>
          <option value="tous">Tous opérateurs</option>
          {operateurs.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      {/* Tableau des transactions */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Opérateur</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Détails</th>
                <th className="px-4 py-3 font-medium">Caisse</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                  <td className="px-4 py-3 text-ink-500 text-[13px]">{formatDate(t.date_transaction ?? t.created_at)}</td>
                  <td className="px-4 py-3"><Badge className={TYPE_BADGE[t.type] ?? "bg-sand-200 text-ink-600"}>{labelType(t.type)}</Badge></td>
                  <td className="px-4 py-3 text-ink-700 text-[13px]">{opNom(t.operateur)}</td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-ink">{t.nom_client ?? "—"}</div>
                    {t.telephone_client && <div className="num text-[11px] text-ink-400">{t.telephone_client}</div>}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold text-ink">{formatXOF(t.montant)}</td>
                  <td className="num px-4 py-3 text-right text-leaf-600">{t.frais ? formatXOF(t.frais) : "—"}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-400 hidden md:table-cell">
                    {(t as any).nom_dest && <div>→ {(t as any).nom_dest}</div>}
                    {(t as any).telephone_dest && <div className="num">{(t as any).telephone_dest}</div>}
                    {(t as any).expediteur_nom && <div>De : {(t as any).expediteur_nom}</div>}
                    {(t as any).type_credit && <div className="capitalize">{(t as any).type_credit?.replace(/_/g," ")}</div>}
                    {(t as any).echeance && <div>Éch. {(t as any).echeance}</div>}
                    {(t as any).mode_paiement && <div>{(t as any).mode_paiement}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink-500 text-[13px]">{cNom(t.caisse_id)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-400">
                  Aucune transaction. Choisissez une opération ci-dessus.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal distinct par type */}
      <TransactionModal
        open={!!modalType}
        initialType={modalType ?? "DEPOT"}
        caisses={caisses}
        userId={userId}
        onClose={() => setModalType(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
