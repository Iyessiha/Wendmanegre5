"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, KeyRound, Power, Edit2, Search, Shield, Wallet, ChevronRight } from "lucide-react";
import { useProfiles, updateProfile } from "@/lib/hooks2";
import { useCaisses, modifierCaisse } from "@/lib/hooks";
import { creerUtilisateur, reinitialiserMdp, definirActif } from "@/lib/admin-users";
import { PageHeader, Card, Btn, Modal, Field, inputCls, Badge } from "@/components/ui";

const ROLES = [
  { v: "admin", l: "Administrateur" },
  { v: "gerant", l: "Gérant" },
  { v: "caissier", l: "Caissier" },
];
const ROLE_BADGE: Record<string, string> = {
  admin: "bg-clay/15 text-clay",
  gerant: "bg-blue-100 text-blue-700",
  caissier: "bg-leaf-100 text-leaf-600",
};
const roleLabel = (r: string) => ROLES.find(x => x.v === r)?.l ?? r;

export default function UtilisateursPage() {
  const { data: profiles, refetch } = useProfiles();
  const { data: caisses, refetch: refetchCaisses } = useCaisses();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // caisse assignée par utilisateur (caisses.assignee_id)
  const caisseDe = useMemo(() => {
    const m: Record<string, { id: string; nom: string }> = {};
    caisses.forEach((c: any) => { if (c.assignee_id) m[c.assignee_id] = { id: c.id, nom: c.nom }; });
    return m;
  }, [caisses]);

  const rows = useMemo(() => profiles.filter((p: any) =>
    (p.nom ?? "").toLowerCase().includes(q.toLowerCase()) || (p.identifiant ?? "").toLowerCase().includes(q.toLowerCase())
  ), [profiles, q]);

  const stats = useMemo(() => ({
    total: profiles.length,
    admin: profiles.filter((p: any) => p.role === "admin").length,
    gerant: profiles.filter((p: any) => p.role === "gerant").length,
    caissier: profiles.filter((p: any) => p.role === "caissier").length,
    inactifs: profiles.filter((p: any) => p.actif === false).length,
  }), [profiles]);

  // Création
  const [openNew, setOpenNew] = useState(false);
  const [errNew, setErrNew] = useState<string | null>(null);
  const [formNew, setFormNew] = useState({ identifiant: "", nom: "", role: "caissier", agence: "Yako Centre", password: "" });
  function ouvrirNew() { setErrNew(null); setFormNew({ identifiant: "", nom: "", role: "caissier", agence: "Yako Centre", password: "" }); setOpenNew(true); }
  async function submitNew() {
    if (!formNew.identifiant.trim() || !formNew.nom.trim() || !formNew.password) { setErrNew("Identifiant, nom et mot de passe sont requis."); return; }
    if (formNew.password.length < 6) { setErrNew("Mot de passe : 6 caractères minimum."); return; }
    setBusy(true); setErrNew(null);
    try {
      await creerUtilisateur({ identifiant: formNew.identifiant.trim().toLowerCase(), nom: formNew.nom.trim(), role: formNew.role as any, agence: formNew.agence, password: formNew.password });
      setOpenNew(false); refetch();
    } catch (e: any) { setErrNew(e?.message ?? "Erreur lors de la création."); }
    setBusy(false);
  }

  // Édition
  const [editU, setEditU] = useState<any>(null);
  const [errEdit, setErrEdit] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState({ nom: "", role: "caissier", agence: "", telephone: "", caisse_id: "" });
  function ouvrirEdit(u: any) {
    setErrEdit(null);
    setFormEdit({ nom: u.nom ?? "", role: u.role, agence: u.agence ?? "", telephone: u.telephone ?? "", caisse_id: caisseDe[u.id]?.id ?? "" });
    setEditU(u);
  }
  async function submitEdit() {
    if (!editU) return;
    setBusy(true); setErrEdit(null);
    try {
      await updateProfile(editU.id, { nom: formEdit.nom.trim(), role: formEdit.role as any, agence: formEdit.agence, telephone: formEdit.telephone || null } as any);
      // Affectation de caisse
      const actuelle = caisseDe[editU.id]?.id ?? "";
      if (formEdit.caisse_id !== actuelle) {
        if (actuelle) await modifierCaisse(actuelle, { assignee_id: null });
        if (formEdit.caisse_id) await modifierCaisse(formEdit.caisse_id, { assignee_id: editU.id });
      }
      setEditU(null); refetch(); refetchCaisses();
    } catch (e: any) { setErrEdit(e?.message ?? "Erreur lors de la modification."); }
    setBusy(false);
  }

  // Réinitialisation mot de passe
  const [resetU, setResetU] = useState<any>(null);
  const [newPwd, setNewPwd] = useState("");
  const [errReset, setErrReset] = useState<string | null>(null);
  async function submitReset() {
    if (!resetU) return;
    if (newPwd.length < 6) { setErrReset("6 caractères minimum."); return; }
    setBusy(true); setErrReset(null);
    try { await reinitialiserMdp(resetU.id, newPwd); setResetU(null); setNewPwd(""); }
    catch (e: any) { setErrReset(e?.message ?? "Erreur."); }
    setBusy(false);
  }

  async function toggleActif(u: any) {
    const actif = !(u.actif ?? true);
    if (!confirm(actif ? `Réactiver le compte de ${u.nom} ?` : `Désactiver le compte de ${u.nom} ? Il ne pourra plus se connecter.`)) return;
    setBusy(true);
    try { await definirActif(u.id, actif); refetch(); } catch (e: any) { alert(e?.message ?? "Erreur."); }
    setBusy(false);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Utilisateurs"
        subtitle={`${stats.total} comptes · ${stats.admin} admin · ${stats.gerant} gérant · ${stats.caissier} caissier`}
        action={<Btn onClick={ouvrirNew}><UserPlus size={16} /> <span className="hidden sm:inline">Nouvel utilisateur</span></Btn>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Comptes actifs", v: stats.total - stats.inactifs, icon: Users },
          { l: "Administrateurs", v: stats.admin, icon: Shield },
          { l: "Gérants", v: stats.gerant, icon: Shield },
          { l: "Caissiers", v: stats.caissier, icon: Wallet },
        ].map((s, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2 text-ink-400"><s.icon size={15} /><span className="text-[12px]">{s.l}</span></div>
            <div className="num mt-1 text-2xl font-bold text-ink">{s.v}</div>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-sand-200 bg-white/70 px-3.5 py-2.5 shadow-card">
        <Search size={17} className="text-ink-400 flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom ou identifiant…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3 font-medium">Nom</th>
                <th className="px-5 py-3 font-medium">Identifiant</th>
                <th className="px-5 py-3 font-medium">Rôle</th>
                <th className="px-5 py-3 font-medium">Agence</th>
                <th className="px-5 py-3 font-medium">Caisse</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => (
                <tr key={u.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                  <td className="px-5 py-3.5 font-medium text-ink">
                    <Link href={`/utilisateurs/${u.id}`} className="hover:text-clay">{u.nom}</Link>
                  </td>
                  <td className="px-5 py-3.5 text-ink-500">{u.identifiant ?? "—"}</td>
                  <td className="px-5 py-3.5"><Badge className={ROLE_BADGE[u.role]}>{roleLabel(u.role)}</Badge></td>
                  <td className="px-5 py-3.5 text-ink-500 text-[13px]">{u.agence}</td>
                  <td className="px-5 py-3.5 text-ink-500 text-[13px]">{caisseDe[u.id]?.nom ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    {u.actif === false
                      ? <Badge className="bg-ember-100 text-ember-600">Inactif</Badge>
                      : <Badge className="bg-leaf-100 text-leaf-600">Actif</Badge>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => ouvrirEdit(u)} title="Modifier" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink"><Edit2 size={15} /></button>
                      <button onClick={() => { setErrReset(null); setNewPwd(""); setResetU(u); }} title="Réinitialiser le mot de passe" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-clay"><KeyRound size={15} /></button>
                      <button onClick={() => toggleActif(u)} title={u.actif === false ? "Réactiver" : "Désactiver"} className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ember-600"><Power size={15} /></button>
                      <Link href={`/utilisateurs/${u.id}`} title="Fiche" className="p-1.5 rounded-lg hover:bg-sand-200 text-ink-400 hover:text-ink inline-flex"><ChevronRight size={16} /></Link>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-400">Aucun utilisateur.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nouveau */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nouvel utilisateur">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Identifiant de connexion"><input className={inputCls} value={formNew.identifiant} onChange={e => setFormNew(f => ({ ...f, identifiant: e.target.value }))} placeholder="ex. boukary" /></Field>
          <Field label="Nom complet"><input className={inputCls} value={formNew.nom} onChange={e => setFormNew(f => ({ ...f, nom: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rôle">
            <select className={inputCls} value={formNew.role} onChange={e => setFormNew(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Field>
          <Field label="Agence"><input className={inputCls} value={formNew.agence} onChange={e => setFormNew(f => ({ ...f, agence: e.target.value }))} /></Field>
        </div>
        <Field label="Mot de passe provisoire"><input className={inputCls} type="text" value={formNew.password} onChange={e => setFormNew(f => ({ ...f, password: e.target.value }))} placeholder="6 caractères minimum" /></Field>
        <p className="text-[11px] text-ink-400">La connexion se fait avec l'identifiant. Communiquez le mot de passe provisoire à l'utilisateur et invitez-le à le changer.</p>
        {errNew && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{errNew}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenNew(false)}>Annuler</Btn>
          <Btn onClick={submitNew} className={busy ? "opacity-50" : ""}>{busy ? "Création…" : "Créer le compte"}</Btn>
        </div>
      </Modal>

      {/* Édition */}
      <Modal open={!!editU} onClose={() => setEditU(null)} title={`Modifier — ${editU?.nom ?? ""}`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom complet"><input className={inputCls} value={formEdit.nom} onChange={e => setFormEdit(f => ({ ...f, nom: e.target.value }))} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={formEdit.telephone} onChange={e => setFormEdit(f => ({ ...f, telephone: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rôle">
            <select className={inputCls} value={formEdit.role} onChange={e => setFormEdit(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Field>
          <Field label="Agence"><input className={inputCls} value={formEdit.agence} onChange={e => setFormEdit(f => ({ ...f, agence: e.target.value }))} /></Field>
        </div>
        <Field label="Caisse attribuée">
          <select className={inputCls} value={formEdit.caisse_id} onChange={e => setFormEdit(f => ({ ...f, caisse_id: e.target.value }))}>
            <option value="">— Aucune —</option>
            {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}{c.assignee_id && c.assignee_id !== editU?.id ? " (déjà attribuée)" : ""}</option>)}
          </select>
        </Field>
        {errEdit && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{errEdit}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setEditU(null)}>Annuler</Btn>
          <Btn onClick={submitEdit} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Enregistrer"}</Btn>
        </div>
      </Modal>

      {/* Réinitialisation */}
      <Modal open={!!resetU} onClose={() => setResetU(null)} title={`Réinitialiser le mot de passe — ${resetU?.nom ?? ""}`}>
        <Field label="Nouveau mot de passe"><input className={inputCls} type="text" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="6 caractères minimum" /></Field>
        {errReset && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{errReset}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setResetU(null)}>Annuler</Btn>
          <Btn onClick={submitReset} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Réinitialiser"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
