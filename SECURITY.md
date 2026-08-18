# Security Policy

## Demonstration boundary

CollabFlow is a portfolio project. The seeded identities, Compose database password, and demo-login endpoint exist only to make local review reproducible. They must not be used in an internet-facing deployment.

## Production hardening checklist

| Area | Required action |
| --- | --- |
| Authentication | Replace `POST /api/demo/login` with an OIDC or SAML-backed provider and enforce account lifecycle controls. |
| Secrets | Supply `JWT_SECRET`, database credentials, and Redis credentials through a secret manager; never commit them. |
| Transport | Terminate TLS at an ingress or reverse proxy and set an explicit allowlist for `CORS_ORIGIN`. |
| Data | Enable managed PostgreSQL backups, encrypted storage, retention controls, and migration review. |
| Redis | Use private networking and authenticated TLS Redis for any shared environment. |
| Authorization | Keep workspace membership checks server-side for every REST action and Socket.IO room join. |
| Operations | Monitor liveness/readiness endpoints, restrict container privileges, and rotate secrets following an incident. |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Contact the repository owner privately with a concise reproduction and impact description. The project owner will acknowledge receipt, assess the report, and coordinate a remediation timeline.
