"use client";
import { useEffect, useState } from "react";
import type { PanelProps } from "./workspace";
import { CommercialReport } from "./crm-panels";
import { api } from "../lib/api";
import {
  type Business,
  lifecycleLabels,
  normalizeSearch,
  weightedValue,
  dayKey,
  dateLabel,
  addDays,
  money,
  stages,
  hour,
} from "../lib/types";
import { Avatar, Empty, Icon, ErrorBox } from "./ui";
const matches = (query: string, ...values: (string | undefined)[]) =>
  normalizeSearch(values.join(" ")).includes(normalizeSearch(query));

export function Clients({ data, user, actions, query }: PanelProps) {
  const [filter, setFilter] = useState("all"),
    [owner, setOwner] = useState("all"),
    [sort, setSort] = useState("name");
  const lastContact = (id: number) =>
    data.activities.find((a) => a.client === id)?.occurred_at || "";
  const rows = data.clients
    .filter(
      (c) =>
        matches(query, c.name, c.company, c.email, c.phone, c.source) &&
        (filter === "archived" ? !c.active : c.active) &&
        (filter === "all" || filter === "archived" || c.lifecycle === filter) &&
        (owner === "all" || String(c.owner ?? "") === owner),
    )
    .sort((a, b) =>
      sort === "recent"
        ? lastContact(b.id).localeCompare(lastContact(a.id))
        : a.name.localeCompare(b.name, "es"),
    );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="tabs">
          {[
            ["all", "Todos"],
            ["lead", "Potenciales"],
            ["customer", "Clientes"],
            ["inactive", "Inactivos"],
            ["archived", "Archivados"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="button-group">
          {user.role === "admin" && (
            <a className="button compact" href="/api/export/?kind=clients">
              <Icon name="download" size={16} />
              Exportar
            </a>
          )}
          <button
            className="button primary compact"
            onClick={() => actions.edit("clients")}
          >
            <Icon name="plus" size={16} />
            Nuevo contacto
          </button>
        </div>
      </div>
      <div className="crm-filter-bar">
        <label>
          Responsable
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="all">Todo el equipo</option>
            <option value="">Sin asignar</option>
            {data.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Orden
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Nombre A–Z</option>
            <option value="recent">Conversación más reciente</option>
          </select>
        </label>
        <span className="hint">
          {rows.length} contactos · Una ficha, todo el contexto
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Ciclo comercial</th>
              <th>Responsable</th>
              <th>Ventas abiertas</th>
              <th>Última conversación</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const open = data.opportunities.filter(
                (o) => o.client === c.id && !["won", "lost"].includes(o.stage),
              );
              const last = lastContact(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <div className="client-cell">
                      <Avatar
                        name={c.name}
                        color={c.lifecycle === "lead" ? "blue" : "mint"}
                      />
                      <div>
                        <button
                          className="text-button"
                          onClick={() => actions.openClient(c)}
                        >
                          {c.name}
                        </button>
                        <small className="crm-subline">
                          {c.company ||
                            c.email ||
                            c.phone ||
                            "Sin datos de contacto"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.lifecycle}`}>
                      {lifecycleLabels[c.lifecycle]}
                    </span>
                    {c.tag === "vip" && <span className="badge vip">VIP</span>}
                  </td>
                  <td>
                    {data.professionals.find((p) => p.id === c.owner)?.name || (
                      <span className="muted">Sin asignar</span>
                    )}
                  </td>
                  <td>
                    <strong>
                      {money(open.reduce((s, o) => s + o.value, 0))}
                    </strong>
                    <small className="crm-subline">
                      {open.length} oportunidades
                    </small>
                  </td>
                  <td>
                    {last ? (
                      dateLabel(dayKey(last, data.business.timezone))
                    ) : (
                      <span className="muted">Sin registrar</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Editar ${c.name}`}
                      onClick={() => actions.edit("clients", { ...c })}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          title="No hay contactos en esta vista"
          description="Prueba otros filtros o añade el primer contacto para empezar una relación."
        />
      )}
    </section>
  );
}

export function Pipeline({ data, actions, query }: PanelProps) {
  const [showLost, setShowLost] = useState(false),
    [moving, setMoving] = useState<number | null>(null);
  const [owner, setOwner] = useState("all"),
    [followup, setFollowup] = useState("all");
  const today = dayKey(new Date(), data.business.timezone);
  const rows = data.opportunities.filter(
    (o) =>
      matches(
        query,
        o.title,
        data.clients.find((c) => c.id === o.client)?.name,
      ) &&
      (owner === "all" || String(o.owner ?? "") === owner) &&
      (followup === "all" ||
        (followup === "overdue" &&
          !["won", "lost"].includes(o.stage) &&
          o.due_date &&
          o.due_date <= today) ||
        (followup === "missing" &&
          !["won", "lost"].includes(o.stage) &&
          (!o.next_action || !o.due_date))),
  );
  return (
    <>
      <div className="section-toolbar">
        <div>
          <strong>
            {money(
              rows
                .filter((o) => !["won", "lost"].includes(o.stage))
                .reduce((s, o) => s + o.value, 0),
            )}
          </strong>
          <span className="muted"> en oportunidades abiertas</span>
        </div>
        <div className="button-group">
          <label className="check-label">
            <input
              type="checkbox"
              checked={showLost}
              onChange={(e) => setShowLost(e.target.checked)}
            />
            Mostrar perdidos
          </label>
          <button
            className="button primary compact"
            onClick={() => actions.edit("opportunities")}
          >
            <Icon name="plus" size={17} />
            Nueva oportunidad
          </button>
        </div>
      </div>
      <div className="crm-filter-bar">
        <label>
          Responsable
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="all">Todo el equipo</option>
            <option value="">Sin asignar</option>
            {data.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seguimiento
          <select
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
          >
            <option value="all">Todas las oportunidades</option>
            <option value="overdue">Para hoy y vencidas</option>
            <option value="missing">Sin próximo paso</option>
          </select>
        </label>
        <span className="hint">
          Previsión ponderada:{" "}
          <strong>
            {money(
              rows
                .filter((o) => !["won", "lost"].includes(o.stage))
                .reduce((s, o) => s + weightedValue(o), 0),
            )}
          </strong>
        </span>
      </div>
      <div className="pipeline-board">
        {Object.entries(stages)
          .filter(([key]) => showLost || key !== "lost")
          .map(([key, label]) => {
            const group = rows.filter((o) => o.stage === key);
            return (
              <section className={`pipeline-column stage-${key}`} key={key}>
                <div className="pipeline-heading">
                  <h2>
                    <i />
                    {label}
                    <span>{group.length}</span>
                  </h2>
                  <small>{money(group.reduce((s, o) => s + o.value, 0))}</small>
                </div>
                {group.map((o) => (
                  <article className="opportunity-card" key={o.id}>
                    <button
                      className="opportunity-title"
                      onClick={() => actions.edit("opportunities", { ...o })}
                    >
                      {o.title}
                    </button>
                    <p>
                      {data.clients.find((c) => c.id === o.client)?.company ||
                        data.clients.find((c) => c.id === o.client)?.name}
                    </p>
                    <strong className="opportunity-value">
                      {money(o.value)}
                    </strong>
                    <div className="crm-deal-context">
                      <span>
                        {o.stage === "won"
                          ? 100
                          : o.stage === "lost"
                            ? 0
                            : o.probability}
                        % de probabilidad
                      </span>
                      <span>
                        {data.professionals.find((p) => p.id === o.owner)
                          ?.name || "Sin responsable"}
                      </span>
                    </div>
                    {o.expected_close && (
                      <small className="crm-subline">
                        Cierre previsto: {dateLabel(o.expected_close)}
                      </small>
                    )}
                    {o.stage === "lost" && (
                      <p className="note-box">
                        {o.lost_reason || "Sin motivo registrado"}
                      </p>
                    )}
                    {!["won", "lost"].includes(o.stage) &&
                      (!o.next_action || !o.due_date) && (
                        <small className="crm-followup-warning">
                          Falta definir el próximo paso
                        </small>
                      )}
                    {o.next_action && (
                      <div className="next-action">
                        <Icon name="arrow" size={14} />
                        {o.next_action}
                      </div>
                    )}
                    <div className="opportunity-bottom">
                      <Avatar
                        small
                        name={
                          data.clients.find((c) => c.id === o.client)?.name ||
                          "Cliente"
                        }
                      />
                      <span
                        className={
                          o.due_date &&
                          o.due_date < today &&
                          !["won", "lost"].includes(o.stage)
                            ? "crm-overdue"
                            : ""
                        }
                      >
                        {o.due_date
                          ? dateLabel(o.due_date, {
                              day: "numeric",
                              month: "short",
                            })
                          : "Sin fecha"}
                      </span>
                    </div>
                    <label className="stage-select">
                      <span className="sr-only">Etapa de {o.title}</span>
                      <select
                        value={o.stage}
                        disabled={moving === o.id}
                        onChange={async (e) => {
                          if (e.target.value === "lost" && !o.lost_reason) {
                            actions.edit("opportunities", {
                              ...o,
                              stage: "lost",
                            });
                            return;
                          }
                          setMoving(o.id);
                          try {
                            await actions.mutate(
                              `opportunities/${o.id}/`,
                              "PATCH",
                              { stage: e.target.value },
                            );
                          } catch {
                          } finally {
                            setMoving(null);
                          }
                        }}
                      >
                        {Object.entries(stages).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
                {!group.length && (
                  <div className="pipeline-empty">
                    Las oportunidades de esta etapa aparecerán aquí.
                  </div>
                )}
                <button
                  className="pipeline-add"
                  onClick={() => actions.edit("opportunities", { stage: key })}
                >
                  <Icon name="plus" size={15} />
                  Añadir oportunidad
                </button>
              </section>
            );
          })}
      </div>
    </>
  );
}

export function Tasks({ data, actions, query }: PanelProps) {
  const [filter, setFilter] = useState("pending"),
    [working, setWorking] = useState<number | null>(null),
    today = dayKey(new Date(), data.business.timezone);
  const rows = data.tasks
    .filter(
      (t) =>
        matches(
          query,
          t.title,
          data.clients.find((c) => c.id === t.client)?.name,
        ) &&
        (filter === "all" ||
          (filter === "done" && t.done) ||
          (filter === "pending" && !t.done) ||
          (filter === "today" && !t.done && t.due_date <= today)),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="tabs">
          {[
            ["pending", "Pendientes"],
            ["today", "Para hoy"],
            ["done", "Completadas"],
            ["all", "Todas"],
          ].map(([k, v]) => (
            <button
              key={k}
              className={filter === k ? "active" : ""}
              onClick={() => setFilter(k)}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          className="button primary compact"
          onClick={() => actions.edit("tasks")}
        >
          <Icon name="plus" size={16} />
          Nueva tarea
        </button>
      </div>
      <div className="task-list">
        {rows.map((t) => (
          <div className={`task-row ${t.done ? "done" : ""}`} key={t.id}>
            <button
              className={`task-check ${t.done ? "checked" : ""}`}
              disabled={working === t.id}
              aria-label={`${t.done ? "Reabrir" : "Completar"} ${t.title}`}
              onClick={async () => {
                setWorking(t.id);
                try {
                  await actions.mutate(`tasks/${t.id}/`, "PATCH", {
                    done: !t.done,
                  });
                } catch {
                } finally {
                  setWorking(null);
                }
              }}
            >
              {t.done && <Icon name="check" size={14} />}
            </button>
            <button
              className="task-info"
              onClick={() => actions.edit("tasks", { ...t })}
            >
              <strong>{t.title}</strong>
              <span>
                {data.clients.find((c) => c.id === t.client)?.name ||
                  "Tarea interna"}
              </span>
            </button>
            {t.priority === "high" && (
              <span className="badge high-priority">Alta</span>
            )}
            <span
              className={
                !t.done && t.due_date < today
                  ? "due-label overdue"
                  : "due-label"
              }
            >
              <Icon name="calendar" size={15} />
              {t.due_date === today
                ? "Hoy"
                : dateLabel(t.due_date, { day: "numeric", month: "short" })}
            </span>
            {t.professional ? (
              <Avatar
                name={
                  data.professionals.find((p) => p.id === t.professional)
                    ?.name || "Equipo"
                }
                small
              />
            ) : (
              <span className="hint">Sin asignar</span>
            )}
            <button
              className="icon-button"
              aria-label={`Editar tarea ${t.title}`}
              onClick={() => actions.edit("tasks", { ...t })}
            >
              <Icon name="edit" size={17} />
            </button>
          </div>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="Todo bajo control"
          description="No hay tareas en esta vista."
        />
      )}
    </section>
  );
}

export function Payments({ data, user, actions, query }: PanelProps) {
  const [mode, setMode] = useState("history");
  const outstanding = data.appointments.filter(
    (a) => a.price > a.paid && !["cancelled", "no_show"].includes(a.status),
  );
  const payments = data.payments.filter((p) =>
    matches(query, p.client_name, p.service_name, p.reference),
  );
  return (
    <>
      <div className="mini-stats">
        <article>
          <span>Cobrado · histórico</span>
          <strong>
            {money(data.payments.reduce((s, p) => s + p.amount, 0))}
          </strong>
        </article>
        <article>
          <span>Pendiente de cobro</span>
          <strong>
            {money(outstanding.reduce((s, a) => s + a.price - a.paid, 0))}
          </strong>
        </article>
        <article>
          <span>Citas con saldo pendiente</span>
          <strong>{outstanding.length}</strong>
        </article>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div className="tabs">
            <button
              className={mode === "history" ? "active" : ""}
              onClick={() => setMode("history")}
            >
              Historial de cobros
            </button>
            <button
              className={mode === "pending" ? "active" : ""}
              onClick={() => setMode("pending")}
            >
              Pendientes<span>{outstanding.length}</span>
            </button>
          </div>
          <div className="button-group">
            {user.role === "admin" && (
              <a className="button compact" href="/api/export/?kind=payments">
                <Icon name="download" size={16} />
                Exportar
              </a>
            )}
            <button
              className="button primary compact"
              onClick={() => actions.edit("payments")}
            >
              <Icon name="plus" size={16} />
              Registrar cobro
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente / servicio</th>
                <th>Fecha</th>
                <th>{mode === "history" ? "Método" : "Estado"}</th>
                <th>{mode === "history" ? "Importe" : "Saldo pendiente"}</th>
                <th>{mode === "history" ? "Referencia" : "Acción"}</th>
              </tr>
            </thead>
            <tbody>
              {mode === "history"
                ? payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.client_name}</strong>
                        <small>{p.service_name}</small>
                      </td>
                      <td>
                        {dateLabel(dayKey(p.paid_at, data.business.timezone))}
                      </td>
                      <td>
                        <span className="method">
                          <Icon name="wallet" size={15} />
                          {{
                            card: "Tarjeta",
                            cash: "Efectivo",
                            transfer: "Transferencia",
                          }[p.method] || p.method}
                        </span>
                      </td>
                      <td>
                        <strong>{money(p.amount)}</strong>
                      </td>
                      <td>{p.reference || "—"}</td>
                    </tr>
                  ))
                : outstanding
                    .filter((a) =>
                      matches(query, a.client_name, a.service_name),
                    )
                    .map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.client_name}</strong>
                          <small>{a.service_name}</small>
                        </td>
                        <td>
                          {dateLabel(
                            dayKey(a.starts_at, data.business.timezone),
                          )}
                        </td>
                        <td>
                          <span className="badge pending">
                            {a.paid ? "Cobro parcial" : "Pendiente"}
                          </span>
                        </td>
                        <td>
                          <strong>{money(a.price - a.paid)}</strong>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              actions.edit("payments", { appointment: a.id })
                            }
                          >
                            Registrar cobro
                            <Icon name="arrow" size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
          {((mode === "history" && !payments.length) ||
            (mode === "pending" &&
              !outstanding.filter((a) =>
                matches(query, a.client_name, a.service_name),
              ).length)) && <Empty title="No hay cobros en esta vista" />}
        </div>
        <div className="panel-bottom">
          <Icon name="wallet" size={16} />
          Registro de cobros realizados. No sustituye a una factura fiscal ni
          procesa pagos.
        </div>
      </section>
    </>
  );
}

export function Services({ data, user, actions, query }: PanelProps) {
  const rows = data.services.filter((s) =>
    matches(query, s.name, s.description),
  );
  return (
    <>
      <div className="section-toolbar">
        <span className="muted">
          {data.services.filter((s) => s.active).length} servicios activos ·
          Precios en EUR
        </span>
        {user.role === "admin" && (
          <button
            className="button primary compact"
            onClick={() => actions.edit("services")}
          >
            <Icon name="plus" size={16} />
            Nuevo servicio
          </button>
        )}
      </div>
      <div className="service-grid">
        {rows.map((s) => (
          <article
            className={`service-card ${!s.active ? "archived" : ""}`}
            key={s.id}
          >
            <div className="service-card-top">
              <span className={`service-icon ${s.color}`}>
                <Icon name="spark" size={24} />
              </span>
              <span className={`badge ${s.active ? "confirmed" : "cancelled"}`}>
                {s.active ? "Activo" : "Archivado"}
              </span>
            </div>
            <h2>{s.name}</h2>
            <p>{s.description || "Servicio disponible para tus clientes."}</p>
            <div className="service-price">
              <strong>{money(s.price)}</strong>
              <span>
                <Icon name="clock" size={16} />
                {s.duration} min
              </span>
            </div>
            <div className="service-team">
              <div className="avatar-stack">
                {data.professionals
                  .filter((p) => p.active && p.services.includes(s.id))
                  .map((p) => (
                    <Avatar small key={p.id} name={p.name} color={p.color} />
                  ))}
              </div>
              <span>
                {
                  data.professionals.filter(
                    (p) => p.active && p.services.includes(s.id),
                  ).length
                }{" "}
                profesionales
              </span>
            </div>
            {user.role === "admin" && (
              <button
                className="service-edit"
                onClick={() => actions.edit("services", { ...s })}
              >
                Editar servicio
                <Icon name="edit" size={16} />
              </button>
            )}
          </article>
        ))}
      </div>
      {!rows.length && <Empty title="No hay servicios que mostrar" />}
    </>
  );
}

export function Team({ data, user, actions, query }: PanelProps) {
  return (
    <>
      <div className="section-toolbar">
        <h2>Un equipo, muchas conexiones.</h2>
        {user.role === "admin" && (
          <button
            className="button primary compact"
            onClick={() => actions.edit("professionals")}
          >
            <Icon name="plus" size={16} />
            Añadir profesional
          </button>
        )}
      </div>
      <div className="team-grid">
        {data.professionals
          .filter((p) => matches(query, p.name, p.title))
          .map((p) => (
            <article className="panel team-card" key={p.id}>
              <Avatar name={p.name} color={p.color} />
              <h2>{p.name}</h2>
              <p>{p.title || "Profesional"}</p>
              <span className={`badge ${p.active ? "confirmed" : "cancelled"}`}>
                {p.active ? "Activo" : "Archivado"}
              </span>
              <div className="team-services">
                {data.services
                  .filter((s) => p.services.includes(s.id))
                  .map((s) => (
                    <span key={s.id}>{s.name}</span>
                  ))}
              </div>
              {user.role === "admin" && (
                <button
                  className="button"
                  onClick={() => actions.edit("professionals", { ...p })}
                >
                  Gestionar profesional
                  <Icon name="edit" size={16} />
                </button>
              )}
            </article>
          ))}
      </div>
      <section className="panel resources-panel">
        <div className="panel-heading">
          <div>
            <h2>Espacios y recursos</h2>
            <p>Evita reservar una misma sala o equipo a la vez.</p>
          </div>
          {user.role === "admin" && (
            <button
              className="button compact"
              onClick={() => actions.edit("resources")}
            >
              <Icon name="plus" size={16} />
              Añadir recurso
            </button>
          )}
        </div>
        {data.resources
          .filter((r) => matches(query, r.name))
          .map((r) => (
            <div className="resource-row" key={r.id}>
              <span className="stat-icon blue">
                <Icon name="briefcase" size={18} />
              </span>
              <strong>{r.name}</strong>
              <span className={`badge ${r.active ? "confirmed" : "cancelled"}`}>
                {r.active ? "Activo" : "Archivado"}
              </span>
              {user.role === "admin" && (
                <button
                  className="icon-button"
                  aria-label={`Editar ${r.name}`}
                  onClick={() => actions.edit("resources", { ...r })}
                >
                  <Icon name="edit" size={17} />
                </button>
              )}
            </div>
          ))}
      </section>
      <section className="panel resources-panel">
        <div className="panel-heading">
          <div>
            <h2>Bloqueos de disponibilidad</h2>
            <p>Ausencias, vacaciones y tiempo para preparar tu trabajo.</p>
          </div>
          {user.role === "admin" && (
            <button
              className="button compact"
              onClick={() => actions.edit("blocks")}
            >
              <Icon name="plus" size={16} />
              Nuevo bloqueo
            </button>
          )}
        </div>
        {data.blocks.map((b) => (
          <div className="resource-row" key={b.id}>
            <Icon name="clock" />
            <div className="grow">
              <strong>{b.reason}</strong>
              <small>
                {data.professionals.find((p) => p.id === b.professional)
                  ?.name || "Todo el equipo"}{" "}
                · {dateLabel(dayKey(b.starts_at, data.business.timezone))}{" "}
                {hour(b.starts_at, data.business.timezone)} →{" "}
                {dateLabel(dayKey(b.ends_at, data.business.timezone))}{" "}
                {hour(b.ends_at, data.business.timezone)}
              </small>
            </div>
            {user.role === "admin" && (
              <button
                className="text-button danger"
                onClick={() =>
                  void actions
                    .mutate(`blocks/${b.id}/`, "DELETE")
                    .catch(() => {})
                }
              >
                Quitar bloqueo
              </button>
            )}
          </div>
        ))}
        {!data.blocks.length && (
          <p className="panel-padding muted">No hay bloqueos de horario.</p>
        )}
      </section>
    </>
  );
}

export function Reports({ data, user }: PanelProps) {
  const today = dayKey(new Date(), data.business.timezone),
    [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today);
  const within = (s: string) => {
      const day = dayKey(s, data.business.timezone);
      return day >= from && day <= to;
    },
    visits = data.appointments.filter((a) => within(a.starts_at)),
    payments = data.payments.filter((p) => within(p.paid_at)),
    total = payments.reduce((s, p) => s + p.amount, 0);
  const completed = visits.filter((a) => a.status === "completed").length,
    cancelled = visits.filter((a) => a.status === "cancelled").length;
  return (
    <>
      <CommercialReport data={data} />
      <h2 className="crm-operational-heading">Citas y cobros por periodo</h2>
      <div className="section-toolbar reports-filters">
        <div className="button-group">
          <label>
            Desde
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => e.target.value && setTo(e.target.value)}
            />
          </label>
        </div>
        {user.role === "admin" && (
          <a
            className="button"
            href={`/api/export/?kind=payments&from=${from}&to=${to}`}
          >
            <Icon name="download" size={17} />
            Exportar cobros del periodo
          </a>
        )}
      </div>
      <div className="mini-stats four">
        <article>
          <span>Cobros del periodo</span>
          <strong>{money(total)}</strong>
        </article>
        <article>
          <span>Citas completadas</span>
          <strong>{completed}</strong>
        </article>
        <article>
          <span>Cancelaciones</span>
          <strong>
            {visits.length ? Math.round((cancelled / visits.length) * 100) : 0}%
          </strong>
        </article>
        <article>
          <span>Cobro medio</span>
          <strong>
            {money(payments.length ? Math.round(total / payments.length) : 0)}
          </strong>
        </article>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Actividad por profesional</h2>
              <p>Citas y cobros en el intervalo seleccionado.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Citas</th>
                  <th>Completadas</th>
                  <th>Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {data.professionals.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="client-cell">
                        <Avatar name={p.name} color={p.color} small />
                        {p.name}
                      </div>
                    </td>
                    <td>
                      {visits.filter((a) => a.professional === p.id).length}
                    </td>
                    <td>
                      {
                        visits.filter(
                          (a) =>
                            a.professional === p.id && a.status === "completed",
                        ).length
                      }
                    </td>
                    <td>
                      {money(
                        payments
                          .filter(
                            (pay) =>
                              data.appointments.find(
                                (a) => a.id === pay.appointment,
                              )?.professional === p.id,
                          )
                          .reduce((s, pay) => s + pay.amount, 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Servicios más solicitados</h2>
              <p>Distribución de citas no canceladas.</p>
            </div>
          </div>
          <div className="service-bars">
            {data.services.map((s) => {
              const count = visits.filter(
                (a) => a.service === s.id && a.status !== "cancelled",
              ).length;
              return (
                <div key={s.id}>
                  <div>
                    <span>{s.name}</span>
                    <strong>{count}</strong>
                  </div>
                  <span className="progress-track">
                    <i
                      className={s.color}
                      style={{
                        width: `${visits.length ? (count / visits.length) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <p className="hint">
        Los cobros se atribuyen por fecha de registro, las citas por fecha de
        inicio. Los importes reflejan cobros manuales y no incluyen ajustes o
        devoluciones externas.
      </p>
    </>
  );
}

export function Settings({ data, user, actions }: PanelProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [users, setUsers] = useState<
      {
        id: number;
        username: string;
        name: string;
        role: string;
        active: boolean;
      }[]
    >([]);
  useEffect(() => {
    if (user.role === "admin")
      api<typeof users>("users/")
        .then(setUsers)
        .catch((e) => setError(e.message));
  }, [user.role, data]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const form = new FormData(e.currentTarget);
    try {
      const body = Object.fromEntries(form) as Record<string, unknown>;
      body.weekdays = form.getAll("weekdays").map(Number);
      body.public_booking = form.has("public_booking");
      await actions.mutate("settings/", "PATCH", body);
      setSuccess("Configuración guardada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-stack">
      <ErrorBox error={error} />
      {success && (
        <div className="success-notice" role="status">
          {success}
        </div>
      )}
      {user.role === "admin" ? (
        <form onSubmit={save}>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Tu negocio</h2>
                <p>La información que conecta tu equipo y tus clientes.</p>
              </div>
              <span className="badge confirmed">Administrador</span>
            </div>
            <div className="form-grid panel-padding">
              {[
                ["name", "Nombre del negocio"],
                ["industry", "Actividad"],
                ["email", "Correo electrónico"],
                ["phone", "Teléfono"],
                ["address", "Dirección"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    defaultValue={String(data.business[key as keyof Business])}
                    required={key === "name"}
                    type={key === "email" ? "email" : "text"}
                    maxLength={key === "address" ? 240 : 120}
                  />
                </label>
              ))}
              <label>
                Zona horaria
                <select name="timezone" defaultValue={data.business.timezone}>
                  <option value="Europe/Madrid">
                    Península · Europe/Madrid
                  </option>
                  <option value="Atlantic/Canary">
                    Canarias · Atlantic/Canary
                  </option>
                  <option value="UTC">UTC</option>
                </select>
              </label>
            </div>
            <div className="settings-divider">
              <h3>Horario de atención</h3>
              <p className="hint">
                Horario común del negocio. Usa bloqueos por profesional para
                ausencias o descansos. Cambiarlo no reprograma las citas
                existentes.
              </p>
              <div className="weekday-choices">
                {[
                  "Lunes",
                  "Martes",
                  "Miércoles",
                  "Jueves",
                  "Viernes",
                  "Sábado",
                  "Domingo",
                ].map((d, i) => (
                  <label key={d}>
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={i}
                      defaultChecked={data.business.weekdays.includes(i)}
                    />
                    <span>{d}</span>
                  </label>
                ))}
              </div>
              <div className="form-grid">
                <label>
                  Apertura
                  <input
                    type="time"
                    name="opening"
                    step="900"
                    required
                    defaultValue={data.business.opening.slice(0, 5)}
                  />
                </label>
                <label>
                  Cierre
                  <input
                    type="time"
                    name="closing"
                    step="900"
                    required
                    defaultValue={data.business.closing.slice(0, 5)}
                  />
                </label>
              </div>
            </div>
            <div className="settings-divider">
              <h3>Reservas online</h3>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="public_booking"
                  defaultChecked={data.business.public_booking}
                />
                Aceptar solicitudes desde la página de reservas
              </label>
              <p className="hint">
                Las solicitudes entran como pendientes. No se envían
                recordatorios automáticos.
              </p>
              <a
                className="booking-url"
                href={`/reservar/${data.business.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                /reservar/{data.business.slug}
                <Icon name="external" size={16} />
              </a>
            </div>
            <div className="form-footer panel-padding">
              <span className="hint">
                Moneda: EUR · Los precios históricos se conservan.
              </span>
              <button className="button primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar configuración"}
                <Icon name="check" size={17} />
              </button>
            </div>
          </section>
        </form>
      ) : (
        <section className="panel panel-padding">
          <h2>{data.business.name}</h2>
          <p>{data.business.industry}</p>
          <p className="muted">
            Tu administrador gestiona los horarios, servicios y accesos del
            negocio.
          </p>
        </section>
      )}
      {user.role === "admin" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Accesos al espacio</h2>
              <p>
                Los usuarios de acceso son independientes de los profesionales
                de la agenda.
              </p>
            </div>
            <button
              className="button compact"
              onClick={() => actions.edit("users")}
            >
              <Icon name="plus" size={16} />
              Nuevo usuario
            </button>
          </div>
          {users.map((u) => (
            <div className="resource-row" key={u.id}>
              <Avatar name={u.name || u.username} small />
              <div className="grow">
                <strong>{u.name}</strong>
                <small>
                  {u.username} ·{" "}
                  {u.role === "admin" ? "Administrador" : "Equipo"}
                </small>
              </div>
              <span className={`badge ${u.active ? "confirmed" : "cancelled"}`}>
                {u.active ? "Activo" : "Desactivado"}
              </span>
              {u.username !== user.username && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await actions.mutate("users/", "PATCH", {
                        id: u.id,
                        active: !u.active,
                      });
                    } catch {
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {u.active ? "Desactivar" : "Activar"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Seguridad de tu cuenta</h2>
            <p>Al cambiar tu contraseña se cerrará la sesión.</p>
          </div>
        </div>
        <form
          className="panel-padding"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirmation")) {
              setError("Las contraseñas nuevas no coinciden.");
              setBusy(false);
              return;
            }
            try {
              await api("password/", "POST", {
                current: f.get("current"),
                password: f.get("password"),
              });
              window.location.reload();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Contraseña actual
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Nueva contraseña
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            <label>
              Repite la nueva contraseña
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
          </div>
          <button className="button" disabled={busy}>
            Cambiar contraseña
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Actividad reciente</h2>
            <p>Trazabilidad de las últimas operaciones.</p>
          </div>
        </div>
        <div className="audit-list">
          {data.audit.map((a) => (
            <div key={a.id}>
              <span className="audit-dot" />
              <div>
                <strong>{a.action}</strong>
                <small>
                  {a.actor} · {a.entity} #{a.object_id}
                </small>
              </div>
              <time>
                {dateLabel(dayKey(a.created_at, data.business.timezone), {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {hour(a.created_at, data.business.timezone)}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
