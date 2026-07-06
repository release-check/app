import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "release-check-api",
  });
});

app.get("/search", (c) => {
  const query = c.req.query("q") ?? "";

  return c.json({
    query,
    results: [],
    note: "search index not wired yet",
  });
});

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
