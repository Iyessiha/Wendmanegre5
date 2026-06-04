"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, MapPin, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Btn, Modal, Field, inputCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { formatXOF, resteAPayer } from "@/lib/format";

export default function ClientsPage() {
  const { clients, prets, remboursements, ajouterClient } = useStore();
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ id: "", nom: "", ville: "", telephone: "", plafond: "" });

  type Row = typeof rows[0];

  const rows = useMemo(() => clients.map(c => {
    const encours = prets.filter(p => p.clientId === c.id && p.statut !== "rembourse").reduce((s, p) => s + resteAPayer(p, remboursements), 0);
    const nbPrets = prets.filter(p => p.clientId === c.id).length;
    return { ...c, encours, nbPrets };
  })
  .filter(c => c.nom.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase()) || c.ville.toLowerCase().includes(q.toLowerCase()))
  .sort((a, b) => b.encours - a.encours), [clients, prets, remboursements, q]);

  const columns: Column<Row>[] = [
    {
      key: "nom", label: "Commerçant", mobilePrimary: true,
      render: r => (
        <div>
          <Link href={`/clients/${encodeURIComponent(r.id)}`} className="font-medium text-ink hover:text-clay">{r.nom}</Link>
          <div className="num text-[11px] text-ink-400">{r.id}</div>
        </div>
      ),
    },
    {
      key: "ville", label: "Localité", mobileSecondary: true,
      render: r => (
        <span className="inline-flex items-center gap-1 text-ink-700">
          <MapPin size={12} className="text-ink-400" />{r.ville}
        </span>
      ),
    },
    {
      key: "plafond", label: "Plafond", mobileHide: true,
      render: r => {
        const pct = r.plafond > 0 ? Math.min(100, (r.encours / r.plafond) * 100) : 0;
        return (
          <div>
            <div className="num text-[13px]">{formatXOF(r.plafond)}</div>
            <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-sand-200">
              <div className={`h-full rounded-full ${pct > 85 ? "bg-ember" : pct > 60 ? "bg-gold" : "bg-leaf"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "encours", label: "Encours", align: "right",
      render: r => <span className={`num font-semibold ${r.encours > 0 ? "text-clay-700" : "text-ink-300"}`}>{formatXOF(r.encours)}</span>,
    },
    {
      key: "prets", label: "Prêts", align: "right", mobileHide: true,
      render: r => <span className="num text-ink-500">{r.nbPrets}</span>,
    },
    {
      key: "action", label: "", align: "right", mobileHide: true,
      render: r => (
        <Link href={`/clients/${encodeURIComponent(r.id)}`}
          className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink inline-flex">
          <ChevronRight size={16} />
        </Link>
      ),
    },
  ];

  function submit() {
    if (!form.nom || !form.ville) return;
    ajouterClient({
      id: form.id || "CU" + Math.floor(1000 + Math.random() * 8999) + "-" + Math.floor(10000 + Math.random() * 89999),
      nom: form.nom.toUpperCase(), ville: form.ville,
      telephone: form.telephone, plafond: Number(form.plafond) || 500_000,
    });
    setForm({ id: "", nom: "", ville: "", telephone: "", plafond: "" });
    setOpenNew(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Commerçants"
        subtitle={`${clients.length} sous-distributeurs dans le réseau`}
        action={
          <Btn onClick={() => setOpenNew(true)} className="tap">
            <Plus size={16} /> <span className="hidden sm:inline">Nouveau commerçant</span>
          </Btn>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
        <Search size={17} className="text-ink-400 flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher nom, code ou ville…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={r => r.id}
          onRowClick={r => { window.location.href = `/clients/${encodeURIComponent(r.id)}`; }}
          emptyMessage="Aucun commerçant trouvé."
          mobileCard={r => {
            const pct = r.plafond > 0 ? Math.min(100, (r.encours / r.plafond) * 100) : 0;
            return (
              <Link href={`/clients/${encodeURIComponent(r.id)}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink">{r.nom}</div>
                    <div className="num text-[11px] text-ink-400">{r.id}</div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-500">
                      <MapPin size={11} />{r.ville} · {r.nbPrets} prêt{r.nbPrets > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`num text-[15px] font-semibold ${r.encours > 0 ? "text-clay-700" : "text-ink-300"}`}>
                      {formatXOF(r.encours)}
                    </div>
                    <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-sand-200 ml-auto">
                      <div className={`h-full rounded-full ${pct > 85 ? "bg-ember" : pct > 60 ? "bg-gold" : "bg-leaf"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-ink-400 mt-0.5">{formatXOF(r.plafond)} plafond</div>
                  </div>
                </div>
              </Link>
            );
          }}
        />
      </Card>

      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nouveau commerçant">
        <Field label="Nom complet">
          <input className={inputCls} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="OUEDRAOGO Boukary" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Localité">
            <input className={inputCls} value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} placeholder="Yako" />
          </Field>
          <Field label="Téléphone">
            <input className={inputCls + " num"} value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} placeholder="+226..." />
          </Field>
        </div>
        <Field label="Plafond de crédit (XOF)">
          <input className={inputCls + " num"} type="number" value={form.plafond} onChange={e => setForm({ ...form, plafond: e.target.value })} placeholder="500000" />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenNew(false)}>Annuler</Btn>
          <Btn onClick={submit}>Enregistrer</Btn>
        </div>
      </Modal>
    </div>
  );
}
