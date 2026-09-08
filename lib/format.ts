export function formatearPesos(monto: number | string): string {
  const numero = typeof monto === "string" ? parseFloat(monto) : monto;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(numero || 0);
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Interpreta una fecha de culto de forma robusta:
 * - "2026-10-04" o "2026-10-04T00:00:00(...)" (sin hora real) → día local al mediodía,
 *   para que no se corra al día anterior por la zona horaria.
 * - Cualquier otro timestamp → se convierte a la zona local del navegador/usuario.
 */
export function parseFechaCulto(raw?: string | null): Date {
  if (!raw) return new Date(NaN);
  const midnight = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]00:00:00/);
  if (midnight) return new Date(Number(midnight[1]), Number(midnight[2]) - 1, Number(midnight[3]), 12);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
  return new Date(raw.includes(" ") ? raw.replace(" ", "T") : raw);
}

/** Fecha larga en español, capitalizada: "Sábado 10 de octubre". */
export function formatearFechaCulto(raw?: string | null): string {
  const d = parseFechaCulto(raw);
  if (isNaN(d.getTime())) return "Fecha por confirmar";
  const s = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fecha corta "10 oct" (o "por confirmar"). */
export function formatearFechaCorta(raw?: string | null): string {
  const d = parseFechaCulto(raw);
  if (isNaN(d.getTime())) return "por confirmar";
  return d
    .toLocaleDateString("es-CL", { day: "numeric", month: "short" })
    .replace(".", "");
}

/** Hora "20:00 hrs" si el culto tiene hora real; vacío si es solo fecha. */
export function horaCulto(raw?: string | null): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{4}-\d{2}-\d{2}[T\s]00:00:00/.test(raw)) return "";
  const d = parseFechaCulto(raw);
  if (isNaN(d.getTime())) return "";
  if (d.getHours() === 0 && d.getMinutes() === 0) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} hrs`;
}

/** Fecha y hora juntas, listas para mostrar. */
export function fechaHoraCulto(raw?: string | null): { fecha: string; hora: string } {
  return { fecha: formatearFechaCulto(raw), hora: horaCulto(raw) };
}