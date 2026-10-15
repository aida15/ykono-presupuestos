"use client";

import { useActionState } from "react";
import { saveCategory } from "@/lib/actions/catalog";
import type { ServiceCategory } from "@/lib/data/types";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function CategoryForm({ category, categories }: { category?: ServiceCategory; categories: ServiceCategory[] }) {
  const [state, action, pending] = useActionState(saveCategory.bind(null, category?.id ?? null), null);
  return (
    <form action={action} className="grid gap-3">
      <Field label="Nombre">
        <Input name="name" defaultValue={category?.name} required />
      </Field>
      <Field label="Descripción">
        <Input name="description" defaultValue={category?.description ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Subcategoría de">
          <Select name="parent_id" defaultValue={category?.parent_id ?? ""}>
            <option value="">— Ninguna —</option>
            {categories
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Orden">
          <Input name="sort_order" type="number" defaultValue={category?.sort_order ?? 99} />
        </Field>
      </div>
      {category ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={category.active} /> Activa
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {category ? "Guardar" : "Crear categoría"}
        </Button>
        {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
        {state?.ok ? <span className="text-xs text-lime-ink">Guardado</span> : null}
      </div>
    </form>
  );
}
