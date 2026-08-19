# syntax=docker/dockerfile:1

# ---- builder: Rust matching core ----
FROM rust:1.86-slim AS core-builder
WORKDIR /build
COPY core/ ./core/
RUN cargo build --release --manifest-path core/Cargo.toml -p rc-worker

# ---- runtime: Bun API ----
FROM oven/bun:1.3.14
WORKDIR /app

COPY --from=core-builder /build/core/target/release/rc-worker /usr/local/bin/rc-worker

COPY package.json bun.lock ./
COPY apps/ ./apps/
COPY packages/ ./packages/

RUN bun install --frozen-lockfile

ENV RELEASE_CHECK_DB=/data/releasecheck.db
ENV RELEASE_CHECK_CORE_BIN=/usr/local/bin/rc-worker
ENV PORT=3000

EXPOSE 3000
VOLUME /data

CMD ["bun", "run", "--cwd", "apps/api", "src/index.ts"]
