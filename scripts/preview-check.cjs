const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const password = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8').match(/^DEMO_PASSWORD=(.*)$/m)[1].trim();
  await page.goto('http://127.0.0.1:3100');
  await page.getByLabel('Usuario', { exact: true }).fill('admin');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar en mi espacio' }).click();
  await page.getByRole('heading', { name: /Tu negocio, en buena marcha/ }).waitFor();
  await page.screenshot({ path: '.local/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.locator('.schedule-grid').waitFor();
  await page.screenshot({ path: '.local/agenda-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Nueva cita', exact: true }).click();
  await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Elegir fecha y hora' }).click();
  await page.locator('.calendar-day:not(:disabled)').first().waitFor();
  await page.locator('.calendar-day:not(:disabled)').first().click();
  await page.screenshot({ path: '.local/booking-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  for (const section of ['Clientes', 'Oportunidades', 'Tareas', 'Cobros', 'Informes', 'Servicios', 'Equipo y recursos', 'Configuración']) {
    await page.getByRole('button', { name: section, exact: true }).click();
    await page.getByRole('heading', { name: section, exact: true, level: 1 }).waitFor();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Vista general', exact: true }).click();
  await page.screenshot({ path: '.local/dashboard-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await browser.close();
  console.log(JSON.stringify({ errors, mobileOverflow: overflow, screenshots: ['dashboard-desktop.png', 'agenda-desktop.png', 'booking-desktop.png', 'dashboard-mobile.png'] }));
  if (errors.length || overflow) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
