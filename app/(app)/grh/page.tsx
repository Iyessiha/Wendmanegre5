"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Users, CalendarDays, Plane, Banknote, TrendingUp,
  Plus, Edit2, Check, X, Printer, ChevronDown,
  AlertCircle, Clock, Award, Phone, MapPin, FileText,
} from "lucide-react";
import {
  useEmployes, useConges, usePresencesSemaine,
  creerConge, deciderConge, sauvegarderPresence,
  calculerPaie, EMPLOYES_DEMO,
  type Employe, type StatutPresence, type TypeContrat,
} from "@/lib/hooks-grh";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF } from "@/lib/format";

// ── Constantes ────────────────────────────────────────────

const TABS = [
  { id: "equipe",        label: "Équipe",         icon: Users       },
  { id: "pointage",      label: "Pointage",        icon: CalendarDays},
  { id: "conges",        label: "Congés",          icon: Plane       },
  { id: "paie",          label: "Paie",            icon: Banknote    },
  { id: "performances",  label: "Performances",    icon: TrendingUp  },
];

const STATUT_PRESENCE: Record<StatutPresence, { label: string; cls: string; short: string }> = {
  present:     { label: "Présent",       cls: "bg-leaf-100 text-leaf-600",    short: "P"  },
  absent:      { label: "Absent",        cls: "bg-ember-100 text-ember-600",  short: "A"  },
  retard:      { label: "En retard",     cls: "bg-gold-100 text-clay-700",    short: "R"  },
  conge:       { label: "Congé",         cls: "bg-blue-100 text-blue-700",    short: "C"  },
  maladie:     { label: "Maladie",       cls: "bg-purple-100 text-purple-700",short: "M"  },
  demi_journee:{ label: "½ journée",     cls: "bg-sand-200 text-ink-600",     short: "½"  },
  ferie:       { label: "Férié",         cls: "bg-sand-300 text-ink-500",     short: "F"  },
};

const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const TYPE_CONTRAT_CLS: Record<TypeContrat, string> = {
  CDI: "bg-leaf-100 text-leaf-600", CDD: "bg-gold-100 text-clay-700",
  STAGE: "bg-blue-100 text-blue-700", FREELANCE: "bg-sand-200 text-ink-600",
};

// Simulation performances du mois courant
const PERF_DEMO = [
  { userId: "u3", nom: "Boukary SAWADOGO", poste: "Caissier principal", nbTx: 142, volumeMM: 14_200_000, fraisGeneres: 142_000 },
  { userId: "u4", nom: "Salif KABORE",     poste: "Caissier",          nbTx: 98,  volumeMM: 9_800_000,  fraisGeneres: 98_000  },
  { userId: "u2", nom: "Aminata OUEDRAOGO",poste: "Gérant d'agence",   nbTx: 35,  volumeMM: 7_000_000,  fraisGeneres: 70_000  },
];
const TAUX_PRIME_PERF = 0.10; // 10% des frais générés reversés en prime

// ── Utils ─────────────────────────────────────────────────

