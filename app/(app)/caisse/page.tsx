"use client";

import { useMemo, useState, useEffect } from "react";
import {
  HandCoins, ArrowDownCircle, ArrowUpCircle,
  Smartphone, Wallet, Send, Download,
  ClipboardCheck, Plus, X, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useCaisses, octroyerPret } from "@/lib/hooks";
import {
  useTransactions, useConfigFrais, creerTransaction, calculerFrais
} from "@/lib/hooks2";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { KpiCard } from "@/components/KpiCard";
import TransactionsResume from "@/components/TransactionsResume";
import { formatXOF, formatDate } from "@/lib/format";
import type { TypeTransaction } from "@/lib/database.types";

const TODAY = new Date().toISOString().slice(0, 10);

const OPERATEURS = [
  "ORANGE MONEY","MOOV MONEY","TELECEL","WIZALL","WAVE",
  "WARI","RIA","WESTERN UNION","UNITES","SIM",
];

const TX_TYPES: { type: TypeTransaction; label: string; desc: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { type: "DEPOT",         label: "Dépôt Mobile Money",   desc: "Client dépose du cash → reçoit de l'eMonnaie", icon: ArrowDownCircle, color: "text-leaf-600",  bgColor: "bg-leaf-100"  },
  { type: "RETRAIT",       label: "Retrait Mobile Money",  desc: "Client retire du cash de son compte mobile",   icon: ArrowUpCircle,   color: "text-clay-700", bgColor: "bg-clay-100"  },
  { type: "ENVOI",         label: "Envoi d'argent",        desc: "Transfert vers un autre numéro",               icon: Send,            color: "text-purple-600",bgColor: "bg-purple-100"},
  { type: "CREDIT",        label: "Octroyer un crédit",    desc: "Avancer des unités ou du cash à crédit",       icon: HandCoins,       color: "text-amber-700", bgColor: "bg-amber-100" },
  { type: "REMBOURSEMENT", label: "Remboursement crédit",  desc: "Encaisser le retour d'un crédit",              icon: Wallet,          color: "text-teal-600",  bgColor: "bg-teal-100"  },
  { type: "RECEPTION",     label: "Réception transfert",   desc: "Client reçoit un transfert entrant",           icon: Download,        color: "text-blue-600",  bgColor: "bg-blue-100"  },
];

