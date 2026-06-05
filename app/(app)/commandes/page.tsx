"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSignature, ShoppingCart, Truck, BarChart2,
  Plus, Check, X, Printer, ChevronDown,
} from "lucide-react";
import FacturationModule from "@/components/FacturationModule";
import {
  useCommandes, creerCommande, changerStatutCommande, recevoirCommande,
  useProduits, useFournisseurs,
  type CommandeFournisseur,
} from "@/lib/hooks-stock";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";
import { useRealtimeRefetch } from "@/lib/realtime";

// ── Statuts commandes fournisseurs ────────────────────────────────────────────
const STATUT_CMD: Record<string, { label: string; cls: string }> = {
  brouillon: { label:"Brouillon",  cls:"bg-sand-200 text-ink-600"   },
  validee:   { label:"Validée",    cls:"bg-blue-100 text-blue-700"  },
  recue:     { label:"Reçue",      cls:"bg-leaf-100 text-leaf-600"  },
  facturee:  { label:"Facturée",   cls:"bg-amber-100 text-amber-700"},
  annulee:   { label:"Annulée",    cls:"bg-ember-100 text-ember-600"},
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"devis",       label:"Propositions / Devis",   icon:FileSignature },
  { id:"clients",     label:"Commandes clients",       icon:ShoppingCart  },
  { id:"fournisseurs",label:"Commandes fournisseurs",  icon:Truck         },
  { id:"stats",       label:"Statistiques",            icon:BarChart2     },
] as const;
type TabId = typeof TABS[number]["id"];

