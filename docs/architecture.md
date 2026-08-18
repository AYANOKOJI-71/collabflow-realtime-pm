# Architecture decisions

## Why PostgreSQL and Redis have different responsibilities

PostgreSQL is the durable source of truth for workspaces, memberships, projects, tasks, and activity records. Redis is not used as a replacement database: it is attached to Socket.IO as a publish/subscribe adapter so a client connected to one API process can receive an event emitted by another process. This separation keeps ephemeral live notifications independent from transactional project data.

## Concurrency model

Each task has a positive `version`. A client sends the version it last read as `expectedVersion`; the API updates only when it matches the database row. A failure produces `409 VERSION_CONFLICT`, which lets the client reload rather than silently overwriting a teammate’s work.

## Authorization model

The API checks workspace membership before returning dashboards or allowing task updates. Socket.IO validates a JWT during connection and checks membership again before the socket can join a workspace room. Client-side visibility is a convenience only; server-side authorization is the control boundary.
