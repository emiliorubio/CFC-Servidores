# Despliegue en producción (Supabase Cloud + Vercel)

Guía paso a paso para dejar CFC-Servidores operativo en la web con tu dominio `.cl`.

## 1. Conexión a Supabase Cloud

1. Abre tu proyecto en <https://supabase.com/dashboard>.
2. En **Project Settings → API Keys** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (clave secreta, **nunca** `NEXT_PUBLIC_`) → `SUPABASE_SECRET_KEY`
3. Escribe esas dos primeras claves en `.env.local` (este archivo está en `.gitignore`,
   nunca se sube al repositorio). La `service_role` solo se usa en el servidor (`/api/signup`)
   y en el script de provisión; no la expongas en el navegador.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...tu-anon
SUPABASE_SECRET_KEY=eyJhbGciOi...tu-service-role
```

## 2. Crear el esquema y la seguridad (RLS)

Abre tu proyecto en **SQL Editor** y ejecuta el contenido de la migración:

```
supabase/migrations/20260908_schema_rls_storage.sql
```

Ese archivo crea todas las tablas, el trigger de perfiles, activa **Row Level Security**,
define los buckets de storage (`organizations` y `materials`) con sus políticas.

- Si tu proyecto **ya tenía tablas** creadas antes (con datos), ejecuta primero las tres
  migraciones `20260831_*.sql` y después la `20260908` (es idempotente).
- Si partes **de cero**, solo ejecuta la `20260908` (ya incluye todo).

La `20260908` hace que:
- El cronograma y la identidad de las iglesias sean **públicos** (visibles sin login).
- Solo los **líderes/admins** de cada iglesia puedan escribir (cultos, equipos, canciones,
  lecciones, asignaciones manuales).
- Cada miembro pueda **anotarse a sí mismo** (`user_id = auth.uid()`).
- Los perfiles y datos de cada iglesia queden **aislados entre organizaciones**.

## 3. Crear organizaciones y usuarios de prueba

Desde una terminal en la carpeta del proyecto (con `.env.local` ya configurado y la
`SUPABASE_SECRET_KEY` definida también como variable de entorno local):

```powershell
$env:DEMO_USERS_PASSWORD = "una-clave-fuerte-de-prueba"
npm run provision:demo
```

Crea 4 organizaciones con admins, líderes y servidores usando correos
`admin1@cfc-puente-alto.example.test`. (Si ya tenías esa data, se actualiza.)

## 4. Desplegar en Vercel

1. Entra a <https://vercel.com/new> e importa el repositorio `emiliorubio/CFC-Servidores`.
2. En **Settings → Environment Variables** agrega las mismas tres variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SECRET_KEY` (solo servidor)
3. Despliega (`Deploy`).
4. Para el multi-tenant por subdominio agrega el dominio raíz (`tudominio.cl`) y el
   **comodín** `*.tudominio.cl` en **Settings → Domains**. Los dominios comodín requieren
   delegar los nameservers a Vercel. No uses el dominio `.vercel.app` para este flujo.

## 5. Verificación en línea

- `https://tudominio.cl/login?org=cfc-puente-alto` carga la identidad de CFC Puente Alto.
- `https://cfc-puente-alto.tudominio.cl/login` es la URL pública definitiva de cada iglesia.
- Inicia sesión con un admin demo y prueba crear un culto y anotar servidores.

## Notas de seguridad

- Nunca cambies el prefijo de `SUPABASE_SECRET_KEY` a `NEXT_PUBLIC_`.
- No habilites `service_role` en el cliente. El único punto que usa la clave secreta es
  `/api/signup` (server-side) y `scripts/provision-demo-users.mjs`.
- Si más adelante agregas tablas, activa RLS por defecto en Sql Editor (Supabase lo
  recomienda por seguridad).