"use server";

import { z } from "zod";
import { formValues, TURNSTILE_FIELD } from "@/lib/forms/form-data";
import { loggableDbError } from "@/lib/db-errors";
import { GENERIC_REQUEST_ERROR, requestError } from "@/lib/requests/errors";
import { parseRequest, type RequestData } from "@/lib/requests/schema";
import type { RequestState } from "@/lib/requests/state";
import { verifyHumanRequest } from "@/lib/security/verify-request";
import { createServiceClient } from "@/lib/supabase/service";

const TURNSTILE_FAILED =
  "No pudimos verificar tu navegador. Esperá unos segundos y volvé a tocar Enviar encargo.";

// create_perfume_request devuelve el id del encargo.
const createdRequest = z.uuid();

/**
 * Registra un encargo. Mismo orden que createOrder (decisión 35):
 * 1. zod: valida y normaliza (sin red; no gasta el token de Turnstile en un error de tipeo)
 * 2. Turnstile con la IP real y la IP hasheada
 * 3. create_perfume_request con service_role
 *
 * Sin updateTag: un encargo no cambia stock ni productos.
 */
export async function createPerfumeRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const values = formValues(formData, [TURNSTILE_FIELD]);

  const parsed = parseRequest(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const human = await verifyHumanRequest(formData, "encargo");
  if (!human.ok) return { status: "error", message: TURNSTILE_FAILED, values };

  try {
    const { data, error } = await createServiceClient().rpc(
      "create_perfume_request",
      toCreateRequestArgs(parsed.data, human.clientKey),
    );

    if (error) {
      const mapped = requestError(error);
      if (!mapped.known) console.error("[encargos] create_perfume_request falló", loggableDbError(error));
      return { status: "error", message: mapped.message, values };
    }

    if (!createdRequest.safeParse(data).success) {
      console.error("[encargos] create_perfume_request devolvió algo inesperado", data);
      return { status: "error", message: GENERIC_REQUEST_ERROR, values };
    }

    return { status: "success", perfumeName: parsed.data.perfumeName };
  } catch (error) {
    console.error("[encargos] no se pudo llamar a create_perfume_request", error);
    return { status: "error", message: GENERIC_REQUEST_ERROR, values };
  }
}

/*
 * Los tipos generados declaran los argumentos de texto como string (no null): se manda ""
 * y la base lo convierte en null. p_variant_id es opcional: sin él, la base usa null.
 */
function toCreateRequestArgs(request: RequestData, clientKey: string) {
  return {
    p_client_key: clientKey,
    p_full_name: request.fullName,
    p_whatsapp: request.whatsapp,
    p_perfume_name: request.perfumeName,
    p_brand: request.brand ?? "",
    p_presentation: request.presentation ?? "",
    p_note: request.note ?? "",
    ...(request.variantId && { p_variant_id: request.variantId }),
  };
}
