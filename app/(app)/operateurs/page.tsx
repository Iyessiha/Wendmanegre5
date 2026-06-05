"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Edit2, Trash2, RefreshCw, Phone, Hash, Calculator,
  ChevronRight, Save, X, TrendingUp, Banknote, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import {
  useOperateursAvances, useFraisOperateur, usePaliersOperateur,
  useLimitesOperateur, useMouvementsFlotte,
  updateFrais, createFrais, deleteFrais,
  createPalier, updatePalier, deletePalier,
  updateLimite, createLimite, calculerFrais,
  TYPE_OP_LABEL, ACTEUR_LABEL, MODE_LABEL, LIMITE_LABEL,
  type OperateurAvance, type FraisOperateur,
} from "@/lib/hooks-operateurs-avances";
import { ajusterFlotte, modifierOperateur } from "@/lib/hooks-operateurs";
import { useOperateurs } from "@/lib/hooks-operateurs";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF, formatDate } from "@/lib/format";

// ── Icônes SVG par opérateur ──────────────────────────────────────────────────
function OperateurSVG({ id, couleur, size = 48 }: { id: string; couleur: string; size?: number }) {
  const c = couleur;
  const icons: Record<string, JSX.Element> = {
    OM: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="20" cy="20" r="19" fill={c}/>
        <circle cx="20" cy="20" r="12" fill="none" stroke="white" strokeWidth="3"/>
        <circle cx="20" cy="20" r="4" fill="white"/>
        <text x="20" y="37" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="sans-serif">MONEY</text>
      </svg>
    ),
    MOOV: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="1" y="1" width="38" height="38" rx="8" fill={c}/>
        <path d="M8 28 L14 12 L20 24 L26 12 L32 28" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    WIZALL: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <polygon points="20,1 39,11 39,29 20,39 1,29 1,11" fill={c}/>
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="17" fontWeight="900" fontFamily="sans-serif">W</text>
      </svg>
    ),
    WAVE: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="1" y="1" width="38" height="38" rx="10" fill={c}/>
        <path d="M4 20 Q10 12 16 20 Q22 28 28 20 Q34 12 40 20" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        <path d="M4 26 Q10 18 16 26 Q22 34 28 26" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
        <text x="20" y="15" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">WAVE</text>
      </svg>
    ),
    CORIS: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <path d="M20 1 L38 10 L38 30 L20 39 L2 30 L2 10 Z" fill={c}/>
        <rect x="11" y="16" width="18" height="14" rx="1" fill="none" stroke="white" strokeWidth="2"/>
        <rect x="15" y="12" width="10" height="6" rx="1" fill="none" stroke="white" strokeWidth="2"/>
        <line x1="11" y1="22" x2="29" y2="22" stroke="white" strokeWidth="1.5"/>
        <rect x="17" y="24" width="6" height="6" fill="white"/>
      </svg>
    ),
    UBA: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="20" cy="20" r="19" fill={c}/>
        <text x="20" y="17" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="sans-serif">UBA</text>
        <text x="20" y="28" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="5.5" fontFamily="sans-serif">MOBILE</text>
      </svg>
    ),
    CELPAID: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="1" y="1" width="38" height="38" rx="12" fill={c}/>
        <text x="20" y="24" textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily="sans-serif">CP</text>
        <text x="20" y="34" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="5" fontFamily="sans-serif">CELPAID</text>
      </svg>
    ),
    SG: (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="20" cy="20" r="19" fill={c}/>
        <text x="20" y="23" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="sans-serif">YUP</text>
        <text x="20" y="33" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="5" fontFamily="sans-serif">by SG</text>
      </svg>
    ),
  };
  const fallback = (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <circle cx="20" cy="20" r="19" fill={c}/>
      <text x="20" y="24" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="sans-serif">{id.slice(0,2)}</text>
    </svg>
  );
  return icons[id] ?? fallback;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ["Aperçu","Frais","Paliers","Limites","Paramètres"] as const;
type Tab = typeof TABS[number];

