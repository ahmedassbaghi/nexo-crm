"use client";
import { useCallback, useEffect, useState } from "react";
import { api, setCsrf } from "../lib/api";
import {
  type Data,
  type User,
  type Business,
  type Appointment,
  type Client,
  type Quote,
  dayKey,
  dateLabel,
  hour,
  money,
  statuses,
} from "../lib/types";
import { Icon, Avatar, Modal, ErrorBox } from "./ui";
import Booking from "./booking";
import Editor, { type EditKind, type EditRecord, editLabels } from "./editor";
import { CRMHome, Activities, Client360, GlobalSearch } from "./crm-panels";
import { Quotes, QuoteDialog } from "./quotes";
import { Agenda } from "./schedule-panels";
import {
  Clients,
  Pipeline,
  Tasks,
  Payments,
  Services,
  Team,
  Reports,
  Settings,
} from "./business-panels";

const pages = [
  { id: "overview", label: "Vista general", icon: "grid" },
  { id: "clients", label: "Contactos", icon: "users" },
  { id: "pipeline", label: "Oportunidades", icon: "briefcase" },
  { id: "quotes", label: "Presupuestos", icon: "wallet" },
  { id: "activities", label: "Conversaciones", icon: "mail" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "tasks", label: "Tareas", icon: "tasks" },
  { id: "payments", label: "Cobros", icon: "wallet" },
  { id: "reports", label: "Informes", icon: "chart" },
  { id: "services", label: "Servicios", icon: "spark" },
  { id: "team", label: "Equipo y recursos", icon: "users" },
  { id: "settings", label: "Configuración", icon: "settings" },
];
const subtitles: Record<string, string> = {
  quotes: "Propuestas claras. Seguimiento hasta la decisión.",
  activities: "Cada conversación suma contexto a la relación.",
  overview: "Todo lo que importa para que tu negocio avance.",
  agenda: "Cada cita en su sitio. Cada cliente bien atendido.",
  clients: "Conoce mejor a quienes confían en tu negocio.",
  pipeline: "De una primera conversación a una relación duradera.",
  tasks: "Los pequeños pasos que hacen avanzar tu negocio.",
  payments: "Control de cobros, con las cuentas claras.",
  reports: "Una mirada a la actividad real de tu negocio.",
  services: "Tu experiencia, convertida en servicios.",
  team: "Las personas y los espacios que lo hacen posible.",
  settings: "Un espacio de trabajo a la medida de tu negocio.",
};
export type Actions = {
  edit: (kind: EditKind, record?: EditRecord) => void;
  mutate: (path: string, method: string, body?: unknown) => Promise<void>;
  openVisit: (a: Appointment) => void;
  openClient: (c: Client) => void;
  openQuote: (quote?: Quote, clientId?: number) => void;
  book: () => void;
  navigate: (page: string) => void;
};
export type PanelProps = {
  data: Data;
  user: User;
  actions: Actions;
  query: string;
};

