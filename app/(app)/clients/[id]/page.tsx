"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, CreditCard, Plus, HandCoins, Wallet } from "lucide-react";
import { useClients, usePrets, useCaisses, octroyerPret, enregistrerRemboursement } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PageHeader, Card, Btn, Badge, Modal, Field, inputCls } from "@/components/ui";
import { PhotoProfil, PiecesJointesBloc } from "@/components/FicheMedia";
import { useHistoriqueClient } from "@/lib/hooks-factures";
import { formatXOF, formatDate, statutLabel } from "@/lib/format";

const TYPES = ["ORANGE MONEY", "MOOV MONEY", "TELECEL", "UNITES", "CASH", "SIM", "TRANSFERT INTL"];

export default function ClientDetail() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);

  const { data: clients } = useClients();
  const { data: mesP, refetch: refetchPrets } = usePrets({ clientId: id });
  const { data: caisses } = useCaisses();
  const { data: historique } = useHistoriqueClient(id);

  const client = clients.find((c) => c.id === id);

  const [userId, setUserId] = useState<string>("");
  const [openPret, setOpenPret] = useState(false);
  const [openRemb, setOpenRemb] = useState<string | null>(null);
  const [openRembGlobal, setOpenRembGlobal] = useState(false);
  const [selectedPretId, setSelectedPretId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [pretForm, setPretForm] = useState({ type: "ORANGE MONEY", montant: "", caisseId: "", echeance: "2026-06-20" });
  const [rembForm, setRembForm] = useState({ montant: "", mode: "Espèces", caisseId: "" });

  // Identité de l'utilisateur connecté (pour octroye_par / saisi_par)
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUserId(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  // Caisse par défaut une fois les caisses chargées
  useEffect(() => {
    if (caisses[0]?.id) {
      setPretForm((f) => f.caisseId ? f : { ...f, caisseId: caisses[0].id });
      setRembForm((f) => f.caisseId ? f : { ...f, caisseId: caisses[0].id });
    }
  }, [caisses]);

  const data = useMemo(() => {
    const actifs = mesP.filter((p) => p.statut !== "rembourse" && p.statut !== "annule");
    const encours = actifs.reduce((s, p) => s + (p.reste_a_payer ?? 0), 0);
    const totalOctroye = mesP.reduce((s, p) => s + p.montant, 0);
    const totalRembourse = mesP.reduce((s, p) => s + (p.total_rembourse ?? 0), 0);
    const taux = totalOctroye > 0 ? (totalRembourse / totalOctroye) * 100 : 0;
    return { encours, totalOctroye, taux };
  }, [mesP]);

  if (!client) {
    return (
      <div className="animate-fade-up">
        <Btn variant="ghost" onClick={() => router.push("/clients")}>
          <ArrowLeft size={16} /> Retour
        </Btn>
        <p className="mt-6 text-ink-500">Commerçant introuvable.</p>
      </div>
    );
  }

  async function submitPret() {
    const m = Number(pretForm.montant);
    if (!m) { setErreur("Indiquez un montant."); return; }
    if (!userId) { setErreur("Session non chargée, réessayez."); return; }
    if (!pretForm.caisseId) { setErreur("Choisissez une caisse."); return; }
    setBusy(true); setErreur(null);
    try {
      await octroyerPret({
        clientId: id, typeOperation: pretForm.type, montant: m,
        caisseId: pretForm.caisseId, echeance: pretForm.echeance, userId,
      });
      setPretForm({ ...pretForm, montant: "" });
      setOpenPret(false);
      refetchPrets();
    } catch (e: any) { setErreur(e?.message ?? "Erreur lors de l'octroi."); }
    setBusy(false);
  }

  async function submitRemb(pretId: string) {
    const m = Number(rembForm.montant);
    if (!m) { setErreur("Indiquez un montant."); return; }
    if (!userId) { setErreur("Session non chargée, réessayez."); return; }
    setBusy(true); setErreur(null);
    try {
      await enregistrerRemboursement({
        pretId, montant: m, mode: rembForm.mode as any, caisseId: rembForm.caisseId, userId,
      });
      setRembForm({ ...rembForm, montant: "" });
      setOpenRemb(null);
      refetchPrets();
    } catch (e: any) { setErreur(e?.message ?? "Erreur lors du remboursement."); }
    setBusy(false);
  }

  const plafondPct = Math.min(100, (data.encours / (client.plafond || 1)) * 100);

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push("/clients")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink">
        <ArrowLeft size={16} /> Commerçants
      </button>

      <PageHeader
        title={client.nom}
        subtitle={(client as any).nom_alternatif ?? undefined}
        action={
          <div className="flex items-center gap-2">
            {data.encours > 0 && (
              <Btn variant="soft" onClick={() => {
                setErreur(null);
                const actifs = mesP.filter(p => (p.reste_a_payer ?? 0) > 0);
                const premier = actifs[0];
                if (premier) {
                  setSelectedPretId(premier.id);
                  setRembForm({ montant: String(premier.reste_a_payer ?? ""), mode: "Espèces", caisseId: caisses[0]?.id ?? "" });
                } else {
                  setSelectedPretId(null);
                  setRembForm({ montant: "", mode: "Espèces", caisseId: caisses[0]?.id ?? "" });
                }
                setOpenRembGlobal(true);
              }}>
                <Wallet size={15} /> Rembourser
              </Btn>
            )}
            <Btn onClick={() => { setErreur(null); setOpenPret(true); }}><Plus size={16} /> Octroyer un prêt</Btn>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <PhotoProfil entite="client" id={client.id} nom={client.nom} photoUrl={(client as any).photo_url} />
            <div>
              <div className="display text-base font-bold text-ink">{client.nom}</div>
              {(client as any).nom_alternatif && <div className="text-[12px] text-ink-500">{(client as any).nom_alternatif}</div>}
            </div>
          </div>
          <h3 className="display mb-3 text-base font-bold text-ink">Coordonnées</h3>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2 text-ink-700"><CreditCard size={15} className="text-ink-400" /> <span className="num">{client.id}</span></li>
            <li className="flex items-center gap-2 text-ink-700"><MapPin size={15} className="text-ink-400" /> {client.ville}</li>
            <li className="flex items-center gap-2 text-ink-700"><Phone size={15} className="text-ink-400" /> <span className="num">{client.telephone}</span></li>
            {(client as any).cnib && <li className="text-ink-500">CNIB : <span className="num">{(client as any).cnib}</span></li>}
            {(client as any).identifiant_pro1 && <li className="text-ink-500">ID pro : <span className="num">{(client as any).identifiant_pro1}</span></li>}
            {(client as any).date_creation && <li className="text-ink-400">Client depuis {formatDate((client as any).date_creation)}</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="display mb-3 text-base font-bold text-ink">Encours actuel</h3>
          <div className="num text-3xl font-semibold text-clay-700">{formatXOF(data.encours)}</div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-ink-500">
            <span>Plafond {formatXOF(client.plafond)}</span>
            <span className="num">{plafondPct.toFixed(0)} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand-200">
            <div className={`h-full rounded-full ${plafondPct > 85 ? "bg-ember" : plafondPct > 60 ? "bg-gold" : "bg-leaf"}`} style={{ width: `${plafondPct}%` }} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="display mb-3 text-base font-bold text-ink">Fiabilité</h3>
          <div className="num text-3xl font-semibold text-leaf-600">{data.taux.toFixed(0)} %</div>
          <p className="mt-2 text-[12px] text-ink-500">Taux de remboursement historique sur {formatXOF(data.totalOctroye)} octroyés</p>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <PiecesJointesBloc entite="client" id={client.id} />
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h3 className="display text-lg font-bold text-ink">Chronologie</h3>
          <p className="text-[12px] text-ink-400">Prêts, remboursements, factures et encaissements</p>
        </div>
        <div className="divide-y divide-sand-100">
          {historique.map((e, i) => {
            const credit = e.sens === "credit";
            const couleur = { pret: "bg-clay-100 text-clay-700", facture: "bg-blue-100 text-blue-700", commande: "bg-sand-200 text-ink-600", remboursement: "bg-leaf-100 text-leaf-600", paiement: "bg-leaf-100 text-leaf-600" }[e.type];
            return (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-7 items-center rounded-lg px-2 text-[11px] font-medium ${couleur}`}>{e.type}</span>
                  <div>
                    <div className="text-[13px] font-medium text-ink">{e.libelle}</div>
                    <div className="text-[11px] text-ink-400">{formatDate(e.date)}{e.statut ? ` · ${e.statut}` : ""}</div>
                  </div>
                </div>
                <div className={`num text-sm font-semibold ${credit ? "text-leaf-600" : "text-clay-700"}`}>{credit ? "−" : "+"}{formatXOF(e.montant)}</div>
              </div>
            );
          })}
          {historique.length === 0 && <div className="px-5 py-8 text-center text-[13px] text-ink-400">Aucun mouvement.</div>}
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-sand-200 px-5 py-4">
          <HandCoins size={17} className="text-clay" />
          <h3 className="display text-lg font-bold text-ink">Historique des prêts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3 font-medium">Référence</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 text-right font-medium">Montant</th>
                <th className="px-5 py-3 text-right font-medium">Reste dû</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mesP.map((p) => {
                const reste = p.reste_a_payer ?? 0;
                const st = statutLabel(p.statut as any);
                const retard = p.jours_retard ?? 0;
                return (
                  <tr key={p.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                    <td className="num px-5 py-3.5 text-ink-700">{p.id}</td>
                    <td className="px-5 py-3.5 text-ink-700">{p.type_operation}</td>
                    <td className="px-5 py-3.5 text-ink-500">
                      {formatDate(p.date_octroi)}
                      {retard > 0 && p.statut !== "rembourse" && <span className="ml-1 text-[11px] text-ember">(+{retard}j)</span>}
                    </td>
                    <td className="num px-5 py-3.5 text-right text-ink">{formatXOF(p.montant)}</td>
                    <td className="num px-5 py-3.5 text-right font-medium text-clay-700">{reste > 0 ? formatXOF(reste) : "—"}</td>
                    <td className="px-5 py-3.5"><Badge className={st.cls}>{st.label}</Badge></td>
                    <td className="px-5 py-3.5 text-right">
                      {reste > 0 && (
                        <button
                          onClick={() => { setErreur(null); setRembForm({ montant: String(reste), mode: "Espèces", caisseId: caisses[0]?.id ?? "" }); setOpenRemb(p.id); }}
                          className="rounded-lg bg-leaf-100 px-2.5 py-1 text-[12px] font-medium text-leaf-600 hover:bg-leaf-100/70">
                          Encaisser
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {mesP.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-400">Aucun prêt pour ce commerçant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal octroi */}
      <Modal open={openPret} onClose={() => setOpenPret(false)} title={`Octroyer un prêt — ${client.nom}`}>
        <Field label="Type d'opération">
          <select className={inputCls} value={pretForm.type} onChange={(e) => setPretForm({ ...pretForm, type: e.target.value })}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Montant (XOF)">
          <input className={inputCls + " num"} type="number" value={pretForm.montant} onChange={(e) => setPretForm({ ...pretForm, montant: e.target.value })} placeholder="500000" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caisse débitée">
            <select className={inputCls} value={pretForm.caisseId} onChange={(e) => setPretForm({ ...pretForm, caisseId: e.target.value })}>
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Échéance">
            <input className={inputCls} type="date" value={pretForm.echeance} onChange={(e) => setPretForm({ ...pretForm, echeance: e.target.value })} />
          </Field>
        </div>
        {erreur && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenPret(false)}>Annuler</Btn>
          <Btn onClick={submitPret} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Confirmer l'octroi"}</Btn>
        </div>
      </Modal>

      {/* Modal remboursement */}
      <Modal open={!!openRemb} onClose={() => setOpenRemb(null)} title="Enregistrer un remboursement">
        <Field label="Montant reçu (XOF)">
          <input className={inputCls + " num"} type="number" value={rembForm.montant} onChange={(e) => setRembForm({ ...rembForm, montant: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode">
            <select className={inputCls} value={rembForm.mode} onChange={(e) => setRembForm({ ...rembForm, mode: e.target.value })}>
              {["Espèces", "Versement", "Orange Money", "Virement"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Caisse créditée">
            <select className={inputCls} value={rembForm.caisseId} onChange={(e) => setRembForm({ ...rembForm, caisseId: e.target.value })}>
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
        </div>
        {erreur && <p className="mt-1 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenRemb(null)}>Annuler</Btn>
          <Btn onClick={() => openRemb && submitRemb(openRemb)} className={busy ? "opacity-50" : ""}>{busy ? "…" : "Valider"}</Btn>
        </div>
      </Modal>
      {/* ── Modal remboursement global (depuis le bouton header) ──────────── */}
      <Modal open={openRembGlobal} onClose={() => setOpenRembGlobal(false)} title={`Rembourser — ${client.nom}`}>
        {/* Liste des prêts actifs */}
        <div className="mb-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Prêts en cours</p>
          {mesP.filter(p => (p.reste_a_payer ?? 0) > 0).length === 0 && (
            <p className="rounded-xl bg-sand-100 px-4 py-3 text-[13px] text-ink-400">Aucun prêt impayé.</p>
          )}
          <div className="space-y-2 max-h-48 overflow-auto">
            {mesP.filter(p => (p.reste_a_payer ?? 0) > 0).map(p => {
              const sel = selectedPretId === p.id;
              return (
                <button key={p.id} onClick={() => {
                  setSelectedPretId(p.id);
                  setRembForm(f => ({ ...f, montant: String(p.reste_a_payer ?? "") }));
                }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all
                    ${sel ? "border-leaf-400 bg-leaf-50 ring-2 ring-leaf-300" : "border-sand-200 bg-white/70 hover:bg-sand-50"}`}>
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{p.id}</div>
                    <div className="text-[12px] text-ink-500">{p.type_operation} · octroyé {formatDate(p.date_octroi)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[13px] font-bold text-clay-700">{formatXOF(p.reste_a_payer ?? 0)}</div>
                    <div className="text-[11px] text-ink-400">restant</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formulaire de remboursement */}
        {selectedPretId && (
          <>
            <div className="mb-3 rounded-xl bg-sand-100 px-4 py-2.5 text-[12px] text-ink-500">
              Prêt sélectionné : <span className="num font-semibold text-ink">{selectedPretId}</span>
            </div>
            <Field label="Montant reçu (XOF)">
              <input className={inputCls + " num"} type="number" autoFocus
                value={rembForm.montant} onChange={e => setRembForm({ ...rembForm, montant: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mode de paiement">
                <select className={inputCls} value={rembForm.mode} onChange={e => setRembForm({ ...rembForm, mode: e.target.value })}>
                  {["Espèces", "Orange Money", "Moov Money", "Versement", "Virement", "Chèque"].map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Caisse créditée">
                <select className={inputCls} value={rembForm.caisseId} onChange={e => setRembForm({ ...rembForm, caisseId: e.target.value })}>
                  {caisses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        {erreur && <p className="mt-2 rounded-lg bg-ember-100 px-3 py-2 text-[12px] text-ember-600">{erreur}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenRembGlobal(false)}>Annuler</Btn>
          <Btn
            onClick={async () => { if (!selectedPretId) return; await submitRemb(selectedPretId); setOpenRembGlobal(false); }}
            className={(!selectedPretId || busy) ? "opacity-50" : ""}
            disabled={!selectedPretId || busy}>
            {busy ? "…" : "Valider le remboursement"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
