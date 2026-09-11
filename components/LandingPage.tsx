"use client";

import { useState } from "react";
import Link from "next/link";

const CARACTERISTICAS = [
  {
    icon: "🗓️",
    titulo: "Cronograma de cultos",
    texto: "Planifica cultos, retiros, vigilias y eventos con fecha, hora y tipo de evento. Genera el calendario de semanas por adelantado.",
  },
  {
    icon: "🤝",
    titulo: "Equipos de servidores",
    texto: "Arma los equipos de adoración, escuela, cafetería y plataforma para cada servicio, sin planillas ni cadenas de WhatsApp.",
  },
  {
    icon: "📲",
    titulo: "Confirmaciones y recordatorios",
    texto: "Cada servidor confirma su participación desde su celular y recibe recordatorios de sus próximos turnos.",
  },
  {
    icon: "✅",
    titulo: "Asistencia por culto",
    texto: "Registra quiénes asistieron a cada servicio y mantén un historial fiel de participación y crecimiento.",
  },
  {
    icon: "📇",
    titulo: "Directorio de miembros",
    texto: "Una ficha por persona: datos, cumpleaños, servicios prestados, asistencias y grupos a los que pertenece.",
  },
  {
    icon: "👥",
    titulo: "Grupos y células",
    texto: "Organiza grupos de discipulado con líder, horario, dirección e integrantes desde el mismo directorio.",
  },
  {
    icon: "📖",
    titulo: "Archivo de sermones",
    texto: "Guarda predicaciones, textos bíblicos y predicadores. Todo el historial de enseñanza en un solo lugar.",
  },
  {
    icon: "💰",
    titulo: "Finanzas",
    texto: "Ofrendas, gastos y reportes de la iglesia con control de tesorería y acceso por roles.",
  },
];

const AUDIENCIAS = [
  {
    icon: "🏛️",
    titulo: "Pastores y administradores",
    texto: "Ven el panorama completo de la iglesia: cronograma, equipos, asistencia, finanzas y configuración de módulos.",
  },
  {
    icon: "🎯",
    titulo: "Coordinadores de ministerio",
    texto: "Armen sus equipos por servicio, confirmen cobertura y mantengan el orden semanal sin idas y vueltas.",
  },
  {
    icon: "👫",
    titulo: "Servidores y voluntarios",
    texto: "Consulten sus próximos turnos, confirmen participación y reciban recordatorios de sus servicios.",
  },
];

