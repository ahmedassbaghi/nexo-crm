import { test, expect } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const fixture = JSON.parse(fs.readFileSync(".local/e2e-access.json", "utf8"));
test.describe.serial("CRM completo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Usuario", { exact: true }).fill(fixture.username);
    await page.getByLabel("Contraseña", { exact: true }).fill(fixture.password);
    await page.getByRole("button", { name: "Entrar en mi espacio" }).click();
    await expect(
      page.getByRole("heading", { name: /Tu negocio, en buena marcha/ }),
    ).toBeVisible();
  });
  test("cliente, cita, cobro, reprogramación y cancelación", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Clientes", exact: true }).click();
    await page
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Nombre completo", { exact: true })
      .fill("Cliente recorrido E2E");
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("recorrido@example.com");
    await page
      .getByRole("button", { name: "Crear cliente", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Cliente recorrido E2E", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Nueva cita", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Cliente", exact: true })
      .selectOption({ label: "Cliente recorrido E2E" });
    await page.getByRole("button", { name: "Elegir fecha y hora" }).click();
    const date = fixture.day;
    while (
      (await page.locator(`.calendar-day[data-date="${date}"]`).count()) === 0
    )
      await page
        .getByRole("button", { name: "Mes siguiente", exact: true })
        .click();
    await page.locator(`.calendar-day[data-date="${date}"]`).click();
    await page.getByRole("button", { name: "10:00", exact: true }).click();
    await page
      .getByRole("button", { name: "Revisar cita", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar cita", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "La cita ya está en tu agenda." }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Volver a la agenda", exact: true })
      .click();
    await page.getByRole("button", { name: "Cobros", exact: true }).click();
    await page
      .getByRole("button", { name: "Pendientes", exact: false })
      .click();
    await page
      .getByRole("row")
      .filter({ hasText: "Cliente recorrido E2E" })
      .getByRole("button", { name: "Registrar cobro", exact: true })
      .click();
    await page.getByLabel("Importe (€)", { exact: true }).fill("20");
    await page
      .getByRole("button", { name: "Crear cobro", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: "45 €", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Agenda", exact: true }).click();
    await page.getByLabel("Fecha de agenda", { exact: true }).fill(date);
    await page
      .locator(".schedule-appointment")
      .filter({ hasText: "Cliente recorrido E2E" })
      .click();
    await page
      .getByRole("button", { name: "Reprogramar", exact: true })
      .click();
    while (
      (await page.locator(`.calendar-day[data-date="${date}"]`).count()) === 0
    )
      await page
        .getByRole("button", { name: "Mes siguiente", exact: true })
        .click();
    await page.locator(`.calendar-day[data-date="${date}"]`).click();
    await page.getByRole("button", { name: "12:00", exact: true }).click();
    await page
      .getByRole("button", { name: "Revisar cita", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar nueva hora", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nueva hora, misma cita." }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Volver a la agenda", exact: true })
      .click();
    await expect(
      page
        .locator(".schedule-appointment")
        .filter({ hasText: "Cliente recorrido E2E" }),
    ).toContainText("12:00");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Agenda", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Fecha de agenda", { exact: true }).fill(date);
    await page
      .locator(".schedule-appointment")
      .filter({ hasText: "Cliente recorrido E2E" })
      .click();
    await page
      .getByRole("button", { name: "Cancelar cita", exact: true })
      .click();
    await expect(page.getByText(/Tiene cobros registrados/)).toBeVisible();
    await page
      .getByRole("button", { name: "Sí, cancelar cita", exact: true })
      .click();
    await expect(
      page
        .locator(".schedule-appointment")
        .filter({ hasText: "Cliente recorrido E2E" }),
    ).toHaveCount(0);
  });
  test("tareas, oportunidad y configuración", async ({ page }) => {
    await page.getByRole("button", { name: "Tareas", exact: true }).click();
    await page
      .getByRole("button", { name: "Nueva tarea", exact: true })
      .click();
    await page
      .getByLabel("Qué hay que hacer", { exact: true })
      .fill("Enviar presupuesto E2E");
    await page
      .getByRole("button", { name: "Crear tarea", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Completar Enviar presupuesto E2E",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Completadas", exact: true })
      .click();
    await expect(
      page.getByText("Enviar presupuesto E2E", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Oportunidades", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nueva oportunidad", exact: true })
      .click();
    await page
      .getByLabel("Nombre de la oportunidad", { exact: true })
      .fill("Plan trimestral E2E");
    await page
      .getByRole("combobox", { name: "Cliente", exact: true })
      .selectOption(String(fixture.client));
    await page.getByLabel("Valor estimado (€)", { exact: true }).fill("300");
    await page
      .getByRole("button", { name: "Crear oportunidad", exact: true })
      .click();
    await page
      .getByRole("combobox", {
        name: "Etapa de Plan trimestral E2E",
        exact: true,
      })
      .selectOption("won");
    await expect(
      page
        .locator(".stage-won")
        .getByText("Plan trimestral E2E", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Configuración", exact: true })
      .click();
    await page.getByLabel("Teléfono", { exact: true }).fill("600 123 456");
    await page
      .getByRole("button", { name: "Guardar configuración", exact: true })
      .click();
    await expect(
      page.getByText("Configuración guardada.", { exact: true }),
    ).toBeVisible();
  });
  test("navegación móvil y accesibilidad estructural", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of [
      "Clientes",
      "Agenda",
      "Oportunidades",
      "Tareas",
      "Cobros",
      "Informes",
      "Servicios",
      "Equipo y recursos",
      "Configuración",
      "Vista general",
    ]) {
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .click();
      await page.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    ).toEqual([]);
  });
});
test("reserva pública sin acceso al CRM", async ({ page }) => {
  await page.goto(`/reservar/${fixture.slug}`);
  await page
    .getByLabel("Tu nombre", { exact: true })
    .fill("Cliente público E2E");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("publico@example.com");
  await page.getByLabel("Teléfono", { exact: true }).fill("600 123 123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Elegir fecha y hora" }).click();
  await page.locator(".calendar-day:not(:disabled)").last().click();
  await page.locator(".time-slot").first().click();
  await page.getByRole("button", { name: "Revisar cita", exact: true }).click();
  await page
    .getByRole("button", { name: "Solicitar cita", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu solicitud está recibida." }),
  ).toBeVisible();
});
