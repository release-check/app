const API_BASE = window.RELEASE_CHECK_API_BASE ?? "http://localhost:3000";

declare global {
  interface Window {
    RELEASE_CHECK_API_BASE?: string;
  }
}
const platformOrder = [
  "spotify",
  "youtube_music",
  "apple_music",
  "soundcloud",
  "bandcamp",
  "melon",
] as const;

type Platform = (typeof platformOrder)[number];
type CandidateOrigin = "handwritten_demo" | "synthetic_load" | "verified_musicbrainz";

interface AvailabilityEntry {
  state: string;
  url?: string;
  note?: string;
}

interface Candidate {
  id: string;
  canonical: {
    artist: string;
    title: string;
    release?: string;
    durationSeconds?: number;
    isrc?: string;
  };
  confidence: number;
  ambiguity: string[];
  evidence: Array<{
    field: string;
    score: number;
    note: string;
  }>;
  availability: Record<Platform, AvailabilityEntry>;
  origin?: CandidateOrigin;
  sample?: {
    origin?: CandidateOrigin;
    verified?: boolean;
  };
}

interface SearchResponse {
  query?: {
    latencyBudgetMs?: number;
  };
  candidates?: Candidate[];
}

const platformLabels: Record<Platform, string> = {
  spotify: "Spotify",
  youtube_music: "YouTube Music",
  apple_music: "Apple Music",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  melon: "Melon",
};

const form = mustQuery<HTMLFormElement>("#search-form");
const queryInput = mustQuery<HTMLInputElement>("#query");
const apiStatus = mustQuery<HTMLElement>("#api-status");
const candidateCount = mustQuery<HTMLElement>("#candidate-count");
const latencyBudget = mustQuery<HTMLElement>("#latency-budget");
const unknownCount = mustQuery<HTMLElement>("#unknown-count");
const queryLabel = mustQuery<HTMLElement>("#query-label");
const candidateList = mustQuery<HTMLElement>("#candidate-list");
const detailPanel = mustQuery<HTMLElement>("#detail-panel");

let currentCandidates: Candidate[] = [];
let selectedCandidateId = "";

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void runSearch(queryInput.value);
});

const suggestionsList = mustQuery<HTMLDataListElement>("#query-suggestions");
let suggestionTimer: ReturnType<typeof setTimeout> | undefined;

queryInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => {
    void refreshSuggestions(queryInput.value);
  }, 150);
});

async function refreshSuggestions(query: string): Promise<void> {
  const trimmed = query.trim();
  suggestionsList.innerHTML = "";
  if (trimmed.length < 2) {
    return;
  }

  try {
    const url = new URL("/suggest", API_BASE);
    url.searchParams.set("q", trimmed);
    const response = await fetch(url);
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      suggestions: Array<{ artist: string; title: string }>;
    };
    for (const suggestion of payload.suggestions ?? []) {
      const option = document.createElement("option");
      option.value = `${suggestion.artist} — ${suggestion.title}`;
      suggestionsList.appendChild(option);
    }
  } catch {
    // Suggestions are non-critical; drop silently.
  }
}

void checkHealth();
void runSearch(queryInput.value);

async function checkHealth(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    apiStatus.textContent = "online";
  } catch {
    apiStatus.textContent = "offline";
  }
}

