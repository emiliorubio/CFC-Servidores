"use client";

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
    icon: "🧑‍🤝‍🧑",
    titulo: "Servidores y voluntarios",
    texto: "Consulten sus próximos turnos, confirmen participación y reciban recordatorios de sus servicios.",
  },
];

export default function LandingPage() {
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
              <p className="font-extrabold leading-tight">MiIglesia</p>
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
            MiIglesia ayuda a cada congregación a programar sus servicios,
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
            {["cfcvida", "cfcpuentealto", "habitacionrancagua", "casasionsantiago"].map((s) => (
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
        © 2026 MiIglesia · Centro de Formación Cristiana. Desarrollado para la edificación del cuerpo de Cristo.
      </footer>
    </div>
  );
}