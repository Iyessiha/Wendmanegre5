"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  mobileHide?: boolean;      // masquer sur mobile
  mobilePrimary?: boolean;   // afficher en titre de carte
  mobileSecondary?: boolean; // afficher en sous-titre de carte
  align?: "left" | "right" | "center";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  mobileCard?: (row: T) => ReactNode;  // override complet sur mobile
}

export function DataTable<T>({
  columns, data, rowKey, onRowClick,
  emptyMessage = "Aucun résultat.",
  loading = false,
  mobileCard,
}: DataTableProps<T>) {
  if (loading) return (
    <div className="py-10 text-center text-sm text-ink-400">Chargement...</div>
  );

  if (data.length === 0) return (
    <div className="py-10 text-center text-sm text-ink-400">{emptyMessage}</div>
  );

  return (
    <>
      {/* ── Desktop : table classique ── */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand-200 text-left text-[12px] uppercase tracking-wide text-ink-400">
              {columns.map(col => (
                <th key={col.key}
                  className={`px-5 py-3 font-medium ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.className ?? ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-sand-100 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-sand-100/60" : "hover:bg-sand-100/40"}`}>
                {columns.map(col => (
                  <td key={col.key}
                    className={`px-5 py-3.5 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile : cartes ── */}
      <div className="lg:hidden divide-y divide-sand-100">
        {data.map(row => (
          <div key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={`px-4 py-3.5 ${onRowClick ? "cursor-pointer active:bg-sand-100" : ""}`}>
            {mobileCard ? mobileCard(row) : <DefaultMobileCard row={row} columns={columns} />}
          </div>
        ))}
      </div>
    </>
  );
}

function DefaultMobileCard<T>({ row, columns }: { row: T; columns: Column<T>[] }) {
  const primary   = columns.find(c => c.mobilePrimary);
  const secondary = columns.find(c => c.mobileSecondary);
  const rest      = columns.filter(c => !c.mobilePrimary && !c.mobileSecondary && !c.mobileHide);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {primary && <div className="font-medium text-ink truncate">{primary.render(row)}</div>}
          {secondary && <div className="text-[12px] text-ink-400 mt-0.5">{secondary.render(row)}</div>}
        </div>
        {rest[0] && (
          <div className={`flex-shrink-0 ${rest[0].align === "right" ? "text-right" : ""}`}>
            {rest[0].render(row)}
          </div>
        )}
      </div>
      {rest.slice(1).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {rest.slice(1).map(col => (
            <div key={col.key} className="text-[12px] text-ink-500">
              <span className="text-ink-400">{col.label}: </span>{col.render(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
