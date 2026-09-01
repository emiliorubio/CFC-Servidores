This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Multi-tenant por subdominio

Cada organización se identifica con su `slug`: por ejemplo,
`https://cfc-puente-alto.tu-dominio.cl/login` carga CFC Puente Alto y registra
las cuentas nuevas en esa organización. Para probarlo localmente, usa
`http://localhost:3000/login?org=cfc-puente-alto`.

En Vercel agrega el dominio raíz y el comodín `*.tu-dominio.cl`; los dominios
comodín requieren delegar los nameservers a Vercel. No se debe usar el dominio
`vercel.app` para este flujo, porque no permite crear subdominios propios.

En **Vercel → Settings → Environment Variables**, agrega `SUPABASE_SECRET_KEY`
(o la clave heredada `SUPABASE_SERVICE_ROLE_KEY`). Es una clave exclusiva de
servidor: no debe comenzar con `NEXT_PUBLIC_`, no se sube a Git y permite que
`/api/signup` asigne la iglesia usando el subdominio. Ejecuta también la
migración `20260831_create_profile_on_signup.sql` en Supabase antes de abrir el
registro al público.

### Cuentas de prueba

El comando siguiente crea las cuatro organizaciones y, para cada una, 2 admins,
4 líderes y 4 servidores. Requiere una clave secreta de Supabase solo en la
terminal/entorno de Vercel; nunca se guarda en el repositorio.

```powershell
# Agrega estas mismas variables a .env.local (archivo ignorado por Git)
$env:SUPABASE_SECRET_KEY = "sb_secret_..."
$env:DEMO_USERS_PASSWORD = "una-clave-de-prueba-segura"
npm run provision:demo
```

Los correos siguen el formato `admin1@cfc-puente-alto.example.test`,
`lider1@cfc-puente-alto.example.test` y `servidor1@cfc-puente-alto.example.test`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
