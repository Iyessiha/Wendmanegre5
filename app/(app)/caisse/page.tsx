"use client";

import { useMemo, useState } from "react";
import {
  HandCoins, ArrowDownCircle, ArrowUpCircle,
  Smartphone, Wallet, Send, Download, ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useCaisses } from "@/lib/hooks";
import { useTransactions } from "@/lib/hooks2";
import { PageHeader, Card, Btn, Modal } from "@/components/ui";
import { KpiCard } from "@/components/KpiCard";
import TransactionsResume from "@/components/TransactionsResume";
import TransactionModal from "@/components/TransactionModal";
import { formatXOF, formatDate } from "@/lib/format";
import type { TypeTransaction } from "@/lib/database.types";

const TODAY = new Date().toISOString().slice(0, 10);

const TX_TYPES: {
  type: TypeTransaction; label: string; desc: string;
  icon: React.ElementType; color: string; bgColor: string;
}[] = [
  { type: "DEPOT",         label: "Dépôt Mobile Money",   desc: "Client dépose du cash → reçoit de l'eMonnaie", icon: ArrowDownCircle, color: "text-leaf-600",   bgColor: "bg-leaf-100"   },
  { type: "RETRAIT",       label: "Retrait Mobile Money",  desc: "Client retire du cash de son compte mobile",   icon: ArrowUpCircle,   color: "text-clay-700",  bgColor: "bg-clay-100"   },
  { type: "ENVOI",         label: "Envoi d'argent",        desc: "Transfert vers un autre numéro",               icon: Send,            color: "text-purple-600",bgColor: "bg-purple-100" },
  { type: "CREDIT",        label: "Octroyer un crédit",    desc: "Avancer des unités ou du cash à crédit",       icon: HandCoins,       color: "text-amber-700", bgColor: "bg-amber-100"  },
  { type: "REMBOURSEMENT", label: "Remboursement crédit",  desc: "Encaisser le retour d'un crédit",              icon: Wallet,          color: "text-teal-600",  bgColor: "bg-teal-100"   },
  { type: "RECEPTION",     label: "Réception transfert",   desc: "Client reçoit un transfert entrant",           icon: Download,        color: "text-blue-600",  bgColor: "bg-blue-100"   },
];

