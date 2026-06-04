"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  HandCoins, Users, Wallet, TrendingUp,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Building2, Shield,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Badge } from "@/components/ui";
import { KpiCard } from "@/components/KpiCard";
import {
  formatXOF, formatXOFCompact, resteAPayer,
  joursDeRetard, typeColor, formatDate,
} from "@/lib/format";
import { ENTREPRISE } from "@/lib/data";

export default function AdminDashboard() {
  const { prets, clients, remboursements, caisses, produits } = useStore();

  const stats = useMemo(() => {
    const actifs = prets.filter(p => (p.statut as string) !== "rembourse" && (p.statut as string) !== "annule");
    const encours        = actifs.reduce((s, p) => s + resteAPayer(p, remboursements), 0);
    const tresorerie     = caisses.reduce((s, c) => s + c.solde, 0);
    const totalOctroye   = prets.reduce((s, p) => s + p.montant, 0);
    const totalRemb      = remboursements.reduce((s, r) => s + r.montant, 0);
    const tauxRecouv     = totalOctroye > 0 ? (totalRemb / totalOctroye) * 100 : 0;
    const enRetard       = actifs.filter(p => joursDeRetard(p.echeance) > 0);
    const stockAlertes   = produits.filter(p => (p.stock ?? 0) <= ((p as any).seuilAlerte ?? 10));

    // Encours par ville
    const parVille: Record<string, number> = {};
    actifs.forEach(p => {
      const cl = clients.find(c => c.id === p.clientId);
      const v  = cl?.ville ?? "Autre";
      parVille[v] = (parVille[v] ?? 0) + resteAPayer(p, remboursements);
    });
    const villeData = Object.entries(parVille)
      .map(([ville, montant]) => ({ ville, montant }))
      .sort((a, b) => b.montant - a.montant).slice(0, 7);

    // Par type
    const parType: Record<string, number> = {};
    actifs.forEach(p => { parType[p.type] = (parType[p.type] ?? 0) + resteAPayer(p, remboursements); });
    const typeData = Object.entries(parType).map(([type, montant]) => ({ type, montant }));

    return { encours, tresorerie, tauxRecouv, enRetard, stockAlertes, villeData, typeData, nbActifs: actifs.length };
  }, [prets, clients, remboursements, caisses, produits]);

  // Activité récente (derniers prêts + remboursements)
  const activite = useMemo(() => {
    return [
      ...prets.slice(0, 5).map(p => ({
        type: "octroi" as const, ref: p.id,
        client: clients.find(c => c.id === p.clientId)?.nom ?? p.clientId,
        montant: p.montant, date: p.dateOctroi,
      })),
      ...remboursements.slice(0, 4).map(r => {
        const pret = prets.find(p => p.id === r.pretId);
        return {
          type: "remboursement" as const, ref: r.pretId,
          client: clients.find(c => c.id === pret?.clientId)?.nom ?? "—",
          montant: r.montant, date: r.date,
        };
      }),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [prets, clients, remboursements]);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Tableau de bord"
        subtitle={`${ENTREPRISE.nom} · Vue d'ensemble globale · ${formatDate(new Date().toISOString().slice(0,10))}`}
        action={
          <div className="flex items-center gap-2 rounded-xl bg-clay-100 px-3 py-1.5 text-[12px] font-medium text-clay-700">
            <Shield size={14} /> Administrateur
          </div>
        }
      />

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Encours réseau"      value={formatXOF(stats.encours)}    sub={`${stats.nbActifs} créances actives`}       icon={<HandCoins size={18}/>}  accent="clay" />
        <KpiCard label="Trésorerie totale"   value={formatXOF(stats.tresorerie)} sub={`${caisses.length} caisses`}               icon={<Wallet size={18}/>}     accent="leaf" />
        <KpiCard label="Commerçants réseau"  value={String(clients.length)}       sub="sous-distributeurs actifs"                 icon={<Users size={18}/>}      accent="ink"  />
        <KpiCard label="Taux recouvrement"   value={stats.tauxRecouv.toFixed(0)+"%"} sub="historique global"                     icon={<TrendingUp size={18}/>} accent="gold" />
      </div>

      {/* Graphiques */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="display mb-1 text-lg font-bold text-ink">Encours par localité</h3>
          <p className="mb-4 text-[12px] text-ink-500">Montant restant dû par ville (toutes agences)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.villeData} margin={{ left: 0, right: 8 }}>
              <XAxis dataKey="ville" tick={{ fontSize: 11, fill: "#6B6157" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => formatXOFCompact(v)} tick={{ fontSize: 11, fill: "#8A8178" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v: number) => [formatXOF(v), "Encours"]} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
              <Bar dataKey="montant" radius={[6,6,0,0]} fill="#C75B2A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="display mb-1 text-lg font-bold text-ink">Par opérateur</h3>
          <p className="mb-2 text-[12px] text-ink-500">Répartition de l'encours</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.typeData} dataKey="montant" nameKey="type" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {stats.typeData.map(d => <Cell key={d.type} fill={typeColor(d.type)} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatXOF(v)} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Résumé caisses par agence + alertes + activité */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {/* Activité */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="display text-lg font-bold text-ink">Activité récente</h3>
            <Link href="/prets" className="text-[13px] font-medium text-clay hover:underline">Tout voir →</Link>
          </div>
          <div className="space-y-0.5">
            {activite.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-sand-100">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.type === "octroi" ? "bg-clay-100 text-clay-700" : "bg-leaf-100 text-leaf-600"}`}>
                    {a.type === "octroi" ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}
                  </span>
                  <div>
                    <Link href={`/clients/${encodeURIComponent(a.ref.includes("FA") ? "" : a.ref)}`} className="text-sm font-medium text-ink hover:text-clay">
                      {a.client}
                    </Link>
                    <div className="num text-[11px] text-ink-400">{a.ref}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`num text-sm font-semibold ${a.type === "octroi" ? "text-clay-700" : "text-leaf-600"}`}>
                    {a.type === "octroi" ? "−" : "+"}{formatXOF(a.montant)}
                  </div>
                  <div className="text-[11px] text-ink-400">{a.type === "octroi" ? "Prêt" : "Remboursement"}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Alertes */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={17} className="text-ember" />
            <h3 className="display text-lg font-bold text-ink">Alertes</h3>
          </div>
          <div className="space-y-2.5">
            {stats.enRetard.slice(0, 4).map(p => {
              const cl = clients.find(c => c.id === p.clientId);
              return (
                <Link key={p.id} href={`/clients/${encodeURIComponent(p.clientId)}`}
                  className="block rounded-xl bg-ember-100/60 px-3 py-2.5 hover:bg-ember-100/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{cl?.nom}</span>
                    <Badge className="bg-ember-100 text-ember-600">{joursDeRetard(p.echeance)}j</Badge>
                  </div>
                  <div className="num mt-0.5 text-[12px] text-ink-500">{formatXOF(resteAPayer(p, remboursements))} en retard</div>
                </Link>
              );
            })}
            {stats.stockAlertes.slice(0, 3).map(p => (
              <div key={p.id} className="rounded-xl bg-gold-100/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{p.nom}</span>
                  <Badge className="bg-gold-100 text-clay-700">Stock bas</Badge>
                </div>
                <div className="num mt-0.5 text-[12px] text-ink-500">{p.stock} restants · seuil {(p as any).seuilAlerte}</div>
              </div>
            ))}
            {stats.enRetard.length === 0 && stats.stockAlertes.length === 0 && (
              <p className="text-sm text-ink-400">Aucune alerte 🎉</p>
            )}
          </div>
        </Card>
      </div>

      {/* Caisses */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Building2 size={17} className="text-clay" />
            <h3 className="display text-lg font-bold text-ink">Caisses — toutes agences</h3>
          </div>
          <Link href="/caisses" className="text-[13px] font-medium text-clay hover:underline">Gérer →</Link>
        </div>
        <div className="grid grid-cols-2 divide-x divide-sand-100 sm:grid-cols-4">
          {caisses.map(c => (
            <div key={c.id} className="p-4">
              <div className="text-[12px] text-ink-500">{c.nom}</div>
              <div className="num mt-1 text-xl font-semibold text-ink">{formatXOF(c.solde)}</div>
              <div className="text-[11px] text-ink-400 mt-0.5">{c.agence}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
