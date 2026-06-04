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
import { useDashboardStats, useCaisses, useProduits } from "@/lib/hooks";
import { PageHeader, Card, Badge } from "@/components/ui";
import { KpiCard } from "@/components/KpiCard";
import { formatXOF, formatXOFCompact, typeColor, formatDate } from "@/lib/format";
import { ENTREPRISE } from "@/lib/data";

export default function AdminDashboard() {
  const { stats, loading } = useDashboardStats();
  const { data: caisses } = useCaisses();
  const { data: produits } = useProduits();

  const stockAlertes = useMemo(
    () => produits.filter(p => (p.stock ?? 0) <= ((p as any).seuil_alerte ?? 10)),
    [produits]
  );

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
        <KpiCard label="Encours réseau"     value={formatXOF(stats.encours)}    sub={`${stats.nbImpayes} créances actives`}   icon={<HandCoins size={18}/>}  accent="clay" />
        <KpiCard label="Trésorerie totale"  value={formatXOF(stats.tresorerie)} sub={`${caisses.length} caisses`}             icon={<Wallet size={18}/>}     accent="leaf" />
        <KpiCard label="Commerçants réseau" value={String(stats.nbCommerçants)} sub="sous-distributeurs actifs"               icon={<Users size={18}/>}      accent="ink"  />
        <KpiCard label="Taux recouvrement"  value={stats.tauxRecouvrement.toFixed(0)+"%"} sub="historique global"             icon={<TrendingUp size={18}/>} accent="gold" />
      </div>

      {/* Graphiques */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="display mb-1 text-lg font-bold text-ink">Encours par localité</h3>
          <p className="mb-4 text-[12px] text-ink-500">Montant restant dû par ville (toutes agences)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.parVille} margin={{ left: 0, right: 8 }}>
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
              <Pie data={stats.parType} dataKey="montant" nameKey="type" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {stats.parType.map(d => <Cell key={d.type} fill={typeColor(d.type)} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatXOF(v)} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Activité + alertes */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="display text-lg font-bold text-ink">Activité récente</h3>
            <Link href="/prets" className="text-[13px] font-medium text-clay hover:underline">Tout voir →</Link>
          </div>
          <div className="space-y-0.5">
            {stats.activiteRecente.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-sand-100">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.type === "octroi" ? "bg-clay-100 text-clay-700" : "bg-leaf-100 text-leaf-600"}`}>
                    {a.type === "octroi" ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink">{a.client}</div>
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
            {!loading && stats.activiteRecente.length === 0 && (
              <p className="text-sm text-ink-400">Aucune activité récente.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={17} className="text-ember" />
            <h3 className="display text-lg font-bold text-ink">Alertes</h3>
          </div>
          <div className="space-y-2.5">
            {stats.enRetard.slice(0, 4).map(p => (
              <Link key={p.id} href={`/clients/${encodeURIComponent(p.client_id)}`}
                className="block rounded-xl bg-ember-100/60 px-3 py-2.5 hover:bg-ember-100/80 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{p.client_nom}</span>
                  <Badge className="bg-ember-100 text-ember-600">{p.jours_retard}j</Badge>
                </div>
                <div className="num mt-0.5 text-[12px] text-ink-500">{formatXOF(p.reste_a_payer ?? 0)} en retard</div>
              </Link>
            ))}
            {stockAlertes.slice(0, 3).map(p => (
              <div key={p.id} className="rounded-xl bg-gold-100/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{p.nom}</span>
                  <Badge className="bg-gold-100 text-clay-700">Stock bas</Badge>
                </div>
                <div className="num mt-0.5 text-[12px] text-ink-500">{p.stock} restants · seuil {(p as any).seuil_alerte}</div>
              </div>
            ))}
            {stats.enRetard.length === 0 && stockAlertes.length === 0 && (
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
