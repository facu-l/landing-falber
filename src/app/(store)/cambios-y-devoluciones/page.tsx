import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cambios y devoluciones",
  description:
    "Política de cambios y devoluciones de FALBER: arrepentimiento en 10 días con el producto sin abrir, y cambio sin costo si llega defectuoso.",
};

/*
 * Política de cambios y devoluciones. La pide Google Merchant Center y tiene que
 * coincidir con lo cargado ahí: devoluciones de productos nuevos (sin abrir) en
 * 10 días, y cambios solo por defecto o error.
 *
 * Los 10 días corridos son el derecho de arrepentimiento de las ventas a distancia
 * (Ley 24.240, art. 34): no se pueden achicar. Los abiertos quedan afuera porque el
 * producto tiene que volver como se entregó.
 *
 * Página estática: sin datos de la base, entra entera en el shell prerenderizado.
 */
export default function ReturnsPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12 md:px-8 md:py-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-h1 text-text uppercase">Cambios y devoluciones</h1>
        <p className="text-body text-text-secondary">
          Un perfume abierto no se puede volver a vender. Por eso aceptamos devoluciones de productos sin abrir y
          resolvemos sin costo cualquier problema con tu pedido.
        </p>
      </header>

      <div className="flex max-w-2xl flex-col gap-10">
        <Section title="Si te arrepentís de la compra">
          <p>
            Tenés 10 días corridos desde que recibís el pedido para devolverlo, sin dar explicaciones. Vale para
            frascos y decants.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>El producto tiene que estar sin abrir ni usar, con su precinto o sello intacto y en su empaque.</li>
            <li>El envío de vuelta corre por nuestra cuenta.</li>
            <li>Cuando lo recibimos y lo revisamos, te devolvemos el importe por el mismo medio en que pagaste.</li>
          </ul>
        </Section>

        <Section title="Productos abiertos o usados">
          <p>
            No aceptamos devoluciones ni cambios de perfumes abiertos o usados, salvo que tengan un defecto. Una vez
            abierto, el producto no se puede volver a vender.
          </p>
        </Section>

        <Section title="Si llega con un problema">
          <p>
            Si tu pedido llega dañado, con pérdida o distinto de lo que pediste, avisanos apenas lo recibas. Te lo
            cambiamos por el mismo producto o te devolvemos el importe, y el envío corre por nuestra cuenta.
          </p>
          <p>No hacemos cambios por gusto: si un perfume cerrado no te convence, podés devolverlo.</p>
        </Section>

        <Section title="Cómo pedirlo">
          <p>
            Escribinos por WhatsApp con tu número de pedido (empieza con FAL) y contanos qué pasó. Si es por un
            problema, sumá una foto del producto. Te respondemos con los pasos para el envío o el retiro.
          </p>
          <p>
            Si buscás un perfume que no está en la tienda, podés{" "}
            <Link href="/encargos" className="text-text underline underline-offset-4 hover:text-platinum">
              encargarlo
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 text-body text-text-secondary">
      <h2 className="text-h3 text-text uppercase">{title}</h2>
      {children}
    </section>
  );
}
