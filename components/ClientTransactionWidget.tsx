"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, ArrowDownCircle, ArrowUpCircle, Send, HandCoins,
  Wallet, Download, X, CheckCircle, User, ChevronRight,
} from "lucide-react";
import { useClientSearch, useHistoriqueClientTx, type ClientLight } from "@/lib/hooks";
import { useOperateurs } from "@/lib/hooks-operateurs";
import { useCaisses } from "@/lib/hooks";
import { enregistrerTransaction, labelType, type TypeTransaction } from "@/lib/hooks-transactions";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { Card, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

// ── Types d'opération ─────────────────────────────────────────────────────────
const ACTIONS: {
  type: TypeTransaction; label: string; desc: string;
  icon: React.ElementType; color: string; bg: string; ring: string;
}[] = [
  { type: "DEPOT",         label: "Dépôt",        desc: "Cash → eMonnaie", icon: ArrowDownCircle, color: "text-leaf-600",   bg: "bg-leaf-50",    ring: "ring-leaf-400"   },
  { type: "RETRAIT",       label: "Retrait",       desc: "eMonnaie → Cash", icon: ArrowUpCircle,   color: "text-clay-700",  bg: "bg-clay-50",    ring: "ring-clay-400"   },
  { type: "ENVOI",         label: "Envoi",         desc: "Vers un numéro",  icon: Send,            color: "text-purple-600",bg: "bg-purple-50",  ring: "ring-purple-400" },
  { type: "RECEPTION",     label: "Réception",     desc: "Transfert entrant",icon: Download,       color: "text-blue-600",  bg: "bg-blue-50",    ring: "ring-blue-400"   },
  { type: "CREDIT",        label: "Crédit",        desc: "Avance unités",   icon: HandCoins,       color: "text-amber-700", bg: "bg-amber-50",   ring: "ring-amber-400"  },
  { type: "REMBOURSEMENT", label: "Remboursement", desc: "Retour crédit",   icon: Wallet,          color: "text-teal-600",  bg: "bg-teal-50",    ring: "ring-teal-400"   },
];

const TX_BADGE: Record<string, string> = {
  DEPOT:"bg-leaf-100 text-leaf-600", RETRAIT:"bg-clay/15 text-clay-700",
  ENVOI:"bg-purple-100 text-purple-600", RECEPTION:"bg-blue-100 text-blue-600",
  CREDIT:"bg-amber-100 text-amber-700", REMBOURSEMENT:"bg-teal-100 text-teal-600",
};

export default function ClientTransactionWidget() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  // ── Données ────────────────────────────────────────────────────────────────
  const { data: operateurs } = useOperateurs();
  const { data: caisses } = useCaisses();

  // ── Recherche client ───────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [client, setClient] = useState<ClientLight | null>(null);
  const { results, loading: searching } = useClientSearch(query);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fermer dropdown au clic extérieur
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function selectClient(c: ClientLight) {
    setClient(c);
    setQuery(c.nom);
    setShowDrop(false);
    // Pré-remplir le téléphone
    setForm(f => ({ ...f, telephone: c.telephone ?? "", nom: c.nom }));
  }

  function clearClient() {
    setClient(null); setQuery(""); setForm(f => ({ ...f, telephone: "", nom: "" }));
  }

  // ── Historique du client sélectionné ──────────────────────────────────────
  const { data: historique, refetch: rfHisto } = useHistoriqueClientTx(client?.id ?? null, 4);

  // ── Sélection du type d'opération ─────────────────────────────────────────
  const [selType, setSelType] = useState<TypeTransaction | null>(null);

  // ── Formulaire ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    montant: "", operateur: "", frais: "", reference: "",
    telephone: "", nom: "",
  });

  // Auto-caisse par défaut
  const [caisseId, setCaisseId] = useState("");
  useEffect(() => {
    if (caisseId) return;
    const def = caisses.find((c: any) => c.assignee_id === userId) ?? caisses[0];
    if (def) setCaisseId((def as any).id);
  }, [caisses, userId, caisseId]);

  // Commission auto
  useEffect(() => {
    if (!form.operateur || !form.montant) return;
    const op = operateurs.find(o => o.id === form.operateur);
    if (op) setForm(f => ({ ...f, frais: String(Math.round(Number(f.montant) * (op.commission_taux || 0) / 100)) }));
  }, [form.operateur, form.montant, operateurs]);

  // ── Soumission ─────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit() {
    if (!selType) return;
    const montant = Number(form.montant);
    if (!montant || montant <= 0) { setErrMsg("Montant invalide."); return; }
    if (!caisseId) { setErrMsg("Aucune caisse disponible."); return; }
    setBusy(true); setErrMsg(null);
    try {
      await enregistrerTransaction({
        type: selType,
        operateur: form.operateur || undefined,
        montant,
        frais: Number(form.frais) || 0,
        nom_client: form.nom || client?.nom || undefined,
        telephone_client: form.telephone || client?.telephone || undefined,
        reference: form.reference || undefined,
        caisse_id: caisseId,
        user_id: userId,
        client_id: client?.id || undefined,
      });
      setSuccess(`${ACTIONS.find(a=>a.type===selType)?.label} de ${formatXOF(montant)} enregistré ✓`);
      setSelType(null);
      setForm(f => ({ ...f, montant: "", frais: "", reference: "" }));
      rfHisto();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setErrMsg(e?.message ?? "Erreur."); }
    setBusy(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card className="overflow-hidden flex flex-col">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-sand-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-clay-100">
            <User size={14} className="text-clay-700" />
          </div>
          <h3 className="display text-[14px] font-bold text-ink">Opération client</h3>
        </div>
        {client && (
          <button onClick={clearClient} className="text-[11px] text-ink-400 hover:text-ember-500 flex items-center gap-1">
            <X size={12}/> Effacer
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-3">
        {/* Flash de succès */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-leaf-50 border border-leaf-200 px-3 py-2.5 text-[13px] font-medium text-leaf-700">
            <CheckCircle size={14}/> {success}
          </div>
        )}

        {/* ── Recherche client ──────────────────────────────────────────── */}
        <div ref={searchRef} className="relative">
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors
            ${showDrop && results.length > 0 ? "border-clay rounded-b-none" : "border-sand-200 bg-white/70"}`}>
            <Search size={15} className="shrink-0 text-ink-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDrop(true); if (!e.target.value) clearClient(); }}
              onFocus={() => setShowDrop(true)}
              placeholder="Chercher client par nom ou téléphone…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-400"
            />
            {searching && <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-clay border-t-transparent"/>}
            {client && <CheckCircle size={14} className="shrink-0 text-leaf-500"/>}
          </div>

          {/* Dropdown résultats */}
          {showDrop && results.length > 0 && (
            <div className="absolute z-50 w-full rounded-b-xl border border-t-0 border-clay bg-white shadow-lg">
              {results.map(c => (
                <button key={c.id} onMouseDown={() => selectClient(c)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-sand-50">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{c.nom}</div>
                    {c.ville && <div className="text-[11px] text-ink-400">{c.ville}</div>}
                  </div>
                  {c.telephone && <span className="num text-[12px] text-ink-500">{c.telephone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fiche client sélectionné */}
        {client && (
          <div className="flex items-center gap-3 rounded-xl bg-clay-50 border border-clay-100 px-4 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay-200 text-[13px] font-bold text-clay-700">
              {client.nom.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink truncate">{client.nom}</div>
              <div className="text-[11px] text-ink-500">{client.telephone ?? "—"} · {client.ville ?? "—"}</div>
            </div>
            {client.plafond && (
              <div className="text-right shrink-0">
                <div className="text-[10px] text-ink-400">Plafond</div>
                <div className="num text-[12px] font-semibold text-ink">{formatXOF(client.plafond)}</div>
              </div>
            )}
          </div>
        )}

        {/* ── 6 boutons d'action ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-1.5">
          {ACTIONS.map(a => {
            const Icon = a.icon;
            const active = selType === a.type;
            return (
              <button key={a.type} onClick={() => setSelType(active ? null : a.type)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-center transition-all tap
                  ${active
                    ? `${a.bg} border-current ${a.color} ring-2 ${a.ring} ring-opacity-30`
                    : "border-sand-200 bg-white/70 hover:bg-sand-50"
                  }`}>
                <Icon size={18} className={active ? a.color : "text-ink-400"} />
                <span className={`text-[11px] font-semibold leading-tight ${active ? a.color : "text-ink-500"}`}>{a.label}</span>
                <span className="text-[9px] text-ink-400 leading-tight">{a.desc}</span>
              </button>
            );
          })}
        </div>

        {/* ── Formulaire (visible si type sélectionné) ──────────────────── */}
        {selType && (
          <div className="space-y-3 rounded-xl border border-sand-200 bg-sand-50/60 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Montant (XOF)">
                <input className={inputCls + " num"} type="number" placeholder="0"
                  value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} autoFocus/>
              </Field>
              <Field label="Opérateur">
                <select className={inputCls} value={form.operateur}
                  onChange={e => setForm(f => ({ ...f, operateur: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {operateurs.filter(o => o.actif).map(o => (
                    <option key={o.id} value={o.id}>{o.nom}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Commission (XOF)">
                <input className={inputCls + " num"} type="number" placeholder="auto"
                  value={form.frais} onChange={e => setForm(f => ({ ...f, frais: e.target.value }))} />
              </Field>
              <Field label="Référence">
                <input className={inputCls} value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </Field>
            </div>
            {!client && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nom client">
                  <input className={inputCls} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </Field>
                <Field label="Téléphone">
                  <input className={inputCls + " num"} value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </Field>
              </div>
            )}
            {errMsg && <p className="rounded-lg bg-ember-50 px-3 py-1.5 text-[12px] text-ember-600">{errMsg}</p>}
            <button onClick={submit} disabled={busy || !form.montant}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold text-white tap transition-opacity
                ${busy || !form.montant ? "opacity-40 cursor-not-allowed" : ""}
                ${ACTIONS.find(a=>a.type===selType)?.bg ?? "bg-clay"}`}
              style={{ backgroundColor: busy || !form.montant ? undefined : undefined }}
            >
              {(() => { const a = ACTIONS.find(x=>x.type===selType)!; const Icon = a.icon;
                return <><Icon size={15} className="text-white"/><span className="text-white">{busy ? "Enregistrement…" : `Confirmer ${a.label}`}</span></>;
              })()}
            </button>
          </div>
        )}

        {/* ── Historique du client sélectionné ─────────────────────────── */}
        {client && historique.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Historique</h4>
            </div>
            <div className="space-y-1 max-h-32 overflow-auto">
              {historique.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge className={TX_BADGE[t.type] ?? "bg-sand-200 text-ink-500"}>{labelType(t.type)}</Badge>
                    <span className="text-[11px] text-ink-400">{formatDate(t.date_transaction?.slice(0,10) ?? t.created_at?.slice(0,10))}</span>
                  </div>
                  <span className="num text-[12px] font-semibold text-ink">{formatXOF(t.montant)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selType && !client && (
          <p className="text-center text-[12px] text-ink-400">
            Cherchez un client ou choisissez directement une opération ci-dessus.
          </p>
        )}
      </div>
    </Card>
  );
}
