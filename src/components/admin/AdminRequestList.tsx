import { sortRequestsForAdmin } from "@/lib/admin/request-list";
import { type AdminRequestListItem, CLOSED_REQUESTS_LIMIT } from "@/lib/admin/requests";
import { formatDateTime } from "@/lib/format";
import { buildRequestReplyMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { RequestStatusForm } from "./RequestStatusForm";

type Props = { requests: AdminRequestListItem[]; closedTruncated?: boolean };

const linkClasses =
  "inline-flex min-h-11 items-center text-label text-text-secondary uppercase underline-offset-8 hover:text-text hover:underline";

/**
 * Lista de encargos del admin. Sin página de detalle: un encargo entra entero en su
 * fila, con el link para escribirle al cliente y el cambio de estado.
 */
export function AdminRequestList({ requests, closedTruncated = false }: Props) {
  if (requests.length === 0) return <p className="text-body text-text-secondary">Todavía no hay encargos.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col border-t border-border">
        {sortRequestsForAdmin(requests).map((request) => {
          const details = [request.brand, request.presentation].filter(Boolean).join(" · ");
          const replyUrl = buildWhatsAppUrl(
            request.customers.whatsapp,
            buildRequestReplyMessage({ customerName: request.customer_name, perfumeName: request.perfume_name }),
          );

          return (
            <li
              key={request.id}
              className="flex flex-col gap-4 border-b border-border py-6 md:flex-row md:items-start md:justify-between md:gap-8"
            >
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-h3 text-text">{request.perfume_name}</h2>
                  <RequestStatusBadge status={request.status} />
                </div>
                {details && <p className="text-body text-text-secondary">{details}</p>}
                {request.note && <p className="text-body-sm text-text-secondary">Nota: {request.note}</p>}
                <p className="text-body-sm text-text-muted">
                  {request.customer_name} · {request.customers.whatsapp} · {formatDateTime(request.created_at)}
                </p>
                <a href={replyUrl} target="_blank" rel="noopener noreferrer" className={`${linkClasses} self-start`}>
                  Escribirle por WhatsApp
                </a>
              </div>
              <RequestStatusForm request={request} />
            </li>
          );
        })}
      </ul>
      {closedTruncated && (
        <p className="text-body-sm text-text-muted">
          Se muestran los últimos {CLOSED_REQUESTS_LIMIT} encargos completados o cancelados.
        </p>
      )}
    </div>
  );
}
