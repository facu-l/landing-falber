"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useActionState, useRef, useState } from "react";
import { createOrder } from "@/app/(store)/checkout/actions";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { serializeCart } from "@/lib/cart/cart";
import { clearCart, useCart } from "@/lib/cart/cart-store";
import { type ResolvedCart, resolveCart, type VariantIndex } from "@/lib/cart/resolve";
import { type CheckoutState, INITIAL_CHECKOUT_STATE } from "@/lib/checkout/state";
import { cn } from "@/lib/cn";
import { useFocusFirstInvalid } from "@/lib/forms/focus-first-invalid";
import { LIMITS } from "@/lib/forms/limits";
import { formatARS } from "@/lib/format";
import { type ShippingRates, shippingEstimateLines } from "@/lib/shipping/rates";
import { useIsClient } from "@/lib/use-is-client";
import { CartSkeleton, EmptyCart } from "./CartView";
import { FormSection } from "@/components/ui/FormSection";
import { TurnstileField } from "./TurnstileField";

type DeliveryMethod = "pickup" | "delivery";
type PaymentMethod = "transfer" | "cash";

/**
 * Checkout: datos, entrega, pago y aclaración (sección 6 del documento maestro).
 * - request_id: un UUID por carga de la página. Un reintento manda el mismo, y
 *   create_order devuelve el pedido existente en vez de duplicarlo.
 * - El botón se deshabilita mientras la acción corre (doble click).
 * - Al terminar se vacía el carrito y se navega a /pedido/[id].
 * - shippingEstimates: los envíos estimados de /admin/envios. Sin ellos (no se pudieron
 *   leer) queda el texto de siempre: son informativos y no bloquean la compra.
 */
export function CheckoutForm({
  index,
  shippingEstimates = null,
}: {
  index: VariantIndex;
  shippingEstimates?: ShippingRates | null;
}) {
  const cart = useCart();
  const isClient = useIsClient();
  const router = useRouter();

  const [requestId] = useState(() => crypto.randomUUID());
  const [serverErrors, setServerErrors] = useState(0);
  const [delivery, setDelivery] = useState<DeliveryMethod>("pickup");
  const [payment, setPayment] = useState<PaymentMethod>("transfer");

  const [state, formAction, pending] = useActionState(async (prev: CheckoutState, formData: FormData) => {
    const next = await createOrder(prev, formData);
    if (next.status === "success") {
      clearCart();
      router.replace(`/pedido/${next.orderId}`);
    } else if (next.status === "error") {
      // El token ya se usó (o era inválido): Turnstile tiene que dar uno nuevo.
      setServerErrors((key) => key + 1);
    }
    return next;
  }, INITIAL_CHECKOUT_STATE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state.status === "error" ? state.fieldErrors : undefined);

  if (state.status === "success") {
    return <p className="text-body text-text-secondary">Pedido registrado. Abriendo el detalle de tu compra.</p>;
  }
  if (!isClient) return <CartSkeleton />;
  if (cart.length === 0) return <EmptyCart />;

  const resolved = resolveCart(cart, index);
  if (!resolved.canCheckout) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="text-body text-text-secondary">
          Hay productos de tu carrito sin stock o que ya no están disponibles.
        </p>
        <Link href="/carrito" className={buttonClasses("secondary")}>
          Revisar el carrito
        </Link>
      </div>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? state.values : {};
  const problemVariantId = state.status === "error" ? state.variantId : null;

  function chooseDelivery(method: DeliveryMethod) {
    setDelivery(method);
    if (method === "delivery") setPayment("transfer");
  }

  return (
    <div className="grid gap-12 md:grid-cols-[1fr_22rem] md:gap-16">
      <form ref={form} action={formAction} noValidate className="flex flex-col gap-10">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="items" value={serializeCart(cart)} />

        <FormSection title="Tus datos">
          <Input
            label="Nombre y apellido"
            name="fullName"
            autoComplete="name"
            maxLength={LIMITS.fullName}
            defaultValue={values.fullName}
            error={errors.fullName}
          />
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint="Con código de área. Ej.: 221 555 1234"
            defaultValue={values.whatsapp}
            error={errors.whatsapp}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            hint="Opcional."
            defaultValue={values.email}
            error={errors.email}
          />
        </FormSection>

        <FormSection title="Entrega">
          {/*
            key: después de la acción React resetea el <form> y cada radio vuelve a su
            defaultChecked, que React marca solo al montarlo. key = cantidad de errores:
            cada respuesta remonta el grupo con la elección actual (aunque haya cambiado
            mientras se enviaba); sin eso el DOM volvería a "Retiro" con el estado en "Envío".
          */}
          <RadioGroup
            key={serverErrors}
            legend="Cómo querés recibir tu pedido"
            error={errors.deliveryMethod}
          >
            <RadioOption
              name="deliveryMethod"
              value="pickup"
              checked={delivery === "pickup"}
              onChange={() => chooseDelivery("pickup")}
              label="Retiro en La Plata"
              detail="Coordinamos día y horario por WhatsApp."
            />
            <RadioOption
              name="deliveryMethod"
              value="delivery"
              checked={delivery === "delivery"}
              onChange={() => chooseDelivery("delivery")}
              label="Envío a domicilio"
              detail={<DeliveryDetail estimates={shippingEstimates} />}
            />
          </RadioGroup>
          {delivery === "delivery" && (
            <div className="grid gap-6 md:grid-cols-2">
              <Input
                label="Dirección"
                name="address"
                autoComplete="street-address"
                maxLength={LIMITS.address}
                defaultValue={values.address}
                error={errors.address}
                className="md:col-span-2"
              />
              <Input
                label="Ciudad"
                name="city"
                autoComplete="address-level2"
                maxLength={LIMITS.city}
                defaultValue={values.city}
                error={errors.city}
              />
              <Input
                label="Código postal"
                name="postalCode"
                autoComplete="postal-code"
                maxLength={LIMITS.postalCode}
                hint="Opcional."
                defaultValue={values.postalCode}
                error={errors.postalCode}
              />
              <Input
                label="Referencia"
                name="reference"
                maxLength={LIMITS.reference}
                hint="Opcional. Ej.: timbre, entre calles."
                defaultValue={values.reference}
                error={errors.reference}
                className="md:col-span-2"
              />
            </div>
          )}
        </FormSection>

        <FormSection title="Pago">
          <RadioGroup key={serverErrors} legend="Cómo vas a pagar" error={errors.paymentMethod}>
            <RadioOption
              name="paymentMethod"
              value="transfer"
              checked={payment === "transfer"}
              onChange={() => setPayment("transfer")}
              label="Transferencia"
              detail="Te pasamos los datos por WhatsApp."
            />
            <RadioOption
              name="paymentMethod"
              value="cash"
              checked={payment === "cash"}
              onChange={() => setPayment("cash")}
              disabled={delivery === "delivery"}
              label="Efectivo"
              detail="Solo con retiro en La Plata."
            />
          </RadioGroup>
        </FormSection>

        <Input
          label="Aclaración"
          name="note"
          maxLength={LIMITS.note}
          hint={`Opcional. Hasta ${LIMITS.note} caracteres.`}
          defaultValue={values.note}
          error={errors.note}
        />

        <div className="flex flex-col items-start gap-4 border-t border-border pt-8">
          <p className="text-caption text-text-muted">
            Usamos tus datos solo para gestionar este pedido y contactarte por WhatsApp (Ley 25.326).
          </p>
          {state.status === "error" && state.message && (
            <p role="alert" className="text-body-sm text-error">
              {state.message}
            </p>
          )}
          <TurnstileField resetKey={serverErrors} />
          <Button type="submit" disabled={pending} className="w-full md:w-auto">
            {pending ? "Enviando pedido" : "Realizar compra"}
          </Button>
        </div>
      </form>

      <OrderSummary resolved={resolved} problemVariantId={problemVariantId} />
    </div>
  );
}

