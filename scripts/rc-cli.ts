import { ReleaseCheckClient } from "../packages/rc-sdk-js/src/index";

const DEFAULT_BASE_URL = "http://localhost:3000";
const baseUrl = process.env.RELEASE_CHECK_API_URL ?? DEFAULT_BASE_URL;
const client = new ReleaseCheckClient(baseUrl);

const [, , command, ...rest] = process.argv;

function printUsage(): void {
  console.error(`Usage:
  bun run scripts/rc-cli.ts search <query>
  bun run scripts/rc-cli.ts availability <artist> <track>
  bun run scripts/rc-cli.ts resolve <url>

Environment:
  RELEASE_CHECK_API_URL  API base URL (default: ${DEFAULT_BASE_URL})`);
}

function isApiUnreachable(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("econnrefused") ||
      message.includes("fetch failed") ||
      message.includes("unable to connect") ||
      message.includes("network")
    ) {
      return true;
    }

    const nested = error.cause;
    if (nested instanceof Error && nested.message.toLowerCase().includes("econnrefused")) {
      return true;
    }
  }

  return false;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function runCommand(): Promise<void> {
  if (!command) {
    printUsage();
    fail("Missing command.");
  }

  try {
    switch (command) {
      case "search": {
        const query = rest.join(" ").trim();
        if (!query) {
          printUsage();
          fail("search requires a query.");
        }

        const result = await client.search(query);
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      case "availability": {
        if (rest.length < 2) {
          printUsage();
          fail("availability requires <artist> and <track>.");
        }

        const artist = rest[0]!;
        const track = rest.slice(1).join(" ").trim();
        if (!artist.trim() || !track) {
          printUsage();
          fail("availability requires non-empty <artist> and <track>.");
        }

        const result = await client.availability(artist, track);
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      case "resolve": {
        const url = rest.join(" ").trim();
        if (!url) {
          printUsage();
          fail("resolve requires a URL.");
        }

        const result = await client.resolve(url);
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      default:
        printUsage();
        fail(`Unknown command: ${command}`);
    }
  } catch (error) {
    if (isApiUnreachable(error)) {
      fail(
        `ReleaseCheck API unreachable at ${baseUrl}. Start the API with: bun run dev:api`,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    fail(message);
  }
}

await runCommand();
