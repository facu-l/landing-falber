"use client";

import { useActionState, useRef, useState } from "react";
import { moveStock } from "@/app/admin/(panel)/productos/[id]/variant-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  INITIAL_STOCK_MOVE_STATE,
  MOVE_CHOICES,
  type MoveChoice,
  parseWholeUnits,
  STOCK_MOVE_ERRORS,
  STOCK_QUANTITY_MAX,
  type StockMoveState,
  stockAfter,
} from "@/lib/admin/stock-movements";
import { useFocusFirstInvalid } from "@/lib/forms/focus-first-invalid";
import { LIMITS } from "@/lib/forms/limits";

type Props = {
  variant: { id: string; stock: number };
  onClose: () => void;
};

const isChoice = (value: string): value is MoveChoice => Object.hasOwn(MOVE_CHOICES, value);

/**
 * Mover stock de una presentación (D11). Muestra "Queda en N u." mientras se escribe y
 * avisa antes de enviar si no alcanza. La base decide igual: el stock pudo cambiar.
 */
export function StockMoveForm({ variant, onClose }: Props) {
  const [state, formAction, pending] = useActionState(moveStock.bind(null, variant.id), INITIAL_STOCK_MOVE_STATE);

  // Lo elegido y lo escrito, para la cuenta en vivo. Con cada respuesta: lo escrito si hubo
  // error, vacío si salió bien (como ProductDataForm, en el render que trae el estado nuevo).
  const [choice, setChoice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lastState, setLastState] = useState<StockMoveState>(state);
  const [responses, setResponses] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setResponses(responses + 1);
    setChoice(state.status === "error" ? (state.values.choice ?? "") : "");
    setQuantity(state.status === "error" ? (state.values.quantity ?? "") : "");
  }

  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  useFocusFirstInvalid(formRef, fieldErrors);

  const parsed = parseWholeUnits(quantity, STOCK_QUANTITY_MAX);
  const after = isChoice(choice) && parsed.success && parsed.value ? stockAfter(variant.stock, choice, parsed.value) : null;
  const note = state.status === "error" ? state.values.note : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-6 border-l-2 border-accent pl-4">
      <div className="grid gap-6 md:grid-cols-2">
        <Select
          key={`choice-${responses}`}
          label="Qué pasó"
          name="choice"
          defaultValue={choice}
          onChange={(event) => setChoice(event.target.value)}
          error={fieldErrors?.choice}
        >
          <option value="">Elegí una opción</option>
          {Object.entries(MOVE_CHOICES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          key={`quantity-${responses}`}
          label="Cantidad"
          name="quantity"
          inputMode="numeric"
          autoComplete="off"
          hint="Unidades, sin signo: la opción dice si suma o resta."
          defaultValue={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={fieldErrors?.quantity}
        />
      </div>
      {/* Región viva: el lector de pantalla anuncia la cuenta al cambiar. */}
      <p aria-live="polite" className="text-body-sm tabular-nums">
        {after === null ? null : after < 0 ? (
          <span className="text-error">{STOCK_MOVE_ERRORS.notEnoughStock}</span>
        ) : (
          <span className="text-text-secondary">Queda en {after} u.</span>
        )}
      </p>
      <Input
        key={`note-${responses}`}
        label="Nota"
        name="note"
        autoComplete="off"
        maxLength={LIMITS.stockNote}
        hint="Opcional. Ej.: llegó la caja del proveedor."
        defaultValue={note}
        error={fieldErrors?.note}
      />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Moviendo" : "Mover stock"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {state.status === "success" ? "Cerrar" : "Cancelar"}
        </Button>
        {state.status === "success" && (
          <p role="status" className="text-body-sm text-text-secondary">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
