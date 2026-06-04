"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MapPin,
  CreditCard,
  Plus,
  HandCoins,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Btn, Badge, Modal, Field, inputCls } from "@/components/ui";
import {
  formatXOF,
  formatDate,
  resteAPayer,
  statutLabel,
  joursDeRetard,
} from "@/lib/format";
import type { TypeOperation } from "@/lib/types";

export default function ClientDetail() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const {
    clients,
    prets,
    remboursements,
    caisses,
    octroyerPret,
    enregistrerRemboursement,
  } = useStore();

  const client = clients.find((c) => c.id === id);
  const [openPret, setOpenPret] = useState(false);
  const [openRemb, setOpenRemb] = useState<string | null>(null);

  const [pretForm, setPretForm] = useState({
    type: "ORANGE MONEY" as TypeOperation,
    montant: "",
    caisseId: caisses[0]?.id ?? "",
    echeance: "2026-06-20",
  });
  const [rembForm, setRembForm] = useState({ montant: "", mode: "Espèces", caisseId: caisses[0]?.id ?? "" });

  const data = useMemo(() => {
    const mesP = prets
      .filter((p) => p.clientId === id)
      .sort((a, b) => b.dateOctroi.localeCompare(a.dateOctroi));
    const encours = mesP
      .filter((p) => p.statut !== "rembourse")
      .reduce((s, p) => s + resteAPayer(p, remboursements), 0);
    const totalOctroye = mesP.reduce((s, p) => s + p.montant, 0);
    const totalRembourse = mesP.reduce(
      (s, p) =>
        s +
        remboursements.filter((r) => r.pretId === p.id).reduce((x, r) => x + r.montant, 0),
      0
    );
    const taux = totalOctroye > 0 ? (totalRembourse / totalOctroye) * 100 : 0;
    return { mesP, encours, totalOctroye, taux };
  }, [prets, remboursements, id]);

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

  function submitPret() {
    const m = Number(pretForm.montant);
    if (!m) return;
    octroyerPret({
      clientId: id,
      type: pretForm.type,
      montant: m,
      caisseId: pretForm.caisseId,
      echeance: pretForm.echeance,
    });
    setPretForm({ ...pretForm, montant: "" });
    setOpenPret(false);
  }

  function submitRemb(pretId: string) {
    const m = Number(rembForm.montant);
    if (!m) return;
    enregistrerRemboursement({
      pretId,
      montant: m,
      mode: rembForm.mode as any,
      caisseId: rembForm.caisseId,
    });
    setRembForm({ ...rembForm, montant: "" });
    setOpenRemb(null);
  }

  const plafondPct = Math.min(100, (data.encours / client.plafond) * 100);

  return (
    <div className="animate-fade-up">
      <button
        onClick={() => router.push("/clients")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink"
      >
        <ArrowLeft size={16} /> Commerçants
      </button>

      <PageHeader
        title={client.nom}
        subtitle={client.nomAlternatif}
        action={
          <Btn onClick={() => setOpenPret(true)}>
            <Plus size={16} /> Octroyer un prêt
          </Btn>
        }
      />

      {/* Infos + synthèse */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="display mb-3 text-base font-bold text-ink">Coordonnées</h3>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2 text-ink-700">
              <CreditCard size={15} className="text-ink-400" /> <span className="num">{client.id}</span>
            </li>
            <li className="flex items-center gap-2 text-ink-700">
              <MapPin size={15} className="text-ink-400" /> {client.ville}
            </li>
            <li className="flex items-center gap-2 text-ink-700">
              <Phone size={15} className="text-ink-400" /> <span className="num">{client.telephone}</span>
            </li>
            {client.cnib && (
              <li className="text-ink-500">CNIB : <span className="num">{client.cnib}</span></li>
            )}
            <li className="text-ink-400">Client depuis {formatDate(client.dateCreation)}</li>
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
            <div
              className={`h-full rounded-full ${plafondPct > 85 ? "bg-ember" : plafondPct > 60 ? "bg-gold" : "bg-leaf"}`}
              style={{ width: `${plafondPct}%` }}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="display mb-3 text-base font-bold text-ink">Fiabilité</h3>
          <div className="num text-3xl font-semibold text-leaf-600">{data.taux.toFixed(0)} %</div>
          <p className="mt-2 text-[12px] text-ink-500">
            Taux de remboursement historique sur {formatXOF(data.totalOctroye)} octroyés
          </p>
        </Card>
      </div>

      {/* Historique des prêts */}
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
              {data.mesP.map((p) => {
                const reste = resteAPayer(p, remboursements);
                const st = statutLabel(p.statut);
                const retard = joursDeRetard(p.echeance);
                return (
                  <tr key={p.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-100/60">
                    <td className="num px-5 py-3.5 text-ink-700">{p.id}</td>
                    <td className="px-5 py-3.5 text-ink-700">{p.type}</td>
                    <td className="px-5 py-3.5 text-ink-500">
                      {formatDate(p.dateOctroi)}
                      {retard > 0 && p.statut !== "rembourse" && (
                        <span className="ml-1 text-[11px] text-ember">(+{retard}j)</span>
                      )}
                    </td>
                    <td className="num px-5 py-3.5 text-right text-ink">{formatXOF(p.montant)}</td>
                    <td className="num px-5 py-3.5 text-right font-medium text-clay-700">
                      {reste > 0 ? formatXOF(reste) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={st.cls}>{st.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {reste > 0 && (
                        <button
                          onClick={() => {
                            setRembForm({ montant: String(reste), mode: "Espèces", caisseId: caisses[0]?.id ?? "" });
                            setOpenRemb(p.id);
                          }}
                          className="rounded-lg bg-leaf-100 px-2.5 py-1 text-[12px] font-medium text-leaf-600 hover:bg-leaf-100/70"
                        >
                          Encaisser
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.mesP.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-400">
                    Aucun prêt pour ce commerçant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal octroi */}
      <Modal open={openPret} onClose={() => setOpenPret(false)} title={`Octroyer un prêt — ${client.nom}`}>
        <Field label="Type d'opération">
          <select className={inputCls} value={pretForm.type} onChange={(e) => setPretForm({ ...pretForm, type: e.target.value as TypeOperation })}>
            {["ORANGE MONEY", "MOOV MONEY", "TELECEL", "UNITES", "CASH", "SIM", "TRANSFERT INTL"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Montant (XOF)">
          <input className={inputCls + " num"} type="number" value={pretForm.montant} onChange={(e) => setPretForm({ ...pretForm, montant: e.target.value })} placeholder="500000" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caisse débitée">
            <select className={inputCls} value={pretForm.caisseId} onChange={(e) => setPretForm({ ...pretForm, caisseId: e.target.value })}>
              {caisses.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Échéance">
            <input className={inputCls} type="date" value={pretForm.echeance} onChange={(e) => setPretForm({ ...pretForm, echeance: e.target.value })} />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenPret(false)}>Annuler</Btn>
          <Btn onClick={submitPret}>Confirmer l'octroi</Btn>
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
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpenRemb(null)}>Annuler</Btn>
          <Btn onClick={() => openRemb && submitRemb(openRemb)}>Valider</Btn>
        </div>
      </Modal>
    </div>
  );
}