export default function LandingPage() {
  const [showTrial, setShowTrial] = useState(false);
  const [trialName, setTrialName] = useState("");
  const [trialEmail, setTrialEmail] = useState("");
  const [trialChurch, setTrialChurch] = useState("");
  const [trialMessage, setTrialMessage] = useState("");
  const [trialSending, setTrialSending] = useState(false);
  const [trialSent, setTrialSent] = useState(false);
  const [trialError, setTrialError] = useState("");

  const abrirSolicitud = () => {
    setTrialError("");
    setTrialSent(false);
    setShowTrial(true);
  };

  const enviarSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialSending(true);
    setTrialError("");
    try {
      const response = await fetch("/api/trial-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trialName,
          email: trialEmail,
          churchName: trialChurch,
          message: trialMessage,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo enviar la solicitud.");
      setTrialSent(true);
    } catch (err) {
      setTrialError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setTrialSending(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-800 antialiased">
      {/* Barra superior */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              ⛪
            </div>
            <div>
              <p className="font-extrabold leading-tight">Mi Iglesia</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Organización de servidores y cultos
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <span className="inline-block bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-wider text-amber-300 px-4 py-1.5 rounded-full mb-6">
            Plataforma multisede para iglesias
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight max-w-3xl mx-auto">
            Organiza a tus servidores y tus cultos, todo en un solo lugar.
          </h1>
          <p className="mt-5 text-slate-300 max-w-2xl mx-auto text-base md:text-lg">
            Mi Iglesia ayuda a cada congregación a programar sus servicios,
            armar sus equipos de voluntarios, registrar asistencia y cuidar a su
            gente, cada iglesia desde su propio enlace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="bg-white text-slate-900 font-bold px-6 py-3 rounded-xl text-sm hover:bg-slate-100 transition-colors shadow-lg"
            >
              Iniciar sesión
            </Link>
            <a
              href="#funciones"
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Conocer el sistema ↓
            </a>
          </div>
          <p className="mt-8 text-xs text-slate-400">
            Cada iglesia accede por su propio enlace, con su identidad visual, sus módulos y sus datos.
          </p>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="max-w-6xl mx-auto px-4 py-16 md:py-20 scroll-mt-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight">Lo que ya hace el sistema</h2>
          <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
            Desde la programación semanal hasta el cuidado de cada persona, los
            módulos centrales de la organización de una iglesia en una sola plataforma.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARACTERISTICAS.map((c) => (
            <div
              key={c.titulo}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="text-2xl">{c.icon}</div>
              <h3 className="mt-3 font-bold text-slate-900">{c.titulo}</h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{c.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Enlaces por iglesia */}
      <section className="bg-indigo-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Cada iglesia tiene su propio enlace</h2>
          <p className="mt-3 text-indigo-200 max-w-2xl mx-auto">
            Tu iglesia te entrega un enlace del tipo{" "}
            <span className="font-bold text-white">tuiglesia.miiglesia.cl</span>. A través de él te
            registras, inicias sesión y ves el cronograma, los grupos y los recursos de tu congregación.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-bold">
            {["tuiglesia", "miparroquia"].map((s) => (
              <span
                key={s}
                className="bg-white/10 border border-white/15 rounded-full px-4 py-2 text-indigo-100"
              >
                {s}.miiglesia.cl
              </span>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Ingresa desde el enlace de tu iglesia
            </Link>
          </div>
        </div>
      </section>

      {/* Audiencias */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight">¿Para quién es?</h2>
          <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
            Una herramienta para toda la estructura de la iglesia, con acceso según el rol de cada persona.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {AUDIENCIAS.map((a) => (
            <div key={a.titulo} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="text-3xl">{a.icon}</div>
              <h3 className="mt-4 font-bold text-slate-900">{a.titulo}</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">{a.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes y acceso */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight">Planes y acceso</h2>
            <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
              Mi Iglesia se encuentra gratis en sus distintos planes por un período de prueba,
              para que tu congregación elija el que mejor se acomode a su tamaño y necesidades.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { plan: "Básico", texto: "Lo esencial para comenzar: cronograma de cultos y organización de servidores." },
              { plan: "Plata", texto: "Para iglesias en crecimiento, con módulos adicionales para el equipo." },
              { plan: "Gold", texto: "Todo el potencial de la plataforma, con el máximo de módulos para la iglesia." },
            ].map((p) => (
              <div
                key={p.plan}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">{p.plan}</div>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">{p.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <div className="inline-flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={abrirSolicitud}
                className="bg-slate-900 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-slate-800 transition-colors shadow"
              >
                Probar gratis
              </button>
              <p className="text-xs text-slate-500">
                Deja tus datos y el administrador te autorizará el acceso de prueba a tu iglesia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[2rem] p-8 md:p-12 text-center shadow-xl">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ¿Eres el administrador de la plataforma?
          </h2>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            El acceso central (superadmin) se hace desde este mismo enlace raíz. Una vez dentro,
            podrás ver todas las iglesias y gestionar la plataforma.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-block bg-white text-slate-900 font-bold px-6 py-3 rounded-xl text-sm hover:bg-slate-100 transition-colors shadow-lg"
          >
            Iniciar sesión (superadmin)
          </Link>
        </div>
      </section>

      {/* Pie */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        © 2026 Mi Iglesia · Organización de servidores y cultos. Desarrollado para la edificación del cuerpo de Cristo.
      </footer>

      {/* Modal: solicitud para probar la plataforma */}
      {showTrial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setShowTrial(false)}>
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {trialSent ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl">✅</div>
                <h3 className="text-lg font-extrabold text-slate-900">¡Solicitud enviada!</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Gracias por tu interés en probar Mi Iglesia. El administrador revisará tu
                  solicitud y te autorizará el acceso de prueba lo antes posible.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTrial(false)}
                  className="mt-2 w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-slate-800 transition-colors"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">Probar Mi Iglesia gratis</h3>
                  <p className="text-xs text-slate-500">
                    Deja tus datos y solicitaremos tu período de prueba de la plataforma.
                  </p>
                </div>
                {trialError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {trialError}
                  </div>
                )}
                <form onSubmit={enviarSolicitud} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Tu Nombre y Apellido"
                      value={trialName}
                      onChange={(e) => setTrialName(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@correo.com"
                      value={trialEmail}
                      onChange={(e) => setTrialEmail(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de tu iglesia</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Iglesia de mi ciudad"
                      value={trialChurch}
                      onChange={(e) => setTrialChurch(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ¿Qué necesitas? <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Cuéntanos brevemente tu situación"
                      value={trialMessage}
                      onChange={(e) => setTrialMessage(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowTrial(false)}
                      className="flex-1 border border-slate-200 text-slate-600 font-bold py-3 rounded-xl text-sm hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={trialSending}
                      className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
                    >
                      {trialSending ? "Enviando..." : "Enviar solicitud"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}