export default function CaissePage() {
  const { userId } = useAuth();
  const { users, caisses: caissesSeed } = useStore();
  const { data: caissesSupabase } = useCaisses();
  const user = users.find(u => u.id === userId);

  const maCaisse = caissesSupabase.find(c => c.assignee_id === userId)
    ?? caissesSeed.find((c: any) => c.assigneeA === userId);

  const caisseId = (maCaisse as any)?.id ?? "c1";
  const solde    = (maCaisse as any)?.solde ?? 0;

  const { data: txJour, loading: txLoading, refetch } = useTransactions(caisseId, TODAY);

  // Modal
  const [openTx, setOpenTx]     = useState<TypeTransaction | null>(null);
  const [openCloture, setOpenCloture] = useState(false);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  function handleSuccess() {
    setOpenTx(null);
    refetch();
    setSuccessMsg("Transaction enregistrée ✓");
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  // Stats du jour
  const stats = useMemo(() => {
    const fraisJ   = txJour.filter(t => t.statut !== "annulee").reduce((s, t) => s + (t.frais ?? 0), 0);
    const volumeMM = txJour.filter(t => ["DEPOT","RETRAIT","ENVOI","RECEPTION"].includes(t.type) && t.statut !== "annulee").reduce((s, t) => s + t.montant, 0);
    const octroyeJ = txJour.filter(t => t.type === "CREDIT"         && t.statut !== "annulee").reduce((s, t) => s + t.montant, 0);
    const encaisseJ= txJour.filter(t => t.type === "REMBOURSEMENT"  && t.statut !== "annulee").reduce((s, t) => s + t.montant, 0);
    return { fraisJ, volumeMM, octroyeJ, encaisseJ };
  }, [txJour]);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={`Bonjour, ${user?.nom?.split(" ")[0] ?? ""}`}
        subtitle={`${(maCaisse as any)?.nom ?? "Ma caisse"} · ${formatDate(TODAY)}`}
        action={
          <Btn variant="soft" onClick={() => setOpenCloture(true)}>
            <ClipboardCheck size={16} /> Clôturer la journée
          </Btn>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Solde caisse"        value={formatXOF(solde)}           icon={<Wallet size={18}/>}         accent="leaf" />
        <KpiCard label="Frais encaissés"     value={formatXOF(stats.fraisJ)}    icon={<HandCoins size={18}/>}      accent="gold" />
        <KpiCard label="Volume Mobile Money" value={formatXOF(stats.volumeMM)}  icon={<Smartphone size={18}/>}     accent="ink"  />
        <KpiCard label="Opérations du jour"  value={String(txJour.length)}      icon={<ClipboardCheck size={18}/>} accent="clay" />
      </div>

      {/* Flash succès */}
      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-[13px] font-medium text-leaf-700">
          ✓ {successMsg}
        </div>
      )}

      {/* 6 boutons de type de transaction */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TX_TYPES.map(t => (
          <button key={t.type} onClick={() => setOpenTx(t.type)}
            className="group flex items-start gap-3 rounded-2xl border border-sand-200 bg-white/70 p-4 text-left shadow-card tap transition-all hover:border-clay/30 hover:shadow-lift">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.bgColor} ${t.color} transition-transform group-hover:scale-105`}>
              <t.icon size={20}/>
            </span>
            <div>
              <div className="display text-sm font-bold text-ink leading-tight">{t.label}</div>
              <div className="mt-0.5 text-[11px] text-ink-500 leading-snug">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Journal du jour */}
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h3 className="display text-lg font-bold text-ink">Journal du jour</h3>
        </div>
        {txLoading ? (
          <div className="py-8 text-center text-sm text-ink-400">Chargement...</div>
        ) : txJour.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-400">
            Aucune transaction aujourd'hui. Commencez par choisir un type d'opération ci-dessus.
          </div>
        ) : (
          <div className="divide-y divide-sand-100">
            {txJour.map(tx => {
              const def = TX_TYPES.find(t => t.type === tx.type);
              const Icon = def?.icon ?? HandCoins;
              const isEntree = ["DEPOT","REMBOURSEMENT","RECEPTION"].includes(tx.type);
              return (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-sand-100/60">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${def?.bgColor ?? "bg-sand-200"} ${def?.color ?? "text-ink"}`}>
                      <Icon size={15}/>
                    </span>
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {def?.label ?? tx.type}
                        {tx.nom_client && <span className="text-ink-400"> · {tx.nom_client}</span>}
                      </div>
                      <div className="num text-[11px] text-ink-400">
                        {tx.operateur && `${tx.operateur} · `}
                        {tx.telephone_client && `📱 ${tx.telephone_client} · `}
                        Frais : {formatXOF(tx.frais ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`num text-sm font-semibold ${isEntree ? "text-leaf-600" : "text-clay-700"}`}>
                      {isEntree ? "+" : "−"}{formatXOF(tx.montant)}
                    </div>
                    {(tx.frais ?? 0) > 0 && (
                      <div className="num text-[11px] text-amber-600">+{formatXOF(tx.frais ?? 0)} comm.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mt-5">
        <TransactionsResume />
      </div>

      {/* ── Modal : formulaires distincts par type ───────────────────────── */}
      <TransactionModal
        open={!!openTx}
        initialType={openTx ?? "DEPOT"}
        caisses={caissesSupabase.length > 0 ? caissesSupabase : [maCaisse].filter(Boolean) as any[]}
        userId={userId ?? ""}
        onClose={() => setOpenTx(null)}
        onSuccess={handleSuccess}
      />

      {/* Modal clôture */}
      <Modal open={openCloture} onClose={() => setOpenCloture(false)} title="Clôture de journée">
        <div className="space-y-2.5 text-sm">
          {[
            { l: "Transactions Mobile Money", v: formatXOF(stats.volumeMM) },
            { l: "Crédits octroyés",          v: "−" + formatXOF(stats.octroyeJ) },
            { l: "Remboursements reçus",       v: "+" + formatXOF(stats.encaisseJ) },
            { l: "Frais & commissions",        v: "+" + formatXOF(stats.fraisJ), c: "text-leaf-600" },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex justify-between">
              <span className="text-ink-500">{l}</span>
              <span className={`num font-medium ${c ?? "text-ink"}`}>{v}</span>
            </div>
          ))}
          <div className="my-2 border-t border-sand-200"/>
          <div className="flex justify-between">
            <span className="font-medium text-ink">Solde théorique de clôture</span>
            <span className="num text-base font-semibold text-ink">{formatXOF(solde)}</span>
          </div>
        </div>
        <p className="mt-4 text-[12px] text-ink-400">Comparez avec l'argent physique en caisse. Signalez tout écart au responsable.</p>
        <div className="mt-4 flex justify-end">
          <Btn onClick={() => setOpenCloture(false)}>Fermer</Btn>
        </div>
      </Modal>
    </div>
  );
}
