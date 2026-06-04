"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight, Plus, Search,
  ArrowDownCircle, ArrowUpCircle, Send, HandCoins, Wallet, Download,
} from "lucide-react";
import { useTransactions, enregistrerTransaction, resumeJour, TYPES_TRANSACTION, labelType, type TypeTransaction } from "@/lib/hooks-transactions";
import { useOperateurs } from "@/lib/hooks-operateurs";
import { useCaisses } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

// ── 6 boutons d'action rapide ────────────────────────────────────────────────
const TX_ACTIONS: {
  type: TypeTransaction; label: string; desc: string;
  icon: React.ElementType; color: string; bg: string; border: string;
}[] = [
  { type: "DEPOT",         label: "Dépôt Mobile Money",   desc: "Client dépose du cash → reçoit de l'eMonnaie",   icon: ArrowDownCircle, color: "text-leaf-600",   bg: "bg-leaf-50",    border: "border-leaf-200"  },
  { type: "RETRAIT",       label: "Retrait Mobile Money",  desc: "Client retire du cash de son compte mobile",      icon: ArrowUpCircle,   color: "text-clay-700",  bg: "bg-clay-50",    border: "border-clay-200"  },
  { type: "ENVOI",         label: "Envoi d'argent",        desc: "Transfert vers un autre numéro",                  icon: Send,            color: "text-purple-600",bg: "bg-purple-50",  border: "border-purple-200"},
  { type: "CREDIT",        label: "Octroyer un crédit",    desc: "Avancer des unités ou du cash à crédit",          icon: HandCoins,       color: "text-amber-700", bg: "bg-amber-50",   border: "border-amber-200" },
  { type: "REMBOURSEMENT", label: "Remboursement crédit",  desc: "Encaisser le retour d'un crédit",                 icon: Wallet,          color: "text-teal-600",  bg: "bg-teal-50",    border: "border-teal-200"  },
  { type: "RECEPTION",     label: "Réception transfert",   desc: "Client reçoit un transfert entrant",              icon: Download,        color: "text-blue-600",  bg: "bg-blue-50",    border: "border-blue-200"  },
];

const TYPE_BADGE: Record<string, string> = {
  DEPOT: "bg-leaf-100 text-leaf-600", RETRAIT: "bg-clay/15 text-clay-700", ENVOI: "bg-blue-100 text-blue-700",
  RECEPTION: "bg-gold/20 text-gold-700", CREDIT: "bg-sand-200 text-ink-600", REMBOURSEMENT: "bg-leaf-100 text-leaf-600",
};