// ── Composant principal ───────────────────────────────────────────────────────
export default function OperateursPage() {
  const { data: operateurs, loading, refetch: refetchOps } = useOperateursAvances();
  const [sel, setSel] = useState<OperateurAvance | null>(null);
  const [tab, setTab] = useState<Tab>("Aperçu");
  const [userId, setUserId] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  // auto-sélectionner le premier opérateur actif
  useEffect(() => {
    if (!sel && operateurs.length > 0) setSel(operateurs.find(o=>o.actif) ?? operateurs[0]);
  }, [operateurs, sel]);

  const totalFlotte = useMemo(() => operateurs.filter(o=>o.actif).reduce((s,o)=>s+o.solde_flotte,0), [operateurs]);
  const actifCount = operateurs.filter(o=>o.actif).length;

  // Données de l'opérateur sélectionné
  const { data: frais, refetch: rfFrais } = useFraisOperateur(sel?.id ?? "");
  const { data: paliers, refetch: rfPaliers } = usePaliersOperateur(sel?.id ?? "");
  const { data: limites, refetch: rfLimites } = useLimitesOperateur(sel?.id ?? "");
  const { data: mouvements, refetch: rfMvt } = useMouvementsFlotte(sel?.id ?? "");

  const refetchAll = () => { rfFrais(); rfPaliers(); rfLimites(); rfMvt(); refetchOps(); };

  // ── État mouvements flotte ──
  const [openFlotte, setOpenFlotte] = useState<"appro"|"retrait"|null>(null);
  const [flotteF, setFlotteF] = useState({ montant:"", libelle:"" });
  const [flotteBusy, setFlotteBusy] = useState(false);
  async function submitFlotte() {
    if (!sel) return; const m=Number(flotteF.montant); if(!m||m<=0) return;
    setFlotteBusy(true);
    await ajusterFlotte({ operateur_id:sel.id, type:openFlotte==="appro"?"appro":"retrait", montant:m, libelle:flotteF.libelle||undefined, user_id:userId||undefined });
    setOpenFlotte(null); setFlotteF({montant:"",libelle:""}); setFlotteBusy(false); refetchAll();
  }

  // ── Calculateur de frais ──
  const [calcOp, setCalcOp] = useState("");
  const [calcMontant, setCalcMontant] = useState("");
  const calcResult = useMemo(() => {
    const m = Number(calcMontant); if (!m || !calcOp) return null;
    return calculerFrais(frais, paliers, calcOp, m);
  }, [frais, paliers, calcOp, calcMontant]);

  // ── Nouveau frais ──
  const [newFrais, setNewFrais] = useState(false);
  const [nfF, setNfF] = useState({ nom:"", type_operation:"retrait", acteur:"client", mode:"pourcentage", valeur:"", montant_min:"", montant_max:"", notes:"" });
  async function submitNewFrais() {
    if (!sel || !nfF.nom) return;
    await createFrais({ operateur_id:sel.id, nom:nfF.nom, type_operation:nfF.type_operation, acteur:nfF.acteur, mode:nfF.mode, valeur:Number(nfF.valeur)||0, montant_min:Number(nfF.montant_min)||0, montant_max:Number(nfF.montant_max)||0, actif:true, notes:nfF.notes||null, ordre:frais.length });
    setNewFrais(false); rfFrais();
  }

  // ── Édition inline frais ──
  const [editFrais, setEditFrais] = useState<FraisOperateur|null>(null);
  const [efF, setEfF] = useState({ valeur:"", montant_min:"", montant_max:"", actif:true, notes:"", nom:"", mode:"" });
  function openEF(f: FraisOperateur){ setEfF({valeur:String(f.valeur),montant_min:String(f.montant_min),montant_max:String(f.montant_max),actif:f.actif,notes:f.notes??"",nom:f.nom,mode:f.mode}); setEditFrais(f); }
  async function saveEF(){
    if(!editFrais) return;
    await updateFrais(editFrais.id,{valeur:Number(efF.valeur),montant_min:Number(efF.montant_min),montant_max:Number(efF.montant_max),actif:efF.actif,notes:efF.notes||null,nom:efF.nom,mode:efF.mode});
    setEditFrais(null); rfFrais();
  }

  // ── Nouveau palier ──
  const [newPalier, setNewPalier] = useState<string|null>(null); // frais_id
  const [npF, setNpF] = useState({ tranche_min:"", tranche_max:"", frais_fixe:"0", frais_pct:"0" });
  async function submitNewPalier(){
    if(!newPalier) return;
    const nb = paliers.filter(p=>p.frais_id===newPalier).length;
    await createPalier({ frais_id:newPalier, tranche_min:Number(npF.tranche_min), tranche_max:Number(npF.tranche_max), frais_fixe:Number(npF.frais_fixe), frais_pct:Number(npF.frais_pct), ordre:nb });
    setNewPalier(null); rfPaliers();
  }

  // ── Paramètres opérateur ──
  const [paramF, setParamF] = useState({ nom:"", couleur:"", commission_taux:"", telephone_support:"", ussd_solde:"", slogan:"", actif:true, notes:"" });
  useEffect(() => { if(sel) setParamF({ nom:sel.nom, couleur:sel.couleur, commission_taux:String(sel.commission_taux), telephone_support:sel.telephone_support??"", ussd_solde:sel.ussd_solde??"", slogan:sel.slogan??"", actif:sel.actif, notes:sel.notes??"" }); }, [sel]);
  async function saveParams(){
    if(!sel) return;
    await modifierOperateur(sel.id,{ nom:paramF.nom, couleur:paramF.couleur, commission_taux:Number(paramF.commission_taux), telephone_support:paramF.telephone_support||null, notes:paramF.notes||null, actif:paramF.actif });
    refetchAll();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Opérateurs Burkina Faso"
        subtitle={`${actifCount} actifs · flotte totale ${formatXOF(totalFlotte)}`}
      />

      {/* Grille des opérateurs */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {operateurs.map(op => (
          <button key={op.id} onClick={() => { setSel(op); setTab("Aperçu"); }}
            className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all tap border-2
              ${sel?.id===op.id ? "border-transparent ring-2 ring-ink shadow-md scale-[1.05]" : "border-transparent bg-white/70 hover:bg-white"}
              ${!op.actif ? "opacity-40 grayscale" : ""}`}>
            <OperateurSVG id={op.id} couleur={op.couleur} size={44}/>
            <span className="text-[10px] font-semibold text-ink leading-tight text-center">{op.nom.split(" ")[0]}</span>
            {op.actif && <span className="num text-[9px] text-ink-400">{formatXOF(op.solde_flotte)}</span>}
          </button>
        ))}
      </div>

      {/* Panneau de détail */}
      {sel && (
        <Card className="overflow-hidden">
          {/* En-tête opérateur */}
          <div className="flex items-center gap-4 p-5 pb-4" style={{background:`linear-gradient(135deg,${sel.couleur}22,${sel.couleur2??sel.couleur}11)`}}>
            <OperateurSVG id={sel.id} couleur={sel.couleur} size={56}/>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="display text-xl font-bold text-ink">{sel.nom}</h2>
                <Badge className={sel.actif?"bg-leaf-100 text-leaf-700":"bg-ember-100 text-ember-600"}>{sel.actif?"Actif":"Inactif"}</Badge>
              </div>
              {sel.slogan && <p className="text-[12px] text-ink-500 italic">{sel.slogan}</p>}
              <div className="mt-1 flex items-center gap-3 text-[12px] text-ink-500">
                {sel.ussd_solde && <span className="flex items-center gap-1"><Hash size={11}/>{sel.ussd_solde}</span>}
                {sel.telephone_support && <span className="flex items-center gap-1"><Phone size={11}/>{sel.telephone_support}</span>}
                <span className="flex items-center gap-1"><TrendingUp size={11}/>Com. {sel.commission_taux}%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="num text-2xl font-bold text-ink">{formatXOF(sel.solde_flotte)}</div>
              <div className="text-[11px] text-ink-400">Solde flotte</div>
              <div className="mt-2 flex gap-1 justify-end">
                <button onClick={()=>{setFlotteF({montant:"",libelle:""});setOpenFlotte("appro")}}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-leaf-100 text-leaf-600 hover:bg-leaf-200 tap">
                  <ArrowUpCircle size={12}/> Appro.
                </button>
                <button onClick={()=>{setFlotteF({montant:"",libelle:""});setOpenFlotte("retrait")}}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-clay-100 text-clay-700 hover:bg-clay-200 tap">
                  <ArrowDownCircle size={12}/> Retrait
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-sand-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={()=>setTab(t)}
                className={`px-4 py-2.5 text-[13px] font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors
                  ${tab===t?"border-clay text-clay-700":"border-transparent text-ink-400 hover:text-ink"}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* ── APERÇU ──────────────────────────────────────────────────── */}
            {tab==="Aperçu" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {l:"Solde flotte",v:formatXOF(sel.solde_flotte)},
                    {l:"Types de frais",v:`${sel.nb_frais} règles`},
                    {l:"Limites configurées",v:`${sel.nb_limites} limites`},
                    {l:"Commission dealer",v:`${sel.commission_taux}%`},
                  ].map(s=>(
                    <div key={s.l} className="rounded-xl bg-sand-50 p-3">
                      <div className="text-[11px] text-ink-400">{s.l}</div>
                      <div className="num mt-0.5 text-base font-bold text-ink">{s.v}</div>
                    </div>
                  ))}
                </div>
                {/* Mouvements récents */}
                <div>
                  <h4 className="mb-2 text-[13px] font-semibold text-ink">Mouvements récents</h4>
                  {mouvements.length===0 && <p className="text-[12px] text-ink-400">Aucun mouvement enregistré.</p>}
                  <div className="space-y-1 max-h-52 overflow-auto">
                    {mouvements.map(m=>(
                      <div key={m.id} className="flex items-center justify-between rounded-lg bg-sand-50 px-3 py-2">
                        <div>
                          <span className="text-[12px] font-medium text-ink">{m.libelle||m.type}</span>
                          <span className="ml-2 text-[11px] text-ink-400">{formatDate(m.created_at?.slice(0,10))}</span>
                        </div>
                        <span className={`num text-[13px] font-semibold ${m.montant>=0?"text-leaf-600":"text-clay-700"}`}>
                          {m.montant>=0?"+":""}{formatXOF(Math.abs(m.montant))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Mini calculateur */}
                <div className="rounded-xl border border-sand-200 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink"><Calculator size={14}/> Calculateur de frais</h4>
                  <div className="flex flex-wrap gap-3">
                    <select className={inputCls+" flex-1 min-w-[160px]"} value={calcOp} onChange={e=>setCalcOp(e.target.value)}>
                      <option value="">— Type d'opération —</option>
                      {frais.filter(f=>f.acteur==="client"&&f.actif).map(f=><option key={f.id} value={f.type_operation}>{f.nom}</option>)}
                    </select>
                    <input className={inputCls+" num flex-1 min-w-[120px]"} type="number" placeholder="Montant XOF" value={calcMontant} onChange={e=>setCalcMontant(e.target.value)}/>
                  </div>
                  {calcResult && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        {l:"Frais client",v:formatXOF(calcResult.fraisClient),c:"text-clay-700"},
                        {l:"Commission dealer",v:formatXOF(calcResult.commission),c:"text-leaf-600"},
                        {l:"Montant net",v:formatXOF(calcResult.net),c:"text-ink"},
                      ].map(s=>(
                        <div key={s.l} className="rounded-lg bg-sand-50 p-2 text-center">
                          <div className="text-[10px] text-ink-400">{s.l}</div>
                          <div className={`num text-[13px] font-bold ${s.c}`}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── FRAIS ───────────────────────────────────────────────────── */}
            {tab==="Frais" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[13px] font-semibold text-ink">Règles de frais ({frais.length})</h4>
                  <Btn onClick={()=>setNewFrais(true)}><Plus size={13}/> Ajouter</Btn>
                </div>
                <div className="space-y-1">
                  {frais.map(f=>(
                    <div key={f.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${!f.actif?"opacity-50 bg-sand-50 border-sand-100":"bg-white border-sand-200"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{f.nom}</span>
                          <Badge className="bg-sand-200 text-ink-500 text-[10px]">{ACTEUR_LABEL[f.acteur]}</Badge>
                          {!f.actif && <Badge className="bg-ember-100 text-ember-500 text-[10px]">Inactif</Badge>}
                        </div>
                        <div className="text-[11px] text-ink-400">
                          {MODE_LABEL[f.mode]} ·{" "}
                          {f.mode==="fixe" ? `${formatXOF(f.valeur)}` : f.mode==="pourcentage" ? `${f.valeur}%` : `paliers configurés`}
                          {f.montant_min>0 && ` · min ${formatXOF(f.montant_min)}`}
                          {f.montant_max>0 && ` · max ${formatXOF(f.montant_max)}`}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {f.mode==="palier" && (
                          <button onClick={()=>{setNewPalier(f.id);setNpF({tranche_min:"",tranche_max:"",frais_fixe:"0",frais_pct:"0"})}}
                            className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 text-[11px]">Paliers</button>
                        )}
                        <button onClick={()=>openEF(f)} className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400"><Edit2 size={13}/></button>
                        <button onClick={async()=>{await deleteFrais(f.id);rfFrais();}} className="p-1.5 rounded-lg hover:bg-ember-100 text-ember-500"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PALIERS ─────────────────────────────────────────────────── */}
            {tab==="Paliers" && (
              <div className="space-y-4">
                {frais.filter(f=>f.mode==="palier").map(f=>{
                  const fps = paliers.filter(p=>p.frais_id===f.id).sort((a,b)=>a.ordre-b.ordre);
                  return (
                    <div key={f.id}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[13px] font-semibold text-ink">{f.nom}</h4>
                        <button onClick={()=>{setNewPalier(f.id);setNpF({tranche_min:"",tranche_max:"",frais_fixe:"0",frais_pct:"0"})}}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-400 hover:bg-sand-200"><Plus size={11}/> Ajouter tranche</button>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-sand-200">
                        <table className="w-full text-[12px]">
                          <thead className="bg-sand-50">
                            <tr>
                              {["De (XOF)","À (XOF)","Frais fixe","Frais %",""].map(h=><th key={h} className="px-3 py-2 text-left text-[11px] text-ink-400">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sand-100">
                            {fps.map(p=>(
                              <tr key={p.id}>
                                <td className="num px-3 py-2">{formatXOF(p.tranche_min)}</td>
                                <td className="num px-3 py-2">{formatXOF(p.tranche_max)}</td>
                                <td className="num px-3 py-2">{p.frais_fixe>0?formatXOF(p.frais_fixe):"—"}</td>
                                <td className="num px-3 py-2">{p.frais_pct>0?`${p.frais_pct}%`:"—"}</td>
                                <td className="px-2 py-1">
                                  <button onClick={async()=>{await deletePalier(p.id);rfPaliers();}} className="p-1 rounded hover:bg-ember-100 text-ember-400"><Trash2 size={12}/></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
                {frais.filter(f=>f.mode==="palier").length===0 && <p className="text-[13px] text-ink-400">Aucun frais de type "Paliers" configuré. Ajoutez un frais avec le mode Paliers dans l'onglet Frais.</p>}
              </div>
            )}

            {/* ── LIMITES ─────────────────────────────────────────────────── */}
            {tab==="Limites" && (
              <div>
                <h4 className="mb-3 text-[13px] font-semibold text-ink">Limites de transaction ({limites.length})</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {limites.map(l=>(
                    <div key={l.id} className="flex items-center justify-between rounded-xl border border-sand-200 px-4 py-3">
                      <div>
                        <div className="text-[12px] font-medium text-ink">{LIMITE_LABEL[l.type_limite]??l.type_limite}</div>
                        {l.notes && <div className="text-[11px] text-ink-400">{l.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={l.valeur} className="num w-28 rounded-lg border border-sand-200 px-2 py-1 text-[13px] text-right focus:outline-none focus:ring-1 focus:ring-clay"
                          onBlur={async(e)=>{ const v=Number(e.target.value); if(v!==l.valeur) await updateLimite(l.id,v); rfLimites(); }}/>
                        <span className="text-[11px] text-ink-400">XOF</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PARAMÈTRES ──────────────────────────────────────────────── */}
            {tab==="Paramètres" && (
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nom affiché"><input className={inputCls} value={paramF.nom} onChange={e=>setParamF(f=>({...f,nom:e.target.value}))}/></Field>
                  <Field label="Couleur principale"><div className="flex gap-2"><input className={inputCls+" flex-1 num"} value={paramF.couleur} onChange={e=>setParamF(f=>({...f,couleur:e.target.value}))}/><input type="color" value={paramF.couleur} onChange={e=>setParamF(f=>({...f,couleur:e.target.value}))} className="h-10 w-10 cursor-pointer rounded-lg border border-sand-200"/></div></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Commission dealer (%)"><input className={inputCls+" num"} type="number" step="0.1" value={paramF.commission_taux} onChange={e=>setParamF(f=>({...f,commission_taux:e.target.value}))}/></Field>
                  <Field label="USSD solde"><input className={inputCls+" num"} value={paramF.ussd_solde} placeholder="*144#" onChange={e=>setParamF(f=>({...f,ussd_solde:e.target.value}))}/></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Téléphone assistance"><input className={inputCls} value={paramF.telephone_support} onChange={e=>setParamF(f=>({...f,telephone_support:e.target.value}))}/></Field>
                  <Field label="Slogan"><input className={inputCls} value={paramF.slogan} onChange={e=>setParamF(f=>({...f,slogan:e.target.value}))}/></Field>
                </div>
                <Field label="Notes"><textarea className={inputCls} rows={2} value={paramF.notes} onChange={e=>setParamF(f=>({...f,notes:e.target.value}))}/></Field>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="op_actif" checked={paramF.actif} onChange={e=>setParamF(f=>({...f,actif:e.target.checked}))}/>
                  <label htmlFor="op_actif" className="text-[13px] text-ink">Opérateur actif</label>
                </div>
                <Btn onClick={saveParams}><Save size={14}/> Enregistrer les paramètres</Btn>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {/* Flotte */}
      <Modal open={!!openFlotte} onClose={()=>setOpenFlotte(null)} title={openFlotte==="appro"?"Approvisionner la flotte":"Retrait de flotte"}>
        <div className="mb-3 rounded-xl bg-sand-100 px-4 py-2.5 text-[13px]">Solde actuel : <strong className="num">{formatXOF(sel?.solde_flotte??0)}</strong></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Montant (XOF)"><input className={inputCls+" num"} type="number" value={flotteF.montant} onChange={e=>setFlotteF(f=>({...f,montant:e.target.value}))}/></Field>
          <Field label="Libellé"><input className={inputCls} value={flotteF.libelle} onChange={e=>setFlotteF(f=>({...f,libelle:e.target.value}))}/></Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setOpenFlotte(null)}>Annuler</Btn>
          <Btn onClick={submitFlotte} className={flotteBusy?"opacity-50":""}>{flotteBusy?"…":"Valider"}</Btn>
        </div>
      </Modal>

      {/* Nouveau frais */}
      <Modal open={newFrais} onClose={()=>setNewFrais(false)} title="Nouveau type de frais">
        <Field label="Nom"><input className={inputCls} value={nfF.nom} onChange={e=>setNfF(f=>({...f,nom:e.target.value}))}/></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Type d'opération">
            <select className={inputCls} value={nfF.type_operation} onChange={e=>setNfF(f=>({...f,type_operation:e.target.value}))}>
              {Object.entries(TYPE_OP_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Acteur">
            <select className={inputCls} value={nfF.acteur} onChange={e=>setNfF(f=>({...f,acteur:e.target.value}))}>
              {Object.entries(ACTEUR_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Mode">
            <select className={inputCls} value={nfF.mode} onChange={e=>setNfF(f=>({...f,mode:e.target.value}))}>
              {Object.entries(MODE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Valeur"><input className={inputCls+" num"} type="number" value={nfF.valeur} onChange={e=>setNfF(f=>({...f,valeur:e.target.value}))}/></Field>
          <Field label="Notes"><input className={inputCls} value={nfF.notes} onChange={e=>setNfF(f=>({...f,notes:e.target.value}))}/></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Montant min (XOF)"><input className={inputCls+" num"} type="number" value={nfF.montant_min} onChange={e=>setNfF(f=>({...f,montant_min:e.target.value}))}/></Field>
          <Field label="Montant max (XOF)"><input className={inputCls+" num"} type="number" value={nfF.montant_max} onChange={e=>setNfF(f=>({...f,montant_max:e.target.value}))}/></Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setNewFrais(false)}>Annuler</Btn>
          <Btn onClick={submitNewFrais}>Créer</Btn>
        </div>
      </Modal>

      {/* Édition frais */}
      <Modal open={!!editFrais} onClose={()=>setEditFrais(null)} title={`Modifier — ${editFrais?.nom}`}>
        <Field label="Nom"><input className={inputCls} value={efF.nom} onChange={e=>setEfF(f=>({...f,nom:e.target.value}))}/></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Mode">
            <select className={inputCls} value={efF.mode} onChange={e=>setEfF(f=>({...f,mode:e.target.value}))}>
              {Object.entries(MODE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Valeur"><input className={inputCls+" num"} type="number" step="0.1" value={efF.valeur} onChange={e=>setEfF(f=>({...f,valeur:e.target.value}))}/></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Min (XOF)"><input className={inputCls+" num"} type="number" value={efF.montant_min} onChange={e=>setEfF(f=>({...f,montant_min:e.target.value}))}/></Field>
          <Field label="Max (XOF)"><input className={inputCls+" num"} type="number" value={efF.montant_max} onChange={e=>setEfF(f=>({...f,montant_max:e.target.value}))}/></Field>
        </div>
        <Field label="Notes"><input className={inputCls} value={efF.notes} onChange={e=>setEfF(f=>({...f,notes:e.target.value}))}/></Field>
        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="ef_actif" checked={efF.actif} onChange={e=>setEfF(f=>({...f,actif:e.target.checked}))}/>
          <label htmlFor="ef_actif" className="text-[13px] text-ink">Actif</label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setEditFrais(null)}>Annuler</Btn>
          <Btn onClick={saveEF}>Enregistrer</Btn>
        </div>
      </Modal>

      {/* Nouveau palier */}
      <Modal open={!!newPalier} onClose={()=>setNewPalier(null)} title="Ajouter une tranche">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="De (XOF)"><input className={inputCls+" num"} type="number" value={npF.tranche_min} onChange={e=>setNpF(f=>({...f,tranche_min:e.target.value}))}/></Field>
          <Field label="À (XOF)"><input className={inputCls+" num"} type="number" value={npF.tranche_max} onChange={e=>setNpF(f=>({...f,tranche_max:e.target.value}))}/></Field>
          <Field label="Frais fixe (XOF)"><input className={inputCls+" num"} type="number" value={npF.frais_fixe} onChange={e=>setNpF(f=>({...f,frais_fixe:e.target.value}))}/></Field>
          <Field label="Frais % (0 si fixe)"><input className={inputCls+" num"} type="number" step="0.01" value={npF.frais_pct} onChange={e=>setNpF(f=>({...f,frais_pct:e.target.value}))}/></Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={()=>setNewPalier(null)}>Annuler</Btn>
          <Btn onClick={submitNewPalier}>Ajouter</Btn>
        </div>
      </Modal>
    </div>
  );
}
