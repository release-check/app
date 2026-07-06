const port = Number(process.env.WEB_PORT ?? 3001);
const publicRoot = new URL("../public/", import.meta.url);
const clientSource = new URL("./client.ts", import.meta.url);
const transpiler = new Bun.Transpiler({
  loader: "ts",
  target: "browser",
});

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

    if (pathname === "/app.js") {
      const source = await Bun.file(clientSource).text();
      return new Response(transpiler.transformSync(source), {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }

    const safePathname = pathname.replace(/^\/+/, "");

    if (safePathname.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const file = Bun.file(new URL(safePathname, publicRoot));
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }

    const extension = safePathname.match(/\.[^.]+$/)?.[0] ?? "";
    return new Response(file, {
      headers: {
        "content-type": contentTypes[extension] ?? "application/octet-stream",
      },
    });
  },
});

console.log(`ReleaseCheck web demo listening on http://localhost:${port}`);
