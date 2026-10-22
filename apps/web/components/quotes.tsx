"use client";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import {
  type Data,
  type Quote,
  type QuoteItem,
  addDays,
  dayKey,
  dateLabel,
  money,
  normalizeSearch,
  quoteNumber,
  quoteStatuses,
} from "../lib/types";
import type { PanelProps } from "./workspace";
import { Empty, ErrorBox, Icon } from "./ui";

export function Quotes({ data, actions, query }: PanelProps) {
  const [status, setStatus] = useState("all");
  const today = dayKey(new Date(), data.business.timezone);
  const rows = data.quotes.filter(
    (q) =>
      (status === "all" ||
        (status === "overdue"
          ? q.status === "sent" && q.valid_until < today
          : q.status === status)) &&
      normalizeSearch(
        `${q.title} ${quoteNumber(q.number)} ${data.clients.find((c) => c.id === q.client)?.name}`,
      ).includes(normalizeSearch(query)),
  );
  return (
    <>
      <div className="crm-metrics">
        <Metric
          label="Pendientes de respuesta"
          value={money(
            data.quotes
              .filter((q) => q.status === "sent")
              .reduce((s, q) => s + q.total, 0),
          )}
          note="Importe propuesto, no cobrado"
        />
        <Metric
          label="Aceptados"
          value={money(
            data.quotes
              .filter((q) => q.status === "accepted")
              .reduce((s, q) => s + q.total, 0),
          )}
          note="Acumulado · impuestos incluidos"
        />
        <Metric
          label="Por preparar"
          value={String(data.quotes.filter((q) => q.status === "draft").length)}
          note="Borradores de propuestas"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div className="tabs">
            {[
              ["all", "Todos"],
              ["draft", "Borradores"],
              ["sent", "Enviados"],
              ["accepted", "Aceptados"],
              ["overdue", "Vencidos"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={status === key ? "active" : ""}
                onClick={() => setStatus(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="button primary compact"
            onClick={() => actions.openQuote()}
          >
            <Icon name="plus" size={16} />
            Nuevo presupuesto
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Presupuesto</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Validez</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => actions.openQuote(q)}
                    >
                      {quoteNumber(q.number)}
                    </button>
                    <small className="crm-subline">{q.title}</small>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        const c = data.clients.find((c) => c.id === q.client);
                        if (c) actions.openClient(c);
                      }}
                    >
                      {data.clients.find((c) => c.id === q.client)?.name}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${q.status}`}>
                      {quoteStatuses[q.status]}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        q.status === "sent" && q.valid_until < today
                          ? "crm-overdue"
                          : ""
                      }
                    >
                      {dateLabel(q.valid_until)}
                    </span>
                  </td>
                  <td>
                    <strong>{money(q.total)}</strong>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Abrir ${quoteNumber(q.number)}`}
                      onClick={() => actions.openQuote(q)}
                    >
                      <Icon name="arrow" size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="Tu próxima propuesta empieza aquí"
            description="Prepara un presupuesto claro y sigue su evolución hasta la aceptación."
          />
        )}
      </section>
    </>
  );
}
export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="crm-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export function QuoteDialog({
  data,
  quote,
  clientId,
  onSaved,
  onClose,
}: {
  data: Data;
  quote?: Quote;
  clientId?: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(!quote);
  const [copy, setCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const working = useRef(false);
  if (editing)
    return (
      <QuoteForm
        data={data}
        quote={copy ? undefined : quote}
        template={copy ? quote : undefined}
        clientId={clientId}
        onSaved={onSaved}
        onClose={onClose}
      />
    );
  if (!quote) return null;
  const client = data.clients.find((c) => c.id === quote.client);
  const sender = quote.status === "draft" ? data.business : quote.sender;
  const recipient = quote.status === "draft" ? client : quote.recipient;
  async function transition(status: string) {
    if (!quote || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`quotes/${quote.id}/`, "PATCH", {
        status,
        version: quote.version,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      working.current = false;
    }
  }
  return (
    <div className="quote-view">
      <div className="no-print">
        <ErrorBox error={error} />
        <div className="crm-toolbar">
          <span className={`badge ${quote.status}`}>
            {quoteStatuses[quote.status]}
          </span>
          <button className="button compact" onClick={() => window.print()}>
            <Icon name="download" size={16} />
            Imprimir / PDF
          </button>
          <button
            className="button compact"
            onClick={() => {
              setCopy(true);
              setEditing(true);
            }}
          >
            Duplicar
          </button>
          {quote.status === "draft" && (
            <button className="button compact" onClick={() => setEditing(true)}>
              Editar borrador
            </button>
          )}
        </div>
      </div>
      <article className="quote-document">
        <header>
          <div>
            <p className="eyebrow">PROPUESTA COMERCIAL</p>
            <h2>{sender.name}</h2>
            <p>{sender.address}</p>
            <p>
              {sender.email} {sender.phone && `· ${sender.phone}`}
            </p>
          </div>
          <div className="quote-reference">
            <strong>{quoteNumber(quote.number)}</strong>
            <p>
              {quote.status === "draft"
                ? "BORRADOR"
                : quoteStatuses[quote.status]}
            </p>
            <p>
              {quote.issued_at ? "Emitido" : "Creado"}:{" "}
              {dateLabel(
                dayKey(
                  quote.issued_at || quote.created_at,
                  data.business.timezone,
                ),
              )}
            </p>
            <p>
              Válido hasta:{" "}
              {dateLabel(quote.valid_until, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </header>
        <div className="quote-recipient">
          <small>PREPARADO PARA</small>
          <h3>{recipient?.name}</h3>
          <p>{recipient?.company}</p>
          <p>
            {recipient?.email} {recipient?.phone && `· ${recipient.phone}`}
          </p>
        </div>
        <h2>{quote.title}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td>{Number(item.quantity).toLocaleString("es-ES")}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>{money(item.total || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="quote-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(quote.subtotal)}</dd>
          </div>
          {quote.discount > 0 && (
            <div>
              <dt>Descuento ({quote.discount_percent}%)</dt>
              <dd>−{money(quote.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Impuestos ({quote.tax_percent}%)</dt>
            <dd>{money(quote.tax)}</dd>
          </div>
          <div className="quote-grand-total">
            <dt>Total</dt>
            <dd>{money(quote.total)}</dd>
          </div>
        </dl>
        {quote.notes && (
          <div className="quote-conditions">
            <h4>Condiciones y observaciones</h4>
            <p>{quote.notes}</p>
          </div>
        )}
        <footer>Presupuesto comercial · No es una factura</footer>
      </article>
      <div className="no-print">
        {confirm ? (
          <div className="crm-confirm">
            <p>
              {confirm === "sent"
                ? "Confirma que has enviado esta propuesta por tu canal habitual. El contenido quedará bloqueado y Nexo guardará una copia de los datos actuales del emisor y del cliente."
                : `Vas a registrar el presupuesto como ${quoteStatuses[confirm].toLowerCase()}. Este estado será definitivo.`}
            </p>
            <div className="button-group">
              <button
                disabled={busy}
                className="button"
                onClick={() => setConfirm("")}
              >
                Volver
              </button>
              <button
                disabled={busy}
                className="button primary"
                onClick={() => void transition(confirm)}
              >
                {busy ? "Guardando…" : "Confirmar estado"}
              </button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <button className="button" onClick={onClose}>
              Cerrar
            </button>
            {quote.status === "draft" && (
              <button
                className="button primary"
                onClick={() => setConfirm("sent")}
              >
                Registrar como enviado
              </button>
            )}
            {quote.status === "sent" && (
              <>
                <button
                  className="button"
                  onClick={() => setConfirm("rejected")}
                >
                  Rechazado
                </button>
                {quote.valid_until <
                dayKey(new Date(), data.business.timezone) ? (
                  <button
                    className="button primary"
                    onClick={() => setConfirm("expired")}
                  >
                    Marcar caducado
                  </button>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => setConfirm("accepted")}
                  >
                    Registrar aceptación
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function QuoteForm({
  data,
  quote,
  template,
  clientId,
  onSaved,
  onClose,
}: {
  data: Data;
  quote?: Quote;
  template?: Quote;
  clientId?: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const initial = quote || template;
  const [items, setItems] = useState<QuoteItem[]>(
    initial?.items.map((i) => ({ ...i })) || [
      { description: "", quantity: "1", unit_price: 0 },
    ],
  );
  const [discount, setDiscount] = useState(initial?.discount_percent || 0),
    [tax, setTax] = useState(initial?.tax_percent ?? 21),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const working = useRef(false),
    requestKey = useRef("");
  const subtotal = items.reduce(
      (s, i) => s + Math.round(Number(i.quantity) * i.unit_price),
      0,
    ),
    discountAmount = Math.round((subtotal * discount) / 100),
    taxAmount = Math.round(((subtotal - discountAmount) * tax) / 100);
  const update = (
    index: number,
    key: keyof QuoteItem,
    value: string | number,
  ) =>
    setItems(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      await api(
        `quotes/${quote ? `${quote.id}/` : ""}`,
        quote ? "PATCH" : "POST",
        {
          client: Number(form.get("client")),
          title: form.get("title"),
          valid_until: form.get("valid_until"),
          notes: form.get("notes"),
          items,
          discount_percent: discount,
          tax_percent: tax,
          ...(quote
            ? { version: quote.version }
            : { request_key: requestKey.current }),
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      working.current = false;
    }
  }
  return (
    <form onSubmit={submit}>
      <ErrorBox error={error} />
      <div className="form-grid">
        <label>
          Cliente
          <select
            name="client"
            required
            defaultValue={initial?.client || clientId || ""}
          >
            <option value="">Selecciona un cliente</option>
            {data.clients
              .filter((c) => c.active || c.id === initial?.client)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` · ${c.company}` : ""}
                </option>
              ))}
          </select>
        </label>
        <label>
          Válido hasta
          <input
            name="valid_until"
            type="date"
            required
            defaultValue={
              quote?.valid_until ||
              addDays(dayKey(new Date(), data.business.timezone), 30)
            }
          />
        </label>
        <label className="span-2">
          Título de la propuesta
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={initial?.title || ""}
            placeholder="Por ejemplo: mantenimiento trimestral"
          />
        </label>
      </div>
      <div className="quote-lines">
        {items.map((item, i) => (
          <div className="quote-line" key={i}>
            <label>
              Concepto {i + 1}
              <input
                aria-label={`Concepto ${i + 1}`}
                required
                maxLength={240}
                value={item.description}
                onChange={(e) => update(i, "description", e.target.value)}
              />
            </label>
            <label>
              Cantidad
              <input
                aria-label={`Cantidad ${i + 1}`}
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                required
                value={item.quantity}
                onChange={(e) => update(i, "quantity", e.target.value)}
              />
            </label>
            <label>
              Precio (€)
              <input
                aria-label={`Precio ${i + 1}`}
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={item.unit_price / 100}
                onChange={(e) =>
                  update(
                    i,
                    "unit_price",
                    Math.round(Number(e.target.value) * 100),
                  )
                }
              />
            </label>
            <strong>
              {money(Math.round(Number(item.quantity) * item.unit_price))}
            </strong>
            <button
              type="button"
              className="icon-button"
              disabled={items.length === 1}
              aria-label={`Eliminar concepto ${i + 1}`}
              onClick={() => setItems(items.filter((_, n) => n !== i))}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="button compact"
        disabled={items.length >= 100}
        onClick={() =>
          setItems([
            ...items,
            { description: "", quantity: "1", unit_price: 0 },
          ])
        }
      >
        <Icon name="plus" size={16} />
        Añadir concepto
      </button>
      <div className="form-grid quote-options">
        <label>
          Descuento (%)
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            required
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </label>
        <label>
          Impuestos (%)
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            required
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
          />
        </label>
        <label className="span-2">
          Condiciones y observaciones
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={initial?.notes || ""}
            placeholder="Alcance, plazos de entrega, condiciones de pago…"
          />
        </label>
      </div>
      <div className="quote-estimate">
        <span>Total estimado · incluye {money(taxAmount)} de impuestos</span>
        <strong>{money(subtotal - discountAmount + taxAmount)}</strong>
      </div>
      <p className="hint">
        Los importes definitivos se calculan al guardar. Podrás revisar,
        imprimir y registrar el envío desde el presupuesto.
      </p>
      <div className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? "Guardando…" : "Guardar borrador"}
        </button>
      </div>
    </form>
  );
}