export default function CommandesPage() {
  const [tab, setTab] = useState<TabId>("devis");
  const { data: commandes, refetch: rfCmds } = useCommandes();
  const { data: produits } = useProduits();
  const { data: fournisseurs } = useFournisseurs();

  // ── Stats commandes fournisseurs ─────────────────────────────────────────
  const statsCmds = useMemo(() => {
    const enCours   = commandes.filter(c => c.statut === "validee");
    const recues    = commandes.filter(c => c.statut === "recue");
    const totalCA   = commandes.reduce((s,c) => s + c.montant_total, 0);
    const enAttente = commandes.filter(c => ["validee","brouillon"].includes(c.statut))
      .reduce((s,c) => s + c.montant_total, 0);
    return { total:commandes.length, enCours:enCours.length, recues:recues.length, totalCA, enAttente };
  }, [commandes]);

  // ── Modale nouvelle commande fournisseur ─────────────────────────────────
  const [openNvCmd, setOpenNvCmd] = useState(false);
  const [cmdForm, setCmdForm] = useState({
    fournisseur_id: "", date_livraison_prevue: "",
    notes: "",
    lignes: [{ produit_id:"", description:"", quantite:"1", prix_unitaire:"" }],
  });
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdErr, setCmdErr] = useState<string|null>(null);

  function addLigne() {
    setCmdForm(f => ({ ...f, lignes:[...f.lignes, { produit_id:"", description:"", quantite:"1", prix_unitaire:"" }] }));
  }
  function updLigne(i:number, p:Partial<typeof cmdForm.lignes[0]>) {
    setCmdForm(f => { const l=[...f.lignes]; l[i]={...l[i],...p}; return {...f,lignes:l}; });
  }
  function removeLigne(i:number) {
    setCmdForm(f => ({ ...f, lignes:f.lignes.filter((_,j)=>j!==i) }));
  }

  async function submitCmd() {
    if (!cmdForm.fournisseur_id) { setCmdErr("Choisissez un fournisseur."); return; }
    if (cmdForm.lignes.length===0) { setCmdErr("Ajoutez au moins une ligne."); return; }
    setCmdBusy(true); setCmdErr(null);
    try {
      await creerCommande({
        fournisseur_id: cmdForm.fournisseur_id,
        date_livraison_prevue: cmdForm.date_livraison_prevue || undefined,
        notes: cmdForm.notes || undefined,
        lignes: cmdForm.lignes.map(l => ({
          produit_id: l.produit_id || undefined,
          description: l.description || produits.find(p=>p.id===l.produit_id)?.nom || "",
          quantite: Number(l.quantite)||1,
          prix_unitaire: Number(l.prix_unitaire)||0,
        })),
      });
      setOpenNvCmd(false);
      setCmdForm({ fournisseur_id:"", date_livraison_prevue:"", notes:"", lignes:[{ produit_id:"", description:"", quantite:"1", prix_unitaire:"" }] });
      rfCmds();
    } catch(e:any){ setCmdErr(e?.message ?? "Erreur."); }
    setCmdBusy(false);
  }

  // ── Détail commande fournisseur ───────────────────────────────────────────
  const [openCmd, setOpenCmd] = useState<CommandeFournisseur|null>(null);

  // ── Header action contextuel ──────────────────────────────────────────────
  const headerAction = tab === "fournisseurs" ? (
    <Btn onClick={()=>{ setCmdErr(null); setOpenNvCmd(true); }}><Plus size={14}/> Nouvelle commande</Btn>
  ) : null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Commandes"
        subtitle="Propositions, commandes clients & fournisseurs"
        action={headerAction}
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors
              ${tab===t.id?"bg-clay text-sand-50":"bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
            <t.icon size={14}/> {t.label}
          </button>
        ))}
      </div>

      {/* ── DEVIS / PROPOSITIONS ───────────────────────────────────────────── */}
      {tab==="devis" && (
        <div>
          <div className="mb-4 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-[13px] text-ink-500">
            💡 Les propositions / devis sont des commandes à l'état <strong>Brouillon</strong> envoyées aux commerçants avant validation.
          </div>
          <FacturationModule docType="commande" embedded initialStatut="brouillon" labelNouveauBtn="Nouvelle proposition" />
        </div>
      )}

      {/* ── COMMANDES CLIENTS ─────────────────────────────────────────────── */}
      {tab==="clients" && (
        <FacturationModule docType="commande" embedded />
      )}

      {/* ── COMMANDES FOURNISSEURS ────────────────────────────────────────── */}
      {tab==="fournisseurs" && (
        <div>
          {/* KPIs */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l:"Total commandes",    v:String(statsCmds.total) },
              { l:"En attente livraison",v:String(statsCmds.enCours) },
              { l:"Reçues",             v:String(statsCmds.recues) },
              { l:"Montant en attente", v:formatXOF(statsCmds.enAttente), accent:true },
            ].map(s=>(
              <Card key={s.l} className="p-4">
                <div className="text-[12px] text-ink-400">{s.l}</div>
                <div className={`num mt-1 text-xl font-bold ${s.accent?"text-clay-700":"text-ink"}`}>{s.v}</div>
              </Card>
            ))}
          </div>

          {/* Liste */}
          <div className="space-y-3">
            {commandes.map(cmd => {
              const fournisseur = fournisseurs.find(f=>f.id===cmd.fournisseur_id);
              const st = STATUT_CMD[cmd.statut] ?? { label:cmd.statut, cls:"bg-sand-200 text-ink-600" };
              return (
                <Card key={cmd.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="num font-bold text-ink">{cmd.id}</span>
                          <Badge className={st.cls}>{st.label}</Badge>
                        </div>
                        <div className="text-[12px] text-ink-500 mt-0.5">
                          {fournisseur?.nom ?? cmd.fournisseur_id} · {formatDate(cmd.date_commande)}
                          {cmd.date_livraison_prevue && ` → livraison ${formatDate(cmd.date_livraison_prevue)}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="num font-bold text-ink">{formatXOF(cmd.montant_total)}</div>
                        <div className="text-[11px] text-ink-400">{cmd.lignes.length} ligne{cmd.lignes.length>1?"s":""}</div>
                      </div>
                      <div className="flex gap-1">
                        {cmd.statut==="validee" && (
                          <button onClick={async()=>{ await recevoirCommande(cmd); rfCmds(); }}
                            className="flex items-center gap-1 rounded-lg bg-leaf-100 text-leaf-600 px-2.5 py-1 text-[12px] font-medium hover:bg-leaf-200 tap">
                            <Check size={12}/> Reçue
                          </button>
                        )}
                        {cmd.statut==="brouillon" && (
                          <button onClick={async()=>{ await changerStatutCommande(cmd.id,"validee"); rfCmds(); }}
                            className="flex items-center gap-1 rounded-lg bg-blue-100 text-blue-600 px-2.5 py-1 text-[12px] font-medium hover:bg-blue-200 tap">
                            <Check size={12}/> Valider
                          </button>
                        )}
                        {["brouillon","validee"].includes(cmd.statut) && (
                          <button onClick={async()=>{ if(confirm("Annuler cette commande ?")) { await changerStatutCommande(cmd.id,"annulee"); rfCmds(); } }}
                            className="p-1.5 rounded-lg hover:bg-ember-100 text-ink-400 hover:text-ember-500 tap">
                            <X size={14}/>
                          </button>
                        )}
                        <button onClick={()=>setOpenCmd(cmd)}
                          className="rounded-lg bg-sand-100 text-ink-600 px-2.5 py-1 text-[12px] hover:bg-sand-200 tap">
                          <ChevronDown size={13}/>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Lignes */}
                  <div className="border-t border-sand-100 px-5 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-500">
                    {cmd.lignes.map(l=>(
                      <span key={l.id} className="flex items-center gap-1">
                        <span className="text-ink">{l.produit_nom ?? l.description}</span>
                        <span className="num text-ink-400">×{l.quantite}</span>
                        {l.prix_unitaire > 0 && <span className="num text-ink-400">@ {formatXOF(l.prix_unitaire)}</span>}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}
            {commandes.length===0 && (
              <Card className="p-10 text-center text-[13px] text-ink-400">
                Aucune commande fournisseur. Cliquez sur «&nbsp;Nouvelle commande&nbsp;» pour commencer.
              </Card>
            )}
          </div>

          {/* Fournisseurs actifs (aide contextuelle) */}
          <div className="mt-5">
            <h3 className="display mb-3 text-base font-bold text-ink">Fournisseurs</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fournisseurs.filter(f=>f.actif).map(f=>(
                <Card key={f.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-ink">{f.nom}</div>
                      <Badge className={f.type==="OPERATEUR"?"bg-clay-100 text-clay-700":"bg-sand-200 text-ink-600"}>{f.type}</Badge>
                    </div>
                    <Btn variant="ghost" onClick={()=>{ setCmdErr(null); setCmdForm(fo=>({...fo,fournisseur_id:f.id})); setOpenNvCmd(true); }}>
                      <Plus size={13}/> Commander
                    </Btn>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[12px] text-ink-500">
                    {f.telephone && <div>📞 {f.telephone}</div>}
                    <div>⏱ Délai {f.delai_livraison}j · {f.conditions_paiement}</div>
                    {f.nb_commandes && <div>📦 {f.nb_commandes} commandes passées</div>}
                  </div>
                  {f.solde_du > 0 && (
                    <div className="mt-2 rounded-lg bg-ember-50 border border-ember-200 px-3 py-1.5 text-[12px] text-ember-600">
                      Dette : <span className="num font-bold">{formatXOF(f.solde_du)}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STATISTIQUES ─────────────────────────────────────────────────── */}
      {tab==="stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l:"Commandes fournisseurs", v:String(statsCmds.total) },
              { l:"En cours",               v:String(statsCmds.enCours) },
              { l:"Reçues",                 v:String(statsCmds.recues) },
              { l:"Volume total",           v:formatXOF(statsCmds.totalCA) },
            ].map(s=>(
              <Card key={s.l} className="p-4">
                <div className="text-[12px] text-ink-400">{s.l}</div>
                <div className="num mt-1 text-xl font-bold text-ink">{s.v}</div>
              </Card>
            ))}
          </div>

          {/* Répartition par fournisseur */}
          <Card className="p-5">
            <h3 className="display mb-4 text-base font-bold text-ink">Volume par fournisseur</h3>
            <div className="space-y-2">
              {fournisseurs.filter(f=>f.nb_commandes).map(f=>{
                const max = Math.max(...fournisseurs.map(x=>x.nb_commandes??0));
                const pct = max > 0 ? ((f.nb_commandes??0)/max)*100 : 0;
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <div className="w-36 text-[12px] text-ink-500 shrink-0 truncate">{f.nom}</div>
                    <div className="flex-1 rounded-full bg-sand-200 h-2">
                      <div className="h-2 rounded-full bg-clay" style={{width:`${pct}%`}}/>
                    </div>
                    <div className="num text-[13px] font-semibold text-ink w-16 text-right">{f.nb_commandes} cmd</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal nouvelle commande fournisseur ───────────────────────────── */}
      <Modal open={openNvCmd} onClose={()=>setOpenNvCmd(false)} title="Nouvelle commande fournisseur">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fournisseur ★">
            <select className={inputCls} value={cmdForm.fournisseur_id} onChange={e=>setCmdForm(f=>({...f,fournisseur_id:e.target.value}))}>
              <option value="">— Choisir —</option>
              {fournisseurs.filter(f=>f.actif).map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </Field>
          <Field label="Livraison prévue">
            <input className={inputCls} type="date" value={cmdForm.date_livraison_prevue} onChange={e=>setCmdForm(f=>({...f,date_livraison_prevue:e.target.value}))}/>
          </Field>
        </div>

        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Lignes de commande</div>
        <div className="space-y-2 max-h-52 overflow-auto">
          {cmdForm.lignes.map((l,i)=>(
            <div key={i} className="grid grid-cols-12 gap-2 rounded-xl bg-sand-50 p-2">
              <div className="col-span-5">
                <select className={inputCls+" text-[12px]"} value={l.produit_id}
                  onChange={e=>{ const p=produits.find(x=>x.id===e.target.value); updLigne(i,{ produit_id:e.target.value, description:p?.nom??"", prix_unitaire:p?String((p as any).prix_achat||0):"" }); }}>
                  <option value="">— Produit —</option>
                  {produits.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <input className={inputCls+" text-[12px]"} placeholder="Description" value={l.description} onChange={e=>updLigne(i,{description:e.target.value})}/>
              </div>
              <div className="col-span-2">
                <input className={inputCls+" num text-[12px]"} placeholder="Qté" type="number" value={l.quantite} onChange={e=>updLigne(i,{quantite:e.target.value})}/>
              </div>
              <div className="col-span-1">
                <input className={inputCls+" num text-[12px]"} placeholder="P.U." type="number" value={l.prix_unitaire} onChange={e=>updLigne(i,{prix_unitaire:e.target.value})}/>
              </div>
              <button onClick={()=>removeLigne(i)} className="col-span-1 flex items-center justify-center text-ink-400 hover:text-ember-500">
                <span className="text-lg">×</span>
              </button>
            </div>
          ))}
        </div>
        <button onClick={addLigne} className="mt-2 text-[13px] text-clay hover:underline">+ Ajouter une ligne</button>

        <Field label="Notes"><textarea className={inputCls} rows={2} value={cmdForm.notes} onChange={e=>setCmdForm(f=>({...f,notes:e.target.value}))}/></Field>
        {cmdErr && <p className="rounded-lg bg-ember-50 border border-ember-200 px-3 py-2 text-[12px] text-ember-600">{cmdErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenNvCmd(false)}>Annuler</Btn>
          <Btn onClick={submitCmd} className={cmdBusy?"opacity-50":""}>{cmdBusy?"…":"Créer la commande"}</Btn>
        </div>
      </Modal>

      {/* Détail commande */}
      <Modal open={!!openCmd} onClose={()=>setOpenCmd(null)} title={`Commande ${openCmd?.id}`}>
        {openCmd && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div><span className="text-ink-400">Fournisseur :</span> <span className="font-semibold">{fournisseurs.find(f=>f.id===openCmd.fournisseur_id)?.nom ?? openCmd.fournisseur_id}</span></div>
              <div><span className="text-ink-400">Date :</span> <span className="num">{formatDate(openCmd.date_commande)}</span></div>
              <div><span className="text-ink-400">Statut :</span> <Badge className={STATUT_CMD[openCmd.statut]?.cls}>{STATUT_CMD[openCmd.statut]?.label}</Badge></div>
              <div><span className="text-ink-400">Livraison :</span> <span className="num">{openCmd.date_livraison_prevue ? formatDate(openCmd.date_livraison_prevue) : "—"}</span></div>
            </div>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-sand-200 text-[11px] uppercase text-ink-400">
                <th className="py-1.5 text-left">Produit</th><th className="py-1.5 text-center">Qté</th><th className="py-1.5 text-right">P.U.</th><th className="py-1.5 text-right">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-sand-100">
                {openCmd.lignes.map(l=>(
                  <tr key={l.id}>
                    <td className="py-2 text-ink">{l.produit_nom ?? l.description}</td>
                    <td className="num py-2 text-center">{l.quantite}</td>
                    <td className="num py-2 text-right text-ink-500">{l.prix_unitaire > 0 ? formatXOF(l.prix_unitaire) : "—"}</td>
                    <td className="num py-2 text-right font-semibold text-ink">{l.prix_unitaire > 0 ? formatXOF(l.quantite*l.prix_unitaire) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-sand-200">
                <td colSpan={3} className="py-2 font-bold text-ink text-right">Total</td>
                <td className="num py-2 text-right font-bold text-ink">{formatXOF(openCmd.montant_total)}</td>
              </tr></tfoot>
            </table>
            {openCmd.notes && <p className="text-[12px] text-ink-500 italic">{openCmd.notes}</p>}
          </div>
        )}
        <div className="mt-3 flex justify-end"><Btn onClick={()=>setOpenCmd(null)}>Fermer</Btn></div>
      </Modal>
    </div>
  );
}
