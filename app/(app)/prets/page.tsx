"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Printer, Eye } from "lucide-react";
import { usePrets } from "@/lib/hooks";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { formatXOF, formatDate, statutLabel } from "@/lib/format";

const STATUTS = [
  { v: "tous", l: "Tous" },
  { v: "impaye",   l: "Impayés"    },
  { v: "partiel",  l: "Partiels"   },
  { v: "retard",   l: "En retard"  },
  { v: "rembourse",l: "Remboursés" },
];

export default function PretsPage() {
  const { data: prets, loading } = usePrets();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("tous");

  type Row = (typeof prets)[number] & {
    clientNom: string; ville: string; reste: number; retard: number; statutEffectif: string;
  };

  const rows: Row[] = useMemo(() => prets.map(p => {
    const retard = p.jours_retard ?? 0;
    const reste = p.reste_a_payer ?? 0;
    const statutEffectif =
      p.statut !== "rembourse" && p.statut !== "annule" && retard > 0 && p.statut !== "partiel"
        ? "retard" : p.statut;
    return { ...p, clientNom: p.client_nom ?? p.client_id, ville: p.client_ville ?? "", reste, retard, statutEffectif };
  })
  .filter(p => filtre === "tous" ? p.statut !== "annule" : p.statutEffectif === filtre)
  .filter(p => p.clientNom.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase()))
  .sort((a, b) => b.date_octroi.localeCompare(a.date_octroi)), [prets, q, filtre]);

  const totalEncours = rows.filter(r => r.statut !== "rembourse").reduce((s, r) => s + r.reste, 0);

  const columns: Column<Row>[] = [
    {
      key: "id", label: "Référence", mobilePrimary: true,
      render: r => <span className="num text-ink-700 text-[13px]">{r.id}</span>,
    },
    {
      key: "client", label: "Commerçant", mobileSecondary: true,
      render: r => (
        <div>
          <Link href={`/clients/${encodeURIComponent(r.client_id)}`} className="font-medium text-ink hover:text-clay">{r.clientNom}</Link>
          <div className="text-[11px] text-ink-400 hidden lg:block">{r.ville}</div>
        </div>
      ),
    },
    { key: "type", label: "Type", mobileHide: true, render: r => <span className="text-ink-700">{r.type_operation}</span> },
    {
      key: "echeance", label: "Échéance",
      render: r => (
        <div className="text-ink-500 text-[13px]">
          {formatDate(r.echeance)}
          {r.retard > 0 && r.statut !== "rembourse" && <span className="ml-1 text-[11px] text-ember">+{r.retard}j</span>}
        </div>
      ),
    },
    { key: "montant", label: "Montant", align: "right", render: r => <span className="num">{formatXOF(r.montant)}</span> },
    {
      key: "reste", label: "Reste dû", align: "right",
      render: r => <span className={`num font-semibold ${r.reste > 0 ? "text-clay-700" : "text-ink-300"}`}>{r.reste > 0 ? formatXOF(r.reste) : "—"}</span>,
    },
    {
      key: "statut", label: "Statut",
      render: r => { const st = statutLabel(r.statutEffectif as any); return <Badge className={st.cls}>{st.label}</Badge>; },
    },
    {
      key: "actions", label: "", align: "right", mobileHide: false,
      render: r => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/clients/${encodeURIComponent(r.client_id)}`}
            className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink tap">
            <Eye size={15} />
          </Link>
          <a href={`/receipt/pret/${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer"
            className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-clay tap">
            <Printer size={15} />
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Prêts & encours"
        subtitle={`${rows.length} créances · ${formatXOF(totalEncours)} d'encours`}
      />

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
        <Search size={17} className="text-ink-400 flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher une créance ou un commerçant…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {STATUTS.map(s => (
          <button key={s.v} onClick={() => setFiltre(s.v)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${filtre === s.v ? "bg-clay text-sand-50" : "bg-white/70 border border-sand-200 text-ink-500 hover:bg-sand-200"}`}>
            {s.l}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={r => r.id}
          emptyMessage={loading ? "Chargement…" : "Aucune créance pour ce filtre."}
          mobileCard={r => {
            const st = statutLabel(r.statutEffectif as any);
            return (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{r.clientNom}</span>
                    <Badge className={st.cls + " text-[10px]"}>{st.label}</Badge>
                  </div>
                  <div className="num mt-0.5 text-[11px] text-ink-400">{r.id} · {r.type_operation}</div>
                  <div className="mt-1 text-[12px] text-ink-500">
                    Échéance {formatDate(r.echeance)}
                    {r.retard > 0 && r.statut !== "rembourse" && <span className="ml-1 text-ember">+{r.retard}j retard</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={`num text-[15px] font-semibold ${r.reste > 0 ? "text-clay-700" : "text-leaf-600"}`}>
                    {r.reste > 0 ? formatXOF(r.reste) : "Soldé"}
                  </div>
                  <div className="num text-[11px] text-ink-400">{formatXOF(r.montant)}</div>
                  <div className="mt-1.5 flex justify-end gap-1">
                    <Link href={`/clients/${encodeURIComponent(r.client_id)}`} className="tap p-1 rounded-lg bg-sand-200 text-ink-600">
                      <Eye size={14} />
                    </Link>
                    <a href={`/receipt/pret/${encodeURIComponent(r.id)}`} target="_blank"
                      className="tap p-1 rounded-lg bg-clay-100 text-clay-700">
                      <Printer size={14} />
                    </a>
                  </div>
                </div>
              </div>
            );
          }}
        />
      </Card>
    </div>
  );
}
