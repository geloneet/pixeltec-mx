export function reminderBody(
  note: string,
  cents: number,
  currency: string,
  period: string,
) {
  return (
    note +
    "\n\nSaldo del período: " +
    new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(
      cents / 100,
    ) +
    " " +
    currency +
    "\nVencimiento: " +
    period
  );
}
