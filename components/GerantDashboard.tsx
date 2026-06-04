"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  HandCoins, Wallet, Users, CheckCircle,
  AlertTriangle, ArrowDownRight, Clock,
  Store, Plane, ShieldCheck, Lock,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { usePermissions } from "@/lib/permissions";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { KpiCard } from "@/components/KpiCard";
import { formatXOF, formatDate, resteAPayer, joursDeRetard, statutLabel } from "@/lib/format";
import { CONGES_DEMO } from "@/lib/hooks-grh";
import type { Profile } from "@/lib/database.types";

export default function GerantDashboard({ profile }: { profile: Profile }) {
  const { prets, clients, remboursements, caisses, users } = useStore();
  const { can, permissions } = usePermissions();
  const [openCongé, setOpenCongé] = useState<typeof CONGES_DEMO[0] | null>(null);

  // Caissiers de son agence
  const mesCaissiers = users.filter(u => u.agence === profile.agence && u.role === "caissier");
  const mesCaisses   = caisses.filter(c => c.agence === profile.agence || mesCaissiers.some(u => c.assigneeA === u.id));

  const stats = useMemo(() => {
    const actifs   = prets.filter(p => (p.statut as string) !== "rembourse" && (p.statut as string) !== "annule");
    const encours  = actifs.reduce((s, p) => s + resteAPayer(p, remboursements), 0);
    const tresor   = mesCaisses.reduce((s, c) => s + c.solde, 0);
    const enRetard = actifs.filter(p => joursDeRetard(p.echeance) > 0);
    const recentsP = prets.slice(0, 6).map(p => ({
      ...p,
      clientNom: clients.find(c => c.id === p.clientId)?.nom ?? p.clientId,
      reste: resteAPayer(p, remboursements),
    }));
    return { encours, tresor, enRetard, recentsP, nbActifs: actifs.length };
  }, [prets, clients, remboursements, mesCaisses]);

  // Congés en attente que le gérant peut approuver
  const congesEnAttente = CONGES_DEMO.filter(c => c.statut === "en_attente");

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={`Bonjour, ${profile.nom.split(" ")[0]}`}
        subtitle={`${profile.agence} · Gérant d'agence · ${formatDate(new Date().toISOString().slice(0,10))}`}
        action={
          <div className="flex items-center gap-2 rounded-xl bg-gold-100 px-3 py-1.5 text-[12px] font-medium text-clay-700">
            <ShieldCheck size={14} /> Gérant
          </div>
        }
      />

      {/* KPIs de l'agence */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Encours total"     value={formatXOF(stats.encours)}  sub={`${stats.nbActifs} créances`}           icon={<HandCoins size={18}/>} accent="clay" />
        <KpiCard label="Trésorerie agence" value={formatXOF(stats.tresor)}   sub={`${mesCaisses.length} caisses`}         icon={<Wallet size={18}/>}    accent="leaf" />
        <KpiCard label="Caissiers actifs"  value={String(mesCaissiers.length)} sub={`agence ${profile.agence}`}          icon={<Users size={18}/>}     accent="ink"  />
        <KpiCard label="En retard"         value={String(stats.enRetard.length)} sub="prêts au-delà de l'échéance"       icon={<AlertTriangle size={18}/>} accent="ember" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">

        {/* Mes caissiers */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users size={17} className="text-clay" />
            <h3 className="display text-lg font-bold text-ink">Mes caissiers</h3>
          </div>
          <div className="space-y-3">
            {mesCaissiers.map(u => {
              const caisse = caisses.find(c => c.assigneeA === u.id);
              return (
                <div key={u.id} className="rounded-xl border border-sand-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-ink text-[14px]">{u.nom}</div>
                      <div className="text-[11px] text-ink-400">{caisse?.nom ?? "Sans caisse"}</div>
                    </div>
                    {caisse && (
                      <div className="text-right">
                        <div className="num text-[14px] font-semibold text-ink">{formatXOF(caisse.solde)}</div>
                        <div className="text-[10px] text-ink-400">solde</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {mesCaissiers.length === 0 && <p className="text-sm text-ink-400">Aucun caissier dans votre agence.</p>}
          </div>
        </Card>

        {/* Prêts récents + congés */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="display text-lg font-bold text-ink">Prêts & encours récents</h3>
            <Link href="/prets" className="text-[13px] text-clay hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-1.5">
            {stats.recentsP.map(p => {
              const st = statutLabel(p.statut as any);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-sand-100">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink truncate">{p.clientNom}</span>
                      <Badge className={st.cls + " text-[10px]"}>{st.label}</Badge>
                    </div>
                    <div className="num text-[11px] text-ink-400">{p.id} · {p.type}</div>
                  </div>
                  <div className="flex-shrink-0 text-right ml-3">
                    <div className="num text-sm font-semibold text-clay-700">{formatXOF(p.reste)}</div>
                    {joursDeRetard(p.echeance) > 0 && p.statut !== "rembourse" && (
                      <div className="text-[10px] text-ember">+{joursDeRetard(p.echeance)}j retard</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Alertes en retard + Congés à approuver */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={17} className="text-ember" />
            <h3 className="display text-base font-bold text-ink">Retards à relancer</h3>
          </div>
          {stats.enRetard.length === 0 ? (
            <div className="flex items-center gap-2 text-leaf-600 text-sm">
              <CheckCircle size={16} /> Aucun retard — excellent !
            </div>
          ) : (
            <div className="space-y-2">
              {stats.enRetard.slice(0, 5).map(p => {
                const cl = clients.find(c => c.id === p.clientId);
                return (
                  <div key={p.id} className="rounded-xl bg-ember-100/60 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">{cl?.nom}</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-ember-100 text-ember-600">{joursDeRetard(p.echeance)}j</Badge>
                        {cl?.telephone && (
                          <a href={`tel:${cl.telephone}`}
                            className="rounded-lg bg-leaf-100 px-2 py-0.5 text-[11px] text-leaf-600 hover:bg-leaf-100/70">
                            📞 Appeler
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="num mt-0.5 text-[12px] text-ink-500">
                      {formatXOF(resteAPayer(p, remboursements))} restant · {cl?.ville}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Congés à approuver — si permission */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plane size={17} className="text-blue-600" />
              <h3 className="display text-base font-bold text-ink">Congés à approuver</h3>
            </div>
            {can("conges_approuver") && <Link href="/grh" className="text-[13px] text-clay hover:underline">Gérer →</Link>}
          </div>
          {!can("conges_approuver") ? (
            <PermissionLocked label="Approbation de congés" />
          ) : congesEnAttente.length === 0 ? (
            <p className="text-sm text-ink-400">Aucune demande en attente.</p>
          ) : (
            <div className="space-y-2">
              {congesEnAttente.map(c => (
                <div key={c.id} className="rounded-xl border border-sand-200 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-ink">{c.employe_nom}</div>
                      <div className="text-[12px] text-ink-400">
                        {new Date(c.date_debut).toLocaleDateString("fr-FR")} → {new Date(c.date_fin).toLocaleDateString("fr-FR")}
                        <span className="ml-1 font-medium text-ink">({c.nb_jours}j)</span>
                      </div>
                      {c.motif && <div className="text-[11px] text-ink-400 mt-0.5">{c.motif}</div>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button className="flex items-center gap-1 rounded-lg bg-leaf-100 px-2.5 py-1.5 text-[12px] font-medium text-leaf-600 hover:opacity-80">
                        <CheckCircle size={12} /> Ok
                      </button>
                      <button className="flex items-center gap-1 rounded-lg bg-ember-100 px-2.5 py-1.5 text-[12px] font-medium text-ember-600 hover:opacity-80">
                        <span>✕</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Actions rapides selon permissions */}
      <Card className="mt-5 p-5">
        <h3 className="display mb-4 text-base font-bold text-ink">Mes actions rapides</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/clients" icon={Users}  label="Commerçants" sub="Voir le réseau"    allowed={can("clients_voir")} />
          <QuickAction href="/prets"   icon={HandCoins} label="Prêts"    sub="Gérer l'encours"  allowed={can("prets_voir")} />
          <QuickAction href="/caisses" icon={Wallet} label="Caisses"     sub="Alimenter"         allowed={can("caisses_voir")} />
          <QuickAction href="/boutique"icon={Store}  label="Boutique"    sub="Stock & ventes"   allowed={can("stock_voir")} />
          <QuickAction href="/grh"     icon={Plane}  label="Congés"      sub="Approuver"         allowed={can("conges_approuver")} />
          <QuickAction href="/boutique?tab=commandes" icon={Clock} label="Commandes" sub="Réceptionner" allowed={can("commandes_valider")} />
        </div>
      </Card>

      {/* Panneau "accès restreints" */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={16} className="text-ink-400" />
          <h3 className="text-[13px] font-medium text-ink-500">Accès non accordés</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["comptabilite_voir","paie_voir","rapports_exporter","caisses_transferer","prets_annuler"] as const).map(k => (
            !can(k) && (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-xl bg-sand-200 px-3 py-1.5 text-[12px] text-ink-500">
                <Lock size={11} />
                {{ comptabilite_voir:"Comptabilité", paie_voir:"Fiches de paie", rapports_exporter:"Exports", caisses_transferer:"Transferts", prets_annuler:"Annuler prêts" }[k]}
              </span>
            )
          ))}
          <span className="text-[12px] text-ink-400 self-center">— demandez au DG pour obtenir l'accès</span>
        </div>
      </Card>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────

function QuickAction({ href, icon: Icon, label, sub, allowed }: {
  href: string; icon: any; label: string; sub: string; allowed: boolean;
}) {
  if (!allowed) return null;
  return (
    <Link href={href}
      className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white/70 p-3.5 transition-all hover:border-clay/30 hover:shadow-card">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ink/5 text-clay">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-[11px] text-ink-400">{sub}</div>
      </div>
    </Link>
  );
}

function PermissionLocked({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-sand-100 px-3 py-2.5 text-[13px] text-ink-400">
      <Lock size={14} />
      <span>{label} — accès non accordé</span>
    </div>
  );
}
