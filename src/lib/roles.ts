import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  tecnico: "/tecnico",
  cliente: "/portal",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  tecnico: "Técnico",
  cliente: "Cliente",
};

/** Qual role pode acessar cada área. */
export const AREA_ROLES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/tecnico", roles: ["tecnico"] },
  { prefix: "/portal", roles: ["cliente"] },
];

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "tecnico" || value === "cliente";
}
