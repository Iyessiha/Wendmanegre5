"use client";

import { useState } from "react";
import { TrendingUp, BarChart2, PieChart, Landmark } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { useComptaStats } from "@/lib/hooks2";
import { usePrets } from "@/lib/hooks";
import { PageHeader, Card } from "@/components/ui";
import { formatXOF, formatXOFCompact, typeColor } from "@/lib/format";

const COULEURS = ["#C75B2A","#2F6B4F","#C9962E","#B23A2E","#6B6157","#378ADD","#7F77DD"];

export default function ComptabilitePage() {
  const now = new Date();
  const [mois, setMois] = useState(now.toISOString().slice(0, 7));
  const { data: stats, loading } = useComptaStats(mois);
  const { data: prets } = usePrets({ statut: "tous" });

  const encoursPrets = prets.filter(p => p.statut !== "rembourse" && p.statut !== "annule").reduce((s, p) => s + (p.reste_a_payer ?? 0), 0);

  const typeLabels: Record<string, string> = {
    DEPOT: "Dépôts", RETRAIT: "Retraits", ENVOI: "Envois",
    RECEPTION: "Réceptions", CREDIT: "Crédits", REMBOURSEMENT: "Remboursements",
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Comptabilité"
        subtitle="Revenus, marges et analyse financière"
        action={
          <input type="month" value={mois} onChange={e => setMois(e.target.value)}
            className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-clay" />
        }
      />

      {loading ? (
        <div className="py-20 text-center text-ink-400">Chargement des données...</div>
      ) : !stats ? (
        <Card className="p-8 text-center">
          <Landmark size={32} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500">Configurez Supabase pour accéder aux données comptables en temps réel.</p>
          <p className="mt-2 text-[12px] text-ink-400">En mode démo, les transactions sont en localStorage et non disponibles ici.</p>
        </Card>
      ) : (
        <>
          {/* KPIs principaux */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { l: "Revenus commissions",   v: stats.revenus_commissions, icon: TrendingUp, accent: "leaf"  },
              { l: "Volume total traité",   v: stats.volume_transactions,  icon: BarChart2,  accent: "clay"  },
              { l: "Nb transactions",       v: stats.nb_transactions,      icon: PieChart,   accent: "ink",  num: true },
              { l: "Encours crédits",       v: encoursPrets,               icon: Landmark,   accent: "ember" },
            ].map(({ l, v, icon: Icon, accent, num }) => (
              <Card key={l} className="p-5">
                <div className="flex items-start justify-between">
                  <span className="text-[13px] font-medium text-ink-500">{l}</span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-${accent === "leaf" ? "leaf-100 text-leaf-600" : accent === "clay" ? "clay-100 text-clay-700" : accent === "ember" ? "ember-100 text-ember-600" : "ink/5 text-ink"}`}>
                    <Icon size={18} />
                  </span>
                </div>
                <div className="num mt-3 text-[26px] font-semibold leading-none text-ink">
                  {num ? v : formatXOF(Number(v))}
                </div>
              </Card>
            ))}
          </div>

          {/* Revenus par opérateur + Répartition */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="display mb-4 text-lg font-bold text-ink">Commissions par opérateur</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.par_operateur} margin={{ left: 0, right: 8 }}>
                  <XAxis dataKey="operateur" tick={{ fontSize: 10, fill: "#6B6157" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatXOFCompact(v)} tick={{ fontSize: 11, fill: "#8A8178" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: number) => [formatXOF(v), "Commissions"]} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
                  <Bar dataKey="frais" radius={[6,6,0,0]} fill="#C75B2A" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="display mb-2 text-lg font-bold text-ink">Par type</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RechartsPie>
                  <Pie data={stats.par_type.map(d => ({ ...d, name: typeLabels[d.type] ?? d.type }))} dataKey="frais" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                    {stats.par_type.map((_, i) => <Cell key={i} fill={COULEURS[i % COULEURS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatXOF(v)} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                </RechartsPie>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Évolution journalière */}
          {stats.evolution_30j.length > 0 && (
            <Card className="mt-4 p-5">
              <h3 className="display mb-4 text-lg font-bold text-ink">Évolution des commissions</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={stats.evolution_30j} margin={{ left: 0, right: 8 }}>
                  <XAxis dataKey="jour" tick={{ fontSize: 10, fill: "#6B6157" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatXOFCompact(v)} tick={{ fontSize: 11, fill: "#8A8178" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: number) => [formatXOF(v), "Commissions"]} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
                  <Line type="monotone" dataKey="frais" stroke="#C75B2A" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Tableau détaillé par opérateur */}
          <Card className="mt-4 overflow-hidden">
            <div className="border-b border-sand-200 px-5 py-4">
              <h3 className="display text-lg font-bold text-ink">Détail par opérateur</h3>
            </div>
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                    <th className="px-5 py-3 font-medium">Opérateur</th>
                    <th className="px-5 py-3 text-right font-medium">Nb opérations</th>
                    <th className="px-5 py-3 text-right font-medium">Volume traité</th>
                    <th className="px-5 py-3 text-right font-medium">Commissions</th>
                    <th className="px-5 py-3 text-right font-medium">Taux moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.par_operateur.map(row => (
                    <tr key={row.operateur} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                      <td className="px-5 py-3.5 font-medium text-ink">{row.operateur}</td>
                      <td className="num px-5 py-3.5 text-right text-ink-600">{row.nb}</td>
                      <td className="num px-5 py-3.5 text-right text-ink-600">{formatXOF(row.volume)}</td>
                      <td className="num px-5 py-3.5 text-right font-semibold text-leaf-600">+{formatXOF(row.frais)}</td>
                      <td className="num px-5 py-3.5 text-right text-ink-500">
                        {row.volume > 0 ? (row.frais / row.volume * 100).toFixed(2) + "%" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-sand-200 bg-sand-50 font-bold">
                    <td className="px-5 py-3 text-ink">TOTAL</td>
                    <td className="num px-5 py-3 text-right text-ink">{stats.nb_transactions}</td>
                    <td className="num px-5 py-3 text-right text-ink">{formatXOF(stats.volume_transactions)}</td>
                    <td className="num px-5 py-3 text-right text-leaf-600">+{formatXOF(stats.revenus_commissions)}</td>
                    <td className="num px-5 py-3 text-right text-ink-500">
                      {stats.volume_transactions > 0 ? (stats.revenus_commissions / stats.volume_transactions * 100).toFixed(2) + "%" : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
