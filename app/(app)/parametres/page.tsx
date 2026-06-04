"use client";

import { useState } from "react";
import {
  Building2, Users, Receipt, Percent, ShieldCheck,
  Save, Plus, Trash2, Edit2, RotateCcw, Check, UserPlus, KeyRound, Power, RefreshCw
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PERMISSIONS_DEFS, type PermissionKey, GERANT_DEFAULTS } from "@/lib/permissions";
import { useProfiles, updateProfile, useConfigFrais, saveConfigFrais, useConfigEntreprise, saveConfigEntreprise } from "@/lib/hooks2";
import { creerUtilisateur, reinitialiserMdp, definirActif } from "@/lib/admin-users";
import { testerDolibarr, synchroniserClients, synchroniserProduits, synchroniserFactures, synchroniserAvoirs } from "@/lib/dolibarr";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";
import { formatXOF } from "@/lib/format";

const TABS = [
  { id: "entreprise", label: "Entreprise", icon: Building2 },
  { id: "users",      label: "Utilisateurs", icon: Users   },
  { id: "frais",      label: "Frais & marges", icon: Percent },
  { id: "factures",   label: "Factures", icon: Receipt     },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "dolibarr",   label: "Dolibarr", icon: RefreshCw },
];

const roleStyle: Record<string, string> = {
  admin:   "bg-clay-100 text-clay-700",
  gerant:  "bg-gold-100 text-clay-700",
  caissier:"bg-leaf-100 text-leaf-600",
};
const OPERATEURS_FRAIS = ["ORANGE MONEY","MOOV MONEY","TELECEL","WIZALL","WAVE","WARI","RIA","WESTERN UNION","UNITES","SIM"];
const TYPES_TX = ["DEPOT","RETRAIT","ENVOI","RECEPTION","CREDIT"];