async function runSearch(query: string): Promise<void> {
  const trimmedQuery = query.trim();
  queryLabel.textContent = trimmedQuery ? `"${trimmedQuery}"` : "";
  candidateList.innerHTML = "";
  detailPanel.innerHTML = '<div class="empty-state">Searching the local demo index...</div>';

  try {
    const url = new URL("/search", API_BASE);
    url.searchParams.set("q", trimmedQuery);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Search failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as SearchResponse;
    currentCandidates = payload.candidates ?? [];
    selectedCandidateId = currentCandidates[0]?.id ?? "";

    candidateCount.textContent = String(currentCandidates.length);
    latencyBudget.textContent = `${payload.query?.latencyBudgetMs ?? 150} ms`;
    unknownCount.textContent = String(countUnknownStates(currentCandidates));

    renderCandidates();
    renderDetail(currentCandidates[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown search error";
    candidateCount.textContent = "0";
    unknownCount.textContent = "0";
    candidateList.innerHTML = "";
    detailPanel.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
  }
}

function renderCandidates(): void {
  if (currentCandidates.length === 0) {
    candidateList.innerHTML = '<div class="empty-state">No demo candidates found.</div>';
    return;
  }

  candidateList.innerHTML = currentCandidates
    .map((candidate, index) => {
      const activeClass = candidate.id === selectedCandidateId ? " is-active" : "";
      const ambiguity = candidate.ambiguity
        .map((marker) => `<span class="pill pill-ambiguity">${escapeHtml(marker)}</span>`)
        .join("");
      const originBadge = renderOriginBadge(candidate);

      return `
        <button class="candidate-button${activeClass}" data-candidate-id="${escapeHtml(candidate.id)}">
          <div class="candidate-title">
            <strong>${index + 1}. ${escapeHtml(candidate.canonical.artist)} - ${escapeHtml(candidate.canonical.title)}</strong>
            <span>${escapeHtml(candidate.canonical.release ?? "Release unknown")}</span>
          </div>
          <div class="candidate-meta">
            <span class="pill pill-confidence">${Math.round(candidate.confidence * 100)}%</span>
            ${originBadge}
            ${ambiguity}
          </div>
        </button>
      `;
    })
    .join("");

  for (const button of Array.from(
    candidateList.querySelectorAll<HTMLButtonElement>(".candidate-button"),
  )) {
    button.addEventListener("click", () => {
      selectedCandidateId = button.dataset.candidateId ?? "";
      renderCandidates();
      renderDetail(currentCandidates.find((candidate) => candidate.id === selectedCandidateId));
    });
  }
}

function renderDetail(candidate: Candidate | undefined): void {
  if (!candidate) {
    detailPanel.innerHTML = '<div class="empty-state">No candidate selected.</div>';
    return;
  }

  detailPanel.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(candidate.canonical.artist)} - ${escapeHtml(candidate.canonical.title)}</h2>
      <p class="detail-subtitle">
        ${escapeHtml(candidate.canonical.release ?? "Release unknown")}
        ${candidate.canonical.durationSeconds ? ` - ${candidate.canonical.durationSeconds}s` : ""}
        ${candidate.canonical.isrc ? ` - ${escapeHtml(candidate.canonical.isrc)}` : ""}
      </p>
      <div class="candidate-meta">
        <span class="pill pill-confidence">${Math.round(candidate.confidence * 100)}% confidence</span>
        ${renderOriginBadge(candidate)}
        ${candidate.ambiguity
          .map((marker) => `<span class="pill pill-ambiguity">${escapeHtml(marker)}</span>`)
          .join("")}
      </div>
    </div>

    <section class="detail-section">
      <div class="section-heading">
        <h2>Platform availability</h2>
      </div>
      <div class="availability-grid">
        ${platformOrder.map((platform) => renderPlatform(platform, candidate.availability[platform])).join("")}
      </div>
    </section>

    <section class="detail-section">
      <details class="evidence-panel" open>
        <summary class="evidence-panel-summary">
          <span class="evidence-panel-title">Match evidence</span>
          <span class="evidence-panel-count">${candidate.evidence.length} fields</span>
        </summary>
        <div class="evidence-list">
          ${candidate.evidence.map(renderEvidence).join("")}
        </div>
      </details>
    </section>
  `;
}

function renderPlatform(platform: Platform, entry: AvailabilityEntry | undefined): string {
  const state = entry?.state ?? "unknown";
  const note = entry?.note ?? "No indexed evidence yet.";
  const url = entry?.url
    ? `<a class="platform-link" href="${escapeAttribute(entry.url)}" target="_blank" rel="noreferrer">Open candidate</a>`
    : "";

  return `
    <article class="platform-row platform-row--${escapeAttribute(state)}">
      <div class="platform-top">
        <span class="platform-name">${platformLabels[platform]}</span>
        ${renderStateBadge(state)}
      </div>
      <p class="platform-note">${escapeHtml(note)}</p>
      ${url}
    </article>
  `;
}

function renderEvidence(evidence: Candidate["evidence"][number]): string {
  const scorePercent = Math.round(evidence.score * 100);

  return `
    <details class="evidence-row">
      <summary class="evidence-summary">
        <span class="evidence-field">${escapeHtml(evidence.field)}</span>
        <span class="score">${scorePercent}%</span>
      </summary>
      <p class="evidence-note">${escapeHtml(evidence.note)}</p>
    </details>
  `;
}

function renderOriginBadge(candidate: Candidate): string {
  const origin = candidate.origin ?? candidate.sample?.origin;
  if (!origin) {
    return "";
  }

  if (origin === "verified_musicbrainz") {
    return '<span class="pill pill-verified" title="Hand-verified MusicBrainz seed">MB verified</span>';
  }

  if (origin === "handwritten_demo") {
    return '<span class="pill pill-demo" title="Handwritten demo fixture">Demo seed</span>';
  }

  return '<span class="pill pill-synthetic" title="Synthetic load fixture">Synthetic</span>';
}

function renderStateBadge(state: string): string {
  const labels: Record<string, string> = {
    available: "Available",
    missing: "Missing",
    unknown: "Unknown",
    region_locked: "Region locked",
    removed: "Removed",
    duplicate_candidate: "Duplicate candidate",
  };

  const label = labels[state] ?? state.replaceAll("_", " ");
  return `<span class="state state-${escapeAttribute(state)}" title="${escapeAttribute(label)}">${escapeHtml(label)}</span>`;
}

function countUnknownStates(candidates: Candidate[]): number {
  return candidates.reduce((total, candidate) => {
    return (
      total +
      Object.values(candidate.availability).filter((entry) => entry.state === "unknown").length
    );
  }, 0);
}

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string | number): string {
  return escapeHtml(value);
}

export {};
