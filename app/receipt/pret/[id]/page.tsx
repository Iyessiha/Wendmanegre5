"use client";

import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { ENTREPRISE } from "@/lib/data";
import { formatXOF, formatDate, resteAPayer } from "@/lib/format";

export default function ReceiptPretPage() {
  const { id } = useParams<{ id: string }>();
  const pretId = decodeURIComponent(id);
  const { prets, clients, remboursements } = useStore();

  const pret = prets.find(p => p.id === pretId);
  const client = pret ? clients.find(c => c.id === pret.clientId) : null;
  const rembs = remboursements.filter(r => r.pretId === pretId);
  const reste = pret ? resteAPayer(pret, remboursements) : 0;
  const totalRemb = pret ? pret.montant - reste : 0;

  // Auto-print après chargement
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  if (!pret || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        Facture introuvable — ID : {pretId}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 font-sans text-[14px] text-black">
      {/* Boutons d'action — masqués à l'impression */}
      <div className="no-print mb-6 flex items-center gap-3">
        <button onClick={() => window.print()}
          className="rounded-xl bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-600">
          🖨️ Imprimer / Sauvegarder PDF
        </button>
        <button onClick={() => window.close()}
          className="rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-sand-100">
          Fermer
        </button>
        <a href={`/receipt/pret/${encodeURIComponent(pretId)}?thermal=1`}
          className="rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-sand-100">
          Format ticket 58mm
        </a>
      </div>

      {/* FACTURE — FORMAT A5, identique Dolibarr */}
      <div className="mx-auto max-w-[148mm] border border-gray-200 bg-white p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-full">

        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-4">
          <div>
            {/* Logo zone (texte à défaut de logo) */}
            <div className="inline-block rounded-lg border-2 border-clay px-3 py-1 text-[11px] font-bold text-clay">
              OM
            </div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold text-clay">Facture {pret.id}</div>
            <div className="text-[12px] text-gray-500 mt-0.5">
              <div>Date facturation : {formatDate(pret.dateOctroi)}</div>
              <div>Date échéance : {formatDate(pret.echeance)}</div>
              <div>Code client : {client.id}</div>
            </div>
          </div>
        </div>

        {/* Émetteur / Destinataire */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Émetteur</div>
            <div className="font-bold text-[13px]">{ENTREPRISE.nom}</div>
            <div className="text-[11px] text-gray-600">{ENTREPRISE.adresse}</div>
            <div className="text-[11px] text-gray-600">Tél. : {ENTREPRISE.tel}</div>
            <div className="text-[11px] text-gray-600">Email : {ENTREPRISE.email}</div>
            <div className="text-[11px] text-gray-600">Web : {ENTREPRISE.web}</div>
          </div>
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Adressé à</div>
            <div className="font-bold text-[13px]">{client.nom}</div>
            <div className="text-[11px] text-gray-600">{client.ville}</div>
            {client.telephone && <div className="text-[11px] text-gray-600">Tél. : {client.telephone}</div>}
            {client.cnib && <div className="text-[11px] text-gray-600">CNIB : {client.cnib}</div>}
          </div>
        </div>

        {/* Type opération */}
        <div className="border border-gray-300 rounded px-3 py-1.5 mb-4 text-[11px] font-semibold uppercase tracking-wide">
          TYPE OPÉRATION : TRANSFERT
        </div>

        {/* Tableau lignes */}
        <table className="w-full text-[12px] border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="py-2 text-left font-semibold text-gray-600">Désignation</th>
              <th className="py-2 text-right font-semibold text-gray-600">P.U. HT</th>
              <th className="py-2 text-right font-semibold text-gray-600">Qté</th>
              <th className="py-2 text-right font-semibold text-gray-600">Total HT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2">{pret.type}</td>
              <td className="py-2 text-right font-mono">{formatXOF(pret.montant)}</td>
              <td className="py-2 text-right">1</td>
              <td className="py-2 text-right font-mono font-semibold">{formatXOF(pret.montant)}</td>
            </tr>
          </tbody>
        </table>

        {/* Remboursements si existants */}
        {rembs.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Historique des remboursements</div>
            <table className="w-full text-[11px]">
              <thead><tr className="border-b border-gray-200">
                <th className="py-1 text-left text-gray-500">Date</th>
                <th className="py-1 text-left text-gray-500">Mode</th>
                <th className="py-1 text-right text-gray-500">Montant</th>
              </tr></thead>
              <tbody>{rembs.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-1">{formatDate(r.date)}</td>
                  <td className="py-1">{r.mode}</td>
                  <td className="py-1 text-right font-mono text-green-700">+{formatXOF(r.montant)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Totaux */}
        <div className="border-t border-gray-300 pt-3 mb-4">
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-gray-500">Conditions de règlement :</span>
            <span>A réception</span>
          </div>
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-gray-500">Mode de règlement :</span>
            <span>Versement</span>
          </div>
          <div className="flex justify-between text-[12px] mb-1 font-semibold">
            <span>Total :</span>
            <span className="font-mono">{formatXOF(pret.montant)}</span>
          </div>
          {totalRemb > 0 && (
            <>
              <div className="flex justify-between text-[12px] mb-1 text-green-700">
                <span>Total remboursé :</span>
                <span className="font-mono">−{formatXOF(totalRemb)}</span>
              </div>
              <div className="flex justify-between text-[13px] font-bold border-t border-gray-200 pt-2 mt-2">
                <span>Reste à payer :</span>
                <span className={`font-mono ${reste > 0 ? "text-red-700" : "text-green-700"}`}>
                  {reste > 0 ? formatXOF(reste) : "SOLDÉ"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Montants en lettres */}
        <div className="text-center text-[10px] text-gray-400 mb-3">
          Montants exprimés en Francs CFA BCEAO
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-3 text-center">
          <div className="text-[10px] text-gray-500">Merci de votre confiance.</div>
          <div className="text-[9px] text-gray-400 mt-1">
            Capital de {(ENTREPRISE.capital).toLocaleString("fr-FR")} XOF — {ENTREPRISE.nom} — {ENTREPRISE.tel}
          </div>
        </div>
      </div>
    </div>
  );
}
