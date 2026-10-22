"use client";
import { useState } from "react";
import type { PanelProps } from "./workspace";
import {
  type Appointment,
  dayKey,
  dateLabel,
  addDays,
  hour,
  money,
  statuses,
} from "../lib/types";
import { Avatar, Empty, Icon } from "./ui";

export function Agenda({ data, user, actions }: PanelProps) {
  const zone = data.business.timezone,
    today = dayKey(new Date(), zone),
    [day, setDay] = useState(today),
    [professional, setProfessional] = useState(""),
    [mode, setMode] = useState("day"),
    [status, setStatus] = useState("");
  const people = data.professionals.filter(
    (p) => p.active && (!professional || p.id === +professional),
  );
  const date = new Date(day + "T12:00Z"),
    monday = addDays(day, -((date.getUTCDay() + 6) % 7)),
    week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const visits = data.appointments.filter(
    (a) =>
      (!professional || a.professional === +professional) &&
      (!status || a.status === status),
  );
  const dayVisits = visits.filter((a) => dayKey(a.starts_at, zone) === day);
  const startHour = Math.min(8, Number(data.business.opening.slice(0, 2))),
    endHour = Math.max(
      20,
      Math.ceil(
        Number(data.business.closing.slice(0, 2)) +
          Number(data.business.closing.slice(3, 5)) / 60,
      ),
    );
  const rowHeight = 76,
    totalHeight = (endHour - startHour) * rowHeight;
  function top(a: Appointment) {
    const local = hour(a.starts_at, zone).split(":").map(Number);
    return (local[0] - startHour + local[1] / 60) * rowHeight;
  }
  return (
    <section className="panel agenda-panel">
      <div className="agenda-toolbar">
        <div className="button-group">
          <button className="button compact" onClick={() => setDay(today)}>
            Hoy
          </button>
          <button
            className="icon-button prev"
            aria-label="Periodo anterior"
            onClick={() => setDay(addDays(day, mode === "week" ? -7 : -1))}
          >
            <Icon name="chevron" size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Periodo siguiente"
            onClick={() => setDay(addDays(day, mode === "week" ? 7 : 1))}
          >
            <Icon name="chevron" size={17} />
          </button>
          <label className="date-control">
            <span className="sr-only">Fecha de agenda</span>
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </label>
        </div>
        <div className="agenda-filters">
          <select
            aria-label="Filtrar profesional"
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
          >
            <option value="">Todo el equipo</option>
            {data.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="segmented" aria-label="Vista de agenda">
            {[
              ["day", "Día"],
              ["week", "Semana"],
              ["list", "Lista"],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={mode === v}
                className={mode === v ? "active" : ""}
                onClick={() => setMode(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="agenda-caption">
        <div>
          <h2>
            {dateLabel(day, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <span>
            {dayVisits.filter((a) => a.status !== "cancelled").length} citas ·{" "}
            {people.length} profesionales
          </span>
        </div>
        {user.role === "admin" && (
          <button
            className="text-button"
            onClick={() => actions.edit("blocks")}
          >
            <Icon name="plus" size={16} />
            Bloquear horario
          </button>
        )}
      </div>
      {mode === "day" && (
        <div className="calendar-scroll">
          <div
            className="schedule-grid"
            style={{
              gridTemplateColumns: `58px repeat(${Math.max(people.length, 1)}, minmax(200px,1fr))`,
            }}
          >
            <div className="schedule-corner">
              GMT
              {new Intl.DateTimeFormat("en", {
                timeZone: zone,
                timeZoneName: "shortOffset",
              })
                .formatToParts(new Date())
                .find((x) => x.type === "timeZoneName")
                ?.value.replace("GMT", "")}
            </div>
            {people.map((p) => (
              <div key={p.id} className="professional-heading">
                <Avatar name={p.name} color={p.color} small />
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.title}</small>
                </div>
              </div>
            ))}
            <div className="time-gutter" style={{ height: totalHeight }}>
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <span key={i} style={{ top: i * rowHeight }}>
                  {String(i + startHour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {people.map((p) => (
              <div
                key={p.id}
                className="schedule-column"
                style={{
                  height: totalHeight,
                  backgroundSize: `100% ${rowHeight}px`,
                }}
              >
                {data.blocks
                  .filter(
                    (b) =>
                      (!b.professional || b.professional === p.id) &&
                      dayKey(b.starts_at, zone) <= day &&
                      dayKey(b.ends_at, zone) >= day,
                  )
                  .map((b) => {
                    const from =
                      dayKey(b.starts_at, zone) < day
                        ? startHour
                        : Number(hour(b.starts_at, zone).slice(0, 2)) +
                          Number(hour(b.starts_at, zone).slice(3)) / 60;
                    const to =
                      dayKey(b.ends_at, zone) > day
                        ? endHour
                        : Number(hour(b.ends_at, zone).slice(0, 2)) +
                          Number(hour(b.ends_at, zone).slice(3)) / 60;
                    const clippedFrom = Math.max(startHour, from),
                      clippedTo = Math.min(endHour, to);
                    return clippedTo > clippedFrom ? (
                      <div
                        className="schedule-block"
                        key={b.id}
                        style={{
                          top: (clippedFrom - startHour) * rowHeight,
                          height: (clippedTo - clippedFrom) * rowHeight,
                        }}
                      >
                        {b.reason}
                      </div>
                    ) : null;
                  })}
                {dayVisits
                  .filter(
                    (a) => a.professional === p.id && a.status !== "cancelled",
                  )
                  .map((a) => (
                    <button
                      className={`schedule-appointment ${data.services.find((s) => s.id === a.service)?.color || "mint"}`}
                      style={{
                        top: top(a) + 3,
                        height: Math.max((a.duration / 60) * rowHeight - 6, 32),
                      }}
                      key={a.id}
                      onClick={() => actions.openVisit(a)}
                    >
                      <span>
                        <strong>{hour(a.starts_at, zone)}</strong>
                        <span>
                          {a.status === "completed" ? (
                            <Icon name="check" size={13} />
                          ) : a.status === "pending" ? (
                            <Icon name="clock" size={13} />
                          ) : null}
                        </span>
                      </span>
                      <strong>{a.client_name}</strong>
                      {a.duration >= 45 && <small>{a.service_name}</small>}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          {!people.length && (
            <Empty
              title="No hay profesionales activos"
              description="Añade un profesional y habilita sus servicios desde Equipo."
            />
          )}
        </div>
      )}
      {mode === "week" && (
        <div className="week-grid">
          {week.map((d) => (
            <div
              key={d}
              className={d === today ? "week-day is-today" : "week-day"}
            >
              <button
                className="week-heading"
                onClick={() => {
                  setDay(d);
                  setMode("day");
                }}
              >
                <span>{dateLabel(d, { weekday: "short" })}</span>
                <strong>{d.slice(8)}</strong>
              </button>
              {visits
                .filter(
                  (a) =>
                    dayKey(a.starts_at, zone) === d && a.status !== "cancelled",
                )
                .map((a) => (
                  <button
                    key={a.id}
                    className={`week-appointment ${data.services.find((s) => s.id === a.service)?.color || "mint"}`}
                    onClick={() => actions.openVisit(a)}
                  >
                    <small>{hour(a.starts_at, zone)}</small>
                    <strong>{a.client_name}</strong>
                    <span>{a.service_name}</span>
                  </button>
                ))}
              {!visits.some(
                (a) =>
                  dayKey(a.starts_at, zone) === d && a.status !== "cancelled",
              ) && <p className="hint">Sin citas</p>}
            </div>
          ))}
        </div>
      )}
      {mode === "list" && (
        <>
          <div className="list-filter">
            <select
              aria-label="Estado de cita"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Cliente / servicio</th>
                  <th>Profesional</th>
                  <th>Estado</th>
                  <th>Importe</th>
                  <th>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dayVisits.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {hour(a.starts_at, zone)}
                      <small>{a.duration} min</small>
                    </td>
                    <td>
                      <button
                        className="cell-link"
                        onClick={() => actions.openVisit(a)}
                      >
                        {a.client_name}
                      </button>
                      <small>{a.service_name}</small>
                    </td>
                    <td>{a.professional_name}</td>
                    <td>
                      <span className={`badge ${a.status}`}>
                        {statuses[a.status]}
                      </span>
                    </td>
                    <td>{money(a.price)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Abrir cita de ${a.client_name}`}
                        onClick={() => actions.openVisit(a)}
                      >
                        <Icon name="chevron" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dayVisits.length && (
              <Empty
                title="No hay citas para este día"
                description="Usa Nueva cita en la cabecera para añadir una reserva."
              />
            )}
          </div>
        </>
      )}
      <div className="agenda-legend">
        {data.services
          .filter((s) => s.active)
          .map((s) => (
            <span key={s.id}>
              <i className={`service-dot ${s.color}`} />
              {s.name}
            </span>
          ))}
      </div>
    </section>
  );
}
