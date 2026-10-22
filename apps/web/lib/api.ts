let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
function message(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(message).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([key, item]) =>
          `${["detail", "non_field_errors"].includes(key) ? "" : key + ": "}${message(item)}`,
      )
      .join(" ");
  return "No se pudo completar la operación.";
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (response.status === 204) return undefined as T;
  const data = await response
    .json()
    .catch(() => ({
      detail: "El servidor no está disponible. Inténtalo de nuevo.",
    }));
  if (!response.ok) throw Error(message(data));
  return data;
}
