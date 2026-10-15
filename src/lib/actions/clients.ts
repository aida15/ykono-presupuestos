"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { run, type ActionResult } from "./result";

const opt = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const ClientInput = z.object({
  trade_name: z.string().trim().min(1, "El nombre comercial es obligatorio").max(200),
  legal_name: opt,
  tax_id: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .transform((v) => (v === "" ? null : v.replace(/[\s-]/g, "")))
    .nullable()
    .optional(),
  address_line: opt,
  postal_code: opt,
  city: opt,
  province: opt,
  country: opt,
  email: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Email no válido").nullable())
    .optional(),
  phone: opt,
  website: opt,
  sector: opt,
  notes: z.string().max(4000).optional(),
});

function fromForm(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

export async function saveClient(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => {
    const ctx = await getMember();
    const data = ClientInput.parse(fromForm(fd));
    if (id) {
      const { error } = await ctx.supabase.from("clients").update(data).eq("id", id).eq("studio_id", ctx.studioId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await ctx.supabase
      .from("clients")
      .insert({ ...data, studio_id: ctx.studioId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
  if (res.ok) {
    revalidatePath("/clientes");
    if (!id) redirect(`/clientes/${res.data.id}`);
  }
  return res;
}

/** Inserta un cliente desde otros flujos (entrevista). */
export async function createClientQuick(input: z.input<typeof ClientInput>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await getMember();
    const data = ClientInput.parse(input);
    const { data: row, error } = await ctx.supabase
      .from("clients")
      .insert({ ...data, studio_id: ctx.studioId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/clientes");
    return { id: row.id as string };
  });
}

/** Duplica los datos del cliente y sus contactos. No copia presupuestos ni proyectos. */
export async function duplicateClient(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => {
    const ctx = await getMember();
    const { data: src, error } = await ctx.supabase.from("clients").select("*").eq("id", id).eq("studio_id", ctx.studioId).single();
    if (error || !src) throw new Error("Cliente no encontrado");
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = src;
    void _id;
    void _c;
    void _u;
    const { data: copy, error: e2 } = await ctx.supabase
      .from("clients")
      .insert({ ...rest, trade_name: `${src.trade_name} (copia)` })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);
    const { data: contacts } = await ctx.supabase.from("client_contacts").select("*").eq("client_id", id);
    if (contacts?.length) {
      await ctx.supabase.from("client_contacts").insert(
        contacts.map(({ id: _cid, created_at: _cc, ...c }) => {
          void _cid;
          void _cc;
          return { ...c, client_id: copy.id };
        }),
      );
    }
    return { id: copy.id as string };
  });
  if (res.ok) redirect(`/clientes/${res.data.id}`);
  return res;
}

export async function setClientArchived(id: string, archived: boolean): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("clients").update({ archived }).eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return res;
}

const ContactInput = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio").max(200),
  role: opt,
  email: opt,
  phone: opt,
  is_primary: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function addContact(clientId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const data = ContactInput.parse(fromForm(fd));
    if (data.is_primary) {
      await ctx.supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId);
    }
    const { error } = await ctx.supabase.from("client_contacts").insert({ ...data, client_id: clientId, studio_id: ctx.studioId });
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath(`/clientes/${clientId}`);
  return res;
}

export async function deleteContact(clientId: string, contactId: string): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("client_contacts").delete().eq("id", contactId).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath(`/clientes/${clientId}`);
  return res;
}
