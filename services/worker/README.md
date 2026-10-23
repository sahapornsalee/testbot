# Worker (not a separate service yet)

In the MVP, downloads run inside the API process (`services/api/app/workers/runner.py`) with a
concurrency semaphore, per-job timeouts and cancellation. That is enough for Local Mode and a
single small server, so no separate worker code or Dockerfile exists yet — an empty placeholder
would only pretend otherwise.

## When to split it out

- more than one API replica, or long media jobs blocking API restarts;
- you want the API container to have **no** outbound internet access, and only the worker to have
  tightly filtered egress (recommended for public deployments, see `docs/SECURITY.md`).

## How

1. Implement the `JobQueue` protocol from `runner.py` with a broker (Redis + RQ/Arq, or Celery):
   `create_job` inserts the row and enqueues the job ID; `cancel` sets a cancel flag the worker polls.
2. Create `services/worker/app/main.py` that consumes job IDs and calls `JobRunner.execute(job_id)`
   (reusing `app.services.*` from the API package).
3. Move the database from SQLite to PostgreSQL and the files to a shared volume or object storage
   with signed, short-lived download URLs.
4. Add `docker/worker.Dockerfile` and a `worker` service to `docker-compose.yml` on its own network
   with an egress firewall that blocks private address ranges.
