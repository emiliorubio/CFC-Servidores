"use client";

import Link from "next/link";

interface RestrictedAccessProps {
  message?: string;
}

export default function RestrictedAccess({
  message = "Debes iniciar sesión con una cuenta autorizada para acceder a este módulo.",
}: RestrictedAccessProps) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center p-4">
      <div className="w-full rounded-3xl border border-amber-200 bg-amber-50 p-7 text-center shadow-sm">
        <div className="text-3xl">🔒</div>
        <h1 className="mt-3 text-lg font-bold text-slate-800">Acceso restringido</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
