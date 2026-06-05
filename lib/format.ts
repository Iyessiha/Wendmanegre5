import type { Pret, Remboursement, StatutPret } from "./types";

export function formatXOF(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " FCFA";
}

export function formatXOFCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + " M FCFA";
  if (n >= 1_000) return Math.round(n / 1_000) + " k FCFA";
  return Math.round(n) + " FCFA";
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });
}

export function formatDateLong(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" });
}

export function joursDeRetard(echeance: string): number {
  const today = new Date();
  const ech = new Date(echeance);
  const diff = Math.floor((today.getTime() - ech.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export function totalRembourse(pretId: string, remboursements: Remboursement[]): number {
  return remboursements.filter(r => r.pretId === pretId).reduce((s,r)=>s+r.montant,0);
}

export function resteAPayer(pret: Pret, remboursements: Remboursement[]): number {
  return Math.max(0, pret.montant - totalRembourse(pret.id, remboursements));
}

export function statutLabel(s: StatutPret): { label: string; cls: string } {
  switch (s) {
    case "rembourse": return { label:"Remboursé",    cls:"bg-leaf-100 text-leaf-600" };
    case "partiel":   return { label:"Partiel",      cls:"bg-gold-100 text-clay-700" };
    case "retard":    return { label:"En retard",    cls:"bg-ember-100 text-ember-600" };
    default:          return { label:"Impayé",       cls:"bg-sand-200 text-ink-700" };
  }
}

export function typeColor(t: string): string {
  switch (t) {
    case "ORANGE MONEY": return "#C75B2A";
    case "MOOV MONEY":   return "#2F6B4F";
    case "TELECEL":      return "#B23A2E";
    case "UNITES":       return "#C9962E";
    case "SIM":          return "#6B6157";
    default:             return "#8A8178";
  }
}

// Devise système
export const DEVISE = "FCFA";
export const DEVISE_CODE = "XOF";
