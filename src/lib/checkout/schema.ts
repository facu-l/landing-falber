import { z } from "zod";
import { MAX_LINES, MAX_QUANTITY } from "@/lib/cart/cart";
import { fullNameField, optionalText as text, whatsappField } from "@/lib/forms/fields";

/*
 * Validación del checkout. Corre en la Server Action (la frontera de confianza):
 * el formulario manda todo como texto y acá sale normalizado para create_order.
 *
 * Repite las reglas de create_order solo para dar errores por campo y en castellano;
 * la base las vuelve a validar. Los largos de dirección, ciudad, código postal y
 * referencia existen solo acá: la base no los limita.
 */

const item = z.object({
  variantId: z.uuid(),
  quantity: z.int().min(1).max(MAX_QUANTITY),
});

const CART_ERROR = "Hay un problema con tu carrito. Volvé al carrito y revisalo.";

const items = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: CART_ERROR });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(item, { error: CART_ERROR })
      .min(1, "Tu carrito está vacío.")
      .max(MAX_LINES, `Podés comprar hasta ${MAX_LINES} productos distintos por pedido.`)
      .refine((lines) => new Set(lines.map((l) => l.variantId)).size === lines.length, CART_ERROR),
  );

const checkoutSchema = z
  .object({
    requestId: z.uuid({ error: "Hubo un problema con tu pedido. Recargá la página y probá de nuevo." }),
    fullName: fullNameField,
    whatsapp: whatsappField,
    email: z
      .string()
      .trim()
      .refine((value) => value === "" || z.email().safeParse(value).success, "Revisá tu email.")
      .transform((value) => value || null),
    deliveryMethod: z.enum(["pickup", "delivery"], { error: "Elegí cómo querés recibir tu pedido." }),
    paymentMethod: z.enum(["transfer", "cash"], { error: "Elegí cómo vas a pagar." }),
    address: text(120, "La dirección puede tener hasta 120 caracteres."),
    city: text(60, "La ciudad puede tener hasta 60 caracteres."),
    postalCode: text(10, "El código postal puede tener hasta 10 caracteres."),
    reference: text(120, "La referencia puede tener hasta 120 caracteres."),
    note: text(100, "La aclaración puede tener hasta 100 caracteres."),
    items,
  })
  // Con retiro, la dirección no se guarda aunque haya quedado escrita en el formulario.
  .transform((order) =>
    order.deliveryMethod === "pickup"
      ? { ...order, address: null, city: null, postalCode: null, reference: null }
      : order,
  );

export type CheckoutData = z.output<typeof checkoutSchema>;
export type CheckoutField = keyof z.input<typeof checkoutSchema>;
export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

export type CheckoutParseResult =
  | { success: true; data: CheckoutData }
  | { success: false; fieldErrors: CheckoutFieldErrors };

// Campos opcionales: un input que no se renderiza (ej. la dirección con retiro) no llega en el FormData.
const OPTIONAL_FIELDS = { email: "", address: "", city: "", postalCode: "", reference: "", note: "" };

export function parseCheckout(rawInput: Record<string, unknown>): CheckoutParseResult {
  const input = { ...OPTIONAL_FIELDS, ...rawInput };
  const result = checkoutSchema.safeParse(input);
  const fieldErrors = crossFieldErrors(input);

  if (result.success && Object.keys(fieldErrors).length === 0) return { success: true, data: result.data };

  // Un mensaje por campo (el primero): el formulario muestra uno debajo de cada input.
  for (const issue of result.error?.issues ?? []) {
    const field = issue.path[0] as CheckoutField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { success: false, fieldErrors };
}

/*
 * Reglas que dependen de más de un campo. Van aparte porque zod 4 no corre un
 * refine del objeto si otro campo ya falló: el cliente arreglaría el WhatsApp y
 * recién después vería "Escribí la dirección". Así ve todos los errores juntos.
 */
function crossFieldErrors(input: Record<string, unknown>): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const filled = (value: unknown) => typeof value === "string" && value.trim() !== "";

  if (input.paymentMethod === "cash" && input.deliveryMethod === "delivery") {
    errors.paymentMethod = "El pago en efectivo es solo para retiro en La Plata.";
  }
  if (input.deliveryMethod === "delivery") {
    if (!filled(input.address)) errors.address = "Escribí la dirección de entrega.";
    if (!filled(input.city)) errors.city = "Escribí la ciudad.";
  }
  return errors;
}
