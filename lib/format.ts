export function formatearPesos(monto: number | string): string {
  const numero = typeof monto === "string" ? parseFloat(monto) : monto;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(numero || 0);
}