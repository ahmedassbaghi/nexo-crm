"use client";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import { type Data, dayKey, money, stages } from "../lib/types";
import { ErrorBox, Icon } from "./ui";
export type EditKind =
  | "activities"
  | "clients"
  | "services"
  | "professionals"
  | "resources"
  | "opportunities"
  | "tasks"
  | "payments"
  | "blocks"
  | "users";
export type EditRecord = Record<string, unknown>;
export const editLabels: Record<EditKind, string> = {
  activities: "actividad",
  clients: "cliente",
  services: "servicio",
  professionals: "profesional",
  resources: "recurso",
  opportunities: "oportunidad",
  tasks: "tarea",
  payments: "cobro",
  blocks: "bloqueo",
  users: "usuario",
};
export default function Editor({
  kind,
  record,
  data,
  onSaved,
  onClose,
}: {
  kind: EditKind;
  record?: EditRecord;
  data: Data;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visitId, setVisitId] = useState(Number(record?.appointment) || 0);
  const requestKey = useRef(""),
    working = useRef(false);
  const today = dayKey(new Date(), data.business.timezone);
  function value(name: string, fallback: string | number = "") {
    return String(record?.[name] ?? fallback);
  }
  function field(
    name: string,
    label: string,
    type = "text",
    required = false,
    fallback: string | number = "",
  ) {
    return (
      <label key={name}>
        {label}
        <input
          name={name}
          type={type}
          defaultValue={value(name, fallback)}
          required={required}
          maxLength={name === "name" ? 120 : 160}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "1" : undefined}
        />
      </label>
    );
  }
  function clientSelect(required = false) {
    return (
      <label>
        Cliente
        <select
          name="client"
          defaultValue={value("client")}
          required={required}
        >
          <option value="">
            {required ? "Selecciona un cliente" : "Sin cliente asociado"}
          </option>
          {data.clients
            .filter((c) => c.active || c.id === record?.client)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
    );
  }
  function ownerSelect() {
    return (
      <label>
        Responsable
        <select name="owner" defaultValue={value("owner")}>
          <option value="">Sin asignar</option>
          {data.professionals
            .filter((p) => p.active || p.id === record?.owner)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
    );
  }
  function personSelect() {
    return (
      <label>
        Responsable
        <select name="professional" defaultValue={value("professional")}>
          <option value="">Sin asignar</option>
          {data.professionals
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget),
      body: Record<string, unknown> = {};
    for (const [key, val] of form.entries()) body[key] = val;
    for (const key of ["client", "professional", "appointment", "owner"])
      if (key in body) body[key] = body[key] ? Number(body[key]) : null;
    for (const key of ["price", "value", "amount"])
      if (key in body) body[key] = Math.round(Number(body[key]) * 100);
    if ("probability" in body) body.probability = Number(body.probability);
    if (kind === "opportunities" && !body.expected_close)
      body.expected_close = null;
    if (kind === "activities")
      body.occurred_at = new Date(String(body.occurred_at)).toISOString();
    if ("duration" in body) body.duration = Number(body.duration);
    if (kind === "professionals")
      body.services = form.getAll("services").map(Number);
    if (["clients", "services", "professionals", "resources"].includes(kind))
      body.active = form.has("active");
    if (kind === "tasks") body.done = form.has("done");
    if (kind === "opportunities" && !body.due_date) body.due_date = null;
    if (kind === "payments") {
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      body.request_key = requestKey.current;
      body.paid_at = new Date().toISOString();
    }
    // datetime-local fields are submitted in the configured business timezone by the server endpoint below.
    if (kind === "blocks") {
      body.starts_local = body.starts_at;
      body.ends_local = body.ends_at;
      delete body.starts_at;
      delete body.ends_at;
    }
    try {
      await api(
        `${kind}/${record?.id ? `${record.id}/` : ""}`,
        record?.id ? "PATCH" : "POST",
        body,
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const chosen = data.appointments.find((a) => a.id === visitId);
  return (
    <form onSubmit={submit}>
      <ErrorBox error={error} />
      <div className="form-grid">
        {kind === "clients" && (
          <>
            {field("name", "Nombre completo", "text", true)}
            {field("company", "Empresa / negocio")}
            <label>
              Ciclo comercial
              <select
                name="lifecycle"
                defaultValue={value("lifecycle", "lead")}
              >
                <option value="lead">Cliente potencial</option>
                <option value="customer">Cliente</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
            {ownerSelect()}
            {field("source", "Procedencia", "text", false, "")}
            {field("email", "Correo electrónico", "email")}
            {field("phone", "Teléfono", "tel")}
            <label>
              Relación
              <select name="tag" defaultValue={value("tag", "nuevo")}>
                <option value="nuevo">Nuevo</option>
                <option value="habitual">Habitual</option>
                <option value="vip">VIP</option>
              </select>
            </label>
            <label className="span-2">
              Notas internas
              <textarea
                name="notes"
                maxLength={5000}
                defaultValue={value("notes")}
                placeholder="Preferencias, contexto y próximos pasos…"
              />
            </label>
          </>
        )}
        {kind === "activities" && (
          <>
            {clientSelect(true)}
            <label>
              Tipo
              <select name="kind" defaultValue={value("kind", "note")}>
                <option value="note">Nota</option>
                <option value="call">Llamada</option>
                <option value="email">Correo</option>
                <option value="meeting">Reunión</option>
              </select>
            </label>
            {field("subject", "Asunto", "text", true)}
            {field(
              "occurred_at",
              "Cuándo ocurrió (hora de este dispositivo)",
              "datetime-local",
              true,
              new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16),
            )}
            <label className="span-2">
              Detalle
              <textarea
                name="body"
                maxLength={5000}
                defaultValue={value("body")}
              />
            </label>
            <p className="hint span-2">
              Registra una conversación ya realizada. No se enviará ningún
              correo ni mensaje.
            </p>
          </>
        )}
        {kind === "services" && (
          <>
            {field("name", "Nombre del servicio", "text", true)}
            <label>
              Precio (€)
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={Number(record?.price || 0) / 100}
              />
            </label>
            <label>
              Duración (minutos)
              <input
                name="duration"
                type="number"
                min="15"
                max="480"
                step="15"
                required
                defaultValue={value("duration", 60)}
              />
            </label>
            <label>
              Color en agenda
              <select name="color" defaultValue={value("color", "mint")}>
                <option value="mint">Verde salvia</option>
                <option value="blue">Azul</option>
                <option value="lavender">Lavanda</option>
                <option value="peach">Melocotón</option>
              </select>
            </label>
            <label className="span-2">
              Descripción
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={value("description")}
              />
            </label>
          </>
        )}
        {kind === "professionals" && (
          <>
            {field("name", "Nombre", "text", true)}
            {field("title", "Especialidad / puesto")}
            <fieldset className="span-2">
              <legend>Servicios que puede realizar</legend>
              {data.services
                .filter((s) => s.active)
                .map((s) => (
                  <label className="check-label" key={s.id}>
                    <input
                      type="checkbox"
                      name="services"
                      value={s.id}
                      defaultChecked={(
                        record?.services as number[] | undefined
                      )?.includes(s.id)}
                    />{" "}
                    {s.name}
                  </label>
                ))}
            </fieldset>
          </>
        )}
        {kind === "resources" &&
          field("name", "Nombre del recurso", "text", true)}
        {kind === "opportunities" && (
          <>
            {field("title", "Nombre de la oportunidad", "text", true)}
            {clientSelect(true)}
            <label>
              Valor estimado (€)
              <input
                name="value"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={Number(record?.value || 0) / 100}
              />
            </label>
            <label>
              Etapa
              <select name="stage" defaultValue={value("stage", "new")}>
                {Object.entries(stages).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {ownerSelect()}
            <label>
              Probabilidad (%)
              <input
                name="probability"
                type="number"
                min="0"
                max="100"
                step="1"
                required
                defaultValue={value("probability", 50)}
              />
            </label>
            {field("expected_close", "Cierre previsto", "date")}
            {field("lost_reason", "Motivo de pérdida (si corresponde)")}
            {field("next_action", "Próxima acción")}
            {field("due_date", "Fecha de seguimiento", "date")}
          </>
        )}
        {kind === "tasks" && (
          <>
            {field("title", "Qué hay que hacer", "text", true)}
            {field("due_date", "Fecha límite", "date", true, today)}
            {clientSelect()}
            {personSelect()}
            <label>
              Prioridad
              <select
                name="priority"
                defaultValue={value("priority", "normal")}
              >
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="done"
                defaultChecked={Boolean(record?.done)}
              />
              Tarea completada
            </label>
          </>
        )}
        {kind === "payments" && (
          <>
            <label className="span-2">
              Cita a cobrar
              <select
                name="appointment"
                value={visitId || ""}
                onChange={(e) => setVisitId(+e.target.value)}
                required
              >
                <option value="">
                  Selecciona una cita con saldo pendiente
                </option>
                {data.appointments
                  .filter(
                    (a) =>
                      a.price > a.paid &&
                      !["cancelled", "no_show"].includes(a.status),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.client_name} · {a.service_name} · pendiente{" "}
                      {money(a.price - a.paid)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Importe (€)
              <input
                key={visitId}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={chosen ? (chosen.price - chosen.paid) / 100 : undefined}
                defaultValue={chosen ? (chosen.price - chosen.paid) / 100 : ""}
                required
              />
            </label>
            <label>
              Método
              <select name="method">
                <option value="card">Tarjeta</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </label>
            {field("reference", "Referencia (opcional)")}
            <p className="hint span-2">
              Registro de un cobro ya realizado. No carga tarjetas ni genera una
              factura fiscal. Una vez guardado, el registro no se puede editar.
            </p>
          </>
        )}
        {kind === "blocks" && (
          <>
            {field("reason", "Motivo", "text", true)}
            {personSelect()}
            {field("starts_at", "Inicio", "datetime-local", true)}
            {field("ends_at", "Fin", "datetime-local", true)}
            <p className="hint span-2">
              Zona horaria: {data.business.timezone}. Sin responsable, bloquea
              toda la agenda. Las citas existentes deben reprogramarse antes.
            </p>
          </>
        )}
        {kind === "users" && (
          <>
            {field("name", "Nombre", "text", true)}
            {field("username", "Usuario de acceso", "text", true)}
            {field("password", "Contraseña inicial", "password", true)}
            <label>
              Permisos
              <select name="role">
                <option value="staff">Equipo · gestión diaria</option>
                <option value="admin">Administrador · acceso completo</option>
              </select>
            </label>
            <p className="hint span-2">
              Al menos 10 caracteres. El usuario puede cambiar su contraseña en
              Configuración.
            </p>
          </>
        )}
        {["clients", "services", "professionals", "resources"].includes(
          kind,
        ) && (
          <label className="check-label span-2">
            <input
              name="active"
              type="checkbox"
              defaultChecked={record?.active !== false}
            />
            Activo · desmarca para archivar y conservar el historial
          </label>
        )}
      </div>
      <div className="form-footer">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          {busy
            ? "Guardando…"
            : record?.id
              ? "Guardar cambios"
              : `Crear ${editLabels[kind]}`}
          <Icon name="check" />
        </button>
      </div>
    </form>
  );
}
