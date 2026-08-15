use std::hint::black_box;
use std::time::Instant;

use criterion::{criterion_group, criterion_main, Criterion};
use rc_core::{
    match_candidates, PlatformStatus, ReleaseCandidate, SourceTrack,
};

const CANDIDATE_COUNT: usize = 600;
const QUERY_COUNT: usize = 1_000;
const P95_BUDGET_MS: f64 = 10.0;

const SCENES: [&str; 5] = [
    "korea-indie",
    "japan-doujin",
    "internet-scene",
    "club-tools",
    "archive-test",
];

const TITLE_ROOTS: [&str; 8] = [
    "Index Signal",
    "Cache Miss",
    "Regional Mirror",
    "Quiet Upload",
    "Catalog Drift",
    "Alias Check",
    "Version Trace",
    "Evidence Path",
];

const MESSY_SUFFIXES: [&str; 6] = ["", "Live", "Demo", "Remaster", "Instrumental", "Sped Up"];

const PLATFORMS: [&str; 6] = [
    "spotify",
    "apple_music",
    "youtube",
    "soundcloud",
    "discogs",
    "musicbrainz",
];

fn bench_match_candidates(c: &mut Criterion) {
    let candidates = build_synthetic_candidates(CANDIDATE_COUNT);
    let queries = build_queries(QUERY_COUNT);

    let report = measure_latency_report(&candidates, &queries);
    eprintln!("{}", report.format_summary());

    if report.p95_ms > P95_BUDGET_MS {
        panic!(
            "core match p95 {:.3} ms exceeds {:.1} ms budget (p50={:.3}, p99={:.3})",
            report.p95_ms, P95_BUDGET_MS, report.p50_ms, report.p99_ms
        );
    }

    c.bench_function("match_candidates_600x1000", |bencher| {
        bencher.iter(|| {
            for query in &queries {
                black_box(match_candidates(query, &candidates));
            }
        });
    });
}

fn measure_latency_report(
    candidates: &[ReleaseCandidate],
    queries: &[SourceTrack],
) -> LatencyReport {
    for query in queries.iter().take(25) {
        black_box(match_candidates(query, candidates));
    }

    let mut durations_ms = Vec::with_capacity(queries.len());
    for query in queries {
        let started_at = Instant::now();
        black_box(match_candidates(query, candidates));
        durations_ms.push(started_at.elapsed().as_secs_f64() * 1_000.0);
    }

    durations_ms.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));

    LatencyReport {
        dataset_size: candidates.len(),
        query_count: queries.len(),
        p50_ms: percentile(&durations_ms, 0.50),
        p95_ms: percentile(&durations_ms, 0.95),
        p99_ms: percentile(&durations_ms, 0.99),
        p95_budget_ms: P95_BUDGET_MS,
    }
}

struct LatencyReport {
    dataset_size: usize,
    query_count: usize,
    p50_ms: f64,
    p95_ms: f64,
    p99_ms: f64,
    p95_budget_ms: f64,
}

impl LatencyReport {
    fn format_summary(&self) -> String {
        format!(
            "core match bench: dataset_size={} query_count={} p50_ms={:.3} p95_ms={:.3} p99_ms={:.3} p95_budget_ms={:.1}",
            self.dataset_size,
            self.query_count,
            self.p50_ms,
            self.p95_ms,
            self.p99_ms,
            self.p95_budget_ms,
        )
    }
}

fn percentile(sorted_values: &[f64], fraction: f64) -> f64 {
    if sorted_values.is_empty() {
        return 0.0;
    }

    let index = ((sorted_values.len() as f64 * fraction).ceil() as usize)
        .saturating_sub(1)
        .min(sorted_values.len() - 1);
    sorted_values[index]
}

fn build_synthetic_candidates(count: usize) -> Vec<ReleaseCandidate> {
    (1..=count)
        .map(build_synthetic_candidate)
        .collect()
}

fn build_synthetic_candidate(serial: usize) -> ReleaseCandidate {
    let scene = SCENES[serial % SCENES.len()];
    let messy_case = serial % 3 == 0;
    let suffix = if messy_case {
        MESSY_SUFFIXES[serial % MESSY_SUFFIXES.len()]
    } else {
        ""
    };
    let title_root = TITLE_ROOTS[serial % TITLE_ROOTS.len()];
    let title = if suffix.is_empty() {
        format!("RC Synthetic {title_root} {serial:03}")
    } else {
        format!("RC Synthetic {title_root} {serial:03} ({suffix})")
    };
    let artist = format!("RC Synthetic Artist {}", (serial % 75) + 1);
    let platform = PLATFORMS[serial % PLATFORMS.len()];
    let status = match serial % 11 {
        0 => PlatformStatus::Unknown,
        1 => PlatformStatus::Missing,
        _ => PlatformStatus::Available,
    };

    ReleaseCandidate {
        platform: platform.to_string(),
        artist,
        artist_aliases: Vec::new(),
        title,
        album: Some(format!("Synthetic {scene} Set")),
        version: if messy_case && !suffix.is_empty() {
            Some(suffix.to_lowercase())
        } else {
            None
        },
        duration_ms: Some((150_000 + (serial % 220) * 1_000) as u32),
        isrc: Some(format!("RCSYN{serial:07}")),
        url: Some(format!(
            "https://example.test/{platform}/rc-synthetic-{serial:04}"
        )),
        status,
    }
}

fn build_queries(count: usize) -> Vec<SourceTrack> {
    let mut queries = vec![
        source_track("Park Hye Jin", "Like This"),
        source_track("DJ Python", "Angel live demo"),
        source_track("RC Synthetic Artist 1", "Angel"),
    ];

    for serial in 1..=(count.saturating_sub(queries.len())) {
        let signal = if serial % 2 == 0 {
            "Cache Miss"
        } else {
            "Index Signal"
        };
        let title = format!("RC Synthetic {signal} {serial:03}");
        let artist = format!("RC Synthetic Artist {}", (serial % 75) + 1);
        queries.push(source_track(&artist, &title));
    }

    queries.truncate(count);
    queries
}

fn source_track(artist: &str, title: &str) -> SourceTrack {
    SourceTrack {
        artist: artist.to_string(),
        artist_aliases: Vec::new(),
        title: title.to_string(),
        album: None,
        version: None,
        duration_ms: None,
        isrc: None,
        url: None,
    }
}

criterion_group!(benches, bench_match_candidates);
criterion_main!(benches);
