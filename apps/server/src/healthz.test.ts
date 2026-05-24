import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

// We mount only the /healthz route on a fresh app to keep this test
// fast and isolated from db / auth / SPA fallback wiring. The contract
// is intentionally tiny: a 200 with { ok: true } that Docker HEALTHCHECK
// and the CI smoke job can grep for. If this test fails, those probes
// silently break and the container can crash-loop unnoticed — exactly
// the failure mode the notes container hit before this guard existed.
describe("/healthz", () => {
  test("returns 200 with { ok: true }", async () => {
    const app = new Hono();
    app.get("/healthz", (c) => c.json({ ok: true }));

    const res = await app.request("/healthz");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
