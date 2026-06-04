"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getFacture, type Facture } from "@/lib/hooks-factures";
import { getClient } from "@/lib/supabase";
import { ENTREPRISE } from "@/lib/data";
import { formatXOF, formatDate } from "@/lib/format";

export default function ReceiptFacturePage() {
  const { id } = useParams<{ id: string }>();
  const facId = decodeURIComponent(id);

  const [fac, setFac] = useState<Facture | null>(null);
  const [client, setClient] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sb = getClient() as any;
        sb.from("config_entreprise").select("*").eq("cle", "principal").maybeSingle()
          .then(({ data }: any) => { if (data) setConfig(data); });
        const f = await getFacture(facId);
        if (f) {
          setFac(f);
          const { data: c } = await sb.from("clients").select("*").eq("id", f.client_id).maybeSingle();
          setClient(c);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [facId]);

  useEffect(() => {
    if (fac && client) { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t); }
  }, [fac, client]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-ink-400">Chargement…</div>;
  if (!fac || !client) return <div className="flex min-h-screen items-center justify-center text-ink-400">Document introuvable — {facId}</div>;

  const titre = fac.type === "commande" ? "Commande" : "Facture";
  const ent = {
    nom: config?.nom ?? ENTREPRISE.nom,
    adresse: config?.adresse ?? ENTREPRISE.adresse,
    tel: config?.telephone ?? ENTREPRISE.tel,
    email: config?.email ?? ENTREPRISE.email,
    web: config?.web ?? ENTREPRISE.web,
    capital: config?.capital ?? ENTREPRISE.capital,
    mention: config?.mention_bas_facture ?? "Merci de votre confiance.",
    conditions: config?.conditions_paiement ?? "A réception",
  };

  return (
    <div className="min-h-screen bg-white p-6 font-sans text-[14px] text-black">
      <div className="no-print mb-6 flex items-center gap-3">
        <button onClick={() => window.print()} className="rounded-xl bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-600">🖨️ Imprimer / PDF</button>
        <button onClick={() => window.close()} className="rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-sand-100">Fermer</button>
      </div>

      <div className="mx-auto max-w-[148mm] border border-gray-200 bg-white p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-full">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-4">
          <div className="inline-block rounded-lg border-2 border-clay px-3 py-1 text-[11px] font-bold text-clay">OM</div>
          <div className="text-right">
            <div className="text-[20px] font-bold text-clay">{titre} {fac.id}</div>
            <div className="text-[12px] text-gray-500 mt-0.5">
              <div>Date : {formatDate(fac.date_facture)}</div>
              {fac.echeance && <div>Échéance : {formatDate(fac.echeance)}</div>}
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
          </div>
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Adressé à</div>
            <div className="font-bold text-[13px]">{client.nom}</div>
            <div className="text-[11px] text-gray-600">{client.ville}</div>
            {client.telephone && <div className="text-[11px] text-gray-600">Tél. : {client.telephone}</div>}
          </div>
        </div>

        <table className="w-full text-[12px] border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="py-2 text-left font-semibold text-gray-600">Désignation</th>
              <th className="py-2 text-right font-semibold text-gray-600">P.U.</th>
              <th className="py-2 text-right font-semibold text-gray-600">Qté</th>
              <th className="py-2 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {(fac.lignes ?? []).map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">{l.designation}</td>
                <td className="py-2 text-right font-mono">{formatXOF(l.prix_unitaire)}</td>
                <td className="py-2 text-right">{l.quantite}</td>
                <td className="py-2 text-right font-mono font-semibold">{formatXOF(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-gray-300 pt-3 mb-4">
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-gray-500">Conditions de règlement :</span><span>{ent.conditions}</span>
          </div>
          <div className="flex justify-between text-[14px] font-bold border-t border-gray-200 pt-2 mt-2">
            <span>Total {titre.toLowerCase()} :</span>
            <span className="font-mono">{formatXOF(fac.montant_total)}</span>
          </div>
        </div>

        {fac.type === "facture" && (fac.paiements?.length ?? 0) > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Encaissements</div>
            <table className="w-full text-[12px] border-collapse mb-2">
              <tbody>
                {(fac.paiements ?? []).map((p, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5">{formatDate(p.date_paiement)}</td>
                    <td className="py-1.5 text-gray-500">{p.mode}</td>
                    <td className="py-1.5 text-right font-mono">{formatXOF(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-500">Total payé :</span><span className="font-mono">{formatXOF(fac.total_paye ?? 0)}</span>
            </div>
            <div className="flex justify-between text-[13px] font-bold border-t border-gray-200 pt-1 mt-1">
              <span>Reste à payer :</span><span className="font-mono">{formatXOF(fac.reste_a_payer ?? 0)}</span>
            </div>
          </div>
        )}

        {fac.notes && <div className="text-[11px] text-gray-500 mb-3">Note : {fac.notes}</div>}
        <div className="text-center text-[10px] text-gray-400 mb-3">Montants exprimés en Francs CFA BCEAO</div>
        <div className="border-t border-gray-200 pt-3 text-center">
          <div className="text-[10px] text-gray-500">{ent.mention}</div>
          <div className="text-[9px] text-gray-400 mt-1">Capital de {(ent.capital).toLocaleString("fr-FR")} XOF — {ent.nom} — {ent.tel}</div>
        </div>
      </div>
    </div>
  );
}
