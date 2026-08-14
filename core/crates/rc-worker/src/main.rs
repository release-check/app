use std::io::{self, Read};

use rc_core::{match_candidates, ReleaseCandidate, SourceTrack};
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

fn main() {
    let Some(command) = std::env::args().nth(1) else {
        eprintln!("usage: rc-worker match-json < input.json");
        std::process::exit(2);
    };

    if command != "match-json" {
        eprintln!("unknown command: {command}");
        std::process::exit(2);
    }

    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");

    let request: MatchRequest = serde_json::from_str(&input).expect("invalid match-json request");
    let response = MatchResponse {
        decisions: match_candidates(&request.source, &request.candidates),
    };

    serde_json::to_writer_pretty(io::stdout(), &response).expect("failed to write response");
    println!();
}
