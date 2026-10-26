"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { addManualLead, searchLeads } from "@/lib/actions/leads";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { useAnalyzeQueue } from "./use-analyze";
import { QueueProgress } from "./queue-progress";

export function SearchPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [next, setNext] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "lime" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const queue = useAnalyzeQueue();

  const [mName, setMName] = useState("");
  const [mWeb, setMWeb] = useState("");
  const [mCity, setMCity] = useState("");

  function doSearch(pageToken?: string) {
    setMsg(null);
    start(async () => {
      const r = await searchLeads({ query, location, pageToken });
      if (!r.ok) return setMsg({ tone: "danger", text: r.error });
      setNext(r.data.nextPageToken);
      setMsg({
        tone: "lime",
        text: `${r.data.found} negocios encontrados, ${r.data.added} nuevos${r.data.found - r.data.added ? ` (${r.data.found - r.data.added} ya estaban)` : ""}.`,
      });
      router.refresh();
      if (autoAnalyze && r.data.fresh.length) void queue.run(r.data.fresh);
    });
  }

  function addManual() {
    setMsg(null);
    start(async () => {
      const r = await addManualLead({ name: mName, website: mWeb || undefined, city: mCity || undefined });
      if (!r.ok) return setMsg({ tone: "danger", text: r.error });
      setMName("");
      setMWeb("");
      setMCity("");
      router.refresh();
      void queue.run([{ id: r.data.id, name: mName }]);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-5">
        <p className="kicker mb-3">Buscar en Google</p>
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            doSearch();
          }}
        >
          <Field label="Qué negocio">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="peluquerías, clínicas dentales, talleres…" disabled={!googleEnabled} required />
          </Field>
          <Field label="Dónde">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Getxo, Bilbao, Vitoria…" disabled={!googleEnabled} required />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={pending || !googleEnabled || queue.state.running}>
              <Search size={15} /> Buscar
            </Button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} /> Analizar los nuevos al momento
          </label>
          {next ? (
            <Button size="sm" variant="secondary" onClick={() => doSearch(next)} disabled={pending || queue.state.running}>
              Siguientes 20
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">Hasta 20 negocios por búsqueda. No se tienen en cuenta reseñas ni valoraciones.</p>
      </Card>

      <Card className="p-5">
        <p className="kicker mb-3">Añadir a mano</p>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addManual();
          }}
        >
          <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nombre del negocio *" required aria-label="Nombre" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={mWeb} onChange={(e) => setMWeb(e.target.value)} placeholder="Web (si tiene)" aria-label="Web" />
            <Input value={mCity} onChange={(e) => setMCity(e.target.value)} placeholder="Localidad" aria-label="Localidad" />
          </div>
          <Button type="submit" variant="secondary" disabled={pending || queue.state.running}>
            <Plus size={15} /> Añadir y analizar
          </Button>
        </form>
      </Card>

      {msg || queue.state.total ? (
        <div className="flex flex-col gap-2 lg:col-span-2">
          {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
          <QueueProgress state={queue.state} onCancel={queue.cancel} />
        </div>
      ) : null}
    </div>
  );
}
