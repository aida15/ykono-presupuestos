import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, type SupabaseServer } from "@/lib/supabase/server";

export type MemberContext = {
  supabase: SupabaseServer;
  userId: string;
  email: string | null;
  studioId: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403,
  ) {
    super(message);
  }
}

/**
 * Data Access Layer: resuelve la usuaria y su estudio validando el token contra
 * Supabase Auth. Se memoiza por petición. Lanza AuthError si no hay acceso.
 */
export const getMember = cache(async (): Promise<MemberContext> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("No autenticada", 401);

  const { data: membership } = await supabase
    .from("studio_members")
    .select("studio_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) throw new AuthError("Tu usuaria no pertenece a ningún estudio", 403);

  return { supabase, userId: user.id, email: user.email ?? null, studioId: membership.studio_id as string };
});

/** Para páginas: redirige en lugar de lanzar. */
export async function requireMember(): Promise<MemberContext> {
  try {
    return await getMember();
  } catch (e) {
    if (e instanceof AuthError) redirect(e.status === 401 ? "/login" : "/login?error=no-studio");
    throw e;
  }
}
