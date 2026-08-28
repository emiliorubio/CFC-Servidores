export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Vista General de la Sede</h2>
          <p className="text-slate-600 text-sm mt-1">
            Revisa el estado de los próximos servicios y la disponibilidad del equipo.
          </p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
          + Programar Nuevo Culto
        </button>
      </section>

      {/* Próximos Servicios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Culto Dominical */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
            <div>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Próximo Domingo
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-2">Culto General de Adoración</h3>
              <p className="text-xs text-slate-500">10:30 AM | Sede CFC Puente Alto</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">Estado de Servidores</h4>
            <ul className="space-y-1.5">
              <li className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded">
                <span>Ujieres / Recepción</span>
                <span className="font-medium text-emerald-600">3/4 Confirmados</span>
              </li>
              <li className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded">
                <span>Equipo de Adoración</span>
                <span className="font-medium text-emerald-600">Completo (5)</span>
              </li>
              <li className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded">
                <span>Multimedia & Sonido</span>
                <span className="font-medium text-amber-600">1/3 Faltan Servidores</span>
              </li>
              <li className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded">
                <span>Escuela Dominical</span>
                <span className="font-medium text-emerald-600">2/2 Maestras</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm py-2 rounded-lg transition-colors">
              Ver Detalle del Servicio
            </button>
          </div>
        </div>

        {/* Reunión de Oración */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
            <div>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Miércoles
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-2">Reunión de Oración y Palabra</h3>
              <p className="text-xs text-slate-500">20:00 PM | Sede CFC Puente Alto</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">Estado de Servidores</h4>
            <ul className="space-y-1.5">
              <li className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded">
                <span>Ujieres</span>
                <span className="font-medium text-emerald-600">2/2 Confirmados</span>
              </li>
              <li className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded">
                <span>Sonido & Proyección</span>
                <span className="font-medium text-rose-600">Sin Servidor Asignado</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm py-2 rounded-lg transition-colors">
              Ver Detalle del Servicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}