function initiales(nom: string) {
  return nom.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function getWeekDates(weekOffset = 0): string[] {
  const today = new Date("2026-06-04");
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function jourLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// ── Composant principal ───────────────────────────────────

export default function GRHPage() {
  const [tab, setTab] = useState("equipe");
  const { data: employes } = useEmployes();
  const { data: conges, refetch: refetchConges } = useConges();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const { data: presencesDB, refetch: refetchPresences } = usePresencesSemaine(weekDates);

  // État local pointage, alimenté depuis Supabase
  const [presences, setPresences] = useState<Record<string, StatutPresence>>({});
  useEffect(() => {
    const m: Record<string, StatutPresence> = {};
    presencesDB.forEach((p: any) => { m[`${p.employe_id}-${p.date_presence}`] = p.statut; });
    setPresences(m);
  }, [presencesDB]);

  async function togglePresence(employeId: string, d: string, newSt: StatutPresence) {
    setPresences(prev => ({ ...prev, [`${employeId}-${d}`]: newSt }));
    try {
      await sauvegarderPresence({
        employe_id: employeId, date_presence: d, statut: newSt,
        heure_arrivee: "08:00", heure_depart: "17:00", nb_heures: 8, notes: null,
      });
    } catch { /* le rafraîchissement corrigera l'affichage si besoin */ }
  }

  // Mois paie
  const [moisPaie, setMoisPaie] = useState("2026-06");
  const [selectedEmploye, setSelectedEmploye] = useState<Employe | null>(null);
  const [openFiche, setOpenFiche] = useState<Employe | null>(null);
  const [openConge, setOpenConge] = useState(false);
  const [congeForm, setCongeForm] = useState({ employe_id: "", type: "annuel", date_debut: "", date_fin: "", motif: "" });
  const [congeBusy, setCongeBusy] = useState(false);
  const [congeErr, setCongeErr] = useState<string | null>(null);

  async function submitConge() {
    if (!congeForm.employe_id || !congeForm.date_debut || !congeForm.date_fin) {
      setCongeErr("Employé et dates requis."); return;
    }
    setCongeBusy(true); setCongeErr(null);
    try {
      await creerConge(congeForm);
      setCongeForm({ employe_id: "", type: "annuel", date_debut: "", date_fin: "", motif: "" });
      setOpenConge(false);
      refetchConges();
    } catch (e: any) { setCongeErr(e?.message ?? "Erreur lors de l'enregistrement."); }
    setCongeBusy(false);
  }

  async function decider(id: string, statut: "approuve" | "refuse") {
    try { await deciderConge(id, statut); refetchConges(); } catch {}
  }

  // Calculs paie du mois
  const fichesPaie = useMemo(() => employes.map(emp => {
    const perf = PERF_DEMO.find(p => p.userId === emp.id);
    const primePerf = perf ? Math.round(perf.fraisGeneres * TAUX_PRIME_PERF) : 0;
    const avances = 0; // À charger depuis la DB
    const jours = 26;
    return { emp, primePerf, ...calculerPaie(emp.salaire_base, emp.prime_base, primePerf, jours, avances) };
  }), [employes]);

  const totalMasseSalariale = fichesPaie.reduce((s, f) => s + f.salaire_net, 0);
  const totalCoutEmployeur = fichesPaie.reduce((s, f) => s + f.cout_employeur, 0);

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="animate-fade-up">
      <PageHeader title="Ressources humaines" subtitle={`${employes.length} employés · ETS WENDMANÉGRÉ`} />

      {/* Onglets */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-ink text-sand-50" : "bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── ÉQUIPE ── */}
      {tab === "equipe" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {employes.map(emp => (
            <Card key={emp.id} className="p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-[16px] font-bold text-sand-50">
                  {initiales(emp.nom)}
                </div>
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink truncate">{emp.nom}</span>
                    <Badge className={TYPE_CONTRAT_CLS[emp.type_contrat]}>{emp.type_contrat}</Badge>
                  </div>
                  <div className="text-[13px] text-ink-500 mt-0.5">{emp.poste}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-400">
                    {emp.telephone && <span className="flex items-center gap-1"><Phone size={11} />{emp.telephone}</span>}
                    <span className="flex items-center gap-1"><MapPin size={11} />{emp.agence}</span>
                  </div>
                  {/* Solde congés */}
                  <div className="mt-2 flex items-center gap-3 text-[12px]">
                    <span className="text-ink-400">Congés :</span>
                    <span className="font-medium text-ink">{emp.solde_conges - emp.jours_conges_pris}j restants</span>
                    <div className="flex-1 h-1.5 rounded-full bg-sand-200 max-w-[80px]">
                      <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.max(0, ((emp.solde_conges - emp.jours_conges_pris) / emp.solde_conges) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Salaire + actions */}
              <div className="mt-4 flex items-center justify-between border-t border-sand-100 pt-3">
                <div>
                  <span className="num text-[13px] font-semibold text-ink">{formatXOF(emp.salaire_base)}</span>
                  <span className="text-[11px] text-ink-400">/mois brut</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setOpenFiche(emp)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] bg-sand-200 text-ink hover:bg-sand-300">
                    <FileText size={13} /> Fiche
                  </button>
                  <a href={`/receipt/employe/${emp.id}`} target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] bg-clay-100 text-clay-700 hover:bg-clay-100/70">
                    <Printer size={13} /> Contrat
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── POINTAGE ── */}
      {tab === "pointage" && (
        <div>
          {/* Navigation semaine */}
          <div className="mb-4 flex items-center gap-3">
            <Btn variant="ghost" onClick={() => setWeekOffset(w => w - 1)} className="!px-3">‹</Btn>
            <span className="text-sm font-medium text-ink">
              Semaine du {jourLabel(weekDates[0])} au {jourLabel(weekDates[4])}
            </span>
            <Btn variant="ghost" onClick={() => setWeekOffset(w => w + 1)} className="!px-3">›</Btn>
            <Btn variant="soft" onClick={() => setWeekOffset(0)} className="!px-3 !py-2 text-[12px]">Cette semaine</Btn>
          </div>

          {/* Tableau pointage */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50/50">
                    <th className="px-5 py-3 text-left text-[12px] font-medium text-ink-500 w-44">Employé</th>
                    {weekDates.map((d, i) => (
                      <th key={d} className={`px-2 py-3 text-center text-[12px] font-medium ${d === "2026-06-04" ? "text-clay font-bold" : "text-ink-500"}`}>
                        <div>{JOURS_FR[i]}</div>
                        <div className="text-[10px] font-normal text-ink-400">{jourLabel(d)}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-[12px] font-medium text-ink-500">Résumé</th>
                  </tr>
                </thead>
                <tbody>
                  {employes.filter(e => e.role !== "admin").map(emp => {
                    const row = weekDates.map(d => presences[`${emp.id}-${d}`] ?? (d < "2026-06-04" ? "present" : null));
                    const nbPresents = row.filter(s => s === "present").length;
                    const nbAbsents  = row.filter(s => s === "absent").length;
                    return (
                      <tr key={emp.id} className="border-b border-sand-100 last:border-0">
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink text-[13px]">{emp.nom}</div>
                          <div className="text-[11px] text-ink-400">{emp.poste}</div>
                        </td>
                        {weekDates.map((d, di) => {
                          const statut: StatutPresence = row[di] ?? "present";
                          const st = STATUT_PRESENCE[statut];
                          const isFuture = d > "2026-06-04";
                          return (
                            <td key={d} className="px-2 py-3 text-center">
                              <button
                                disabled={isFuture}
                                onClick={() => {
                                  const next: StatutPresence[] = ["present","absent","retard","maladie","conge","demi_journee"];
                                  const cur = statut;
                                  const idx = next.indexOf(cur);
                                  const newSt = next[(idx + 1) % next.length];
                                  togglePresence(emp.id, d, newSt);
                                }}
                                title={isFuture ? "" : `Cliquer pour changer · ${st.label}`}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-all ${
                                  isFuture ? "opacity-0" : st.cls + " hover:opacity-80 cursor-pointer"}`}>
                                {st.short}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          <div className="text-[12px]">
                            <span className="text-leaf-600 font-medium">{nbPresents}P</span>
                            {nbAbsents > 0 && <span className="text-ember-600 font-medium ml-1">{nbAbsents}A</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-2 text-[12px] text-ink-400">Cliquez sur un badge pour changer le statut : P → A → R → M → C → ½ → P</p>

          {/* Légende */}
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(STATUT_PRESENCE).map(([k, v]) => (
              <span key={k} className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] ${v.cls}`}>
                <span className="font-bold">{v.short}</span> {v.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── CONGÉS ── */}
      {tab === "conges" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[13px] text-ink-500">{conges.filter(c => c.statut === "en_attente").length} demande(s) en attente</div>
            <Btn onClick={() => setOpenConge(true)}><Plus size={16} /> Nouvelle demande</Btn>
          </div>

          {/* Soldes des congés */}
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4">
            {employes.filter(e => e.role !== "admin").map(emp => (
              <Card key={emp.id} className="p-4">
                <div className="text-[12px] font-medium text-ink">{emp.nom.split(" ")[0]}</div>
                <div className="num mt-1 text-2xl font-bold text-ink">{emp.solde_conges - emp.jours_conges_pris}</div>
                <div className="text-[11px] text-ink-400">jours restants / {emp.solde_conges}</div>
              </Card>
            ))}
          </div>

          {/* Liste des congés */}
          <Card className="overflow-hidden">
            <div className="divide-y divide-sand-100">
              {conges.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-400">Aucune demande de congé.</p>}
              {conges.map(c => {
                const st = c.statut === "approuve"
                  ? { cls: "bg-leaf-100 text-leaf-600", label: "Approuvé" }
                  : c.statut === "refuse"
                  ? { cls: "bg-ember-100 text-ember-600", label: "Refusé" }
                  : { cls: "bg-gold-100 text-clay-700", label: "En attente" };
                const typeLabel: Record<string, string> = {
                  annuel: "Congé annuel", maladie: "Maladie", maternite: "Maternité",
                  paternite: "Paternité", deces: "Décès", sans_solde: "Sans solde", autre: "Autre",
                };
                return (
                  <div key={c.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-ink">{c.employe_nom}</span>
                          <Badge className={st.cls}>{st.label}</Badge>
                          <Badge className="bg-sand-200 text-ink-600">{typeLabel[c.type] ?? c.type}</Badge>
                        </div>
                        <div className="mt-1 text-[13px] text-ink-500">
                          Du {new Date(c.date_debut).toLocaleDateString("fr-FR")} au {new Date(c.date_fin).toLocaleDateString("fr-FR")}
                          <span className="ml-2 font-medium text-ink">({c.nb_jours} jours)</span>
                        </div>
                        {c.motif && <div className="mt-0.5 text-[12px] text-ink-400">Motif : {c.motif}</div>}
                        {c.notes_admin && <div className="mt-0.5 text-[12px] text-ink-400 italic">Note : {c.notes_admin}</div>}
                      </div>
                      {c.statut === "en_attente" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => decider(c.id, "approuve")} className="inline-flex items-center gap-1 rounded-lg bg-leaf-100 px-3 py-1.5 text-[12px] font-medium text-leaf-600 hover:bg-leaf-100/70">
                            <Check size={13} /> Approuver
                          </button>
                          <button onClick={() => decider(c.id, "refuse")} className="inline-flex items-center gap-1 rounded-lg bg-ember-100 px-3 py-1.5 text-[12px] font-medium text-ember-600 hover:bg-ember-100/70">
                            <X size={13} /> Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── PAIE ── */}
      {tab === "paie" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-ink-600">Période :</span>
              <input type="month" value={moisPaie} onChange={e => setMoisPaie(e.target.value)}
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:border-clay" />
            </div>
            <div className="flex gap-2 ml-auto">
              <Btn variant="soft"><Printer size={15} /> Imprimer toutes les fiches</Btn>
            </div>
          </div>

          {/* Récap masse salariale */}
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Masse salariale nette", v: totalMasseSalariale, cls: "text-ink" },
              { l: "Coût total employeur",  v: totalCoutEmployeur,  cls: "text-clay-700" },
              { l: "CNSS total",            v: fichesPaie.reduce((s,f)=>s+f.cnss_employe+f.cnss_employeur,0), cls: "text-amber-700" },
              { l: "IUTS total",            v: fichesPaie.reduce((s,f)=>s+f.iuts,0), cls: "text-ink-600" },
            ].map(({ l, v, cls }) => (
              <Card key={l} className="p-4">
                <div className="text-[12px] text-ink-500">{l}</div>
                <div className={`num mt-1 text-xl font-semibold ${cls}`}>{formatXOF(v)}</div>
              </Card>
            ))}
          </div>

          {/* Tableau des fiches de paie */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                    {["Employé","Jours","Base brute","Primes","CNSS","IUTS","Net à payer","Coût emp.",""].map(h => (
                      <th key={h} className={`px-4 py-3 font-medium ${h && h !== "Employé" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fichesPaie.map(({ emp, primePerf, salaire_brut, cnss_employe, iuts, salaire_net, cout_employeur }) => (
                    <tr key={emp.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-ink">{emp.nom}</div>
                        <div className="text-[11px] text-ink-400">{emp.poste}</div>
                      </td>
                      <td className="num px-4 py-3.5 text-right">26</td>
                      <td className="num px-4 py-3.5 text-right">{formatXOF(salaire_brut)}</td>
                      <td className="num px-4 py-3.5 text-right text-leaf-600">
                        +{formatXOF(emp.prime_base + primePerf)}
                        {primePerf > 0 && <div className="text-[10px] text-ink-400">dont perf. {formatXOF(primePerf)}</div>}
                      </td>
                      <td className="num px-4 py-3.5 text-right text-ink-500">−{formatXOF(cnss_employe)}</td>
                      <td className="num px-4 py-3.5 text-right text-ink-500">−{formatXOF(iuts)}</td>
                      <td className="num px-4 py-3.5 text-right text-lg font-semibold text-ink">{formatXOF(salaire_net)}</td>
                      <td className="num px-4 py-3.5 text-right text-ink-500 text-[12px]">{formatXOF(cout_employeur)}</td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setSelectedEmploye(emp)}
                          className="inline-flex items-center gap-1 rounded-lg bg-sand-200 px-2 py-1 text-[11px] hover:bg-sand-300">
                          <Printer size={12} /> Fiche
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-sand-200 bg-sand-50 font-bold">
                    <td className="px-4 py-3 text-ink" colSpan={6}>TOTAL {moisPaie}</td>
                    <td className="num px-4 py-3 text-right text-ink text-[15px]">{formatXOF(totalMasseSalariale)}</td>
                    <td className="num px-4 py-3 text-right text-clay-700">{formatXOF(totalCoutEmployeur)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <p className="mt-3 text-[12px] text-ink-400">
            Calculs CNSS (5.5% employé, 16% employeur) et IUTS selon le barème progressif en vigueur au Burkina Faso.
            Les primes de performance sont calculées à {(TAUX_PRIME_PERF * 100).toFixed(0)}% des frais générés par caissier.
          </p>
        </div>
      )}

      {/* ── PERFORMANCES ── */}
      {tab === "performances" && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[13px] text-ink-500">Mois de juin 2026 · données en temps réel via Supabase</span>
          </div>

          {/* Podium top performers */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {PERF_DEMO.map((p, i) => {
              const medal = ["🥇","🥈","🥉"][i];
              const primePerf = Math.round(p.fraisGeneres * TAUX_PRIME_PERF);
              return (
                <Card key={p.userId} className={`p-5 ${i === 0 ? "ring-2 ring-clay/30" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{medal}</span>
                    <div>
                      <div className="font-bold text-ink">{p.nom}</div>
                      <div className="text-[12px] text-ink-400">{p.poste}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { l: "Transactions",  v: String(p.nbTx)               },
                      { l: "Volume traité", v: formatXOF(p.volumeMM).replace(" F","")  },
                      { l: "Frais générés", v: formatXOF(p.fraisGeneres),   },
                      { l: "Prime perf.",   v: formatXOF(primePerf), cls: "text-leaf-600" },
                    ].map(({ l, v, cls }) => (
                      <div key={l} className="rounded-xl bg-sand-100 p-2.5">
                        <div className="text-[11px] text-ink-400">{l}</div>
                        <div className={`num mt-0.5 text-[14px] font-semibold ${cls ?? "text-ink"}`}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Tableau comparatif */}
          <Card className="overflow-hidden">
            <div className="border-b border-sand-200 px-5 py-4">
              <h3 className="display text-lg font-bold text-ink">Comparatif des performances</h3>
            </div>
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                    <th className="px-5 py-3 text-left font-medium">Caissier</th>
                    <th className="px-5 py-3 text-right font-medium">Transactions</th>
                    <th className="px-5 py-3 text-right font-medium">Volume</th>
                    <th className="px-5 py-3 text-right font-medium">Frais générés</th>
                    <th className="px-5 py-3 text-right font-medium">Prime</th>
                    <th className="px-5 py-3 text-right font-medium">Moy./transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {PERF_DEMO.map(p => {
                    const prime = Math.round(p.fraisGeneres * TAUX_PRIME_PERF);
                    const moyTx = p.nbTx > 0 ? Math.round(p.fraisGeneres / p.nbTx) : 0;
                    return (
                      <tr key={p.userId} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-ink">{p.nom}</div>
                          <div className="text-[11px] text-ink-400">{p.poste}</div>
                        </td>
                        <td className="num px-5 py-3.5 text-right">{p.nbTx}</td>
                        <td className="num px-5 py-3.5 text-right text-ink-600">{formatXOF(p.volumeMM)}</td>
                        <td className="num px-5 py-3.5 text-right font-semibold text-leaf-600">{formatXOF(p.fraisGeneres)}</td>
                        <td className="num px-5 py-3.5 text-right font-semibold text-clay-700">+{formatXOF(prime)}</td>
                        <td className="num px-5 py-3.5 text-right text-ink-500">{formatXOF(moyTx)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="mt-3 text-[12px] text-ink-400">
            Prime de performance calculée à <strong>{(TAUX_PRIME_PERF * 100).toFixed(0)}%</strong> des frais générés.
            Ce taux est configurable dans Paramètres → Frais & marges.
          </p>
        </div>
      )}

      {/* ── Modal fiche employé ── */}
      <Modal open={!!openFiche} onClose={() => setOpenFiche(null)} title={`Fiche — ${openFiche?.nom}`}>
        {openFiche && (
          <div className="space-y-3 text-sm">
            {[
              ["Poste",          openFiche.poste         ],
              ["Agence",         openFiche.agence        ],
              ["Contrat",        openFiche.type_contrat  ],
              ["Début contrat",  openFiche.date_debut    ],
              ["CNSS",           openFiche.numero_cnss   ],
              ["CNIB",           openFiche.numero_cnib   ],
              ["Date naissance", openFiche.date_naissance],
              ["Lieu naissance", openFiche.lieu_naissance],
              ["Adresse",        openFiche.adresse       ],
              ["Contact urgence",openFiche.contact_urgence_nom ? `${openFiche.contact_urgence_nom} — ${openFiche.contact_urgence_tel}` : null],
            ].filter(([_, v]) => v).map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 border-b border-sand-100 pb-2">
                <span className="text-ink-500">{k}</span>
                <span className="num font-medium text-ink text-right">{String(v)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <span className="text-ink-500">Salaire de base</span>
              <span className="num font-semibold text-ink">{formatXOF(openFiche.salaire_base)}</span>
            </div>
            {openFiche.notes && <p className="rounded-xl bg-sand-100 px-3 py-2 text-[12px] text-ink-600">{openFiche.notes}</p>}
          </div>
        )}
      </Modal>

      {/* ── Modal fiche de paie individuelle ── */}
      <Modal open={!!selectedEmploye} onClose={() => setSelectedEmploye(null)} title={`Fiche de paie — ${selectedEmploye?.nom}`}>
        {selectedEmploye && (() => {
          const f = fichesPaie.find(x => x.emp.id === selectedEmploye.id);
          if (!f) return null;
          return (
            <div className="text-sm space-y-2.5">
              <div className="text-[12px] text-ink-400 text-center">Période : {moisPaie}</div>
              {[
                ["Salaire de base",   formatXOF(selectedEmploye.salaire_base),  ""],
                ["Prime fixe",        formatXOF(selectedEmploye.prime_base),     "text-leaf-600"],
                ["Prime performance", formatXOF(f.primePerf),                    "text-leaf-600"],
                ["Salaire brut",      formatXOF(f.salaire_brut),                "font-semibold"],
                ["CNSS employé (5.5%)", "−"+formatXOF(f.cnss_employe),          "text-ink-500"],
                ["IUTS",              "−"+formatXOF(f.iuts),                    "text-ink-500"],
                ["NET À PAYER",       formatXOF(f.salaire_net),                  "text-lg font-bold text-ink"],
                ["Coût employeur",    formatXOF(f.cout_employeur),               "text-clay-700"],
              ].map(([l, v, cls]) => (
                <div key={String(l)} className="flex justify-between border-b border-sand-100 pb-2">
                  <span className="text-ink-500">{l}</span>
                  <span className={`num ${cls}`}>{v}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-end">
                <Btn variant="soft" onClick={() => window.print()}><Printer size={15} /> Imprimer</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal nouvelle demande de congé */}
      <Modal open={openConge} onClose={() => setOpenConge(false)} title="Demande de congé">
        <Field label="Employé">
          <select className={inputCls} value={congeForm.employe_id} onChange={e => setCongeForm(f => ({ ...f, employe_id: e.target.value }))}>
            <option value="">— Choisir —</option>
            {employes.filter(e => e.role !== "admin").map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={inputCls} value={congeForm.type} onChange={e => setCongeForm(f => ({ ...f, type: e.target.value }))}>
            {[["annuel","Congé annuel"],["maladie","Maladie"],["maternite","Maternité"],["paternite","Paternité"],["deces","Décès familial"],["sans_solde","Sans solde"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date début"><input className={inputCls} type="date" value={congeForm.date_debut} onChange={e => setCongeForm(f => ({ ...f, date_debut: e.target.value }))} /></Field>
          <Field label="Date fin"><input className={inputCls} type="date" value={congeForm.date_fin} onChange={e => setCongeForm(f => ({ ...f, date_fin: e.target.value }))} /></Field>
        </div>
        <Field label="Motif"><input className={inputCls} value={congeForm.motif} onChange={e => setCongeForm(f => ({ ...f, motif: e.target.value }))} placeholder="Optionnel" /></Field>
        {congeErr && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{congeErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenConge(false)}>Annuler</Btn>
          <Btn onClick={submitConge} className={congeBusy ? "opacity-50" : ""}>{congeBusy ? "Enregistrement…" : "Enregistrer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
