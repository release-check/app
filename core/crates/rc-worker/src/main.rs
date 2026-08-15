use std::collections::HashSet;
use std::io::{self, Read};

use rc_core::{
    explain_basic_match, match_candidates, MatchStatus, NormalizedRecord, PlatformStatus,
    ReleaseCandidate, SourceTrack,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct MatchRequest {
    source: SourceTrack,
    candidates: Vec<ReleaseCandidate>,
}

#[derive(Debug, Serialize)]
struct MatchResponse {
    decisions: Vec<rc_core::MatchDecision>,
}

#[derive(Debug, Deserialize)]
struct EvalGoldenRequest {
    cases: Vec<EvalGoldenCase>,
    top_n: usize,
}

#[derive(Debug, Deserialize)]
struct EvalGoldenCase {
    source: SourceTrack,
    candidates: Vec<ReleaseCandidate>,
    acceptable_top3_ids: Vec<String>,
    #[serde(default)]
    candidate_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
struct EvalGoldenCaseResult {
    case_index: usize,
    top3_hit: bool,
    top_n_ids: Vec<String>,
    rejected_count: usize,
    false_positive_count: usize,
}

#[derive(Debug, Serialize)]
struct EvalGoldenResponse {
    case_results: Vec<EvalGoldenCaseResult>,
    top3_hits: usize,
    rejected_count: usize,
}

#[derive(Debug, Deserialize)]
struct IndexJsonRequest {
    records: Vec<IndexInputRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum IndexInputRecord {
    Candidate(ReleaseCandidate),
    Source(SourceTrack),
}

fn main() {
    let Some(command) = std::env::args().nth(1) else {
        eprintln!("usage: rc-worker <match-json|eval-golden|index-json> < input.json");
        std::process::exit(2);
    };

    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");

    match command.as_str() {
        "match-json" => run_match_json(&input),
        "eval-golden" => run_eval_golden(&input),
        "index-json" => run_index_json(&input),
        _ => {
            eprintln!("unknown command: {command}");
            std::process::exit(2);
        }
    }
}

fn run_match_json(input: &str) {
    let request: MatchRequest = serde_json::from_str(input).expect("invalid match-json request");
    let response = MatchResponse {
        decisions: match_candidates(&request.source, &request.candidates),
    };

    serde_json::to_writer_pretty(io::stdout(), &response).expect("failed to write response");
    println!();
}

fn run_eval_golden(input: &str) {
    let request: EvalGoldenRequest =
        serde_json::from_str(input).expect("invalid eval-golden request");
    let mut case_results = Vec::with_capacity(request.cases.len());
    let mut top3_hits = 0usize;
    let mut rejected_count = 0usize;

    for (case_index, eval_case) in request.cases.iter().enumerate() {
        let candidate_ids = candidate_ids_for_case(eval_case);
        let decisions = match_candidates(&eval_case.source, &eval_case.candidates);
        let top_n = request.top_n.min(decisions.len());
        let top_n_ids = decisions
            .iter()
            .take(top_n)
            .map(|decision| candidate_ids[decision.candidate_index].clone())
            .collect::<Vec<_>>();
        let case_acceptable: HashSet<&str> = eval_case
            .acceptable_top3_ids
            .iter()
            .map(String::as_str)
            .collect();
        let top3_hit = top_n_ids
            .iter()
            .any(|candidate_id| case_acceptable.contains(candidate_id.as_str()));

        let case_rejected_count = decisions
            .iter()
            .filter(|decision| decision.status == MatchStatus::Rejected)
            .count();
        let false_positive_count = decisions
            .iter()
            .filter(|decision| decision.status == MatchStatus::FalsePositive)
            .count();

        if top3_hit {
            top3_hits += 1;
        }
        rejected_count += case_rejected_count;

        case_results.push(EvalGoldenCaseResult {
            case_index,
            top3_hit,
            top_n_ids,
            rejected_count: case_rejected_count,
            false_positive_count,
        });
    }

    let response = EvalGoldenResponse {
        case_results,
        top3_hits,
        rejected_count,
    };

    serde_json::to_writer_pretty(io::stdout(), &response).expect("failed to write response");
    println!();
}

fn run_index_json(input: &str) {
    let request: IndexJsonRequest = serde_json::from_str(input).expect("invalid index-json request");
    let normalized_records = request
        .records
        .iter()
        .map(normalize_index_record)
        .collect::<Vec<_>>();

    serde_json::to_writer_pretty(io::stdout(), &normalized_records)
        .expect("failed to write response");
    println!();
}

fn candidate_ids_for_case(eval_case: &EvalGoldenCase) -> Vec<String> {
    if eval_case.candidate_ids.len() == eval_case.candidates.len() {
        return eval_case.candidate_ids.clone();
    }

    (0..eval_case.candidates.len())
        .map(|index| index.to_string())
        .collect()
}

fn normalize_index_record(record: &IndexInputRecord) -> NormalizedRecord {
    match record {
        IndexInputRecord::Source(source) => {
            let candidate = source_as_candidate(source);
            explain_basic_match(&candidate, &candidate).normalized_source
        }
        IndexInputRecord::Candidate(candidate) => {
            explain_basic_match(candidate, candidate).normalized_candidate
        }
    }
}

fn source_as_candidate(source: &SourceTrack) -> ReleaseCandidate {
    ReleaseCandidate {
        platform: String::new(),
        artist: source.artist.clone(),
        artist_aliases: source.artist_aliases.clone(),
        title: source.title.clone(),
        album: source.album.clone(),
        version: source.version.clone(),
        duration_ms: source.duration_ms,
        isrc: source.isrc.clone(),
        url: source.url.clone(),
        status: PlatformStatus::Unknown,
    }
}
