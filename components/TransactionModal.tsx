"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Send, HandCoins, Wallet, Download,
  Search, X, CheckCircle, User, ChevronDown,
} from "lucide-react";
import { Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF } from "@/lib/format";
import { useClientSearch, type ClientLight } from "@/lib/hooks";
import { useOperateurs, type Operateur } from "@/lib/hooks-operateurs";
import { usePrets } from "@/lib/hooks";
import { enregistrerTransaction, type TypeTransaction } from "@/lib/hooks-transactions";

// ── Définitions des 6 types ──────────────────────────────────────────────────
export const TX_DEF = [
  { type: "DEPOT"         as TypeTransaction, label: "Dépôt Mobile",       short: "Dépôt",      desc: "Cash → eMonnaie",     icon: ArrowDownCircle, color: "text-leaf-600",   bg: "bg-leaf-50",   border: "border-leaf-300",  ring: "ring-leaf-400"   },
  { type: "RETRAIT"       as TypeTransaction, label: "Retrait Mobile",      short: "Retrait",    desc: "eMonnaie → Cash",     icon: ArrowUpCircle,   color: "text-clay-700",  bg: "bg-clay-50",  border: "border-clay-300",  ring: "ring-clay-400"   },
  { type: "ENVOI"         as TypeTransaction, label: "Envoi d'argent",      short: "Envoi",      desc: "Vers un numéro",      icon: Send,            color: "text-purple-600",bg: "bg-purple-50",border: "border-purple-300",ring: "ring-purple-400" },
  { type: "CREDIT"        as TypeTransaction, label: "Octroyer un crédit",  short: "Crédit",     desc: "Avance unités/cash",  icon: HandCoins,       color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", ring: "ring-amber-400"  },
  { type: "REMBOURSEMENT" as TypeTransaction, label: "Remboursement crédit",short: "Rembourst.", desc: "Retour de crédit",    icon: Wallet,          color: "text-teal-600",  bg: "bg-teal-50",  border: "border-teal-300",  ring: "ring-teal-400"   },
  { type: "RECEPTION"     as TypeTransaction, label: "Réception transfert", short: "Réception",  desc: "Transfert entrant",   icon: Download,        color: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-300",  ring: "ring-blue-400"   },
] as const;

// ── Mini recherche client (inline) ───────────────────────────────────────────
function ClientPicker({ label, value, onSelect, onClear, placeholder = "Nom ou téléphone…" }: {
  label: string;
  value: ClientLight | null;
  onSelect: (c: ClientLight) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value?.nom ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { results } = useClientSearch(q);

  useEffect(() => {
    if (value) setQ(value.nom);
  }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <Field label={label}>
      <div ref={ref} className="relative">
        {value ? (
          <div className="flex items-center justify-between rounded-xl border border-leaf-200 bg-leaf-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-leaf-200 text-[11px] font-bold text-leaf-700">
                {value.nom.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink">{value.nom}</div>
                {value.telephone && <div className="num text-[11px] text-ink-400">{value.telephone}</div>}
              </div>
            </div>
            <button onClick={onClear} className="p-1 text-ink-400 hover:text-ember-500"><X size={13}/></button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3 py-2">
              <Search size={14} className="shrink-0 text-ink-400"/>
              <input
                value={q}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-400"
              />
            </div>
            {open && results.length > 0 && (
              <div className="absolute z-50 w-full rounded-xl border border-sand-200 bg-white shadow-lg mt-1">
                {results.map(c => (
                  <button key={c.id} onMouseDown={() => { onSelect(c); setQ(c.nom); setOpen(false); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-sand-50 first:rounded-t-xl last:rounded-b-xl">
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{c.nom}</div>
                      {c.ville && <div className="text-[11px] text-ink-400">{c.ville}</div>}
                    </div>
                    {c.telephone && <span className="num text-[12px] text-ink-500">{c.telephone}</span>}
                  </button>
                ))}
              </div>
            )}
            {open && q.length >= 2 && results.length === 0 && (
              <div className="absolute z-50 w-full rounded-xl border border-sand-200 bg-white shadow-lg mt-1 px-4 py-3 text-[12px] text-ink-400">
                Aucun client trouvé. Saisissez le nom ci-dessous.
              </div>
            )}
          </>
        )}
      </div>
    </Field>
  );
}

// ── Props du modal principal ─────────────────────────────────────────────────
interface Props {
  open: boolean;
  initialType?: TypeTransaction;
  caisses: any[];
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransactionModal({ open, initialType = "DEPOT", caisses, userId, onClose, onSuccess }: Props) {
  const { data: operateurs } = useOperateurs();
  const [selType, setSelType] = useState<TypeTransaction>(initialType);
  useEffect(() => { if (open) setSelType(initialType); }, [open, initialType]);

  const def = TX_DEF.find(d => d.type === selType)!;
  const Icon = def.icon;

  // ── Caisse par défaut ──────────────────────────────────────────────────────
  const [caisseId, setCaisseId] = useState("");
  useEffect(() => {
    if (caisseId || caisses.length === 0) return;
    setCaisseId((caisses[0] as any)?.id ?? "");
  }, [caisses, caisseId]);

  // ── Client sélectionné ─────────────────────────────────────────────────────
  const [client, setClient] = useState<ClientLight | null>(null);
  const [beneficiaire, setBeneficiaire] = useState<ClientLight | null>(null);

  // Encours du client pour REMBOURSEMENT
  const { data: prets } = usePrets({ clientId: client?.id });
  const encours = prets.filter(p => p.statut !== "rembourse" && p.statut !== "annule")
    .reduce((s, p) => s + (p.reste_a_payer ?? 0), 0);

  // ── Formulaire ─────────────────────────────────────────────────────────────
  const EMPTY = {
    operateur: "", montant: "", frais: "", reference: "", note: "",
    telephone_mobile: "", telephone_dest: "", nom_dest: "", operateur_dest: "",
    type_credit: "unites_om", echeance: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    mode_paiement: "cash", expediteur_nom: "", expediteur_tel: "",
  };
  const [f, setF] = useState(EMPTY);
  const sf = (p: Partial<typeof EMPTY>) => setF(prev => ({ ...prev, ...p }));

  // Auto-reset quand type change
  useEffect(() => {
    setF(EMPTY); setClient(null); setBeneficiaire(null); setErr(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selType]);

  // Auto-remplissage depuis client sélectionné
  useEffect(() => {
    if (!client) return;
    sf({ telephone_mobile: client.telephone ?? "" });
  }, [client]);

  // Auto-remplissage bénéficiaire → RECEPTION
  useEffect(() => {
    if (!beneficiaire) return;
    sf({ telephone_dest: beneficiaire.telephone ?? "" });
  }, [beneficiaire]);

  // Commission auto
  useEffect(() => {
    if (!f.operateur || !f.montant) return;
    const op = operateurs.find(o => o.id === f.operateur);
    if (!op) return;
    const pct = op.commission_taux || 0;
    let auto = 0;
    if (selType === "RETRAIT" || selType === "ENVOI") auto = Math.round(Number(f.montant) * pct / 100);
    sf({ frais: String(auto) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.operateur, f.montant, selType]);

  // ── Soumission ─────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const m = Number(f.montant);
    if (!m || m <= 0) { setErr("Montant requis."); return; }
    if (selType === "CREDIT" && !client) { setErr("Sélectionnez un commerçant."); return; }
    if (selType === "RETRAIT" && !f.operateur) { setErr("Sélectionnez l'opérateur."); return; }
    if (selType === "ENVOI" && (!f.nom_dest && !f.telephone_dest)) { setErr("Renseignez le bénéficiaire."); return; }
    setBusy(true); setErr(null);
    try {
      await enregistrerTransaction({
        type: selType,
        operateur: f.operateur || undefined,
        montant: m,
        frais: Number(f.frais) || 0,
        nom_client: client?.nom || undefined,
        telephone_client: client?.telephone || f.telephone_mobile || undefined,
        client_id: client?.id || undefined,
        caisse_id: caisseId,
        user_id: userId,
        reference: f.reference || undefined,
        // Envoi
        telephone_dest: f.telephone_dest || undefined,
        nom_dest: f.nom_dest || undefined,
        operateur_dest: f.operateur_dest || undefined,
        // Crédit
        type_credit: f.type_credit || undefined,
        echeance: f.echeance || undefined,
        // Remboursement
        mode_paiement: f.mode_paiement || undefined,
        // Réception
        expediteur_nom: f.expediteur_nom || undefined,
        expediteur_tel: f.expediteur_tel || undefined,
      });
      onSuccess();
      onClose();
    } catch (e: any) { setErr(e?.message ?? "Erreur d'enregistrement."); }
    setBusy(false);
  }

  // ── Sélecteur d'opérateur (partagé) ───────────────────────────────────────
  function OpSelect({ label = "Opérateur", value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
    return (
      <Field label={label}>
        <select className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— Choisir —</option>
          {operateurs.filter(o => o.actif).map(o => (
            <option key={o.id} value={o.id}>{o.nom}</option>
          ))}
        </select>
      </Field>
    );
  }

  function MontantFrais({ fraisLabel = "Commission (XOF)" }: { fraisLabel?: string }) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant (XOF)">
          <input className={inputCls + " num"} type="number" placeholder="0" value={f.montant} onChange={e => sf({ montant: e.target.value })} autoFocus />
        </Field>
        <Field label={fraisLabel}>
          <input className={inputCls + " num"} type="number" placeholder="auto" value={f.frais} onChange={e => sf({ frais: e.target.value })} />
        </Field>
      </div>
    );
  }

  function CaisseRef() {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Caisse">
          <select className={inputCls} value={caisseId} onChange={e => setCaisseId(e.target.value)}>
            <option value="">— Choisir —</option>
            {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Référence">
          <input className={inputCls} value={f.reference} onChange={e => sf({ reference: e.target.value })} placeholder="optionnel" />
        </Field>
      </div>
    );
  }

  // ── Formulaires distincts ─────────────────────────────────────────────────
  const forms: Record<TypeTransaction, JSX.Element> = {

    // ──────────────────────────────────────────────────────────────── DÉPÔT
    DEPOT: (
      <div className="space-y-3">
        <ClientPicker label="Client / Commerçant" value={client} onSelect={setClient} onClear={() => { setClient(null); sf({ telephone_mobile: "" }); }} placeholder="Qui dépose ?" />
        <div className="grid grid-cols-2 gap-3">
          <OpSelect value={f.operateur} onChange={v => sf({ operateur: v })} />
          <Field label="N° compte mobile money">
            <input className={inputCls + " num"} value={f.telephone_mobile} onChange={e => sf({ telephone_mobile: e.target.value })} placeholder="Ex: 226 70 xx xx xx" />
          </Field>
        </div>
        <MontantFrais fraisLabel="Commission agent (XOF)" />
        <CaisseRef />
        <p className="text-[11px] text-ink-400 italic">💡 Dépôt = gratuit pour le client. La commission est encaissée par l'agent auprès d'Orange Money.</p>
      </div>
    ),

    // ─────────────────────────────────────────────────────────────── RETRAIT
    RETRAIT: (
      <div className="space-y-3">
        <ClientPicker label="Client / Commerçant" value={client} onSelect={setClient} onClear={() => { setClient(null); sf({ telephone_mobile: "" }); }} placeholder="Qui retire ?" />
        <div className="grid grid-cols-2 gap-3">
          <OpSelect value={f.operateur} onChange={v => sf({ operateur: v })} />
          <Field label="N° compte mobile money">
            <input className={inputCls + " num"} value={f.telephone_mobile} onChange={e => sf({ telephone_mobile: e.target.value })} placeholder="N° du compte" />
          </Field>
        </div>
        <MontantFrais fraisLabel="Frais retrait (XOF) — auto" />
        <CaisseRef />
        <p className="text-[11px] text-ink-400 italic">💡 Les frais sont déduits du montant et payés par le client selon le barème opérateur.</p>
      </div>
    ),

    // ──────────────────────────────────────────────────────────────── ENVOI
    ENVOI: (
      <div className="space-y-3">
        <ClientPicker label="Expéditeur" value={client} onSelect={setClient} onClear={() => setClient(null)} placeholder="Qui envoie ?" />
        <div className="grid grid-cols-2 gap-3">
          <OpSelect label="Réseau expéditeur" value={f.operateur} onChange={v => sf({ operateur: v })} />
          <Field label="Réseau bénéficiaire">
            <select className={inputCls} value={f.operateur_dest} onChange={e => sf({ operateur_dest: e.target.value })}>
              <option value="">Même réseau</option>
              {operateurs.filter(o => o.actif && o.id !== f.operateur).map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </Field>
        </div>
        <div className="rounded-xl border border-sand-200 p-3 space-y-2">
          <p className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide">Bénéficiaire</p>
          <ClientPicker label="Chercher dans les clients" value={beneficiaire} onSelect={c => { setBeneficiaire(c); sf({ nom_dest: c.nom, telephone_dest: c.telephone ?? "" }); }} onClear={() => { setBeneficiaire(null); sf({ nom_dest: "", telephone_dest: "" }); }} placeholder="Ou saisir manuellement ci-dessous" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom bénéficiaire">
              <input className={inputCls} value={f.nom_dest} onChange={e => sf({ nom_dest: e.target.value })} placeholder="Nom complet" />
            </Field>
            <Field label="Téléphone bénéficiaire">
              <input className={inputCls + " num"} value={f.telephone_dest} onChange={e => sf({ telephone_dest: e.target.value })} placeholder="N° mobile" />
            </Field>
          </div>
        </div>
        <MontantFrais fraisLabel="Frais d'envoi (XOF)" />
        <CaisseRef />
      </div>
    ),

    // ─────────────────────────────────────────────────────────────── CRÉDIT
    CREDIT: (
      <div className="space-y-3">
        <ClientPicker label="Commerçant bénéficiaire ★" value={client} onSelect={setClient} onClear={() => setClient(null)} placeholder="Chercher le commerçant…" />
        {client && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[12px]">
            <span className="text-amber-600">📊</span>
            <div>
              <span className="font-semibold text-amber-800">Encours actuel :</span>
              <span className="num ml-2 font-bold text-amber-700">{formatXOF(encours)}</span>
              {client.plafond && <span className="ml-2 text-amber-600">· plafond {formatXOF(client.plafond)}</span>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type de crédit">
            <select className={inputCls} value={f.type_credit} onChange={e => sf({ type_credit: e.target.value })}>
              <option value="unites_om">Unités Orange Money</option>
              <option value="unites_moov">Unités Moov Money</option>
              <option value="airtime">Crédit téléphonique</option>
              <option value="cash">Avance en espèces</option>
              <option value="marchandise">Marchandise à crédit</option>
            </select>
          </Field>
          <OpSelect label="Opérateur concerné" value={f.operateur} onChange={v => sf({ operateur: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant octroyé (XOF)">
            <input className={inputCls + " num"} type="number" placeholder="0" value={f.montant} onChange={e => sf({ montant: e.target.value })} autoFocus />
          </Field>
          <Field label="Date d'échéance ★">
            <input className={inputCls} type="date" value={f.echeance} onChange={e => sf({ echeance: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caisse source">
            <select className={inputCls} value={caisseId} onChange={e => setCaisseId(e.target.value)}>
              <option value="">— Choisir —</option>
              {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Note / Référence">
            <input className={inputCls} value={f.reference} onChange={e => sf({ reference: e.target.value })} />
          </Field>
        </div>
      </div>
    ),

    // ────────────────────────────────────────────────────────── REMBOURSEMENT
    REMBOURSEMENT: (
      <div className="space-y-3">
        <ClientPicker label="Commerçant qui rembourse ★" value={client} onSelect={setClient} onClear={() => setClient(null)} placeholder="Chercher le commerçant…" />
        {client && encours > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-teal-50 border border-teal-200 px-4 py-2.5 text-[12px]">
            <span className="font-semibold text-teal-800">Encours à rembourser :</span>
            <span className="num font-bold text-teal-700">{formatXOF(encours)}</span>
          </div>
        )}
        <Field label="Montant remboursé (XOF)">
          <input className={inputCls + " num"} type="number" placeholder="0" value={f.montant}
            onChange={e => sf({ montant: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode de paiement">
            <select className={inputCls} value={f.mode_paiement} onChange={e => sf({ mode_paiement: e.target.value })}>
              <option value="cash">Espèces (cash)</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="virement">Virement bancaire</option>
              <option value="cheque">Chèque</option>
            </select>
          </Field>
          {f.mode_paiement === "mobile_money" ? (
            <OpSelect label="Opérateur Mobile Money" value={f.operateur} onChange={v => sf({ operateur: v })} />
          ) : (
            <Field label="Référence paiement">
              <input className={inputCls} value={f.reference} onChange={e => sf({ reference: e.target.value })} placeholder="N° reçu, référence…" />
            </Field>
          )}
        </div>
        <Field label="Caisse destination">
          <select className={inputCls} value={caisseId} onChange={e => setCaisseId(e.target.value)}>
            <option value="">— Choisir —</option>
            {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
      </div>
    ),

    // ────────────────────────────────────────────────────────────── RÉCEPTION
    RECEPTION: (
      <div className="space-y-3">
        <ClientPicker label="Bénéficiaire (qui reçoit)" value={client} onSelect={setClient} onClear={() => { setClient(null); sf({ telephone_mobile: "" }); }} placeholder="Chercher dans les clients…" />
        <div className="grid grid-cols-2 gap-3">
          <OpSelect label="Réseau de réception" value={f.operateur} onChange={v => sf({ operateur: v })} />
          <Field label="N° mobile du bénéficiaire">
            <input className={inputCls + " num"} value={f.telephone_mobile} onChange={e => sf({ telephone_mobile: e.target.value })} placeholder="N° compte" />
          </Field>
        </div>
        <div className="rounded-xl border border-sand-200 p-3 space-y-2">
          <p className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide">Expéditeur</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom de l'expéditeur">
              <input className={inputCls} value={f.expediteur_nom} onChange={e => sf({ expediteur_nom: e.target.value })} placeholder="Nom complet" />
            </Field>
            <Field label="Téléphone expéditeur">
              <input className={inputCls + " num"} value={f.expediteur_tel} onChange={e => sf({ expediteur_tel: e.target.value })} placeholder="N° mobile" />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant reçu (XOF)">
            <input className={inputCls + " num"} type="number" placeholder="0" value={f.montant} onChange={e => sf({ montant: e.target.value })} autoFocus />
          </Field>
          <Field label="Code de retrait / Réf.">
            <input className={inputCls} value={f.reference} onChange={e => sf({ reference: e.target.value })} placeholder="Code de retrait" />
          </Field>
        </div>
        <Field label="Caisse">
          <select className={inputCls} value={caisseId} onChange={e => setCaisseId(e.target.value)}>
            <option value="">— Choisir —</option>
            {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <p className="text-[11px] text-ink-400 italic">💡 La réception de transfert est généralement gratuite pour le bénéficiaire.</p>
      </div>
    ),
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={onClose} title={def.label}>
      {/* Sélecteur de type */}
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {TX_DEF.map(d => {
          const DIcon = d.icon;
          const active = selType === d.type;
          return (
            <button key={d.type} onClick={() => setSelType(d.type)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-center transition-all
                ${active ? `${d.bg} ${d.border} ${d.color} font-bold` : "border-sand-200 text-ink-400 hover:bg-sand-50"}`}>
              <DIcon size={17} className={active ? d.color : "text-ink-400"} />
              <span className="text-[11px] leading-tight">{d.short}</span>
            </button>
          );
        })}
      </div>

      {/* Bandeau couleur type sélectionné */}
      <div className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 ${def.bg} ${def.border}`}>
        <Icon size={16} className={def.color} />
        <div>
          <span className={`text-[13px] font-semibold ${def.color}`}>{def.label}</span>
          <span className="ml-2 text-[12px] text-ink-500">{def.desc}</span>
        </div>
      </div>

      {/* Formulaire spécifique au type */}
      {forms[selType]}

      {/* Erreur + boutons */}
      {err && <p className="mt-3 rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-sand-200 px-4 py-2 text-[13px] font-medium text-ink-500 hover:bg-sand-100">
          Annuler
        </button>
        <button onClick={submit} disabled={busy}
          className={`flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold text-white transition-opacity
            ${busy ? "opacity-50" : ""} ${def.bg.replace("50", "600").replace("bg-", "bg-")} ${def.color.replace("text-", "bg-").replace("-600","-600").replace("-700","-600")}`}
          style={{ backgroundColor: busy ? undefined : def.type === "DEPOT" ? "#16a34a"
            : def.type === "RETRAIT" ? "#b45309"
            : def.type === "ENVOI" ? "#9333ea"
            : def.type === "CREDIT" ? "#d97706"
            : def.type === "REMBOURSEMENT" ? "#0d9488"
            : "#2563eb" }}>
          <Icon size={14} className="text-white" />
          {busy ? "Enregistrement…" : `Confirmer ${def.short}`}
        </button>
      </div>
    </Modal>
  );
}
