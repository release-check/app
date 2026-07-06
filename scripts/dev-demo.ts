const api = Bun.spawn(["bun", "run", "dev:api"], {
  stdout: "inherit",
  stderr: "inherit",
});

const web = Bun.spawn(["bun", "run", "dev:web"], {
  stdout: "inherit",
  stderr: "inherit",
});

console.log("ReleaseCheck demo:");
console.log("- API: http://localhost:3000");
console.log("- Web: http://localhost:3001");

const stop = () => {
  api.kill();
  web.kill();
};

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

await Promise.race([api.exited, web.exited]);
stop();
