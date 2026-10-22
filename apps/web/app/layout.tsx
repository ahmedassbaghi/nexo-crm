import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nexo · Citas y relaciones que crecen",
  description:
    "Agenda y CRM para pequeños negocios. Tus clientes, tu equipo y tu día, conectados.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
