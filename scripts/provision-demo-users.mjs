import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Next.js carga .env.local automáticamente, pero este script se ejecuta con
// Node directamente. Cargamos las variables locales sin sobrescribir las que
// ya existan en la sesión.
const envFile = resolve(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USERS_PASSWORD;

if (!url || !secret || !password) {
  throw new Error(
    "Define NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY) y DEMO_USERS_PASSWORD antes de ejecutar este script."
  );
}

if (password.length < 12) {
  throw new Error("DEMO_USERS_PASSWORD debe tener al menos 12 caracteres.");
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const organizations = [
  { name: "CFC Puente Alto", slug: "cfcpuentealto" },
  { name: "CFC Vida", slug: "cfcvida" },
  { name: "Iglesia Habitación Rancagua", slug: "habitacionrancagua" },
  { name: "Iglesia Habitación Santiago", slug: "habitacionsantiago" },
];

const roleCounts = { admin: 2, lider: 4, servidor: 4 };

async function getOrCreateOrganization({ name, slug }) {
  const { data: existing, error: findError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      primary_color: "#4F46E5",
      secondary_color: "#0F172A",
      plan: "free",
      active_modules: {
        servidores: true,
        adoracion: true,
        escuela_dominical: true,
      },
    })
    .select("id, name, slug")
    .single();

  if (createError) throw createError;
  return created;
}

const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (usersError) throw usersError;

// Limpieza: elimina usuarios demo antiguos (dominio *.example.test).
// Nunca toca correos reales (gmail, etc.).
const staleDemoUsers = usersPage.users.filter((user) =>
  user.email?.toLowerCase().endsWith(".example.test")
);
let deletedUsers = 0;
for (const user of staleDemoUsers) {
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw error;
  deletedUsers += 1;
}
if (deletedUsers > 0) {
  console.log(`Limpieza: ${deletedUsers} usuario(s) demo antiguo(s) eliminado(s).`);
}

const { data: freshUsersPage, error: freshUsersError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (freshUsersError) throw freshUsersError;
const usersByEmail = new Map(freshUsersPage.users.map((user) => [user.email?.toLowerCase(), user]));

let createdUsers = 0;
let updatedUsers = 0;

for (const organization of organizations) {
  const savedOrganization = await getOrCreateOrganization(organization);

  for (const [role, count] of Object.entries(roleCounts)) {
    for (let number = 1; number <= count; number += 1) {
      const email = `${role}${number}@${organization.slug}.test`;
      const fullName = `${role === "lider" ? "Líder" : role === "admin" ? "Admin" : "Servidor"} ${number} — ${organization.name}`;
      let user = usersByEmail.get(email);

      if (!user) {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
          app_metadata: { organization_id: savedOrganization.id },
        });
        if (error) throw error;
        user = data.user;
        createdUsers += 1;
      } else {
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
          app_metadata: { organization_id: savedOrganization.id },
        });
        if (error) throw error;
        updatedUsers += 1;
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: fullName,
          role,
          organization_id: savedOrganization.id,
        },
        { onConflict: "id" }
      );
      if (profileError) throw profileError;
    }
  }
}

console.log(`Listo: ${createdUsers} usuario(s) creados y ${updatedUsers} actualizado(s).`);
console.log(`Contraseña de prueba (variable DEMO_USERS_PASSWORD, ${password.length} caracteres).`);
for (const organization of organizations) {
  console.log(`— ${organization.name} (${organization.slug}.miiglesia.cl):`);
  console.log(`  admin1@${organization.slug}.test / admin2@${organization.slug}.test`);
  console.log(`  lider1@${organization.slug}.test ... lider4@${organization.slug}.test`);
  console.log(`  servidor1@${organization.slug}.test ... servidor4@${organization.slug}.test`);
}
