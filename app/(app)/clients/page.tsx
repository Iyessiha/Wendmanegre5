"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, MapPin, ChevronRight, Edit2, Power, Download } from "lucide-react";
import { useClients, usePrets, upsertClient } from "@/lib/hooks";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { formatXOF } from "@/lib/format";

export default function ClientsPage() {
  const { data: clients, loading, refetch } = useClients();
  const { data: prets } = usePrets();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "actifs" | "inactifs" | "depassement">("tous");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", nom: "", nom_alternatif: "", ville: "", telephone: "", plafond: "", identifiant_pro1: "", identifiant_pro2: "", actif: true });

  type Row = (typeof clients)[number] & { encours: number; nbPrets: number };

  const rows: Row[] = useMemo(() => clients.map(c => {
    const sesPrets = prets.filter(p => p.client_id === c.id);
    const encours = sesPrets
      .filter(p => p.statut !== "rembourse" && p.statut !== "annule")
      .reduce((s, p) => s + (p.reste_a_payer ?? 0), 0);
    return { ...c, encours, nbPrets: sesPrets.length };
  })
  .filter(c => {
    const texte = c.nom.toLowerCase().includes(q.toLowerCase()) ||
      c.id.toLowerCase().includes(q.toLowerCase()) ||
      c.ville.toLowerCase().includes(q.toLowerCase());
    if (!texte) return false;
    if (filtre === "actifs") return c.actif !== false;
    if (filtre === "inactifs") return c.actif === false;
    if (filtre === "depassement") return c.plafond > 0 && c.encours > c.plafond;
    return true;
  })
  .sort((a, b) => b.encours - a.encours), [clients, prets, q, filtre]);

  const stats = useMemo(() => {
    const actifs = clients.filter((c: any) => c.actif !== false).length;
    const encoursTotal = rows.reduce((s, r) => s + r.encours, 0);
    const depass = rows.filter(r => r.plafond > 0 && r.encours > r.plafond).length;
    return { total: clients.length, actifs, encoursTotal, depass };
  }, [clients, rows]);

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
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {r.actif === false && <Badge className="bg-ember-100 text-ember-600 mr-1">Inactif</Badge>}
          <button onClick={() => ouvrirEdit(r)} title="Modifier" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink"><Edit2 size={15} /></button>
          <button onClick={() => toggleActif(r)} title={r.actif === false ? "Réactiver" : "Désactiver"} className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ember-600"><Power size={15} /></button>
          <Link href={`/clients/${encodeURIComponent(r.id)}`} title="Détail" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink inline-flex"><ChevronRight size={16} /></Link>
        </div>
      ),
    },
  ];

  function resetForm() { setForm({ id: "", nom: "", nom_alternatif: "", ville: "", telephone: "", plafond: "", identifiant_pro1: "", identifiant_pro2: "", actif: true }); }
  function ouvrirNew() { setErreur(null); setEditId(null); resetForm(); setOpenNew(true); }
  function ouvrirEdit(c: any) {
    setErreur(null); setEditId(c.id);
    setForm({
      id: c.id, nom: c.nom ?? "", nom_alternatif: c.nom_alternatif ?? "", ville: c.ville ?? "",
      telephone: c.telephone ?? "", plafond: String(c.plafond ?? ""), identifiant_pro1: c.identifiant_pro1 ?? "",
      identifiant_pro2: c.identifiant_pro2 ?? "", actif: c.actif !== false,
    });
    setOpenNew(true);
  }
  async function toggleActif(c: any) {
    const actif = !(c.actif !== false);
    if (!confirm(actif ? `Réactiver ${c.nom} ?` : `Désactiver ${c.nom} ? Il n'apparaîtra plus dans les listes actives.`)) return;
    try { await upsertClient({ id: c.id, actif } as any); refetch(); } catch (e: any) { alert(e?.message ?? "Erreur."); }
  }
  function exporterCSV() {
    const entetes = ["Code", "Nom", "Localité", "Téléphone", "Plafond", "Encours", "Prêts", "Actif"];
    const lignes = rows.map(r => [r.id, r.nom, r.ville, (r as any).telephone ?? "", r.plafond, r.encours, r.nbPrets, r.actif === false ? "Non" : "Oui"]);
    const csv = [entetes, ...lignes].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `commercants-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!form.nom || !form.ville) { setErreur("Le nom et la localité sont requis."); return; }
    setSaving(true); setErreur(null);
    try {
      await upsertClient({
        id: editId || form.id || "CU" + Math.floor(1000 + Math.random() * 8999) + "-" + Math.floor(10000 + Math.random() * 89999),
        nom: form.nom.toUpperCase(),
        nom_alternatif: form.nom_alternatif || null,
        ville: form.ville,
        telephone: form.telephone || null,
        plafond: Number(form.plafond) || 500_000,
        identifiant_pro1: form.identifiant_pro1 || null,
        identifiant_pro2: form.identifiant_pro2 || null,
        actif: form.actif,
      } as any);
      resetForm(); setEditId(null); setOpenNew(false); refetch();
    } catch (e: any) {
      setErreur(e?.message ?? "Erreur lors de l'enregistrement.");
    }
    setSaving(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Commerçants"
        subtitle={`${clients.length} sous-distributeurs dans le réseau`}
        action={
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={exporterCSV} className="tap"><Download size={16} /> <span className="hidden sm:inline">Exporter</span></Btn>
            <Btn onClick={ouvrirNew} className="tap"><Plus size={16} /> <span className="hidden sm:inline">Nouveau commerçant</span></Btn>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Commerçants", v: String(stats.total) },
          { l: "Actifs", v: String(stats.actifs) },
          { l: "Encours réseau", v: formatXOF(stats.encoursTotal) },
          { l: "Dépassements", v: String(stats.depass), alerte: stats.depass > 0 },
        ].map((s, i) => (
          <Card key={i} className="p-4">
            <div className="text-[12px] text-ink-400">{s.l}</div>
            <div className={`num mt-1 text-xl font-bold ${s.alerte ? "text-ember-600" : "text-ink"}`}>{s.v}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
        <Search size={17} className="text-ink-400 flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher nom, code ou ville…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {([["tous", "Tous"], ["actifs", "Actifs"], ["inactifs", "Inactifs"], ["depassement", "En dépassement"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFiltre(v)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${filtre === v ? "bg-clay text-sand-50" : "bg-white/70 border border-sand-200 text-ink-500 hover:bg-sand-200"}`}>
            {l}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={r => r.id}
          onRowClick={r => { window.location.href = `/clients/${encodeURIComponent(r.id)}`; }}
          emptyMessage={loading ? "Chargement…" : "Aucun commerçant trouvé."}
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

      <Modal open={openNew} onClose={() => setOpenNew(false)} title={editId ? `Modifier — ${form.nom}` : "Nouveau commerçant"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nom complet">
            <input className={inputCls} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="OUEDRAOGO Boukary" />
          </Field>
          <Field label="Nom commercial (optionnel)">
            <input className={inputCls} value={form.nom_alternatif} onChange={e => setForm({ ...form, nom_alternatif: e.target.value })} placeholder="Boutique Centre" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="N° identifiant pro 1 (optionnel)">
            <input className={inputCls} value={form.identifiant_pro1} onChange={e => setForm({ ...form, identifiant_pro1: e.target.value })} />
          </Field>
          <Field label="N° identifiant pro 2 (optionnel)">
            <input className={inputCls} value={form.identifiant_pro2} onChange={e => setForm({ ...form, identifiant_pro2: e.target.value })} />
          </Field>
        </div>
        {editId && (
          <label className="mt-1 flex items-center gap-2 text-[13px] text-ink-600">
            <input type="checkbox" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} />
            Commerçant actif
          </label>
        )}
        {erreur && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenNew(false)}>Annuler</Btn>
          <Btn onClick={submit} className={saving ? "opacity-50" : ""}>{saving ? "Enregistrement…" : editId ? "Enregistrer" : "Créer"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
