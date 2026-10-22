"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  type Data,
  type Appointment,
  type CalendarDay,
  dayKey,
  addDays,
  dateLabel,
  money,
} from "../lib/types";
import AvailabilityCalendar from "./availability-calendar";
import { Icon, ErrorBox } from "./ui";

export default function Booking({
  data,
  visit,
  publicSlug,
  onSaved,
  onClose,
}: {
  data: Pick<
    Data,
    "business" | "services" | "professionals" | "clients" | "resources"
  >;
  visit?: Appointment;
  publicSlug?: string;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const today = dayKey(new Date(), data.business.timezone),
    max = addDays(today, 365);
  const [step, setStep] = useState(visit ? 1 : 0),
    [service, setService] = useState(
      visit?.service || data.services.find((s) => s.active)?.id || 0,
    ),
    [professional, setProfessional] = useState(visit?.professional || 0),
    [client, setClient] = useState(visit?.client || 0),
    [resource, setResource] = useState<number | "">(visit?.resource || "");
  const [day, setDay] = useState(today),
    [month, setMonth] = useState(today.slice(0, 7)),
    [days, setDays] = useState<CalendarDay[]>([]),
    [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [saved, setSaved] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [accepted, setAccepted] = useState(false),
    [notes, setNotes] = useState(visit?.notes || "");
  const requestKey = useRef(""),
    working = useRef(false);
  const selected = data.services.find((s) => s.id === service),
    people = data.professionals.filter(
      (p) => p.active && p.services.includes(service),
    );
  useEffect(() => {
    if (!people.some((p) => p.id === professional))
      setProfessional(people[0]?.id || 0);
  }, [service, professional, people]);
  useEffect(() => {
    if (step !== 1 || !service || !professional) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setDays([]);
    setSlot("");
    const query = new URLSearchParams({
      month,
      service: String(service),
      professional: String(professional),
    });
    if (resource) query.set("resource", String(resource));
    if (visit) query.set("exclude", String(visit.id));
    api<{ days: CalendarDay[] }>(
      `${publicSlug ? `public/${publicSlug}/` : "availability/"}?${query}`,
      "GET",
      undefined,
      abort.signal,
    )
      .then((result) => {
        setDays(result.days);
        setLoading(false);
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [month, service, professional, resource, step, retry, publicSlug, visit]);
  async function save() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      if (publicSlug)
        await api(`public/${publicSlug}/book/`, "POST", {
          name,
          email,
          phone,
          accepted,
          service,
          professional,
          start_local: slot,
          request_key: requestKey.current,
        });
      else if (visit)
        await api(`appointments/${visit.id}/`, "PATCH", {
          version: visit.version,
          start_local: slot,
          notes,
        });
      else
        await api("appointments/", "POST", {
          client,
          service,
          professional,
          resource: resource || null,
          start_local: slot,
          notes,
          request_key: requestKey.current,
        });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (saved)
    return (
      <div className="booking-success">
        <span className="success-mark">
          <Icon name="check" size={36} />
        </span>
        <p className="eyebrow">Todo en su sitio</p>
        <h2>
          {publicSlug
            ? "Tu solicitud está recibida."
            : visit
              ? "Nueva hora, misma cita."
              : "La cita ya está en tu agenda."}
        </h2>
        <p>
          {selected?.name} · {dateLabel(day)} a las {slot.slice(11)}
        </p>
        <p className="muted">
          {publicSlug
            ? "El negocio revisará tu solicitud. Puedes contactar por teléfono si necesitas cambiarla. No se ha enviado un correo automático."
            : "Los datos se han guardado y la disponibilidad se ha actualizado."}
        </p>
        <button className="button primary" onClick={onSaved}>
          {publicSlug ? "Volver al inicio" : "Volver a la agenda"}
          <Icon name="arrow" />
        </button>
      </div>
    );
  const slots = days.find((d) => d.date === day)?.slots || [];
  return (
    <div className="booking">
      <div className="booking-steps">
        {["Servicio y cliente", "Día y hora", "Confirmación"].map(
          (label, i) => (
            <div
              className={step === i ? "current" : step > i ? "finished" : ""}
              key={label}
            >
              <span>
                {step > i ? (
                  <Icon name="check" size={13} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              {label}
            </div>
          ),
        )}
      </div>
      <ErrorBox error={error} />
      {step === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setStep(1);
          }}
        >
          <div className="form-grid">
            <label>
              Servicio
              <select
                value={service}
                onChange={(e) => setService(+e.target.value)}
                required
              >
                {data.services
                  .filter((s) => s.active)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name} · {s.duration} min · {money(s.price)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Profesional
              <select
                required
                value={professional || ""}
                onChange={(e) => setProfessional(+e.target.value)}
              >
                <option value="" disabled>
                  Selecciona un profesional
                </option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {!publicSlug ? (
              <>
                <label>
                  Cliente
                  <select
                    required
                    value={client || ""}
                    onChange={(e) => setClient(+e.target.value)}
                  >
                    <option value="" disabled>
                      Selecciona un cliente
                    </option>
                    {data.clients
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `· ${c.company}` : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Recurso / sala
                  <select
                    value={resource}
                    onChange={(e) =>
                      setResource(e.target.value ? +e.target.value : "")
                    }
                  >
                    <option value="">No necesita recurso</option>
                    {data.resources
                      .filter((r) => r.active)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="span-2">
                  Notas de la cita
                  <textarea
                    value={notes}
                    maxLength={3000}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Algo que el equipo deba tener en cuenta…"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Tu nombre
                  <input
                    required
                    value={name}
                    maxLength={120}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Correo electrónico
                  <input
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    required
                    type="tel"
                    maxLength={30}
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="check-label span-2">
                  <input
                    type="checkbox"
                    checked={accepted}
                    required
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  Solicito esta cita y autorizo a {data.business.name} a
                  utilizar estos datos para gestionarla y contactar conmigo
                  sobre ella.
                </label>
              </>
            )}
          </div>
          <div className="form-footer">
            <span className="hint">
              {publicSlug
                ? "Tus datos solo se usarán para gestionar esta solicitud."
                : "¿Es un cliente nuevo? Créalo primero desde Clientes."}
            </span>
            <button
              className="button primary"
              disabled={!professional || !service}
            >
              Elegir fecha y hora
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      )}
      {step === 1 && (
        <>
          <div className="booking-context">
            <span className={`service-dot ${selected?.color}`} />
            <strong>{selected?.name}</strong>
            <span>{visit?.duration || selected?.duration} min</span>
            <span>·</span>
            <span>
              {data.professionals.find((p) => p.id === professional)?.name}
            </span>
          </div>
          <div className="booking-picker">
            <AvailabilityCalendar
              month={month}
              day={day}
              days={days}
              loading={loading}
              min={today}
              max={max}
              onMonth={(m) => {
                setMonth(m);
                setDay(m === today.slice(0, 7) ? today : m + "-01");
              }}
              onDay={(v) => {
                setDay(v);
                setSlot("");
              }}
            />
            <section className="time-picker">
              <p className="eyebrow">02 · Encuentra tu momento</p>
              <h3>
                {dateLabel(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <p className="hint">Hora local · {data.business.timezone}</p>
              {loading ? (
                <div className="loading-inline">
                  Consultando disponibilidad…
                </div>
              ) : slots.length ? (
                <>
                  {["Mañana", "Tarde"].map((label, i) => {
                    const group = slots.filter((s) =>
                      i === 0 ? +s.slice(11, 13) < 14 : +s.slice(11, 13) >= 14,
                    );
                    return group.length ? (
                      <div key={label} className="slot-section">
                        <h4>{label}</h4>
                        <div className="slot-grid">
                          {group.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={`time-slot ${slot === s ? "selected" : ""}`}
                              aria-pressed={slot === s}
                              onClick={() => setSlot(s)}
                            >
                              {s.slice(11)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })}
                </>
              ) : (
                <p className="empty-slots">
                  No hay horas disponibles. Prueba otro día o profesional.
                </p>
              )}
              {error && (
                <button
                  className="text-button"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Reintentar disponibilidad
                </button>
              )}
            </section>
          </div>
          <div className="form-footer">
            <button
              className="button"
              disabled={busy}
              onClick={() => (visit ? onClose?.() : setStep(0))}
            >
              {visit ? "Cancelar" : "Volver"}
            </button>
            <button
              className="button primary"
              disabled={!slot || loading}
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              Revisar cita
              <Icon name="arrow" />
            </button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="booking-review">
            <span className="review-icon">
              <Icon name="calendar" size={32} />
            </span>
            <p className="eyebrow">Un último vistazo</p>
            <h2>{selected?.name}</h2>
            <dl>
              <div>
                <dt>Cliente</dt>
                <dd>
                  {publicSlug
                    ? name
                    : data.clients.find((c) => c.id === client)?.name}
                </dd>
              </div>
              <div>
                <dt>Fecha y hora</dt>
                <dd>
                  {dateLabel(day)} · {slot.slice(11)}
                </dd>
              </div>
              <div>
                <dt>Profesional</dt>
                <dd>
                  {data.professionals.find((p) => p.id === professional)?.name}
                </dd>
              </div>
              <div>
                <dt>Duración</dt>
                <dd>{visit?.duration || selected?.duration} minutos</dd>
              </div>
              <div>
                <dt>Importe del servicio</dt>
                <dd>{money(visit?.price ?? selected?.price ?? 0)}</dd>
              </div>
            </dl>
            <p className="hint">
              {visit
                ? "Tu hora anterior se conserva hasta que confirmes este cambio."
                : publicSlug
                  ? "Esta solicitud no realiza ningún cobro. El negocio confirmará tu cita."
                  : "Comprobaremos de nuevo la disponibilidad al guardar."}
            </p>
          </div>
          <div className="form-footer">
            <button
              className="button"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              Elegir otra hora
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy
                ? "Guardando…"
                : publicSlug
                  ? "Solicitar cita"
                  : visit
                    ? "Confirmar nueva hora"
                    : "Confirmar cita"}
              <Icon name="check" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
