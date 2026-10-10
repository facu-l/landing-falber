import { REQUEST_STATUS_LABELS, type RequestStatus } from "@/lib/admin/request-list";
import { StatusBadge, type StatusTone } from "./StatusBadge";

/* Pendiente pide acción (nadie le escribió todavía); en curso, borde; cerrado, apagado. */
const TONES: Record<RequestStatus, StatusTone> = {
  pending: "action",
  contacted: "active",
  quoted: "active",
  sourcing: "active",
  completed: "closed",
  cancelled: "closed",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <StatusBadge tone={TONES[status]}>{REQUEST_STATUS_LABELS[status]}</StatusBadge>;
}
