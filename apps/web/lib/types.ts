export type Business = {
  id: number;
  name: string;
  slug: string;
  industry: string;
  email: string;
  phone: string;
  address: string;
  timezone: string;
  currency: string;
  is_demo?: boolean;
  opening: string;
  closing: string;
  weekdays: number[];
  public_booking: boolean;
};
export type User = { name: string; username: string; role: "admin" | "staff" };
export type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  lifecycle: "lead" | "customer" | "inactive";
  source: string;
  owner: number | null;
  tag: string;
  notes: string;
  active: boolean;
  created_at: string;
};
export type Service = {
  id: number;
  name: string;
  description: string;
  duration: number;
  price: number;
  color: string;
  active: boolean;
};
export type Professional = {
  id: number;
  name: string;
  title: string;
  color: string;
  active: boolean;
  services: number[];
};
export type Resource = { id: number; name: string; active: boolean };
export type Block = {
  id: number;
  professional: number | null;
  reason: string;
  starts_at: string;
  ends_at: string;
};
export type Appointment = {
  id: number;
  client: number;
  client_name: string;
  service: number;
  service_name: string;
  professional: number;
  professional_name: string;
  resource: number | null;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  duration: number;
  notes: string;
  version: number;
  paid: number;
};
export type Payment = {
  id: number;
  appointment: number;
  amount: number;
  method: string;
  reference: string;
  paid_at: string;
  client_name: string;
  service_name: string;
};
export type Opportunity = {
  id: number;
  title: string;
  client: number;
  value: number;
  stage: string;
  owner: number | null;
  probability: number;
  expected_close: string | null;
  lost_reason: string;
  updated_at: string;
  next_action: string;
  due_date: string | null;
};
export type Task = {
  id: number;
  title: string;
  client: number | null;
  professional: number | null;
  due_date: string;
  priority: string;
  done: boolean;
};
export type Audit = {
  id: number;
  actor: string;
  action: string;
  entity: string;
  object_id: number;
  created_at: string;
};
export type Data = {
  business: Business;
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  resources: Resource[];
  blocks: Block[];
  appointments: Appointment[];
  payments: Payment[];
  opportunities: Opportunity[];
  tasks: Task[];
  audit: Audit[];
  activities: Activity[];
  quotes: Quote[];
};
export type CalendarDay = {
  date: string;
  available_count: number;
  capacity_count: number;
  slots: string[];
};
export const statuses: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No presentado",
};
export const stages: Record<string, string> = {
  new: "Nuevo contacto",
  contacted: "En conversación",
  proposal: "Propuesta",
  won: "Ganado",
  lost: "Perdido",
};
export const money = (cents: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
export const dayKey = (
  value: Date | string = new Date(),
  zone = "Europe/Madrid",
) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const shiftMonth = (month: string, n: number) => {
  const d = new Date(month + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
export const dateLabel = (
  day: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", ...options }).format(
    new Date(day + "T12:00:00Z"),
  );
export const hour = (value: string, zone = "Europe/Madrid") =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");

export type Activity = {
  id: number;
  client: number;
  kind: string;
  subject: string;
  body: string;
  occurred_at: string;
  author: string;
  created_at: string;
};
export type QuoteItem = {
  description: string;
  quantity: string;
  unit_price: number;
  total?: number;
};
export type Quote = {
  id: number;
  client: number;
  title: string;
  number: number;
  status: string;
  valid_until: string;
  items: QuoteItem[];
  discount_percent: number;
  tax_percent: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string;
  issued_at: string | null;
  sender: Record<string, string>;
  recipient: Record<string, string>;
  version: number;
  created_at: string;
  updated_at: string;
};
export const activityKinds: Record<string, string> = {
  note: "Nota",
  call: "Llamada",
  email: "Correo",
  meeting: "Reunión",
};
export const quoteStatuses: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Caducado",
};
export const lifecycleLabels: Record<string, string> = {
  lead: "Potencial",
  customer: "Cliente",
  inactive: "Inactivo",
};
export const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
export const quoteNumber = (number: number) =>
  `P-${String(number).padStart(5, "0")}`;
export const weightedValue = (opportunity: Opportunity) =>
  opportunity.stage === "won"
    ? opportunity.value
    : opportunity.stage === "lost"
      ? 0
      : Math.round((opportunity.value * opportunity.probability) / 100);
