"use client";

import { useActionState, useState } from "react";
import { deleteQuestion, saveQuestion } from "@/lib/actions/catalog";
import type { ServiceQuestion } from "@/lib/data/types";
import { DISCIPLINE_LABEL } from "@/lib/catalog/disciplines";
import { Alert, Badge, Button, Input, Select } from "@/components/ui";
import { ActionButton } from "@/components/action-button";

type Svc = { id: string; name: string };

export function QuestionForm({ q, services, onDone }: { q?: ServiceQuestion; services: Svc[]; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: unknown, fd: FormData) => {
    const r = await saveQuestion(q?.id ?? null, prev, fd);
    if (r.ok) onDone?.();
    return r;
  }, null);
  return (
    <form action={action} className="grid gap-2 md:grid-cols-[180px_1fr]">
      <Select name="discipline" defaultValue={q?.discipline ?? "common"} aria-label="Disciplina">
        {Object.entries(DISCIPLINE_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
      <Input name="question" defaultValue={q?.question} placeholder="Pregunta" required aria-label="Pregunta" />
      <Select name="answer_type" defaultValue={q?.answer_type ?? "text"} aria-label="Tipo de respuesta">
        <option value="text">Texto</option>
        <option value="number">Número</option>
        <option value="boolean">Sí / No</option>
        <option value="choice">Opción única</option>
        <option value="multi">Varias opciones</option>
      </Select>
      <Input name="options" defaultValue={q?.options.join(", ")} placeholder="Opciones separadas por comas" aria-label="Opciones" />
      <Select name="service_id" defaultValue={q?.service_id ?? ""} aria-label="Servicio asociado">
        <option value="">Sin servicio asociado</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input name="help_text" defaultValue={q?.help_text ?? ""} placeholder="Ayuda para la IA (opcional)" aria-label="Ayuda" />
      <input type="hidden" name="sort_order" value={q?.sort_order ?? 999} />
      <div className="flex items-center gap-3 md:col-span-2">
        {q ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={q.active} /> Activa
          </label>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {q ? "Guardar" : "Añadir pregunta"}
        </Button>
        {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      </div>
    </form>
  );
}

export function QuestionRow({ q, services }: { q: ServiceQuestion; services: Svc[] }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="py-3">
        <QuestionForm q={q} services={services} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className={q.active ? "" : "opacity-50"}>
        <p>{q.question}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {q.answer_type !== "text" ? <Badge>{q.answer_type}</Badge> : null}
          {q.options.length ? <span className="text-xs text-muted">{q.options.join(" · ")}</span> : null}
          {!q.active ? <Badge>Inactiva</Badge> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <ActionButton action={deleteQuestion.bind(null, q.id)} variant="ghost" confirm="¿Eliminar la pregunta?">
          Borrar
        </ActionButton>
      </div>
    </li>
  );
}
