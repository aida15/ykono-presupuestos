import { describe, expect, it } from "vitest";
import { analyzeHtml, isOldTech } from "../html-signals";
import { evaluate } from "../evaluate";
import { scoreLead, suggestProducts, CRITERIA } from "../criteria";

const NOW = new Date("2026-10-26T12:00:00Z");

const OLD_SITE = `<!DOCTYPE html><html lang="es"><head>
<title>Peluquería Ejemplo</title>
<meta name="generator" content="WordPress 4.9.8">
<script src="/wp-includes/js/jquery/jquery.js?ver=1.12.4"></script>
<img src="http://example-cdn.test/foto.jpg">
</head><body>
<img src="/img/logo-peluqueria.jpg" alt="Logo">
<p>Pide tu cita. Productos de peluquería: champú 12,50 € — pedidos por WhatsApp <a href="https://wa.me/34600000000">aquí</a></p>
<p>Contacto: <a href="mailto:pelu.ejemplo@gmail.com">pelu.ejemplo@gmail.com</a> · <a href="tel:+34 944 000 000">944 000 000</a></p>
<p>¡Nueva apertura en Getxo!</p>
<footer>&copy; 2017 Peluquería Ejemplo · Diseño web por Agencia Vieja SL</footer>
</body></html>`;

const GOOD_SITE = `<!doctype html><html lang="es"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Estudio Bueno</title><meta name="description" content="Estudio de arquitectura en Bilbao con veinte años de experiencia.">
<link rel="icon" href="/favicon.png"><link rel="alternate" hreflang="eu" href="/eu/">
</head><body><svg class="site-logo"></svg><h1>Arquitectura</h1>
<a href="/aviso-legal">Aviso legal</a><a href="/privacidad">Privacidad</a><a href="/cookies">Cookies</a>
<a href="https://www.instagram.com/estudiobueno">IG</a>
<a href="mailto:hola@estudiobueno.com">hola@estudiobueno.com</a>
<form><textarea></textarea></form>
<footer>© 2015–2026 Estudio Bueno</footer></body></html>`;

describe("analyzeHtml", () => {
  it("detecta una web antigua y sus oportunidades", () => {
    const s = analyzeHtml(OLD_SITE, "http://pelu.example.com/", NOW);
    expect(s.https).toBe(false);
    expect(s.viewport).toBe(false);
    expect(s.copyrightYear).toBe(2017);
    expect(s.wordpressVersion).toBe("4.9.8");
    expect(s.jqueryVersion).toBe("1.12.4");
    expect(s.genericEmail).toBe(true);
    expect(s.sellsProducts).toBe(true);
    expect(s.shopPlatform).toBeNull();
    expect(s.orderByWhatsapp).toBe(true);
    expect(s.agencyCredit).toMatch(/Agencia Vieja/);
    expect(s.mentionsOpening).toBe(true);
    expect(s.logoUrl).toBe("http://pelu.example.com/img/logo-peluqueria.jpg");
    expect(s.legal.avisoLegal).toBe(false);
    expect(isOldTech(s)).toMatch(/WordPress 4\.9\.8/);
  });

  it("reconoce una web cuidada", () => {
    const s = analyzeHtml(GOOD_SITE, "https://estudiobueno.com/", NOW);
    expect(s.viewport).toBe(true);
    expect(s.copyrightYear).toBe(2026);
    expect(s.basque).toBe(true);
    expect(s.genericEmail).toBe(false);
    expect(s.contactForm).toBe(true);
    expect(s.logoIsSvg).toBe(true);
    expect(s.legal).toEqual({ avisoLegal: true, privacidad: true, cookies: true });
    expect(s.social.instagram).toMatch(/instagram/);
    expect(isOldTech(s)).toBeNull();
  });

  it("detecta constructores gratuitos", () => {
    const s = analyzeHtml("<html><body>hola</body></html>", "https://mitienda.wixsite.com/inicio", NOW);
    expect(s.freeBuilder).toMatch(/Wix/);
  });
});

describe("evaluate + scoreLead", () => {
  it("una web antigua sin ficha de Google puntúa alto y explica cada punto", () => {
    const site = analyzeHtml(OLD_SITE, "http://pelu.example.com/", NOW);
    const { results, autoTriggers } = evaluate({
      website: "http://pelu.example.com/",
      site,
      fetchError: null,
      httpsWorks: false,
      place: "not_found",
      performance: 31,
      viewportOk: null,
      basqueArea: true,
      brand: null,
      now: NOW,
    });
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId.https.met).toBe(false);
    expect(byId.mobile.met).toBe(false);
    expect(byId.updated.evidence).toMatch(/2017/);
    expect(byId.pro_email.evidence).toMatch(/gmail/);
    expect(byId.shop.met).toBe(false);
    expect(byId.basque.met).toBe(false);
    expect(byId.gbp_exists.met).toBe(false);
    expect(byId.logo_quality.met).toBeNull();
    expect(autoTriggers.sort()).toEqual(["opening", "stale_site"]);
    // Todos los criterios tienen resultado.
    expect(new Set(results.map((r) => r.id))).toEqual(new Set(CRITERIA.map((c) => c.id)));

    const sc = scoreLead(results, autoTriggers);
    expect(sc.level).toBe("alta");
    expect(sc.score).toBeGreaterThan(70);

    const keys = suggestProducts(results, { sellsProducts: true }).map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["web-design-template", "web-dev-template", "seo-basic", "ecommerce", "extra-language", "pro-email", "google-business"]));
    expect(keys).not.toContain("web-refresh");
  });

  it("una web cuidada con ficha completa puntúa bajo", () => {
    const site = analyzeHtml(GOOD_SITE, "https://estudiobueno.com/", NOW);
    const { results, autoTriggers } = evaluate({
      website: "https://estudiobueno.com/",
      site,
      fetchError: null,
      httpsWorks: true,
      place: { website: "https://estudiobueno.com/", photoCount: 10, hasHours: true },
      performance: 88,
      viewportOk: true,
      basqueArea: true,
      brand: {
        logo_quality: { met: true, evidence: "Logo vectorial limpio" },
        visual_consistency: { met: true, evidence: "Paleta coherente" },
        photo_quality: { met: true, evidence: "Fotos propias" },
      },
      now: NOW,
    });
    const sc = scoreLead(results, autoTriggers);
    expect(sc.level).toBe("baja");
    expect(sc.score).toBeLessThan(15);
    expect(suggestProducts(results, { sellsProducts: false })).toEqual([]);
  });

  it("sin web: landing, Google y puntuación máxima en web", () => {
    const { results } = evaluate({ website: null, site: null, fetchError: null, httpsWorks: false, place: { website: null, photoCount: 2, hasHours: false }, performance: null, viewportOk: null, basqueArea: false, brand: null, now: NOW });
    const sc = scoreLead(results, []);
    expect(sc.byAxis.web.pct).toBe(100);
    const keys = suggestProducts(results, { sellsProducts: false }).map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["landing", "seo-basic", "google-business"]));
  });

  it("perfil de Instagram como web cuenta como sin web", () => {
    const { results } = evaluate({ website: "https://www.instagram.com/negocio", site: null, fetchError: null, httpsWorks: false, place: null, performance: null, viewportOk: null, basqueArea: false, brand: null, now: NOW });
    expect(results.find((r) => r.id === "has_website")?.evidence).toMatch(/perfil de redes/);
  });

  it("las señales de momento suman como mucho 15 puntos", () => {
    const base = [{ id: "https", met: true, evidence: "", source: "auto" as const }];
    expect(scoreLead(base, ["a", "b", "c", "d", "e"]).score).toBe(15);
  });
});