export default function TransactionsPage() {
  const [type, setType] = useState("tous");
  const [operateur, setOperateur] = useState("tous");
  const { data: transactions, refetch } = useTransactions({ type, operateur });
  const { data: operateurs } = useOperateurs();
  const { data: caisses } = useCaisses();
  const [q, setQ] = useState("");

  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const resume = useMemo(() => resumeJour(transactions), [transactions]);
  const opNom = (code: string | null) => operateurs.find(o => o.id === code)?.nom ?? code ?? "—";
  const caisseNom = (id: string | null) => caisses.find((c: any) => c.id === id)?.nom ?? "—";

  const rows = useMemo(() => transactions.filter(t =>
    (t.nom_client ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (t.telephone_client ?? "").includes(q) ||
    (t.reference ?? "").toLowerCase().includes(q.toLowerCase())
  ), [transactions, q]);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "DEPOT" as TypeTransaction, operateur: "", montant: "", frais: "",
    nom_client: "", telephone_client: "", reference: "", caisse_id: "",
  });

  // Ouvrir le modal avec un type pré-sélectionné
  function openWithType(t: TypeTransaction) {
    setErr(null);
    setForm(f => ({ ...f, type: t }));
    setOpen(true);
  }

  // Caisse par défaut
  useEffect(() => {
    if (!open) return;
    const maCaisse = caisses.find((c: any) => c.assignee_id === userId);
    setForm(f => ({ ...f, caisse_id: f.caisse_id || (maCaisse as any)?.id || (caisses[0] as any)?.id || "" }));
  }, [open, caisses, userId]);

  // Commission auto selon l'opérateur
  function onMontantOrOp(next: Partial<typeof form>) {
    setForm(f => {
      const merged = { ...f, ...next };
      const op = operateurs.find(o => o.id === merged.operateur);
      if (op && merged.montant && (!merged.frais || next.montant !== undefined || next.operateur !== undefined)) {
        merged.frais = String(Math.round((Number(merged.montant) || 0) * (op.commission_taux || 0) / 100));
      }
      return merged;
    });
  }

  async function submit() {
    const montant = Number(form.montant);
    if (!montant || montant <= 0) { setErr("Montant invalide."); return; }
    if (!form.caisse_id) { setErr("Choisissez une caisse."); return; }
    setBusy(true); setErr(null);
    try {
      const op = operateurs.find(o => o.id === form.operateur);
      await enregistrerTransaction({
        type: form.type, operateur: form.operateur || undefined, montant,
        frais: Number(form.frais) || 0, taux_applique: op?.commission_taux,
        nom_client: form.nom_client || undefined, telephone_client: form.telephone_client || undefined,
        reference: form.reference || undefined, caisse_id: form.caisse_id, user_id: userId,
      });
      setOpen(false);
      setForm({ type: "DEPOT", operateur: "", montant: "", frais: "", nom_client: "", telephone_client: "", reference: "", caisse_id: "" });
      refetch();
    } catch (e: any) { setErr(e?.message ?? "Erreur lors de l'enregistrement."); }
    setBusy(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Transactions"
        subtitle="Dépôts, retraits, transferts et crédits"
        action={
          <Btn variant="ghost" onClick={() => { setErr(null); setOpen(true); }}>
            <Plus size={15} /> Autre
          </Btn>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { l: "Transactions aujourd'hui", v: String(resume.nombre) },
          { l: "Volume du jour",           v: formatXOF(resume.volume) },
          { l: "Commissions du jour",      v: formatXOF(resume.commissions), accent: true },
        ].map((s, i) => (
          <Card key={i} className="p-4">
            <div className="text-[12px] text-ink-400">{s.l}</div>
            <div className={`num mt-1 text-lg font-bold ${s.accent ? "text-leaf-600" : "text-ink"}`}>{s.v}</div>
          </Card>
        ))}
      </div>

      {/* ── 6 boutons d'action rapide ─────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TX_ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.type}
              onClick={() => openWithType(a.type)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all tap
                hover:shadow-md active:scale-[0.98] ${a.bg} ${a.border}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ${a.color}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold leading-tight ${a.color}`}>{a.label}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-ink-500 line-clamp-2">{a.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtres + recherche */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
          <Search size={17} className="text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Rechercher client, téléphone, référence…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
        </div>
        <select className={inputCls + " w-auto"} value={type} onChange={e => setType(e.target.value)}>
          <option value="tous">Tous les types</option>
          {TYPES_TRANSACTION.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={operateur} onChange={e => setOperateur(e.target.value)}>
          <option value="tous">Tous opérateurs</option>
          {operateurs.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      {/* Tableau */}
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
                <th className="px-4 py-3 font-medium">Caisse</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                  <td className="px-4 py-3 text-ink-500 text-[13px]">{formatDate(t.date_transaction ?? t.created_at)}</td>
                  <td className="px-4 py-3"><Badge className={TYPE_BADGE[t.type] ?? "bg-sand-200 text-ink-600"}>{labelType(t.type)}</Badge></td>
                  <td className="px-4 py-3 text-ink-700">{opNom(t.operateur)}</td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-ink">{t.nom_client ?? "—"}</div>
                    {t.telephone_client && <div className="num text-[11px] text-ink-400">{t.telephone_client}</div>}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold text-ink">{formatXOF(t.montant)}</td>
                  <td className="num px-4 py-3 text-right text-leaf-600">{t.frais ? formatXOF(t.frais) : "—"}</td>
                  <td className="px-4 py-3 text-ink-500 text-[13px]">{caisseNom(t.caisse_id)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">Aucune transaction. Utilisez les boutons ci-dessus pour en enregistrer une.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal nouvelle transaction */}
      <Modal open={open} onClose={() => setOpen(false)} title={
        TX_ACTIONS.find(a => a.type === form.type)?.label ?? "Nouvelle transaction"
      }>
        {/* Sélecteur de type visuel dans le modal */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {TX_ACTIONS.map(a => {
            const Icon = a.icon;
            const sel = form.type === a.type;
            return (
              <button key={a.type} onClick={() => setForm(f => ({ ...f, type: a.type }))}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-medium transition-all
                  ${sel ? `${a.bg} ${a.border} ${a.color} ring-2 ring-current/20` : "border-sand-200 text-ink-400 hover:bg-sand-50"}`}>
                <Icon size={16} />
                <span className="text-center leading-tight">{a.label.split(" ").slice(0, 2).join(" ")}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Opérateur">
            <select className={inputCls} value={form.operateur} onChange={e => onMontantOrOp({ operateur: e.target.value })}>
              <option value="">— Aucun —</option>
              {operateurs.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </Field>
          <Field label="Caisse">
            <select className={inputCls} value={form.caisse_id} onChange={e => setForm(f => ({ ...f, caisse_id: e.target.value }))}>
              <option value="">— Choisir —</option>
              {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (XOF)">
            <input className={inputCls + " num"} type="number" value={form.montant}
              onChange={e => onMontantOrOp({ montant: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Commission (XOF)">
            <input className={inputCls + " num"} type="number" value={form.frais}
              onChange={e => setForm(f => ({ ...f, frais: e.target.value }))} placeholder="auto" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom client"><input className={inputCls} value={form.nom_client} onChange={e => setForm(f => ({ ...f, nom_client: e.target.value }))} /></Field>
          <Field label="Téléphone"><input className={inputCls + " num"} value={form.telephone_client} onChange={e => setForm(f => ({ ...f, telephone_client: e.target.value }))} /></Field>
        </div>
        <Field label="Référence (optionnel)">
          <input className={inputCls} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
        </Field>
        <p className="text-[11px] text-ink-400">La caisse et la flotte opérateur sont mises à jour automatiquement.</p>
        {err && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{err}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpen(false)}>Annuler</Btn>
          <Btn onClick={submit} className={busy ? "opacity-50" : ""}>{busy ? "Enregistrement…" : "Enregistrer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
