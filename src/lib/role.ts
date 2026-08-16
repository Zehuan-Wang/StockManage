import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Role } from "./types";

export function roleLabel(role: Role | null): string {
  if (role === "admin") return "管理员";
  if (role === "manager") return "仓管";
  return "未知";
}

export async function fetchUserRole(user: User | null | undefined): Promise<Role | null> {
  if (!user) return null;
  const { data, error } = await supabase
    .from("admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  const value = data?.role;
  if (value === "admin" || value === "manager") return value;
  return null;
}