function RadioGroup({ legend, error, children }: { legend: string; error?: string; children: ReactNode }) {
  return (
    <fieldset aria-invalid={error ? true : undefined} className="flex flex-col border-t border-border">
      <legend className="sr-only">{legend}</legend>
      {children}
      {error && <p className="pt-3 text-body-sm text-error">{error}</p>}
    </fieldset>
  );
}

type RadioOptionProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail: ReactNode;
  disabled?: boolean;
};

function RadioOption({ name, value, checked, onChange, label, detail, disabled = false }: RadioOptionProps) {
  return (
    <label
      className={cn(
        "flex flex-col gap-1 border-b border-border border-l-2 border-l-transparent py-4 pr-2 pl-4",
        "transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-accent",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-surface-raised has-checked:border-l-accent has-checked:bg-surface-raised",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span className="text-body text-text">{label}</span>
      <span className="text-body-sm text-text-secondary">{detail}</span>
    </label>
  );
}

function DeliveryDetail({ estimates }: { estimates: ShippingRates | null }) {
  if (!estimates) return "El costo del envío se coordina por WhatsApp.";
  return (
    <>
      {shippingEstimateLines(estimates).map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
      <span className="block">El costo final se coordina por WhatsApp.</span>
    </>
  );
}

function OrderSummary({ resolved, problemVariantId }: { resolved: ResolvedCart; problemVariantId?: string | null }) {
  return (
    <aside aria-label="Tu pedido" className="flex flex-col gap-4 md:sticky md:top-28 md:self-start">
      <h2 className="text-label text-text-secondary uppercase">Tu pedido</h2>
      <ul className="flex flex-col border-t border-border">
        {resolved.items.map((item) => (
          <li key={item.variantId} className="flex flex-col gap-1 border-b border-border py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-body-sm text-text">
                {item.quantity} × {item.productName} — {item.label}
              </span>
              <span className="text-body-sm text-text tabular-nums">{formatARS(item.lineTotal)}</span>
            </div>
            {item.variantId === problemVariantId && (
              <span className="text-caption text-error">Sin stock suficiente</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-label text-text-secondary uppercase">Total estimado</span>
        <span className="text-h2 text-text tabular-nums">{formatARS(resolved.total)}</span>
      </div>
      <p className="text-caption text-text-muted">El envío, si corresponde, se coordina por WhatsApp.</p>
      <Link href="/carrito" className="self-start text-caption text-text-secondary uppercase underline underline-offset-4">
        Editar carrito
      </Link>
    </aside>
  );
}