export default function CaissePage() {
  const { userId } = useAuth();
  const { users, clients, prets, remboursements, caisses: caissesSeed } = useStore();
  const { data: caissesSupabase } = useCaisses();
  const { data: configFrais } = useConfigFrais();
  const user = users.find(u => u.id === userId);

  // Utiliser la caisse seed si Supabase pas encore configuré
  const maCaisse = caissesSupabase.find(c => c.assignee_id === userId)
    ?? caissesSeed.find(c => c.assigneeA === userId);

  const caisseId = maCaisse?.id ?? "c1";
  const solde = (maCaisse as any)?.solde ?? 0;

  const { data: txJour, loading: txLoading, refetch } = useTransactions(caisseId, TODAY);

  const [openTx, setOpenTx] = useState<TypeTransaction | null>(null);
  const [openCloture, setOpenCloture] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    operateur: "ORANGE MONEY",
    montant: "",
    fraisCalcules: 0,
    fraisManuel: "",
    useFraisManuel: false,
    telephone: "",
    nomClient: "",
    reference: "",
    clientId: clients[0]?.id ?? "",
    echeance: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  });

  // Recalculer frais auto quand opérateur ou montant changent
  useEffect(() => {
    if (!form.montant || !openTx) return;
    const frais = calculerFrais(configFrais, form.operateur, openTx, Number(form.montant));
    setForm(f => ({ ...f, fraisCalcules: frais }));
  }, [form.operateur, form.montant, openTx, configFrais]);

  const stats = useMemo(() => {
    const octroyeJ   = txJour.filter(t => t.type === "CREDIT").reduce((s,t) => s + t.montant, 0);
    const encaisseJ  = txJour.filter(t => t.type === "REMBOURSEMENT").reduce((s,t) => s + t.montant, 0);
    const volumeMM   = txJour.filter(t => ["DEPOT","RETRAIT","ENVOI","RECEPTION"].includes(t.type)).reduce((s,t) => s + t.montant, 0);
    const fraisJ     = txJour.reduce((s,t) => s + t.frais, 0);
    return { octroyeJ, encaisseJ, volumeMM, fraisJ };
  }, [txJour]);

  // Prêts actifs de cette caisse (pour remboursements)
  const pretsActifs = prets.filter(p => p.caisseId === caisseId && p.statut !== "rembourse").map(p => {
    const cl = clients.find(c => c.id === p.clientId);
    const reste = Math.max(0, p.montant - remboursements.filter(r => r.pretId === p.id).reduce((s,r) => s + r.montant, 0));
    return { ...p, clientNom: cl?.nom ?? p.clientId, reste };
  }).filter(p => p.reste > 0);

  async function submit() {
    if (!openTx || !form.montant) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const frais = form.useFraisManuel ? Number(form.fraisManuel) : form.fraisCalcules;
      const taux = Number(form.montant) > 0 ? (frais / Number(form.montant)) * 100 : 0;

      if (openTx === "CREDIT") {
        await octroyerPret({
          clientId: form.clientId,
          typeOperation: form.operateur,
          montant: Number(form.montant),
          caisseId,
          echeance: form.echeance,
          userId: userId ?? "u1",
        });
      } else {
        await creerTransaction({
          type: openTx,
          operateur: form.operateur,
          montant: Number(form.montant),
          frais,
          tauxApplique: taux,
          telephoneClient: form.telephone || undefined,
          nomClient: form.nomClient || undefined,
          reference: form.reference || undefined,
          caisseId,
          userId: userId ?? "u1",
        });
      }
      refetch();
      setOpenTx(null);
      setForm(f => ({ ...f, montant: "", telephone: "", nomClient: "", reference: "", fraisCalcules: 0, fraisManuel: "", useFraisManuel: false }));
    } catch (e: any) {
      setErrorMsg(e.message ?? "Erreur lors de la transaction");
    } finally {
      setSubmitting(false);
    }
  }

  const txDef = TX_TYPES.find(t => t.type === openTx);
  const fraisAffichees = form.useFraisManuel ? Number(form.fraisManuel || 0) : form.fraisCalcules;
  const montantNet = openTx && Number(form.montant) ? Number(form.montant) + (["DEPOT","REMBOURSEMENT","RECEPTION"].includes(openTx) ? fraisAffichees : -fraisAffichees) : 0;

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
        <KpiCard label="Solde caisse"       value={formatXOF(solde)}         icon={<Wallet size={18} />}       accent="leaf" />
        <KpiCard label="Frais encaissés"    value={formatXOF(stats.fraisJ)}  icon={<HandCoins size={18} />}   accent="gold" />
        <KpiCard label="Volume Mobile Money" value={formatXOF(stats.volumeMM)} icon={<Smartphone size={18} />} accent="ink" />
        <KpiCard label="Opérations du jour" value={String(txJour.length)}    icon={<ClipboardCheck size={18} />} accent="clay" />
      </div>

      {/* 6 types de transactions */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TX_TYPES.map(t => (
          <button key={t.type} onClick={() => setOpenTx(t.type)}
            className="group flex items-start gap-3 rounded-2xl border border-sand-200 bg-white/70 p-4 text-left shadow-card transition-all hover:border-clay/30 hover:shadow-lift">
            <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${t.bgColor} ${t.color} transition-transform group-hover:scale-105`}>
              <t.icon size={20} />
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
                      <Icon size={15} />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {tx.operateur} — {tx.type}
                        {tx.nom_client && <span className="text-ink-400"> · {tx.nom_client}</span>}
                      </div>
                      <div className="num text-[11px] text-ink-400">
                        {tx.telephone_client && `📱 ${tx.telephone_client} · `}Frais: {formatXOF(tx.frais)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`num text-sm font-semibold ${isEntree ? "text-leaf-600" : "text-clay-700"}`}>
                      {isEntree ? "+" : "−"}{formatXOF(tx.montant)}
                    </div>
                    {tx.frais > 0 && <div className="num text-[11px] text-gold">+{formatXOF(tx.frais)} F</div>}
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

      {/* Modal transaction */}
      <Modal open={!!openTx} onClose={() => { setOpenTx(null); setErrorMsg(null); }} title={txDef?.label ?? ""}>
        {txDef && (
          <>
            <Field label="Opérateur">
              <select className={inputCls} value={form.operateur} onChange={e => setForm(f => ({ ...f, operateur: e.target.value }))}>
                {OPERATEURS.map(op => <option key={op}>{op}</option>)}
              </select>
            </Field>

            {openTx === "CREDIT" && (
              <Field label="Commerçant">
                <select className={inputCls} value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.ville}</option>)}
                </select>
              </Field>
            )}

            {openTx !== "CREDIT" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom client">
                  <input className={inputCls} value={form.nomClient} onChange={e => setForm(f => ({ ...f, nomClient: e.target.value }))} placeholder="Optionnel" />
                </Field>
                <Field label="Téléphone">
                  <input className={inputCls + " num"} value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+226..." />
                </Field>
              </div>
            )}

            <Field label="Montant (XOF)">
              <input className={inputCls + " num"} type="number" value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="50000" />
            </Field>

            {openTx === "CREDIT" && (
              <Field label="Échéance">
                <input className={inputCls} type="date" value={form.echeance} onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))} />
              </Field>
            )}

            {/* Frais */}
            <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-700">Frais / commission</span>
                <button onClick={() => setForm(f => ({ ...f, useFraisManuel: !f.useFraisManuel }))}
                  className="text-[11px] text-clay hover:underline">
                  {form.useFraisManuel ? "Recalculer auto" : "Modifier manuellement"}
                </button>
              </div>
              {form.useFraisManuel ? (
                <input className={inputCls + " num mt-2"} type="number" value={form.fraisManuel}
                  onChange={e => setForm(f => ({ ...f, fraisManuel: e.target.value }))}
                  placeholder="Montant des frais" />
              ) : (
                <div className="num mt-1 text-xl font-semibold text-clay-700">
                  {formatXOF(form.fraisCalcules)}
                  <span className="ml-2 text-[12px] text-ink-400 font-normal">calculé automatiquement</span>
                </div>
              )}
              {form.montant && Number(form.montant) > 0 && (
                <div className="mt-2 text-[12px] text-ink-500">
                  Montant net pour la caisse : <span className="num font-medium text-ink">{formatXOF(Math.abs(montantNet))}</span>
                </div>
              )}
            </div>

            {openTx !== "CREDIT" && (
              <Field label="Référence / code (optionnel)">
                <input className={inputCls + " num"} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Numéro de transaction" />
              </Field>
            )}

            {errorMsg && <p className="rounded-xl bg-ember-100 px-3 py-2 text-[13px] text-ember-600">{errorMsg}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="ghost" onClick={() => { setOpenTx(null); setErrorMsg(null); }}>Annuler</Btn>
              <Btn onClick={submit} className={submitting ? "opacity-50 pointer-events-none" : ""}>
                {submitting ? "Traitement..." : "Valider la transaction"}
              </Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Modal clôture */}
      <Modal open={openCloture} onClose={() => setOpenCloture(false)} title="Clôture de journée">
        <div className="space-y-2.5 text-sm">
          {[
            { l: "Transactions Mobile Money", v: formatXOF(stats.volumeMM) },
            { l: "Crédits octroyés", v: "−" + formatXOF(stats.octroyeJ) },
            { l: "Remboursements reçus", v: "+" + formatXOF(stats.encaisseJ) },
            { l: "Frais & commissions", v: "+" + formatXOF(stats.fraisJ), c: "text-leaf-600" },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex justify-between">
              <span className="text-ink-500">{l}</span>
              <span className={`num font-medium ${c ?? "text-ink"}`}>{v}</span>
            </div>
          ))}
          <div className="my-2 border-t border-sand-200" />
          <div className="flex justify-between">
            <span className="font-medium text-ink">Solde théorique de clôture</span>
            <span className="num text-base font-semibold text-ink">{formatXOF(solde)}</span>
          </div>
        </div>
        <p className="mt-4 text-[12px] text-ink-400">Comparez avec l'argent physique en caisse. Signalez tout écart au DG.</p>
        <div className="mt-4 flex justify-end"><Btn onClick={() => setOpenCloture(false)}>Fermer</Btn></div>
      </Modal>
    </div>
  );
}