export default function Workspace() {
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState("overview"),
    [query, setQuery] = useState(""),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [quoteDialog, setQuoteDialog] = useState<{
    quote?: Quote;
    clientId?: number;
  } | null>(null);
  const [editor, setEditor] = useState<{
      kind: EditKind;
      record?: EditRecord;
    } | null>(null),
    [booking, setBooking] = useState<{ visit?: Appointment } | null>(null),
    [visit, setVisit] = useState<Appointment | null>(null),
    [client, setClient] = useState<Client | null>(null),
    [actionBusy, setActionBusy] = useState(false),
    [confirmCancel, setConfirmCancel] = useState(false);
  const refresh = useCallback(async () => {
    const next = await api<Data>("bootstrap/");
    setData(next);
  }, []);
  const initialize = useCallback(async () => {
    setError("");
    try {
      const session = await api<{
        csrf: string;
        user: User | null;
        business?: Business;
      }>("session/");
      setCsrf(session.csrf);
      setUser(session.user);
      if (session.user) await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (pages.some((p) => p.id === hash)) setPage(hash);
    const handler = () => {
      const id = window.location.hash.slice(1);
      if (pages.some((p) => p.id === id)) {
        setPage(id);
        setQuery("");
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(next: string) {
    setPage(next);
    setQuery("");
    setMenu(false);
    window.location.hash = next;
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  async function saved() {
    setQuoteDialog(null);
    setEditor(null);
    setBooking(null);
    setClient(null);
    setVisit(null);
    try {
      await refresh();
      setToast("Cambios guardados correctamente");
    } catch (e) {
      setError(
        "Los cambios se guardaron, pero no pudimos actualizar la pantalla. Pulsa Actualizar.",
      );
    }
  }
  async function mutate(path: string, method: string, body?: unknown) {
    setError("");
    try {
      await api(path, method, body);
      await refresh();
      setToast("Cambios guardados correctamente");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  const actions: Actions = {
    edit: (kind, record) => {
      setClient(null);
      setEditor({ kind, record });
    },
    openQuote: (quote, clientId) => {
      setClient(null);
      setQuoteDialog({ quote, clientId });
    },
    mutate,
    openVisit: (a) => {
      setVisit(a);
      setConfirmCancel(false);
    },
    openClient: setClient,
    book: () => setBooking({}),
    navigate,
  };
  if (loading)
    return (
      <main className="boot">
        <div className="brand-mark">n</div>
        <h1>Preparando tu espacio</h1>
        <p>Conectando agenda, clientes y equipo…</p>
      </main>
    );
  if (!user) return <Login error={error} onLoggedIn={initialize} />;
  if (!data)
    return (
      <main className="boot">
        <ErrorBox error={error} />
        <button className="button primary" onClick={() => void initialize()}>
          Reintentar conexión
        </button>
      </main>
    );
  const props = { data, user, actions, query },
    current = pages.find((p) => p.id === page)!;
  const today = dayKey(new Date(), data.business.timezone),
    due = data.tasks.filter((t) => !t.done && t.due_date <= today).length;
  const latestVisit = visit
    ? data.appointments.find((a) => a.id === visit.id) || visit
    : null;
  async function changeStatus(status: string) {
    if (!latestVisit) return;
    setActionBusy(true);
    try {
      await mutate(`appointments/${latestVisit.id}/`, "PATCH", {
        status,
        version: latestVisit.version,
      });
      setVisit(null);
    } catch {
    } finally {
      setActionBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          href="#overview"
          className="brand"
          onClick={() => navigate("overview")}
        >
          <span className="brand-mark">n</span>
          <span>
            nexo<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-select">
          <span className="workspace-monogram">
            {data.business.name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
          <div>
            <strong>{data.business.name}</strong>
            <small>Tu espacio de trabajo</small>
          </div>
          <span className="status-dot" />
        </div>
        <p className="nav-label">TU NEGOCIO, CONECTADO</p>
        <nav aria-label="Navegación principal">
          {pages.map((p, i) => (
            <div key={p.id}>
              {p.id === "services" && (
                <p className="nav-label secondary-label">ORGANIZACIÓN</p>
              )}
              <button
                className={`nav-item ${page === p.id ? "active" : ""}`}
                aria-label={p.label}
                aria-current={page === p.id ? "page" : undefined}
                onClick={() => navigate(p.id)}
              >
                <Icon name={p.icon} size={19} />
                <span>{p.label}</span>
                {p.id === "tasks" && due > 0 && (
                  <span className="nav-count">{due}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="booking-promo">
            <span className="promo-icon">
              <Icon name="spark" />
            </span>
            <strong>El próximo paso, a mano.</strong>
            <p>Encuentra cualquier contacto o propuesta sin perder el hilo.</p>
            <button className="text-button" onClick={() => setSearchOpen(true)}>
              Buscar en Nexo <kbd>Ctrl K</kbd>
            </button>
          </div>
          <div className="profile">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "Administrador" : "Equipo"}
              </small>
            </div>
            <button
              aria-label="Cerrar sesión"
              className="logout"
              onClick={async () => {
                try {
                  await api("logout/", "POST");
                  setUser(null);
                  setData(null);
                  await initialize();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Espacio de trabajo</span>
            <Icon name="chevron" size={13} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="crm-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar en todo Nexo (Control K)"
            >
              <Icon name="search" size={17} />
              <span>Buscar en Nexo</span>
              <kbd>Ctrl K</kbd>
            </button>
            {data.business.is_demo && (
              <span className="demo-label">
                <i />
                Datos de demostración
              </span>
            )}
            <button
              className="icon-button"
              aria-label="Actualizar datos"
              title="Actualizar datos"
              onClick={() =>
                void refresh()
                  .then(() => setToast("Datos actualizados"))
                  .catch((e) => setError(e.message))
              }
            >
              ↻
            </button>
            <Avatar name={user.name} small />
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "overview"
                  ? dateLabel(today, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : data.business.name + " · GESTIÓN DIARIA"}
              </p>
              <h1>
                {page === "overview"
                  ? `Todo conectado${user.name ? ", " + user.name : ""}.`
                  : current.label}
              </h1>
              <p>{subtitles[page]}</p>
            </div>
            {page === "agenda" && (
              <button className="button primary" onClick={() => setBooking({})}>
                <Icon name="plus" size={18} />
                Nueva cita
              </button>
            )}
          </div>
          {error && (
            <div className="global-error">
              <ErrorBox error={error} />
              <button className="text-button" onClick={() => setError("")}>
                Cerrar aviso
              </button>
            </div>
          )}
          {[
            "clients",
            "tasks",
            "payments",
            "services",
            "team",
            "pipeline",
            "quotes",
            "activities",
          ].includes(page) && (
            <div className="search-line">
              <label className="search-field">
                <Icon name="search" size={18} />
                <input
                  aria-label="Buscar en esta sección"
                  placeholder={
                    {
                      quotes: "Buscar por número, título o cliente…",
                      activities: "Buscar conversaciones, clientes o autores…",
                      clients: "Buscar por nombre, empresa, email o teléfono…",
                      tasks: "Buscar tareas…",
                      payments: "Buscar cliente, servicio o referencia…",
                      services: "Buscar servicios…",
                      team: "Buscar profesionales o recursos…",
                      pipeline: "Buscar oportunidades o clientes…",
                    }[page]
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="icon-button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setQuery("")}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </label>
              <span className="hint">Tu información, siempre a mano</span>
            </div>
          )}
          {page === "overview" && <CRMHome {...props} />}
          {page === "agenda" && <Agenda {...props} />}
          {page === "clients" && <Clients {...props} />}
          {page === "quotes" && <Quotes {...props} />}
          {page === "activities" && <Activities {...props} />}
          {page === "pipeline" && <Pipeline {...props} />}
          {page === "tasks" && <Tasks {...props} />}
          {page === "payments" && <Payments {...props} />}
          {page === "services" && <Services {...props} />}
          {page === "team" && <Team {...props} />}
          {page === "reports" && <Reports {...props} />}
          {page === "settings" && <Settings {...props} />}
          <footer className="workspace-footer">
            <span>
              nexo. <span>Más tiempo para lo que importa.</span>
            </span>
            <span>
              <i className="status-dot" /> Espacio local ·{" "}
              {data.business.timezone}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
      {searchOpen && (
        <Modal
          title="Buscar en Nexo"
          subtitle="Todo tu negocio, a una búsqueda"
          onClose={() => setSearchOpen(false)}
        >
          <GlobalSearch
            data={data}
            actions={actions}
            onClose={() => setSearchOpen(false)}
          />
        </Modal>
      )}
      {quoteDialog && (
        <Modal
          wide
          title={
            quoteDialog.quote ? "Detalle del presupuesto" : "Nuevo presupuesto"
          }
          subtitle={data.business.name}
          onClose={() => setQuoteDialog(null)}
        >
          <QuoteDialog
            data={data}
            quote={quoteDialog.quote}
            clientId={quoteDialog.clientId}
            onSaved={() => void saved()}
            onClose={() => setQuoteDialog(null)}
          />
        </Modal>
      )}
      {editor && (
        <Modal
          title={`${editor.record?.id ? "Editar" : "Nuevo"} ${editLabels[editor.kind]}`}
          subtitle={data.business.name}
          onClose={() => setEditor(null)}
        >
          <Editor
            kind={editor.kind}
            record={editor.record}
            data={data}
            onSaved={() => void saved()}
            onClose={() => setEditor(null)}
          />
        </Modal>
      )}
      {booking && (
        <Modal
          wide
          title={
            booking.visit
              ? "Reprogramar cita"
              : "Una nueva cita, bien organizada."
          }
          subtitle={data.business.name}
          onClose={() => setBooking(null)}
        >
          <Booking
            data={data}
            visit={booking.visit}
            onSaved={() => {
              navigate("agenda");
              void saved();
            }}
            onClose={() => setBooking(null)}
          />
        </Modal>
      )}
      {latestVisit && !booking && (
        <Modal
          title={latestVisit.service_name}
          subtitle="Detalle de la cita"
          onClose={() => setVisit(null)}
        >
          <div className="visit-detail">
            <ErrorBox error={error} />
            <div className="detail-client">
              <Avatar name={latestVisit.client_name} />
              <div>
                <h3>{latestVisit.client_name}</h3>
                <span className={`badge ${latestVisit.status}`}>
                  {statuses[latestVisit.status]}
                </span>
              </div>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Fecha</dt>
                <dd>
                  {dateLabel(
                    dayKey(latestVisit.starts_at, data.business.timezone),
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>
                  {hour(latestVisit.starts_at, data.business.timezone)} –{" "}
                  {hour(latestVisit.ends_at, data.business.timezone)} ·{" "}
                  {latestVisit.duration} min
                </dd>
              </div>
              <div>
                <dt>Profesional</dt>
                <dd>{latestVisit.professional_name}</dd>
              </div>
              <div>
                <dt>Importe / cobrado</dt>
                <dd>
                  {money(latestVisit.price)} / {money(latestVisit.paid)}
                </dd>
              </div>
              {latestVisit.resource && (
                <div>
                  <dt>Recurso</dt>
                  <dd>
                    {
                      data.resources.find((r) => r.id === latestVisit.resource)
                        ?.name
                    }
                  </dd>
                </div>
              )}
            </dl>
            {latestVisit.notes && (
              <p className="note-box">{latestVisit.notes}</p>
            )}
            <div className="detail-actions">
              {["pending", "confirmed"].includes(latestVisit.status) && (
                <>
                  <button
                    className="button"
                    disabled={actionBusy}
                    onClick={() => setBooking({ visit: latestVisit })}
                  >
                    <Icon name="calendar" />
                    Reprogramar
                  </button>
                  {latestVisit.status === "pending" && (
                    <button
                      className="button primary"
                      disabled={actionBusy}
                      onClick={() => void changeStatus("confirmed")}
                    >
                      Confirmar
                    </button>
                  )}
                  {new Date(latestVisit.starts_at) <= new Date() && (
                    <>
                      <button
                        className="button primary"
                        disabled={actionBusy}
                        onClick={() => void changeStatus("completed")}
                      >
                        Completar cita
                      </button>
                      <button
                        className="button"
                        disabled={actionBusy}
                        onClick={() => void changeStatus("no_show")}
                      >
                        No presentado
                      </button>
                    </>
                  )}
                  <button
                    className="button danger"
                    disabled={actionBusy}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancelar cita
                  </button>
                </>
              )}
              {latestVisit.price > latestVisit.paid &&
                !["cancelled", "no_show"].includes(latestVisit.status) && (
                  <button
                    className="button"
                    onClick={() => {
                      setVisit(null);
                      setEditor({
                        kind: "payments",
                        record: { appointment: latestVisit.id },
                      });
                    }}
                  >
                    Registrar cobro
                  </button>
                )}
            </div>
            {confirmCancel && (
              <div className="cancel-confirm">
                <p>
                  ¿Cancelar esta cita y liberar la hora?{" "}
                  {latestVisit.paid > 0
                    ? "Tiene cobros registrados; cualquier devolución debe gestionarse fuera de la aplicación."
                    : "Se conservará en el historial del cliente."}
                </p>
                <button
                  className="button danger"
                  disabled={actionBusy}
                  onClick={() => void changeStatus("cancelled")}
                >
                  Sí, cancelar cita
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmCancel(false)}
                >
                  Conservar cita
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
      {client && !editor && (
        <Modal
          wide
          title={client.name}
          subtitle="Ficha de cliente"
          onClose={() => setClient(null)}
        >
          <Client360
            client={data.clients.find((c) => c.id === client.id) || client}
            data={data}
            actions={actions}
          />
        </Modal>
      )}
    </div>
  );
}

function Login({
  error: initialError,
  onLoggedIn,
}: {
  error: string;
  onLoggedIn: () => Promise<void>;
}) {
  const [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">n</span>
          <span>nexo.</span>
        </div>
        <div>
          <p className="eyebrow">TU NEGOCIO, CONECTADO</p>
          <h1>
            Menos gestión.
            <br />
            Más <em>conexión.</em>
          </h1>
          <p>
            Tu agenda, tus clientes y tu equipo.
            <br />
            Un espacio para que todo encaje.
          </p>
          <div className="login-illustration">
            <div className="illustration-date">
              <span>LUNES</span>
              <strong>12</strong>
              <small>Un día con todo en su sitio.</small>
            </div>
            <div className="illustration-appointment">
              <Avatar name="Marina Costa" />
              <div>
                <strong>Asesoría personalizada</strong>
                <small>09:30 — 10:30 · Marina Costa</small>
              </div>
              <span className="mini-check">
                <Icon name="check" size={15} />
              </span>
            </div>
            <div className="illustration-caption">
              <span className="status-dot" />
              Más cerca de tus clientes.
            </div>
          </div>
        </div>
        <small>Hecho para negocios que cuidan los detalles.</small>
      </section>
      <section className="login-form-wrap">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const session = await api<{ csrf: string }>("session/");
              setCsrf(session.csrf);
              await api("login/", "POST", Object.fromEntries(f));
              await onLoggedIn();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="login-greeting">
            <Icon name="spark" />
          </span>
          <p className="eyebrow">BIENVENIDO A NEXO</p>
          <h2>
            Tu próximo buen día
            <br />
            empieza aquí.
          </h2>
          <p className="muted">Accede al espacio de trabajo de tu negocio.</p>
          <ErrorBox error={error} />
          <label>
            Usuario
            <input
              name="username"
              autoComplete="username"
              required
              placeholder="Tu usuario"
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Tu contraseña"
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Entrando…" : "Entrar en mi espacio"}
            <Icon name="arrow" />
          </button>
          <div className="login-help">
            <Icon name="briefcase" size={18} />
            <span>
              ¿Necesitas acceso? Contacta con la persona que administra tu
              negocio.
            </span>
          </div>
        </form>
        <small className="login-footer">
          Nexo · Agenda y CRM para pequeños negocios
        </small>
      </section>
    </main>
  );
}
