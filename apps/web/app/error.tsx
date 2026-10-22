"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="boot">
      <h1>No pudimos cargar esta vista.</h1>
      <p>Tus datos guardados se conservan. Vuelve a intentarlo.</p>
      <button className="button primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
