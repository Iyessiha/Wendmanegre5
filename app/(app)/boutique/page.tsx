"use client";

import { useState, useMemo } from "react";
import {
  Package, Warehouse, Truck, History, ClipboardList,
  BarChart2, Plus, Search, Edit2, Printer, ShoppingCart,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertTriangle,
  Check, X, ChevronDown, Filter,
} from "lucide-react";
import {
  useProduits, useFournisseurs, useCommandes, useMouvements, useVentes,
  creerVente, ajusterStock,
  type Produit, type CommandeFournisseur,
} from "@/lib/hooks-stock";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Constantes ────────────────────────────────────────────

const TABS = [
  { id: "catalogue",        label: "Catalogue",       icon: Package     },
  { id: "entrepots",        label: "Entrepôts",       icon: Warehouse   },
  { id: "fournisseurs",     label: "Fournisseurs",    icon: Truck       },
  { id: "commandes",        label: "Commandes",       icon: ClipboardList},
  { id: "mouvements",       label: "Mouvements",      icon: History     },
  { id: "ventes",           label: "Ventes POS",      icon: ShoppingCart},
  { id: "analyses",         label: "Analyses",        icon: BarChart2   },
];

const NIVEAU_BADGE: Record<string, string> = {
  normal:   "bg-leaf-100 text-leaf-600",
  faible:   "bg-gold-100 text-clay-700",
  critique: "bg-ember-100 text-ember-600",
  rupture:  "bg-red-100 text-red-700",
};

const STATUT_CMD: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon",   cls: "bg-sand-200 text-ink-600"   },
  validee:   { label: "Validée",     cls: "bg-blue-100 text-blue-700"  },
  recue:     { label: "Reçue",       cls: "bg-leaf-100 text-leaf-600"  },
  facturee:  { label: "Facturée",    cls: "bg-gold-100 text-clay-700"  },
  annulee:   { label: "Annulée",     cls: "bg-ember-100 text-ember-600"},
};

const MOTIF_MVT: Record<string, { label: string; icon: typeof ArrowUpCircle; cls: string }> = {
  reception_commande: { label: "Réception cmd", icon: ArrowDownCircle, cls: "bg-leaf-100 text-leaf-600"   },
  vente:              { label: "Vente",          icon: ArrowUpCircle,  cls: "bg-clay-100 text-clay-700"   },
  perte:              { label: "Perte",          icon: ArrowUpCircle,  cls: "bg-ember-100 text-ember-600" },
  ajustement:         { label: "Ajustement",     icon: RefreshCw,      cls: "bg-sand-200 text-ink-600"   },
  ajustement_inventaire:{ label: "Inventaire",   icon: RefreshCw,      cls: "bg-blue-100 text-blue-700"  },
};

const COULEURS = ["#C75B2A","#2F6B4F","#C9962E","#378ADD","#7F77DD","#B23A2E","#6B6157"];

// ── Composant principal ───────────────────────────────────

