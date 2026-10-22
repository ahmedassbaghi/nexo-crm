"use client";
import { useEffect, useRef, useState } from "react";
import type { Actions, PanelProps } from "./workspace";
import {
  type Client,
  type Data,
  activityKinds,
  dayKey,
  dateLabel,
  hour,
  lifecycleLabels,
  money,
  normalizeSearch,
  quoteNumber,
  quoteStatuses,
  stages,
  statuses,
  weightedValue,
} from "../lib/types";
import { Avatar, Empty, Icon } from "./ui";
import { Metric } from "./quotes";

export function CRMHome({ data, actions }: PanelProps) {
  const today = dayKey(new Date(), data.business.timezone);
  const open = data.opportunities.filter(
    (o) => !["won", "lost"].includes(o.stage),
  );
  const dueTasks = data.tasks
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        Number(b.priority === "high") - Number(a.priority === "high"),
    );
  const overdue = open
    .filter((o) => o.due_date && o.due_date <= today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const unscheduled = open.filter((o) => !o.next_action || !o.due_date);
  const visits = data.appointments.filter(
    (a) =>
      dayKey(a.starts_at, data.business.timezone) === today &&
      !["cancelled", "no_show"].includes(a.status),
  );
  const sent = data.quotes.filter((q) => q.status === "sent");
  const totalOpen = open.reduce((s, o) => s + o.value, 0),
    forecast = open.reduce((s, o) => s + weightedValue(o), 0);
  return (
    <div className="crm-home">
      <section className="crm-focus">
        <div>
          <p className="eyebrow">TU MESA DE TRABAJO</p>
          <h2>
            Las buenas relaciones
            <br />
            empiezan por estar presente.
          </h2>
          <p>
            {overdue.length +
              dueTasks.filter((t) => t.due_date <= today).length >
            0
              ? `Tienes ${overdue.length} seguimientos comerciales y ${dueTasks.filter((t) => t.due_date <= today).length} tareas para atender hoy.`
              : "Tu seguimiento está al día. Es un buen momento para abrir nuevas conversaciones."}
          </p>
          <button
            className="button primary"
            onClick={() => actions.edit("activities")}
          >
            <Icon name="plus" size={17} />
            Registrar conversación
          </button>
          <button
            className="text-button"
            onClick={() => actions.edit("clients")}
          >
            Añadir contacto <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="crm-focus-note">
          <span className="crm-orbit">
            <Icon name="users" size={32} />
          </span>
          <strong>{data.clients.filter((c) => c.active).length}</strong>
          <span>relaciones en un mismo lugar</span>
          <div className="crm-avatar-stack">
            {data.clients
              .filter((c) => c.active)
              .slice(0, 4)
              .map((c) => (
                <Avatar key={c.id} name={c.name} />
              ))}
          </div>
        </div>
      </section>
      <div className="crm-metrics four">
        <Metric
          label="Cartera abierta"
          value={money(totalOpen)}
          note={`${open.length} oportunidades en curso`}
        />
        <Metric
          label="Previsión ponderada"
          value={money(forecast)}
          note="Valor × probabilidad · no son ingresos"
        />
        <Metric
          label="Propuestas enviadas"
          value={String(sent.length)}
          note={`${money(sent.reduce((s, q) => s + q.total, 0))} pendiente de respuesta`}
        />
        <Metric
          label="Clientes potenciales"
          value={String(
            data.clients.filter((c) => c.active && c.lifecycle === "lead")
              .length,
          )}
          note="Relaciones por convertir"
        />
      </div>
      <div className="crm-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SIGUIENTE MEJOR PASO</p>
              <h2>Que nada se enfríe</h2>
            </div>
            <button
              className="text-button"
              onClick={() => actions.navigate("pipeline")}
            >
              Ver oportunidades <Icon name="arrow" size={16} />
            </button>
          </div>
          {overdue.slice(0, 5).map((o) => (
            <button
              className="crm-action-row"
              key={o.id}
              onClick={() => actions.edit("opportunities", { ...o })}
            >
              <span
                className={`crm-action-icon ${o.due_date! < today ? "warm" : ""}`}
              >
                <Icon name="briefcase" size={19} />
              </span>
              <span>
                <strong>{o.next_action || o.title}</strong>
                <small>
                  {data.clients.find((c) => c.id === o.client)?.name} ·{" "}
                  {o.title}
                </small>
              </span>
              <span className="crm-row-end">
                <strong>{money(o.value)}</strong>
                <small className={o.due_date! < today ? "crm-overdue" : ""}>
                  {o.due_date === today ? "Hoy" : dateLabel(o.due_date!)}
                </small>
              </span>
            </button>
          ))}
          {!overdue.length && (
            <Empty
              title="Sin seguimientos vencidos"
              description="Las fechas de seguimiento de tus oportunidades aparecerán aquí."
            />
          )}
          {unscheduled.length > 0 && (
            <button
              className="crm-nudge"
              onClick={() => actions.navigate("pipeline")}
            >
              <Icon name="clock" size={17} />
              {unscheduled.length} oportunidades necesitan un próximo paso
              <Icon name="arrow" size={16} />
            </button>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">FOCO DEL EQUIPO</p>
              <h2>Próximas tareas</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Añadir tarea"
              onClick={() => actions.edit("tasks")}
            >
              <Icon name="plus" />
            </button>
          </div>
          {dueTasks.slice(0, 5).map((t) => (
            <button
              className="crm-action-row"
              key={t.id}
              onClick={() => actions.edit("tasks", { ...t })}
            >
              <span className="crm-task-mark">
                <Icon
                  name={t.priority === "high" ? "spark" : "tasks"}
                  size={17}
                />
              </span>
              <span>
                <strong>{t.title}</strong>
                <small>
                  {data.clients.find((c) => c.id === t.client)?.name ||
                    data.professionals.find((p) => p.id === t.professional)
                      ?.name ||
                    "Equipo"}
                </small>
              </span>
              <small className={t.due_date < today ? "crm-overdue" : ""}>
                {t.due_date === today ? "Hoy" : dateLabel(t.due_date)}
              </small>
            </button>
          ))}
          {!dueTasks.length && (
            <Empty
              title="Todo al día"
              description="Añade una tarea cuando tengas un nuevo compromiso."
            />
          )}
          <button
            className="crm-panel-link"
            onClick={() => actions.navigate("tasks")}
          >
            Ver todas las tareas <Icon name="arrow" size={16} />
          </button>
        </section>
      </div>
      <div className="crm-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CONTEXTO COMPARTIDO</p>
              <h2>Últimas conversaciones</h2>
            </div>
            <button
              className="text-button"
              onClick={() => actions.navigate("activities")}
            >
              Ver historial
            </button>
          </div>
          {data.activities.slice(0, 5).map((a) => (
            <button
              className="crm-action-row"
              key={a.id}
              onClick={() => {
                const c = data.clients.find((c) => c.id === a.client);
                if (c) actions.openClient(c);
              }}
            >
              <Avatar
                small
                name={
                  data.clients.find((c) => c.id === a.client)?.name || "Cliente"
                }
              />
              <span>
                <strong>{a.subject}</strong>
                <small>
                  {data.clients.find((c) => c.id === a.client)?.name} ·{" "}
                  {activityKinds[a.kind]} · {a.author}
                </small>
              </span>
              <small>
                {dateLabel(dayKey(a.occurred_at, data.business.timezone))}
              </small>
            </button>
          ))}
          {!data.activities.length && (
            <Empty
              title="El contexto empieza con una conversación"
              description="Registra llamadas, reuniones y notas para que todo el equipo esté al tanto."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TAMBIÉN HOY</p>
              <h2>Tu agenda</h2>
            </div>
            <span className="badge">{visits.length} citas</span>
          </div>
          {visits.slice(0, 4).map((a) => (
            <button
              className="crm-action-row"
              key={a.id}
              onClick={() => actions.openVisit(a)}
            >
              <strong className="crm-time">
                {hour(a.starts_at, data.business.timezone)}
              </strong>
              <span>
                <strong>{a.client_name}</strong>
                <small>
                  {a.service_name} · {a.professional_name}
                </small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
          ))}
          {!visits.length && (
            <Empty
              title="Hoy tienes espacio"
              description="Consulta la agenda para ver las próximas citas del equipo."
            />
          )}
          <button
            className="crm-panel-link"
            onClick={() => actions.navigate("agenda")}
          >
            Abrir agenda <Icon name="arrow" size={16} />
          </button>
        </section>
      </div>
    </div>
  );
}

export function Activities({ data, actions, query }: PanelProps) {
  const [kind, setKind] = useState("all");
  const rows = data.activities.filter(
    (a) =>
      (kind === "all" || a.kind === kind) &&
      normalizeSearch(
        `${a.subject} ${a.body} ${a.author} ${data.clients.find((c) => c.id === a.client)?.name}`,
      ).includes(normalizeSearch(query)),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="tabs">
          {[["all", "Todo"], ...Object.entries(activityKinds)].map(
            ([key, label]) => (
              <button
                key={key}
                className={kind === key ? "active" : ""}
                onClick={() => setKind(key)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <button
          className="button primary compact"
          onClick={() => actions.edit("activities")}
        >
          <Icon name="plus" size={16} />
          Registrar actividad
        </button>
      </div>
      <div className="crm-feed">
        {rows.map((a) => (
          <article className="crm-feed-item" key={a.id}>
            <span className="crm-action-icon">
              <Icon
                name={
                  a.kind === "email"
                    ? "mail"
                    : a.kind === "meeting"
                      ? "calendar"
                      : "edit"
                }
                size={18}
              />
            </span>
            <div>
              <div className="crm-feed-meta">
                <span>{activityKinds[a.kind]}</span>
                <time dateTime={a.occurred_at}>
                  {dateLabel(dayKey(a.occurred_at, data.business.timezone))} ·{" "}
                  {hour(a.occurred_at, data.business.timezone)}
                </time>
              </div>
              <h3>{a.subject}</h3>
              <p>{a.body}</p>
              <button
                className="text-button"
                onClick={() => {
                  const c = data.clients.find((c) => c.id === a.client);
                  if (c) actions.openClient(c);
                }}
              >
                {data.clients.find((c) => c.id === a.client)?.name}
              </button>
              <small> · Registrado por {a.author}</small>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="Todavía no hay conversaciones aquí"
          description="Registra el contexto que te gustaría recordar la próxima vez que hables con el cliente."
        />
      )}
    </section>
  );
}

export function Client360({
  client,
  data,
  actions,
}: {
  client: Client;
  data: Data;
  actions: Actions;
}) {
  const [tab, setTab] = useState("timeline");
  const deals = data.opportunities.filter((o) => o.client === client.id),
    quotes = data.quotes.filter((q) => q.client === client.id),
    tasks = data.tasks.filter((t) => t.client === client.id),
    visits = data.appointments.filter((a) => a.client === client.id);
  const paid = data.payments
    .filter((p) => visits.some((v) => v.id === p.appointment))
    .reduce((s, p) => s + p.amount, 0);
  const events = [
    ...data.activities
      .filter((a) => a.client === client.id)
      .map((a) => ({
        id: `activity-${a.id}`,
        at: a.occurred_at,
        label: activityKinds[a.kind],
        title: a.subject,
        body: a.body,
        meta: a.author,
      })),
    ...visits.map((v) => ({
      id: `visit-${v.id}`,
      at: v.starts_at,
      label: "Cita",
      title: v.service_name,
      body: statuses[v.status],
      meta: v.professional_name,
    })),
    ...quotes.map((q) => ({
      id: `quote-${q.id}`,
      at: q.updated_at,
      label: "Presupuesto",
      title: `${quoteNumber(q.number)} · ${q.title}`,
      body: `${quoteStatuses[q.status]} · ${money(q.total)}`,
      meta: "Última actualización",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="crm-client360">
      <aside className="crm-client-sidebar">
        <Avatar name={client.name} />
        <h3>{client.company || "Cliente particular"}</h3>
        <span className={`badge ${client.lifecycle}`}>
          {lifecycleLabels[client.lifecycle]}
        </span>
        <dl className="crm-contact-fields">
          <div>
            <dt>Correo</dt>
            <dd>
              {client.email ? (
                <a href={`mailto:${client.email}`}>{client.email}</a>
              ) : (
                "Sin correo"
              )}
            </dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>
              {client.phone ? (
                <a href={`tel:${client.phone.replace(/[^+\d]/g, "")}`}>
                  {client.phone}
                </a>
              ) : (
                "Sin teléfono"
              )}
            </dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>
              {data.professionals.find((p) => p.id === client.owner)?.name ||
                "Sin asignar"}
            </dd>
          </div>
          <div>
            <dt>Procedencia</dt>
            <dd>{client.source || "Sin especificar"}</dd>
          </div>
        </dl>
        <button
          className="button compact"
          onClick={() => actions.edit("clients", { ...client })}
        >
          <Icon name="edit" size={16} />
          Editar contacto
        </button>
        <h4>Contexto y preferencias</h4>
        <p className="note-box">
          {client.notes ||
            "Añade preferencias y contexto desde Editar contacto."}
        </p>
        <small>Cobrado en citas</small>
        <strong className="crm-client-value">{money(paid)}</strong>
        <small>
          Cliente desde{" "}
          {dateLabel(dayKey(client.created_at, data.business.timezone), {
            month: "long",
            year: "numeric",
          })}
        </small>
      </aside>
      <section className="crm-client-body">
        <div className="crm-toolbar">
          <button
            className="button primary compact"
            onClick={() => actions.edit("activities", { client: client.id })}
          >
            <Icon name="plus" size={16} />
            Registrar actividad
          </button>
          <button
            className="button compact"
            onClick={() => actions.edit("tasks", { client: client.id })}
          >
            Añadir tarea
          </button>
          <button
            className="button compact"
            onClick={() => actions.openQuote(undefined, client.id)}
          >
            Preparar propuesta
          </button>
        </div>
        <div className="tabs crm-detail-tabs">
          {[
            ["timeline", "Historial", events.length],
            ["deals", "Ventas", deals.length],
            ["quotes", "Presupuestos", quotes.length],
            ["tasks", "Tareas", tasks.filter((t) => !t.done).length],
          ].map(([key, label, count]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(String(key))}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        {tab === "timeline" && (
          <div className="crm-timeline">
            {events.map((e) => (
              <article key={e.id}>
                <div className="crm-feed-meta">
                  <span>{e.label}</span>
                  <time dateTime={e.at}>
                    {dateLabel(dayKey(e.at, data.business.timezone))} ·{" "}
                    {hour(e.at, data.business.timezone)}
                  </time>
                </div>
                <h3>{e.title}</h3>
                {e.body && <p>{e.body}</p>}
                <small>{e.meta}</small>
              </article>
            ))}
            {!events.length && (
              <Empty
                title="Una relación por construir"
                description="Añade la primera conversación para empezar su historial."
              />
            )}
          </div>
        )}
        {tab === "deals" && (
          <>
            <button
              className="crm-panel-link"
              onClick={() =>
                actions.edit("opportunities", { client: client.id })
              }
            >
              Añadir oportunidad <Icon name="plus" size={16} />
            </button>
            {deals.map((o) => (
              <button
                className="crm-action-row"
                key={o.id}
                onClick={() => actions.edit("opportunities", { ...o })}
              >
                <span>
                  <strong>{o.title}</strong>
                  <small>
                    {stages[o.stage]} · {o.next_action || "Sin próximo paso"}
                  </small>
                </span>
                <strong>{money(o.value)}</strong>
              </button>
            ))}
            {!deals.length && (
              <Empty
                title="Sin oportunidades todavía"
                description="Registra qué necesita el cliente y cómo puedes ayudarle."
              />
            )}
          </>
        )}
        {tab === "quotes" && (
          <>
            {quotes.map((q) => (
              <button
                className="crm-action-row"
                key={q.id}
                onClick={() => actions.openQuote(q)}
              >
                <span>
                  <strong>
                    {quoteNumber(q.number)} · {q.title}
                  </strong>
                  <small>
                    {quoteStatuses[q.status]} · Válido hasta{" "}
                    {dateLabel(q.valid_until)}
                  </small>
                </span>
                <strong>{money(q.total)}</strong>
              </button>
            ))}
            {!quotes.length && (
              <Empty
                title="Sin propuestas todavía"
                description="Prepara un presupuesto con el alcance y las condiciones."
              />
            )}
          </>
        )}
        {tab === "tasks" && (
          <>
            {tasks.map((t) => (
              <button
                className="crm-action-row"
                key={t.id}
                onClick={() => actions.edit("tasks", { ...t })}
              >
                <Icon name={t.done ? "check" : "tasks"} size={18} />
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.done
                      ? "Completada"
                      : `Pendiente · ${dateLabel(t.due_date)}`}
                  </small>
                </span>
              </button>
            ))}
            {!tasks.length && (
              <Empty
                title="Sin compromisos pendientes"
                description="Añade una tarea para que el próximo paso tenga fecha y responsable."
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export function GlobalSearch({
  data,
  actions,
  onClose,
}: {
  data: Data;
  actions: Actions;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const term = normalizeSearch(query);
  const all = [
    ...data.clients.map((c) => ({
      key: `c${c.id}`,
      label: c.name,
      meta: `Contacto · ${[c.company, c.email, c.phone].filter(Boolean).join(" · ") || lifecycleLabels[c.lifecycle]}${c.active ? "" : " · Archivado"}`,
      icon: "users",
      run: () => actions.openClient(c),
    })),
    ...data.opportunities.map((o) => ({
      key: `o${o.id}`,
      label: o.title,
      meta: `Oportunidad · ${data.clients.find((c) => c.id === o.client)?.name} · ${stages[o.stage]}`,
      icon: "briefcase",
      run: () => actions.edit("opportunities", { ...o }),
    })),
    ...data.quotes.map((q) => ({
      key: `q${q.id}`,
      label: `${quoteNumber(q.number)} · ${q.title}`,
      meta: `Presupuesto · ${data.clients.find((c) => c.id === q.client)?.name}`,
      icon: "wallet",
      run: () => actions.openQuote(q),
    })),
    ...data.tasks
      .filter((t) => !t.done)
      .map((t) => ({
        key: `t${t.id}`,
        label: t.title,
        meta: `Tarea · ${data.clients.find((c) => c.id === t.client)?.name || dateLabel(t.due_date)}`,
        icon: "tasks",
        run: () => actions.edit("tasks", { ...t }),
      })),
  ];
  const results = term
    ? all
        .filter((r) => normalizeSearch(`${r.label} ${r.meta}`).includes(term))
        .slice(0, 20)
    : [];
  return (
    <div className="crm-global-search">
      <label className="search-field">
        <Icon name="search" size={20} />
        <input
          ref={input}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, empresa, oportunidad, presupuesto…"
          aria-label="Buscar en todo Nexo"
        />
      </label>
      <p className="hint" role="status">
        {term
          ? `${results.length}${results.length === 20 ? " primeros" : ""} resultados. Tab para recorrerlos; Enter para abrir.`
          : "Encuentra contactos, oportunidades, presupuestos y tareas en un solo lugar."}
      </p>
      {results.map((r) => (
        <button
          className="crm-action-row"
          key={r.key}
          onClick={() => {
            onClose();
            r.run();
          }}
        >
          <Icon name={r.icon} size={19} />
          <span>
            <strong>{r.label}</strong>
            <small>{r.meta}</small>
          </span>
          <Icon name="arrow" size={16} />
        </button>
      ))}
      {term && !results.length && (
        <Empty
          title="No encontramos coincidencias"
          description="Prueba con parte del nombre, la empresa o el número de presupuesto."
        />
      )}
      {!term && (
        <div className="crm-search-shortcuts">
          {[
            ["clients", "Contactos", "users"],
            ["pipeline", "Oportunidades", "briefcase"],
            ["quotes", "Presupuestos", "wallet"],
            ["tasks", "Tareas", "tasks"],
          ].map(([id, label, icon]) => (
            <button
              className="button"
              key={id}
              onClick={() => {
                onClose();
                actions.navigate(id);
              }}
            >
              <Icon name={icon} size={18} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function CommercialReport({ data }: { data: Data }) {
  const open = data.opportunities.filter(
    (o) => !["won", "lost"].includes(o.stage),
  );
  const won = data.opportunities.filter((o) => o.stage === "won"),
    lost = data.opportunities.filter((o) => o.stage === "lost");
  const owners = [
    { id: null, name: "Sin asignar" },
    ...data.professionals,
  ].filter((p) => data.opportunities.some((o) => o.owner === p.id));
  const sources = Object.entries(
    data.clients
      .filter((c) => c.active)
      .reduce<Record<string, number>>((all, c) => {
        const key = c.source.trim() || "Sin especificar";
        all[key] = (all[key] || 0) + 1;
        return all;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
  return (
    <section className="crm-commercial-report">
      <div className="crm-report-heading">
        <p className="eyebrow">PULSO COMERCIAL</p>
        <h2>De conversaciones a oportunidades</h2>
        <p className="hint">
          Estado actual de toda la cartera. Los filtros de fechas inferiores se
          aplican a citas y cobros.
        </p>
      </div>
      <div className="crm-metrics four">
        <Metric
          label="Cartera abierta"
          value={money(open.reduce((s, o) => s + o.value, 0))}
          note={`${open.length} oportunidades activas`}
        />
        <Metric
          label="Previsión ponderada"
          value={money(open.reduce((s, o) => s + weightedValue(o), 0))}
          note="Estimación, no ingresos realizados"
        />
        <Metric
          label="Tasa de éxito"
          value={
            won.length + lost.length
              ? `${Math.round((100 * won.length) / (won.length + lost.length))}%`
              : "—"
          }
          note={`${won.length} ganadas / ${won.length + lost.length} cerradas`}
        />
        <Metric
          label="Valor ganado"
          value={money(won.reduce((s, o) => s + o.value, 0))}
          note="Acumulado comercial, no cobrado"
        />
      </div>
      <div className="crm-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>Cartera por responsable</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Abiertas</th>
                  <th>Previsión</th>
                  <th>Ganadas</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((p) => (
                  <tr key={p.id ?? "none"}>
                    <td>{p.name}</td>
                    <td>{open.filter((o) => o.owner === p.id).length}</td>
                    <td>
                      {money(
                        open
                          .filter((o) => o.owner === p.id)
                          .reduce((s, o) => s + weightedValue(o), 0),
                      )}
                    </td>
                    <td>{won.filter((o) => o.owner === p.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!owners.length && (
            <Empty
              title="Sin oportunidades registradas"
              description="Crea una oportunidad y asígnale un responsable."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>De dónde llegan tus contactos</h2>
          </div>
          <div className="crm-source-list">
            {sources.map(([source, count]) => (
              <div key={source}>
                <div>
                  <span>{source}</span>
                  <strong>{count}</strong>
                </div>
                <progress
                  value={count}
                  max={data.clients.filter((c) => c.active).length}
                  aria-label={`${source}: ${count} contactos`}
                />
              </div>
            ))}
          </div>
          {!sources.length && (
            <Empty
              title="Aún no hay contactos"
              description="La procedencia ayuda a entender qué canales funcionan."
            />
          )}
        </section>
      </div>
    </section>
  );
}
