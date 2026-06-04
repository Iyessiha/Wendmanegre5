"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ENTREPRISE } from "@/lib/data";

// Données de démo — en production, fetch depuis Supabase par ID
const TX_DEMO = {
  id: "TX-DEMO",
  type: "RETRAIT",
  operateur: "ORANGE MONEY",
  montant: 50000,
  frais: 500,
  telephone_client: "+226 70 12 34 56",
  nom_client: "SAWADOGO Issa",
  reference: "OM2606-891234",
  date_transaction: new Date().toISOString().slice(0, 10),
  caisse: "Caisse guichet 1",
};

export default function ReceiptTxPage() {
  const { id } = useParams<{ id: string }>();
  const txId = decodeURIComponent(id);

  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  const tx = TX_DEMO; // TODO: fetch from Supabase with txId

  const typeLabel: Record<string, string> = {
    DEPOT: "Dépôt", RETRAIT: "Retrait", ENVOI: "Envoi", RECEPTION: "Réception",
    CREDIT: "Crédit", REMBOURSEMENT: "Remboursement",
  };
  const typeEmoji: Record<string, string> = {
    DEPOT: "⬇", RETRAIT: "⬆", ENVOI: "➡", RECEPTION: "⬅", CREDIT: "💳", REMBOURSEMENT: "✅",
  };

  const formatMontant = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " F";
  const formatDateFr = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      {/* Contrôles no-print */}
      <div className="no-print mb-4 flex gap-3 w-full max-w-sm">
        <button onClick={() => window.print()}
          className="flex-1 rounded-xl bg-clay px-4 py-2.5 text-sm font-medium text-white hover:bg-clay-600">
          🖨️ Imprimer le ticket
        </button>
        <button onClick={() => window.close()}
          className="rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-ink">
          Fermer
        </button>
      </div>

      {/* TICKET FORMAT 58MM */}
      <div className="bg-white shadow-lg" style={{ width: "58mm", fontFamily: '"IBM Plex Mono", monospace', fontSize: "10px", padding: "4mm" }}>

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "1px dashed #ccc", paddingBottom: "4px", marginBottom: "6px" }}>
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>{ENTREPRISE.nom}</div>
          <div>{ENTREPRISE.adresse}</div>
          <div>{ENTREPRISE.tel}</div>
        </div>

        {/* Type opération */}
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13px", margin: "6px 0" }}>
          {typeEmoji[tx.type]} {typeLabel[tx.type]} {tx.operateur}
        </div>

        {/* Lignes */}
        {[
          ["Date:", formatDateFr(tx.date_transaction)],
          ["Heure:", new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })],
          ["Réf:", tx.reference ?? txId.slice(-8).toUpperCase()],
          ["Caisse:", tx.caisse],
          ...(tx.nom_client ? [["Client:", tx.nom_client]] : []),
          ...(tx.telephone_client ? [["Tél:", tx.telephone_client]] : []),
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span style={{ color: "#666" }}>{k}</span>
            <span style={{ fontWeight: "500", maxWidth: "120px", textAlign: "right", wordBreak: "break-all" }}>{v}</span>
          </div>
        ))}

        {/* Montants */}
        <div style={{ borderTop: "1px solid #ccc", marginTop: "6px", paddingTop: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span>Montant:</span>
            <span style={{ fontWeight: "bold", fontSize: "12px" }}>{formatMontant(tx.montant)}</span>
          </div>
          {tx.frais > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", color: "#666" }}>
              <span>Frais agent:</span>
              <span>{formatMontant(tx.frais)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderTop: "1px dashed #ccc", paddingTop: "3px" }}>
            <span>NET CLIENT:</span>
            <span style={{ fontSize: "13px" }}>{formatMontant(tx.type === "RETRAIT" ? tx.montant - tx.frais : tx.montant)}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", borderTop: "1px dashed #ccc", marginTop: "6px", paddingTop: "6px", color: "#666" }}>
          <div>Merci pour votre confiance</div>
          <div style={{ fontSize: "9px", marginTop: "2px" }}>Transaction validée avec succès</div>
        </div>

        {/* Barcode placeholder */}
        <div style={{ textAlign: "center", marginTop: "4px", letterSpacing: "2px", fontSize: "8px", color: "#999" }}>
          ||||| {txId.slice(-10).toUpperCase()} |||||
        </div>
      </div>

      {/* Format A4 / A5 pour imprimante de bureau */}
      <div className="no-print mt-4 text-[12px] text-gray-500 text-center">
        Pour une imprimante de bureau, utilisez le reçu A5 depuis la fiche prêt.
      </div>
    </div>
  );
}
