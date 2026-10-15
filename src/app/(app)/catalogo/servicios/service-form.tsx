"use client";

import { useActionState } from "react";
import { saveService } from "@/lib/actions/catalog";
import type { Service, ServiceCategory } from "@/lib/data/types";
import { EXTERNAL_TREATMENT_LABEL, EXTERNAL_TREATMENTS } from "@/lib/domain/schemas";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function ServiceForm({
  service,
  categories,
  allServices,
}: {
  service?: Service;
  categories: ServiceCategory[];
  allServices: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveService.bind(null, service?.id ?? null), null);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field label="Nombre *" className="md:col-span-2">
        <Input name="name" defaultValue={service?.name} required />
      </Field>
      <Field label="Categoría">
        <Select name="category_id" defaultValue={service?.category_id ?? ""}>
          <option value="">— Sin categoría —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Unidad de medida" hint="plantilla, página, h, mes, proyecto…">
        <Input name="unit" defaultValue={service?.unit ?? "ud."} required />
      </Field>
      <Field label="Descripción comercial" hint="Lo que verá el cliente en la propuesta." className="md:col-span-2">
        <Textarea name="commercial_description" defaultValue={service?.commercial_description ?? ""} />
      </Field>
      <Field label="Descripción interna" hint="Notas para el estudio y para la IA. No sale en el PDF." className="md:col-span-2">
        <Textarea name="internal_description" defaultValue={service?.internal_description ?? ""} rows={2} />
      </Field>
      <Field label="Entregables habituales" hint="Uno por línea.">
        <Textarea name="default_deliverables" defaultValue={(service?.default_deliverables ?? []).join("\n")} rows={4} />
      </Field>
      <Field label="Exclusiones habituales" hint="Uno por línea. Se proponen al añadir el servicio.">
        <Textarea name="default_exclusions" defaultValue={(service?.default_exclusions ?? []).join("\n")} rows={4} />
      </Field>
      <Field label="Servicios complementarios" hint="La IA podrá sugerirlos (nunca los añade sola)." className="md:col-span-2">
        <select
          name="complements"
          multiple
          defaultValue={service?.complements ?? []}
          className="min-h-28 w-full rounded-lg border border-line-strong bg-card p-2 text-sm"
        >
          {allServices
            .filter((s) => s.id !== service?.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </Field>
      <div className="flex flex-col gap-2 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={service?.active ?? true} /> Activo (disponible para nuevos presupuestos)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_optional_default" defaultChecked={service?.is_optional_default ?? false} /> Se ofrece como
          opcional por defecto
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_external_cost" defaultChecked={service?.is_external_cost ?? false} /> Es un coste de terceros
        </label>
        <Field label="Tratamiento fiscal del coste de terceros" className="max-w-md">
          <Select name="default_external_treatment" defaultValue={service?.default_external_treatment ?? "informative"}>
            {EXTERNAL_TREATMENTS.map((t) => (
              <option key={t} value={t}>
                {EXTERNAL_TREATMENT_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {service ? "Guardar servicio" : "Crear servicio"}
        </Button>
        {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
        {state?.ok ? <span className="text-sm text-lime-ink">Guardado.</span> : null}
      </div>
    </form>
  );
}
