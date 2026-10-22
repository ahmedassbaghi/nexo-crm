"use client";
import { useEffect, useState } from "react";
import { api, setCsrf } from "../lib/api";
import type { Business, Service, Professional } from "../lib/types";
import Booking from "./booking";
import { ErrorBox, Icon } from "./ui";
type PublicData = {
  business: Pick<
    Business,
    "name" | "industry" | "address" | "phone" | "timezone"
  >;
  services: Service[];
  professionals: Professional[];
  csrf: string;
};
export default function PublicBooking({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    api<PublicData>(`public/${slug}/`, "GET", undefined, abort.signal)
      .then((result) => {
        setData(result);
        setCsrf(result.csrf);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            "Esta página de reservas no está disponible. Contacta directamente con el negocio.",
          );
      });
    return () => abort.abort();
  }, [slug]);
  return (
    <main className="public-page">
      <header className="public-header">
        <div className="brand">
          <span className="brand-mark">n</span>
          <span>nexo.</span>
        </div>
        <span>Un espacio para conectar con tu próximo buen día.</span>
      </header>
      {error ? (
        <section className="public-error">
          <ErrorBox error={error} />
          <a className="button" href="/">
            Ir al acceso de negocios
            <Icon name="arrow" />
          </a>
        </section>
      ) : !data ? (
        <div className="empty">Preparando el calendario…</div>
      ) : (
        <>
          <section className="public-intro">
            <p className="eyebrow">
              {data.business.name} · {data.business.industry}
            </p>
            <h1>Un buen momento empieza aquí.</h1>
            <p>
              Elige tu servicio. Encuentra tu hora. Nosotros nos ocupamos del
              resto.
            </p>
          </section>
          <section className="panel">
            <Booking
              key={version}
              data={{
                ...data,
                business: {
                  id: 0,
                  slug,
                  currency: "EUR",
                  email: "",
                  opening: "09:00",
                  closing: "19:00",
                  weekdays: [],
                  public_booking: true,
                  ...data.business,
                },
                clients: [],
                resources: [],
              }}
              publicSlug={slug}
              onSaved={() => setVersion((n) => n + 1)}
            />
          </section>
          <footer className="public-contact">
            {data.business.name} · {data.business.address}
            <br />
            {data.business.phone && (
              <a href={`tel:${data.business.phone.replace(/\s/g, "")}`}>
                {data.business.phone}
              </a>
            )}
            <p>
              Reservas gestionadas con Nexo. Contacta con el negocio para
              consultas, cambios o solicitudes sobre tus datos.
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
