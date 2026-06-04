"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClient } from "@/lib/supabase";
import { ENTREPRISE } from "@/lib/data";
import { formatXOF, formatDate } from "@/lib/format";

export default function ReceiptPretPage() {
  const { id } = useParams<{ id: string }>();
  const pretId = decodeURIComponent(id);

  const [pret, setPret] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [rembs, setRembs] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sb = getClient() as any;
        sb.from("config_entreprise").select("*").eq("cle", "principal").maybeSingle()
          .then(({ data }: any) => { if (data) setConfig(data); });
        const { data: p } = await sb.from("v_prets_encours").select("*").eq("id", pretId).maybeSingle();
        if (p) {
          setPret(p);
          const [{ data: c }, { data: rs }] = await Promise.all([
            sb.from("clients").select("*").eq("id", p.client_id).maybeSingle(),
            sb.from("remboursements").select("*").eq("pret_id", pretId).order("date_remb", { ascending: true }),
          ]);
          setClient(c);
          setRembs(rs ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [pretId]);

  // Auto-impression une fois les données prêtes
  useEffect(() => {
    if (pret && client) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [pret, client]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-400">Chargement de la facture…</div>;
  }

  if (!pret || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        Facture introuvable — ID : {pretId}
      </div>
    );
  }

  const reste = pret.reste_a_payer ?? 0;
  const totalRemb = pret.total_rembourse ?? (pret.montant - reste);
  const ent = {
    nom: config?.nom ?? ENTREPRISE.nom,
    adresse: config?.adresse ?? ENTREPRISE.adresse,
    tel: config?.telephone ?? ENTREPRISE.tel,
    email: config?.email ?? ENTREPRISE.email,
    web: config?.web ?? ENTREPRISE.web,
    capital: config?.capital ?? ENTREPRISE.capital,
    mention: config?.mention_bas_facture ?? "Merci de votre confiance.",
    conditions: config?.conditions_paiement ?? "A réception",
    mode: config?.mode_paiement_defaut ?? "Versement",
  };

  return (
    <div className="min-h-screen bg-white p-6 font-sans text-[14px] text-black">
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

      <div className="mx-auto max-w-[148mm] border border-gray-200 bg-white p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-full">

        <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-4">
          <div>
            <div className="inline-block rounded-lg border-2 border-clay px-3 py-1 text-[11px] font-bold text-clay">OM</div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold text-clay">Facture {pret.id}</div>
            <div className="text-[12px] text-gray-500 mt-0.5">
              <div>Date facturation : {formatDate(pret.date_octroi)}</div>
              <div>Date échéance : {formatDate(pret.echeance)}</div>
              <div>Code client : {client.id}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Émetteur</div>
            <div className="font-bold text-[13px]">{ent.nom}</div>
            <div className="text-[11px] text-gray-600">{ent.adresse}</div>
            <div className="text-[11px] text-gray-600">Tél. : {ent.tel}</div>
            <div className="text-[11px] text-gray-600">Email : {ent.email}</div>
            <div className="text-[11px] text-gray-600">Web : {ent.web}</div>
          </div>
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Adressé à</div>
            <div className="font-bold text-[13px]">{client.nom}</div>
            <div className="text-[11px] text-gray-600">{client.ville}</div>
            {client.telephone && <div className="text-[11px] text-gray-600">Tél. : {client.telephone}</div>}
            {client.cnib && <div className="text-[11px] text-gray-600">CNIB : {client.cnib}</div>}
          </div>
        </div>

        <div className="border border-gray-300 rounded px-3 py-1.5 mb-4 text-[11px] font-semibold uppercase tracking-wide">
          TYPE OPÉRATION : {pret.type_operation}
        </div>

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
              <td className="py-2">{pret.type_operation}</td>
              <td className="py-2 text-right font-mono">{formatXOF(pret.montant)}</td>
              <td className="py-2 text-right">1</td>
              <td className="py-2 text-right font-mono font-semibold">{formatXOF(pret.montant)}</td>
            </tr>
          </tbody>
        </table>

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
                  <td className="py-1">{formatDate(r.date_remb)}</td>
                  <td className="py-1">{r.mode}</td>
                  <td className="py-1 text-right font-mono text-green-700">+{formatXOF(r.montant)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="border-t border-gray-300 pt-3 mb-4">
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-gray-500">Conditions de règlement :</span><span>{ent.conditions}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-gray-500">Mode de règlement :</span><span>{ent.mode}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-1 font-semibold">
            <span>Total :</span><span className="font-mono">{formatXOF(pret.montant)}</span>
          </div>
          {totalRemb > 0 && (
            <>
              <div className="flex justify-between text-[12px] mb-1 text-green-700">
                <span>Total remboursé :</span><span className="font-mono">−{formatXOF(totalRemb)}</span>
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

        <div className="text-center text-[10px] text-gray-400 mb-3">Montants exprimés en Francs CFA BCEAO</div>

        <div className="border-t border-gray-200 pt-3 text-center">
          <div className="text-[10px] text-gray-500">{ent.mention}</div>
          <div className="text-[9px] text-gray-400 mt-1">
            Capital de {(ent.capital).toLocaleString("fr-FR")} XOF — {ent.nom} — {ent.tel}
          </div>
        </div>
      </div>
    </div>
  );
}