export default function BoutiquePage() {
  const [tab, setTab] = useState("catalogue");
  const { data: produits, refetch: refetchProduits } = useProduits();
  const { data: fournisseurs } = useFournisseurs();
  const { data: commandes } = useCommandes();
  const { data: mouvements } = useMouvements();
  const { data: ventes } = useVentes();

  // Filtres catalogue
  const [q, setQ] = useState("");
  const [catFiltre, setCatFiltre] = useState("tout");
  const [niveauFiltre, setNiveauFiltre] = useState("tout");
  const [entrepotFiltre, setEntrepotFiltre] = useState("tout");

  // Modals
  const [openVente, setOpenVente] = useState<Produit | null>(null);
  const [openAjustement, setOpenAjustement] = useState<Produit | null>(null);
  const [openNouveauProduit, setOpenNouveauProduit] = useState(false);
  const [openCommande, setOpenCommande] = useState<CommandeFournisseur | null>(null);
  const [openNouvelleCommande, setOpenNouvelleCommande] = useState(false);

  // Forms
  const [venteForm, setVenteForm] = useState({ quantite: "1", remise: "0", mode: "Espèces", client_nom: "", client_tel: "" });
  const [ajustForm, setAjustForm] = useState({ quantite: "", motif: "perte", notes: "" });
  const [prodForm, setProdForm] = useState({ nom: "", categorie: "SIM", code_barre: "", prix_unitaire: "", prix_achat: "", stock: "", seuil_alerte: "10", entrepot: "Yako Centre", fournisseur_id: "", notes: "" });

  // Stats globales
  const stats = useMemo(() => {
    const valeurAchat   = produits.reduce((s, p) => s + p.valeur_achat, 0);
    const valeurVente   = produits.reduce((s, p) => s + p.valeur_vente, 0);
    const margeStock    = produits.reduce((s, p) => s + p.marge_potentielle, 0);
    const enRupture     = produits.filter(p => p.niveau_stock === "rupture").length;
    const enCritique    = produits.filter(p => p.niveau_stock === "critique").length;
    const CAMois        = ventes.filter(v => v.date_vente >= "2026-06-01").reduce((s, v) => s + v.montant_total, 0);
    const margeMois     = ventes.filter(v => v.date_vente >= "2026-06-01").reduce((s, v) => s + v.marge, 0);
    return { valeurAchat, valeurVente, margeStock, enRupture, enCritique, CAMois, margeMois };
  }, [produits, ventes]);

  // Catalogue filtré
  const categories = useMemo(() => ["tout", ...Array.from(new Set(produits.map(p => p.categorie))).sort()], [produits]);
  const entrepots  = useMemo(() => ["tout", ...Array.from(new Set(produits.map(p => p.entrepot))).sort()], [produits]);

  const produitsFiltres = useMemo(() => produits.filter(p =>
    (catFiltre === "tout"     || p.categorie === catFiltre) &&
    (niveauFiltre === "tout"  || p.niveau_stock === niveauFiltre) &&
    (entrepotFiltre === "tout"|| p.entrepot === entrepotFiltre) &&
    (q === "" || p.nom.toLowerCase().includes(q.toLowerCase()) || (p.code_barre ?? "").includes(q))
  ), [produits, catFiltre, niveauFiltre, entrepotFiltre, q]);

  // Données graphiques
  const parCategorie = useMemo(() => {
    const m: Record<string, { vente: number; achat: number }> = {};
    produits.forEach(p => {
      if (!m[p.categorie]) m[p.categorie] = { vente: 0, achat: 0 };
      m[p.categorie].vente += p.valeur_vente;
      m[p.categorie].achat += p.valeur_achat;
    });
    return Object.entries(m).map(([categorie, v]) => ({ categorie, ...v, marge: v.vente - v.achat }));
  }, [produits]);

  const topVentes = useMemo(() => {
    const m: Record<string, { nom: string; qte: number; ca: number; marge: number }> = {};
    ventes.filter(v => !v.annulee).forEach(v => {
      if (!m[v.produit_id]) m[v.produit_id] = { nom: v.produit_nom, qte: 0, ca: 0, marge: 0 };
      m[v.produit_id].qte   += v.quantite;
      m[v.produit_id].ca    += v.montant_total;
      m[v.produit_id].marge += v.marge;
    });
    return Object.values(m).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [ventes]);

  async function submitVente() {
    if (!openVente) return;
    await creerVente({
      produit_id: openVente.id, quantite: Number(venteForm.quantite),
      prix_unitaire: openVente.prix_unitaire, remise_pct: Number(venteForm.remise),
      cout_achat: openVente.prix_achat, mode_paiement: venteForm.mode,
      client_nom: venteForm.client_nom || undefined,
      client_tel: venteForm.client_tel || undefined,
    });
    setOpenVente(null);
    refetchProduits();
  }

  async function submitAjustement() {
    if (!openAjustement) return;
    const q = ajustForm.motif === "perte" ? -Math.abs(Number(ajustForm.quantite)) : Number(ajustForm.quantite);
    await ajusterStock(openAjustement.id, q, ajustForm.motif);
    setOpenAjustement(null);
    refetchProduits();
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Boutique & Stock"
        subtitle={`Valeur catalogue ${formatXOF(stats.valeurVente)} · Marge potentielle ${formatXOF(stats.margeStock)}`}
      />

      {/* Tabs scrollables */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-ink text-sand-50" : "bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── CATALOGUE ── */}
      {tab === "catalogue" && (
        <div>
          {/* KPIs alertes */}
          {(stats.enRupture > 0 || stats.enCritique > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {stats.enRupture > 0 && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle size={15} />
                  <strong>{stats.enRupture} produit{stats.enRupture > 1 ? "s" : ""} en rupture</strong>
                </div>
              )}
              {stats.enCritique > 0 && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-ember-100 px-3 py-2 text-sm text-ember-600">
                  <AlertTriangle size={15} />
                  {stats.enCritique} produit{stats.enCritique > 1 ? "s" : ""} en stock critique
                </div>
              )}
            </div>
          )}

          {/* Filtres */}
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
              <Search size={16} className="text-ink-400 flex-shrink-0" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Nom, code-barres…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {[
                { val: catFiltre, set: setCatFiltre, opts: categories, placeholder: "Catégorie" },
                { val: niveauFiltre, set: setNiveauFiltre, opts: ["tout","normal","faible","critique","rupture"], placeholder: "Stock" },
                { val: entrepotFiltre, set: setEntrepotFiltre, opts: entrepots, placeholder: "Entrepôt" },
              ].map(({ val, set, opts, placeholder }) => (
                <select key={placeholder} value={val} onChange={e => set(e.target.value)}
                  className="flex-shrink-0 rounded-xl border border-sand-200 bg-white/70 px-3 py-2 text-sm text-ink-600 outline-none focus:border-clay">
                  {opts.map(o => <option key={o} value={o}>{o === "tout" ? placeholder : o}</option>)}
                </select>
              ))}
            </div>
          </div>
          <div className="mb-3 flex justify-between items-center">
            <span className="text-[13px] text-ink-500">{produitsFiltres.length} produits</span>
            <Btn onClick={() => setOpenNouveauProduit(true)} className="tap"><Plus size={15} /> Ajouter</Btn>
          </div>

          {/* Tableau catalogue */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                    {["Produit","Catégorie","Entrepôt","P. Vente","P. Achat","Marge","Stock","Valeur",""].map(h => (
                      <th key={h} className={`px-4 py-3 font-medium ${h && !["Produit","Catégorie","Entrepôt"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produitsFiltres.map(p => {
                    const margePct = p.prix_achat > 0 ? ((p.prix_unitaire - p.prix_achat) / p.prix_achat * 100) : 0;
                    return (
                      <tr key={p.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-ink">{p.nom}</div>
                          {p.code_barre && <div className="num text-[10px] text-ink-400">{p.code_barre}</div>}
                        </td>
                        <td className="px-4 py-3.5 text-ink-600">{p.categorie}</td>
                        <td className="px-4 py-3.5 text-ink-500 text-[13px]">{p.entrepot}</td>
                        <td className="num px-4 py-3.5 text-right font-medium">{formatXOF(p.prix_unitaire)}</td>
                        <td className="num px-4 py-3.5 text-right text-ink-500">{p.prix_achat > 0 ? formatXOF(p.prix_achat) : "—"}</td>
                        <td className="num px-4 py-3.5 text-right text-leaf-600 text-[13px]">
                          {margePct > 0 ? margePct.toFixed(0) + "%" : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Badge className={NIVEAU_BADGE[p.niveau_stock] + " font-mono"}>
                            {p.stock}
                          </Badge>
                        </td>
                        <td className="num px-4 py-3.5 text-right text-ink-600">{formatXOF(p.valeur_vente)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setOpenVente(p); setVenteForm({ quantite:"1", remise:"0", mode:"Espèces", client_nom:"", client_tel:"" }); }}
                              title="Vendre" className="p-1.5 rounded-lg bg-leaf-100 text-leaf-600 hover:bg-leaf-100/70 tap">
                              <ShoppingCart size={14} />
                            </button>
                            <button onClick={() => { setOpenAjustement(p); setAjustForm({ quantite:"", motif:"perte", notes:"" }); }}
                              title="Ajuster stock" className="p-1.5 rounded-lg bg-sand-200 text-ink-600 hover:bg-sand-300 tap">
                              <RefreshCw size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {produitsFiltres.length === 0 && (
                    <tr><td colSpan={9} className="py-10 text-center text-sm text-ink-400">Aucun produit pour ce filtre.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Résumé stock en bas */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { l: "Valeur au coût",    v: stats.valeurAchat,  cls: "text-ink-700" },
              { l: "Valeur catalogue",  v: stats.valeurVente,  cls: "text-ink"     },
              { l: "Marge potentielle", v: stats.margeStock,   cls: "text-leaf-600"},
            ].map(({ l, v, cls }) => (
              <Card key={l} className="p-3 text-center">
                <div className="text-[11px] text-ink-400">{l}</div>
                <div className={`num mt-1 text-[15px] font-semibold ${cls}`}>{formatXOF(v)}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── ENTREPÔTS ── */}
      {tab === "entrepots" && (
        <div>
          {entrepots.filter(e => e !== "tout").map(ent => {
            const prods = produits.filter(p => p.entrepot === ent);
            const valTot = prods.reduce((s, p) => s + p.valeur_vente, 0);
            const nbAlertes = prods.filter(p => ["critique","rupture"].includes(p.niveau_stock)).length;
            return (
              <div key={ent} className="mb-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5">
                    <Warehouse size={18} className="text-ink-600" />
                  </span>
                  <div>
                    <h3 className="display text-base font-bold text-ink">{ent}</h3>
                    <div className="text-[12px] text-ink-500">
                      {prods.length} produits · valeur {formatXOF(valTot)}
                      {nbAlertes > 0 && <span className="ml-2 text-ember-600">{nbAlertes} alerte{nbAlertes > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                </div>
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                          <th className="px-5 py-2 text-left font-medium">Produit</th>
                          <th className="px-5 py-2 text-right font-medium">Stock</th>
                          <th className="px-5 py-2 text-right font-medium">Seuil</th>
                          <th className="px-5 py-2 text-right font-medium">Valeur</th>
                          <th className="px-5 py-2 text-right font-medium">Niveau</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prods.map(p => (
                          <tr key={p.id} className="border-b border-sand-100 last:border-0">
                            <td className="px-5 py-2.5 font-medium text-ink">{p.nom}</td>
                            <td className="num px-5 py-2.5 text-right">{p.stock}</td>
                            <td className="num px-5 py-2.5 text-right text-ink-400">{p.seuil_alerte}</td>
                            <td className="num px-5 py-2.5 text-right">{formatXOF(p.valeur_vente)}</td>
                            <td className="px-5 py-2.5 text-right">
                              <Badge className={NIVEAU_BADGE[p.niveau_stock]}>{p.niveau_stock}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FOURNISSEURS ── */}
      {tab === "fournisseurs" && (
        <div>
          <div className="mb-4 flex justify-end">
            <Btn><Plus size={15} /> Nouveau fournisseur</Btn>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fournisseurs.map(f => (
              <Card key={f.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink">{f.nom}</span>
                      <Badge className={f.type === "OPERATEUR" ? "bg-clay-100 text-clay-700" : "bg-sand-200 text-ink-600"}>
                        {f.type}
                      </Badge>
                    </div>
                    {f.contact && <div className="text-[12px] text-ink-400 mt-0.5">{f.contact}</div>}
                  </div>
                  <button className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 tap"><Edit2 size={15} /></button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  {f.telephone && <div className="text-ink-600">📞 {f.telephone}</div>}
                  {f.email     && <div className="text-ink-600">✉ {f.email}</div>}
                  {f.adresse   && <div className="text-ink-600">📍 {f.adresse}</div>}
                  <div className="text-ink-600">⏱ Délai : {f.delai_livraison}j</div>
                  <div className="text-ink-600">💳 {f.conditions_paiement}</div>
                  {f.nb_commandes && <div className="text-ink-600">📦 {f.nb_commandes} commandes</div>}
                </div>
                {f.solde_du > 0 && (
                  <div className="mt-3 rounded-xl bg-ember-100 px-3 py-2 text-[12px] text-ember-600">
                    Dette en cours : <span className="num font-bold">{formatXOF(f.solde_du)}</span>
                  </div>
                )}
                {f.derniere_commande && (
                  <div className="mt-2 text-[11px] text-ink-400">
                    Dernière commande : {new Date(f.derniere_commande).toLocaleDateString("fr-FR")}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── COMMANDES FOURNISSEURS ── */}
      {tab === "commandes" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[13px] text-ink-500">
              {commandes.filter(c => c.statut === "validee").length} en attente de livraison
            </div>
            <Btn onClick={() => setOpenNouvelleCommande(true)}><Plus size={15} /> Nouvelle commande</Btn>
          </div>

          <div className="space-y-4">
            {commandes.map(cmd => {
              const st = STATUT_CMD[cmd.statut];
              return (
                <Card key={cmd.id} className="overflow-hidden">
                  <div className="px-5 py-4 border-b border-sand-100">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-ink">{cmd.fournisseur_nom}</span>
                          <Badge className={st.cls}>{st.label}</Badge>
                        </div>
                        <div className="text-[12px] text-ink-400 mt-0.5">
                          Passée le {new Date(cmd.date_commande).toLocaleDateString("fr-FR")}
                          {cmd.date_livraison_prevue && ` · Livraison prévue ${new Date(cmd.date_livraison_prevue).toLocaleDateString("fr-FR")}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-lg font-semibold text-ink">{formatXOF(cmd.montant_total)}</div>
                        <div className="flex gap-1.5 mt-1 justify-end">
                          {cmd.statut === "brouillon" && (
                            <button className="rounded-lg bg-clay text-sand-50 px-2.5 py-1 text-[12px] font-medium hover:bg-clay-600">✓ Valider</button>
                          )}
                          {cmd.statut === "validee" && (
                            <button className="rounded-lg bg-leaf-100 text-leaf-600 px-2.5 py-1 text-[12px] font-medium hover:bg-leaf-100/70">📦 Réceptionner</button>
                          )}
                          <button onClick={() => setOpenCommande(cmd)}
                            className="rounded-lg bg-sand-200 text-ink-600 px-2.5 py-1 text-[12px] hover:bg-sand-300">Détail</button>
                          <a href={`/receipt/commande/${cmd.id}`} target="_blank"
                            className="rounded-lg bg-sand-200 text-ink-600 px-2.5 py-1 text-[12px] hover:bg-sand-300 tap">
                            <Printer size={13} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Lignes */}
                  <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-ink-500">
                    {cmd.lignes.map(l => (
                      <span key={l.id}>{l.produit_nom ?? l.description} ×{l.quantite}</span>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MOUVEMENTS ── */}
      {tab === "mouvements" && (
        <div>
          <Card className="overflow-hidden">
            <div className="border-b border-sand-200 px-5 py-3 flex items-center justify-between">
              <h3 className="display text-base font-bold text-ink">Journal des mouvements</h3>
              <Btn variant="soft" onClick={() => setOpenAjustement(produits[0])}><Plus size={15} /> Entrée / Sortie manuelle</Btn>
            </div>
            <div className="divide-y divide-sand-100">
              {mouvements.map(m => {
                const def = MOTIF_MVT[m.motif] ?? { label: m.motif, icon: RefreshCw, cls: "bg-sand-200 text-ink-600" };
                const Icon = def.icon;
                const isEntree = m.quantite > 0;
                return (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-sand-100/60">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${def.cls}`}>
                        <Icon size={15} />
                      </span>
                      <div>
                        <div className="text-sm font-medium text-ink">{m.produit_nom}</div>
                        <div className="text-[11px] text-ink-400">
                          {def.label} {m.reference_id ? `· ${m.reference_id}` : ""} · {new Date(m.date_mvt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                    <span className={`num text-base font-semibold ${isEntree ? "text-leaf-600" : "text-clay-700"}`}>
                      {isEntree ? "+" : ""}{m.quantite}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── VENTES POS ── */}
      {tab === "ventes" && (
        <div>
          {/* KPIs ventes */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "CA ce mois",       v: formatXOF(stats.CAMois),    cls: "text-ink"      },
              { l: "Marge ce mois",    v: formatXOF(stats.margeMois), cls: "text-leaf-600" },
              { l: "Nb de ventes",     v: String(ventes.filter(v => !v.annulee).length), cls: "text-ink" },
              { l: "Panier moyen",     v: ventes.length > 0 ? formatXOF(Math.round(ventes.reduce((s,v)=>s+v.montant_total,0)/ventes.length)) : "—", cls: "text-ink" },
            ].map(({ l, v, cls }) => (
              <Card key={l} className="p-4">
                <div className="text-[12px] text-ink-400">{l}</div>
                <div className={`num mt-1 text-xl font-semibold ${cls}`}>{v}</div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-[12px] uppercase tracking-wide text-ink-400">
                    {["Numéro","Produit","Date","Qté","Total","Marge","Mode paiement",""].map(h => (
                      <th key={h} className={`px-4 py-3 font-medium ${["Total","Marge"].includes(h) ? "text-right" : h === "Qté" ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventes.map(v => (
                    <tr key={v.id} className={`border-b border-sand-100 last:border-0 ${v.annulee ? "opacity-50" : "hover:bg-sand-100/60"}`}>
                      <td className="num px-4 py-3 text-ink-500">{v.numero}</td>
                      <td className="px-4 py-3 font-medium text-ink">{v.produit_nom}</td>
                      <td className="px-4 py-3 text-ink-500">{new Date(v.date_vente).toLocaleDateString("fr-FR")}</td>
                      <td className="num px-4 py-3 text-center">{v.quantite}</td>
                      <td className="num px-4 py-3 text-right font-semibold text-ink">{formatXOF(v.montant_total)}</td>
                      <td className="num px-4 py-3 text-right text-leaf-600">+{formatXOF(v.marge)}</td>
                      <td className="px-4 py-3"><Badge className="bg-sand-200 text-ink-600">{v.mode_paiement}</Badge></td>
                      <td className="px-4 py-3">
                        <a href={`/receipt/vente/${v.id}`} target="_blank" className="tap p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 inline-flex"><Printer size={14} /></a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── ANALYSES ── */}
      {tab === "analyses" && (
        <div>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Valeur par catégorie */}
            <Card className="p-5">
              <h3 className="display mb-4 text-base font-bold text-ink">Valeur de stock par catégorie</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={parCategorie} margin={{ left: 0, right: 0 }}>
                  <XAxis dataKey="categorie" tick={{ fontSize: 10, fill: "#6B6157" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => (v/1000).toFixed(0)+"k"} tick={{ fontSize: 10, fill: "#8A8178" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: number) => formatXOF(v)} contentStyle={{ borderRadius: 12, border: "1px solid #EFE4D2", fontSize: 12 }} />
                  <Bar dataKey="vente" name="Valeur vente" fill="#C75B2A" radius={[4,4,0,0]} />
                  <Bar dataKey="achat" name="Valeur achat" fill="#2F6B4F" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Top ventes */}
            <Card className="p-5">
              <h3 className="display mb-4 text-base font-bold text-ink">Top ventes du mois</h3>
              <div className="space-y-2.5">
                {topVentes.map((p, i) => (
                  <div key={p.nom} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 text-[13px] font-bold text-ink-400">#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink truncate">{p.nom}</div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-sand-200">
                        <div className="h-full rounded-full bg-clay" style={{ width: `${Math.round(p.ca / topVentes[0].ca * 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="num text-[13px] font-semibold text-ink">{formatXOF(p.ca)}</div>
                      <div className="num text-[11px] text-leaf-600">+{formatXOF(p.marge)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Tableau marges par produit */}
            <Card className="p-5 lg:col-span-2 overflow-hidden">
              <h3 className="display mb-4 text-base font-bold text-ink">Analyse des marges</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sand-200 text-[12px] uppercase text-ink-400">
                      {["Produit","Catégorie","P. Achat","P. Vente","Marge unit.","Taux %","Stock","Marge stock totale"].map(h => (
                        <th key={h} className={`px-4 py-2 font-medium ${["P. Achat","P. Vente","Marge unit.","Taux %","Stock","Marge stock totale"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...produits].sort((a, b) => b.marge_potentielle - a.marge_potentielle).map(p => {
                      const pct = p.prix_achat > 0 ? ((p.prix_unitaire - p.prix_achat) / p.prix_achat * 100) : 0;
                      return (
                        <tr key={p.id} className="border-b border-sand-100 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-ink">{p.nom}</td>
                          <td className="px-4 py-2.5 text-ink-500">{p.categorie}</td>
                          <td className="num px-4 py-2.5 text-right text-ink-500">{p.prix_achat > 0 ? formatXOF(p.prix_achat) : "—"}</td>
                          <td className="num px-4 py-2.5 text-right">{formatXOF(p.prix_unitaire)}</td>
                          <td className="num px-4 py-2.5 text-right text-leaf-600">{p.prix_achat > 0 ? "+" + formatXOF(p.prix_unitaire - p.prix_achat) : "—"}</td>
                          <td className={`num px-4 py-2.5 text-right ${pct > 50 ? "text-leaf-600 font-semibold" : pct > 20 ? "text-gold" : "text-ink-500"}`}>{pct > 0 ? pct.toFixed(0) + "%" : "—"}</td>
                          <td className="num px-4 py-2.5 text-right">{p.stock}</td>
                          <td className="num px-4 py-2.5 text-right font-semibold text-leaf-600">{p.marge_potentielle > 0 ? formatXOF(p.marge_potentielle) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-sand-200 bg-sand-50 font-bold">
                      <td className="px-4 py-2 text-ink" colSpan={7}>TOTAL MARGE EN STOCK</td>
                      <td className="num px-4 py-2 text-right text-leaf-600 text-[15px]">{formatXOF(stats.margeStock)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* Vente rapide */}
      <Modal open={!!openVente} onClose={() => setOpenVente(null)} title={`Vendre — ${openVente?.nom}`}>
        {openVente && (
          <>
            <div className="mb-4 rounded-xl bg-sand-100 px-4 py-3 flex justify-between text-sm">
              <span className="text-ink-500">Stock disponible</span>
              <span className="num font-bold text-ink">{openVente.stock} {openVente.unite}s</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantité">
                <input className={inputCls + " num"} type="number" min="1" max={openVente.stock}
                  value={venteForm.quantite} onChange={e => setVenteForm(f => ({ ...f, quantite: e.target.value }))} />
              </Field>
              <Field label="Remise (%)">
                <input className={inputCls + " num"} type="number" min="0" max="100"
                  value={venteForm.remise} onChange={e => setVenteForm(f => ({ ...f, remise: e.target.value }))} />
              </Field>
            </div>
            <Field label="Mode de paiement">
              <select className={inputCls} value={venteForm.mode} onChange={e => setVenteForm(f => ({ ...f, mode: e.target.value }))}>
                {["Espèces","Orange Money","Moov Money","Telecel","Wizall","Crédit"].map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom client (opt.)">
                <input className={inputCls} value={venteForm.client_nom} onChange={e => setVenteForm(f => ({ ...f, client_nom: e.target.value }))} />
              </Field>
              <Field label="Téléphone (opt.)">
                <input className={inputCls + " num"} value={venteForm.client_tel} onChange={e => setVenteForm(f => ({ ...f, client_tel: e.target.value }))} />
              </Field>
            </div>
            {/* Récap */}
            {Number(venteForm.quantite) > 0 && (
              <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm">
                <div className="flex justify-between"><span className="text-ink-500">Prix unitaire</span><span className="num">{formatXOF(openVente.prix_unitaire)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Quantité</span><span className="num">×{venteForm.quantite}</span></div>
                {Number(venteForm.remise) > 0 && <div className="flex justify-between text-ember-600"><span>Remise {venteForm.remise}%</span><span className="num">−{formatXOF(Math.round(openVente.prix_unitaire * Number(venteForm.quantite) * Number(venteForm.remise) / 100))}</span></div>}
                <div className="flex justify-between font-bold text-[15px] border-t border-sand-200 mt-1.5 pt-1.5">
                  <span>Total</span>
                  <span className="num">{formatXOF(Math.round(openVente.prix_unitaire * Number(venteForm.quantite) * (1 - Number(venteForm.remise)/100)))}</span>
                </div>
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setOpenVente(null)}>Annuler</Btn>
              <Btn onClick={submitVente}>Confirmer la vente</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Ajustement stock */}
      <Modal open={!!openAjustement} onClose={() => setOpenAjustement(null)} title={`Ajuster stock — ${openAjustement?.nom}`}>
        {openAjustement && (
          <>
            <div className="mb-3 rounded-xl bg-sand-100 px-4 py-3 flex justify-between text-sm">
              <span className="text-ink-500">Stock actuel</span>
              <span className="num font-bold text-ink">{openAjustement.stock}</span>
            </div>
            <Field label="Type de mouvement">
              <select className={inputCls} value={ajustForm.motif} onChange={e => setAjustForm(f => ({ ...f, motif: e.target.value }))}>
                <option value="reception_commande">Entrée — réception commande</option>
                <option value="retour">Entrée — retour client</option>
                <option value="perte">Sortie — perte / casse</option>
                <option value="vol">Sortie — vol</option>
                <option value="ajustement">Ajustement correctif</option>
              </select>
            </Field>
            <Field label={`Quantité ${["perte","vol"].includes(ajustForm.motif) ? "(positive, sera déduite)" : ""}`}>
              <input className={inputCls + " num"} type="number" min="1"
                value={ajustForm.quantite} onChange={e => setAjustForm(f => ({ ...f, quantite: e.target.value }))} />
            </Field>
            <div className="mt-3 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setOpenAjustement(null)}>Annuler</Btn>
              <Btn onClick={submitAjustement}>Valider</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Détail commande */}
      <Modal open={!!openCommande} onClose={() => setOpenCommande(null)} title={`Commande — ${openCommande?.fournisseur_nom}`}>
        {openCommande && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <Badge className={STATUT_CMD[openCommande.statut].cls}>{STATUT_CMD[openCommande.statut].label}</Badge>
              <span className="num font-semibold text-ink">{formatXOF(openCommande.montant_total)}</span>
            </div>
            <table className="w-full text-sm mb-3">
              <thead><tr className="border-b border-sand-200 text-[12px] text-ink-400"><th className="py-2 text-left">Produit</th><th className="py-2 text-right">Qté</th><th className="py-2 text-right">P.U.</th><th className="py-2 text-right">Total</th></tr></thead>
              <tbody>
                {openCommande.lignes.map(l => (
                  <tr key={l.id} className="border-b border-sand-100 last:border-0">
                    <td className="py-2">{l.produit_nom ?? l.description}</td>
                    <td className="num py-2 text-right">{l.quantite}</td>
                    <td className="num py-2 text-right text-ink-500">{formatXOF(l.prix_unitaire)}</td>
                    <td className="num py-2 text-right font-medium">{formatXOF(l.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setOpenCommande(null)}>Fermer</Btn>
              <a href={`/receipt/commande/${openCommande.id}`} target="_blank"
                className="inline-flex items-center gap-2 rounded-xl bg-sand-200 px-4 py-2.5 text-sm font-medium text-ink hover:bg-sand-300">
                <Printer size={15} /> Imprimer le bon
              </a>
            </div>
          </>
        )}
      </Modal>

      {/* Nouveau produit */}
      <Modal open={openNouveauProduit} onClose={() => setOpenNouveauProduit(false)} title="Nouveau produit">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom"><input className={inputCls} value={prodForm.nom} onChange={e => setProdForm(f=>({...f,nom:e.target.value}))} placeholder="Carte SIM Orange" /></Field>
          <Field label="Code-barres"><input className={inputCls + " num"} value={prodForm.code_barre} onChange={e => setProdForm(f=>({...f,code_barre:e.target.value}))} /></Field>
          <Field label="Catégorie">
            <select className={inputCls} value={prodForm.categorie} onChange={e => setProdForm(f=>({...f,categorie:e.target.value}))}>
              {["SIM","Recharge","Téléphone","Accessoire","Service","Autre"].map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Entrepôt">
            <select className={inputCls} value={prodForm.entrepot} onChange={e => setProdForm(f=>({...f,entrepot:e.target.value}))}>
              {entrepots.filter(e=>e!=="tout").map(e=><option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Prix de vente (XOF)"><input className={inputCls+" num"} type="number" value={prodForm.prix_unitaire} onChange={e => setProdForm(f=>({...f,prix_unitaire:e.target.value}))} /></Field>
          <Field label="Prix d'achat (XOF)"><input className={inputCls+" num"} type="number" value={prodForm.prix_achat} onChange={e => setProdForm(f=>({...f,prix_achat:e.target.value}))} /></Field>
          <Field label="Stock initial"><input className={inputCls+" num"} type="number" value={prodForm.stock} onChange={e => setProdForm(f=>({...f,stock:e.target.value}))} /></Field>
          <Field label="Seuil d'alerte"><input className={inputCls+" num"} type="number" value={prodForm.seuil_alerte} onChange={e => setProdForm(f=>({...f,seuil_alerte:e.target.value}))} /></Field>
        </div>
        <Field label="Fournisseur">
          <select className={inputCls} value={prodForm.fournisseur_id} onChange={e => setProdForm(f=>({...f,fournisseur_id:e.target.value}))}>
            <option value="">— Sélectionner —</option>
            {fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </Field>
        <Field label="Notes (optionnel)"><input className={inputCls} value={prodForm.notes} onChange={e => setProdForm(f=>({...f,notes:e.target.value}))} /></Field>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenNouveauProduit(false)}>Annuler</Btn>
          <Btn onClick={() => setOpenNouveauProduit(false)}>Créer le produit</Btn>
        </div>
      </Modal>
    </div>
  );
}