export default function ParametresPage() {
  const [tab, setTab] = useState("entreprise");
  const { users: seedUsers, caisses, resetDemo } = useStore();
  const { data: profiles, loading: profLoading, refetch: refetchProfiles } = useProfiles();
  const { data: configFrais, loading: fraisLoading, refetch: refetchFrais } = useConfigFrais();
  const { data: config, refetch: refetchConfig } = useConfigEntreprise();

  // Utiliser les profiles Supabase si dispo, sinon les seed
  const displayUsers = profiles.length > 0 ? profiles : seedUsers;

  // Config entreprise form
  const [cfgForm, setCfgForm] = useState<Record<string,string>>({});
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);

  // Edit frais
  const [editFrais, setEditFrais] = useState<string | null>(null);
  const [fraisForm, setFraisForm] = useState<Record<string,string>>({});

  // Edit user
  const [editUser, setEditUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState<Record<string,string>>({});

  // Gestion des comptes (admin) — création, réinitialisation, activation
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string,string>>({ identifiant: "", nom: "", role: "caissier", agence: "Yako Centre", password: "" });
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [resetPwd, setResetPwd]   = useState("");
  const [busy, setBusy]           = useState(false);
  const [actErr, setActErr]       = useState<string | null>(null);

  async function doCreate() {
    setBusy(true); setActErr(null);
    try {
      await creerUtilisateur(createForm as any);
      setCreateOpen(false);
      setCreateForm({ identifiant: "", nom: "", role: "caissier", agence: "Yako Centre", password: "" });
      refetchProfiles();
    } catch (e: any) { setActErr(e?.message ?? "Erreur lors de la création."); }
    setBusy(false);
  }

  async function doReset() {
    if (!resetUser) return;
    setBusy(true); setActErr(null);
    try {
      await reinitialiserMdp(resetUser.id, resetPwd);
      setResetUser(null); setResetPwd("");
    } catch (e: any) { setActErr(e?.message ?? "Erreur lors de la réinitialisation."); }
    setBusy(false);
  }

  async function doToggle(u: any) {
    const actif = !(u.actif ?? true);
    if (!confirm(actif ? `Réactiver le compte de ${u.nom} ?` : `Désactiver le compte de ${u.nom} ? Il ne pourra plus se connecter.`)) return;
    setBusy(true);
    try { await definirActif(u.id, actif); refetchProfiles(); }
    catch (e: any) { alert(e?.message ?? "Erreur."); }
    setBusy(false);
  }

  // Synchronisation Dolibarr
  const [doliBusy, setDoliBusy] = useState<string | null>(null);
  const [doliMsg, setDoliMsg]   = useState<string | null>(null);
  const [doliErr, setDoliErr]   = useState<string | null>(null);
  async function runDoli(kind: string, fn: () => Promise<any>) {
    setDoliBusy(kind); setDoliErr(null); setDoliMsg(null);
    try {
      const r = await fn();
      if (r?.message) setDoliMsg(r.message);
      else setDoliMsg(
        `${r.entity} : ${r.created} créé(s), ${r.updated} mis à jour` +
        (r.errors?.length ? `, ${r.errors.length} erreur(s) :\n` + r.errors.slice(0, 6).join("\n") : ".")
      );
    } catch (e: any) { setDoliErr(e?.message ?? "Erreur."); }
    setDoliBusy(null);
  }

  async function saveCfg() {
    setCfgSaving(true);
    try { await saveConfigEntreprise(cfgForm as any); setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2000); refetchConfig(); }
    catch {}
    setCfgSaving(false);
  }

  function startEditFrais(f: any) {
    setEditFrais(f.id);
    setFraisForm({ taux: String(f.taux), frais_fixe: String(f.frais_fixe), frais_min: String(f.frais_min), frais_max: f.frais_max ?? "" });
  }

  async function saveFrais() {
    if (!editFrais) return;
    await saveConfigFrais(editFrais, {
      taux: Number(fraisForm.taux),
      frais_fixe: Number(fraisForm.frais_fixe),
      frais_min: Number(fraisForm.frais_min),
      frais_max: fraisForm.frais_max ? Number(fraisForm.frais_max) : null,
    } as any);
    setEditFrais(null);
    refetchFrais();
  }

  async function saveUser() {
    if (!editUser) return;
    await updateProfile(editUser.id, { nom: userForm.nom, role: userForm.role as any, agence: userForm.agence, telephone: userForm.telephone } as any);
    setEditUser(null);
    refetchProfiles();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Paramètres" subtitle="Configuration de l'application" />

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-ink text-sand-50" : "bg-white/70 border border-sand-200 text-ink-600 hover:bg-sand-100"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Entreprise ── */}
      {tab === "entreprise" && (
        <Card className="p-6">
          <h3 className="display mb-5 text-lg font-bold text-ink">Informations de l'entreprise</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { k: "nom",      l: "Raison sociale",    ph: config?.nom      },
              { k: "adresse",  l: "Adresse",           ph: config?.adresse  },
              { k: "ville",    l: "Ville",             ph: config?.ville    },
              { k: "telephone",l: "Téléphone 1",       ph: config?.telephone},
              { k: "telephone2",l:"Téléphone 2",       ph: config?.telephone2 ?? "" },
              { k: "email",    l: "Email",             ph: config?.email    },
              { k: "web",      l: "Site web",          ph: config?.web      },
              { k: "ifu",      l: "IFU (fiscal)",      ph: config?.ifu ?? "" },
              { k: "rccm",     l: "RCCM",              ph: config?.rccm ?? "" },
            ].map(({ k, l, ph }) => (
              <Field key={k} label={l}>
                <input className={inputCls} defaultValue={ph ?? ""} placeholder={ph ?? ""}
                  onChange={e => setCfgForm(f => ({ ...f, [k]: e.target.value }))} />
              </Field>
            ))}
            <Field label="Capital (XOF)">
              <input className={inputCls + " num"} type="number" defaultValue={config?.capital ?? 10000000}
                onChange={e => setCfgForm(f => ({ ...f, capital: e.target.value }))} />
            </Field>
          </div>
          <h4 className="display mt-6 mb-3 text-base font-bold text-ink">Paramètres de facturation</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mention bas de facture">
              <input className={inputCls} defaultValue={config?.mention_bas_facture ?? "Merci de votre confiance."}
                onChange={e => setCfgForm(f => ({ ...f, mention_bas_facture: e.target.value }))} />
            </Field>
            <Field label="Conditions de paiement">
              <input className={inputCls} defaultValue={config?.conditions_paiement ?? "A réception"}
                onChange={e => setCfgForm(f => ({ ...f, conditions_paiement: e.target.value }))} />
            </Field>
            <Field label="Mode de paiement par défaut">
              <select className={inputCls} defaultValue={config?.mode_paiement_defaut ?? "Versement"}
                onChange={e => setCfgForm(f => ({ ...f, mode_paiement_defaut: e.target.value }))}>
                {["Versement","Espèces","Orange Money","Virement","Chèque"].map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Btn onClick={saveCfg} className={cfgSaving ? "opacity-50" : ""}>
              {cfgSaved ? <><Check size={16} /> Sauvegardé</> : <><Save size={16} /> Enregistrer</>}
            </Btn>
          </div>
        </Card>
      )}

      {/* ── Utilisateurs ── */}
      {tab === "users" && (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
              <h3 className="display text-lg font-bold text-ink">Utilisateurs & rôles</h3>
              {profiles.length > 0 && (
                <Btn onClick={() => { setActErr(null); setCreateOpen(true); }}>
                  <UserPlus size={16} /> Nouvel utilisateur
                </Btn>
              )}
            </div>
            <div className="divide-y divide-sand-100">
              {displayUsers.map((u: any) => {
                const caisse = caisses.find(c => (c as any).assigneeA === u.id || (c as any).assignee_id === u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{u.nom}</span>
                        {u.actif === false && <Badge className="bg-ember-100 text-ember-600 text-[10px]">désactivé</Badge>}
                      </div>
                      {u.identifiant && <div className="num text-[11px] text-ink-500">identifiant : {u.identifiant}</div>}
                      <div className="num text-[11px] text-ink-400">{u.telephone} · {u.agence}</div>
                      {caisse && <div className="text-[11px] text-ink-400">Caisse : {caisse.nom}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={roleStyle[u.role] ?? "bg-sand-200 text-ink-700"}>{u.role}</Badge>
                      {profiles.length > 0 && (
                        <>
                          <button title="Modifier" onClick={() => { setEditUser(u); setUserForm({ nom: u.nom, role: u.role, agence: u.agence, telephone: u.telephone ?? "" }); }}
                            className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink">
                            <Edit2 size={15} />
                          </button>
                          <button title="Réinitialiser le mot de passe" onClick={() => { setActErr(null); setResetPwd(""); setResetUser(u); }}
                            className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink">
                            <KeyRound size={15} />
                          </button>
                          <button title={u.actif === false ? "Réactiver" : "Désactiver"} onClick={() => doToggle(u)}
                            className={`p-1.5 rounded-lg hover:bg-sand-200 ${u.actif === false ? "text-leaf" : "text-ink-400 hover:text-ember-600"}`}>
                            <Power size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          {profiles.length === 0 && (
            <p className="mt-3 text-[12px] text-ink-400">
              La modification des rôles est disponible une fois le projet Supabase configuré (Sprint 1).
            </p>
          )}
          <Card className="mt-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="display text-base font-bold text-ink">Données de démonstration</h3>
                <p className="mt-1 text-[13px] text-ink-500">Réinitialise toutes les opérations de test.</p>
              </div>
              <Btn variant="soft" onClick={() => { if (confirm("Réinitialiser ?")) resetDemo(); }}>
                <RotateCcw size={16} /> Réinitialiser
              </Btn>
            </div>
          </Card>
        </>
      )}

      {/* ── Frais & Marges ── */}
      {tab === "frais" && (
        <Card className="overflow-hidden">
          <div className="border-b border-sand-200 px-5 py-4">
            <h3 className="display text-lg font-bold text-ink">Grille des frais & commissions</h3>
            <p className="mt-1 text-[12px] text-ink-500">
              Ces taux sont appliqués automatiquement lors de chaque transaction. Modifiez selon vos conditions réelles avec chaque opérateur.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Opérateur</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">Taux %</th>
                  <th className="px-5 py-3 text-right font-medium">Frais fixe</th>
                  <th className="px-5 py-3 text-right font-medium">Min</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {fraisLoading && <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-400">Chargement...</td></tr>}
                {configFrais.map(f => (
                  <tr key={f.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                    <td className="px-5 py-3 font-medium text-ink">{f.operateur}</td>
                    <td className="px-5 py-3 text-ink-700">{f.type_transaction}</td>
                    <td className="num px-5 py-3 text-right text-ink">{f.taux}%</td>
                    <td className="num px-5 py-3 text-right text-ink-600">{f.frais_fixe > 0 ? formatXOF(f.frais_fixe) : "—"}</td>
                    <td className="num px-5 py-3 text-right text-ink-600">{f.frais_min > 0 ? formatXOF(f.frais_min) : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge className={f.actif ? "bg-leaf-100 text-leaf-600" : "bg-sand-200 text-ink-400"}>
                        {f.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => startEditFrais(f)}
                        className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink">
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!fraisLoading && configFrais.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-6 text-center text-sm text-ink-400">
                    Exécutez la migration 001 dans Supabase pour charger les frais par défaut.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Factures ── */}
      {tab === "factures" && (
        <Card className="p-6">
          <h3 className="display mb-2 text-lg font-bold text-ink">Aperçu du modèle de facture</h3>
          <p className="mb-5 text-[13px] text-ink-500">Les informations ci-dessous apparaissent sur chaque reçu et facture imprimable.</p>
          <div className="rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="display text-xl font-extrabold text-ink">{config?.nom ?? "ETS WENDMANÉGRÉ"}</div>
                <div className="mt-1 text-[13px] text-ink-500">{config?.adresse}</div>
                <div className="text-[13px] text-ink-500">Tél. : {config?.telephone}</div>
                <div className="text-[13px] text-ink-500">Email : {config?.email}</div>
              </div>
              <div className="text-right text-[12px] text-ink-400">
                <div className="display text-lg font-bold text-clay">REÇU / FACTURE</div>
                <div>N° : FA2606-54063</div>
                <div>Date : {new Date().toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
            <div className="my-4 border-t border-sand-300" />
            <div className="text-[12px] text-ink-600"><strong>TYPE OPÉRATION :</strong> TRANSFERT</div>
            <table className="mt-2 w-full text-[13px]">
              <thead><tr className="border-b border-sand-300"><th className="py-1 text-left text-ink-500">Désignation</th><th className="text-right text-ink-500">P.U. HT</th><th className="text-right text-ink-500">Total</th></tr></thead>
              <tbody><tr><td className="py-2">ORANGE MONEY</td><td className="num text-right">500 000 F</td><td className="num text-right">500 000 F</td></tr></tbody>
            </table>
            <div className="my-3 border-t border-sand-300" />
            <div className="flex justify-between text-sm"><span className="text-ink-500">{config?.conditions_paiement ?? "A réception"}</span><span className="num font-bold text-ink">Total : 500 000 F</span></div>
            <div className="mt-3 text-center text-[11px] text-ink-400">{config?.mention_bas_facture}</div>
            <div className="mt-1 text-center text-[10px] text-ink-300">Capital {(config?.capital ?? 10000000).toLocaleString("fr-FR")} XOF</div>
          </div>
        </Card>
      )}

      {/* Modal edit user */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Modifier l'utilisateur">
        <Field label="Nom complet"><input className={inputCls} value={userForm.nom} onChange={e => setUserForm(f => ({ ...f, nom: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rôle">
            <select className={inputCls} value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
              <option value="admin">Administrateur</option>
              <option value="gerant">Gérant</option>
              <option value="caissier">Caissier</option>
            </select>
          </Field>
          <Field label="Agence"><input className={inputCls} value={userForm.agence} onChange={e => setUserForm(f => ({ ...f, agence: e.target.value }))} /></Field>
        </div>
        <Field label="Téléphone"><input className={inputCls + " num"} value={userForm.telephone} onChange={e => setUserForm(f => ({ ...f, telephone: e.target.value }))} /></Field>
        <div className="mt-2 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setEditUser(null)}>Annuler</Btn><Btn onClick={saveUser}>Enregistrer</Btn></div>
      </Modal>

      {/* Modal création utilisateur */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvel utilisateur">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Identifiant">
            <input className={inputCls} placeholder="ex. issa" value={createForm.identifiant}
              onChange={e => setCreateForm(f => ({ ...f, identifiant: e.target.value.toLowerCase().replace(/\s/g, "") }))} />
          </Field>
          <Field label="Nom complet">
            <input className={inputCls} value={createForm.nom} onChange={e => setCreateForm(f => ({ ...f, nom: e.target.value }))} />
          </Field>
          <Field label="Rôle">
            <select className={inputCls} value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
              <option value="caissier">Caissier</option>
              <option value="gerant">Gérant</option>
              <option value="admin">Administrateur</option>
            </select>
          </Field>
          <Field label="Agence">
            <input className={inputCls} value={createForm.agence} onChange={e => setCreateForm(f => ({ ...f, agence: e.target.value }))} />
          </Field>
        </div>
        <Field label="Mot de passe initial">
          <input className={inputCls} type="text" placeholder="au moins 6 caractères" value={createForm.password}
            onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} />
        </Field>
        <p className="text-[11px] text-ink-400">L'employé se connectera avec l'identifiant «&nbsp;{createForm.identifiant || "…"}&nbsp;» et ce mot de passe.</p>
        {actErr && <p className="mt-2 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{actErr}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Btn>
          <Btn onClick={doCreate} className={busy ? "opacity-50" : ""}>{busy ? "Création…" : "Créer le compte"}</Btn>
        </div>
      </Modal>

      {/* Modal réinitialisation mot de passe */}
      <Modal open={!!resetUser} onClose={() => setResetUser(null)} title="Réinitialiser le mot de passe">
        <p className="mb-3 text-[13px] text-ink-500">
          Nouveau mot de passe pour <strong>{resetUser?.nom}</strong>
          {resetUser?.identifiant ? ` (identifiant ${resetUser.identifiant})` : ""}.
        </p>
        <Field label="Nouveau mot de passe">
          <input className={inputCls} type="text" placeholder="au moins 6 caractères" value={resetPwd} onChange={e => setResetPwd(e.target.value)} />
        </Field>
        {actErr && <p className="mt-2 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{actErr}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setResetUser(null)}>Annuler</Btn>
          <Btn onClick={doReset} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Réinitialiser"}</Btn>
        </div>
      </Modal>

      {/* Modal edit frais */}
      <Modal open={!!editFrais} onClose={() => setEditFrais(null)} title="Modifier les frais">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taux (%)"><input className={inputCls + " num"} type="number" step="0.01" value={fraisForm.taux} onChange={e => setFraisForm(f => ({ ...f, taux: e.target.value }))} /></Field>
          <Field label="Frais fixe (XOF)"><input className={inputCls + " num"} type="number" value={fraisForm.frais_fixe} onChange={e => setFraisForm(f => ({ ...f, frais_fixe: e.target.value }))} /></Field>
          <Field label="Frais minimum (XOF)"><input className={inputCls + " num"} type="number" value={fraisForm.frais_min} onChange={e => setFraisForm(f => ({ ...f, frais_min: e.target.value }))} /></Field>
          <Field label="Plafond frais (XOF)"><input className={inputCls + " num"} type="number" value={fraisForm.frais_max} onChange={e => setFraisForm(f => ({ ...f, frais_max: e.target.value }))} placeholder="Illimité" /></Field>
        </div>
        <div className="mt-2 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setEditFrais(null)}>Annuler</Btn><Btn onClick={saveFrais}>Enregistrer</Btn></div>
      </Modal>

      {/* ── Permissions ── */}
      {tab === "permissions" && (
        <PermissionsPanel />
      )}

      {/* ── Dolibarr ── */}
      {tab === "dolibarr" && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={18} className="text-clay" />
            <h3 className="display text-lg font-bold text-ink">Synchronisation Dolibarr</h3>
          </div>
          <p className="mb-5 text-[13px] text-ink-500">
            Envoie les données de l'application vers votre instance Dolibarr. Ordre conseillé : commerçants → produits → factures → avoirs.
            Les factures (prêts) et avoirs (prêts annulés) ont besoin que le commerçant existe déjà dans Dolibarr. Les enregistrements déjà liés ne sont pas recréés. La clé API reste côté serveur.
          </p>

          <div className="flex flex-wrap gap-2">
            <Btn variant="soft" onClick={() => runDoli("test", testerDolibarr)} className={doliBusy === "test" ? "opacity-50" : ""}>
              {doliBusy === "test" ? "Test…" : "Tester la connexion"}
            </Btn>
            <Btn onClick={() => runDoli("clients", synchroniserClients)} className={doliBusy === "clients" ? "opacity-50" : ""}>
              <Users size={15} /> {doliBusy === "clients" ? "Synchronisation…" : "Synchroniser les commerçants"}
            </Btn>
            <Btn onClick={() => runDoli("produits", synchroniserProduits)} className={doliBusy === "produits" ? "opacity-50" : ""}>
              <Receipt size={15} /> {doliBusy === "produits" ? "Synchronisation…" : "Synchroniser les produits"}
            </Btn>
            <Btn onClick={() => runDoli("factures", synchroniserFactures)} className={doliBusy === "factures" ? "opacity-50" : ""}>
              <Receipt size={15} /> {doliBusy === "factures" ? "Synchronisation…" : "Synchroniser les factures"}
            </Btn>
            <Btn variant="soft" onClick={() => runDoli("avoirs", synchroniserAvoirs)} className={doliBusy === "avoirs" ? "opacity-50" : ""}>
              {doliBusy === "avoirs" ? "Synchronisation…" : "Synchroniser les avoirs"}
            </Btn>
          </div>

          {doliMsg && (
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-leaf-100/60 px-4 py-3 text-[12px] text-ink-700">{doliMsg}</pre>
          )}
          {doliErr && (
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-ember-100 px-4 py-3 text-[12px] text-ember-600">{doliErr}</pre>
          )}

          <p className="mt-5 text-[11px] text-ink-400">
            Connexion : {`https://gescom.wendmanegre.com`} · La synchronisation est réservée à l'administrateur.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Composant panneau des permissions ──────────────────────
function PermissionsPanel() {
  const { users } = useStore();
  const [selectedUserId, setSelectedUserId] = useState<string>("u2"); // Aminata par défaut
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>(() => {
    // Initialiser depuis GERANT_DEFAULTS
    return Object.fromEntries(PERMISSIONS_DEFS.map(p => [p.cle, GERANT_DEFAULTS.has(p.cle)]));
  });

  const selectedUser = users.find(u => u.id === selectedUserId);
  const gerants = users.filter(u => u.role !== "admin");

  const grouped = PERMISSIONS_DEFS.reduce((acc, p) => {
    if (!acc[p.groupe]) acc[p.groupe] = [];
    acc[p.groupe].push(p);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS_DEFS>);

  const risqueCls: Record<string, string> = {
    faible: "bg-leaf-100 text-leaf-600",
    moyen:  "bg-gold-100 text-clay-700",
    eleve:  "bg-ember-100 text-ember-600",
  };

  return (
    <div>
      {/* Sélection de l'utilisateur */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-ink-700">Configurer les accès de :</span>
        <div className="flex flex-wrap gap-2">
          {gerants.map(u => (
            <button key={u.id} onClick={() => setSelectedUserId(u.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition-all ${
                selectedUserId === u.id ? "border-clay bg-clay-100/50 text-clay-700 ring-1 ring-clay/20" : "border-sand-200 bg-white/70 text-ink hover:border-sand-300"
              }`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ink/10 text-[10px] font-bold">
                {u.nom.split(" ").map((p: string) => p[0]).join("").slice(0,2).toUpperCase()}
              </span>
              {u.nom.split(" ")[0]} <Badge className={u.role === "gerant" ? "bg-gold-100 text-clay-700" : "bg-sand-200 text-ink-600"}>{u.role}</Badge>
            </button>
          ))}
        </div>
        <button className="ml-auto rounded-xl bg-leaf text-white px-4 py-2 text-[13px] font-medium hover:bg-leaf-600">
          💾 Enregistrer
        </button>
      </div>

      {selectedUser && (
        <div className="rounded-xl bg-sand-100 px-4 py-3 mb-5 text-[13px] text-ink-600">
          Vous configurez les accès de <strong>{selectedUser.nom}</strong> ({selectedUser.role}) — agence {selectedUser.agence}.
          Les modifications prendront effet à la prochaine connexion.
        </div>
      )}

      {/* Grille des permissions par groupe */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(grouped).map(([groupe, perms]) => (
          <Card key={groupe} className="overflow-hidden">
            <div className="border-b border-sand-100 px-4 py-3 bg-sand-50/50">
              <h4 className="display text-sm font-bold text-ink">{groupe}</h4>
            </div>
            <div className="divide-y divide-sand-50">
              {perms.map(p => (
                <div key={p.cle} className="flex items-center justify-between px-4 py-3 hover:bg-sand-50/50">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-ink">{p.libelle}</span>
                      <Badge className={risqueCls[p.risque] + " text-[10px]"}>{p.risque}</Badge>
                    </div>
                    <div className="text-[11px] text-ink-400 mt-0.5">{p.desc}</div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => setLocalPerms(prev => ({ ...prev, [p.cle]: !prev[p.cle] }))}
                    className={`relative flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                      localPerms[p.cle] ? "bg-clay" : "bg-sand-300"
                    }`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      localPerms[p.cle] ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
