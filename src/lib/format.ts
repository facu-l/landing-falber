const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** 14500 → "$ 14.500" (con espacio duro). En la tienda los precios van sin centavos. */
export function formatARS(amount: number): string {
  return ars.format(amount);
}
