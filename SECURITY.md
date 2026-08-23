# Security and data-safety notes

ARE Agent Studio handles captured screens and can optionally control Android input. Treat both as sensitive capabilities.

## Secrets

- Never commit `.env.local`, provider tokens, Hugging Face tokens, or device credentials.
- Advisory provider credentials are server-side only.
- `HF_TOKEN` is read only by explicit publishing scripts.

## Dataset privacy

Captured frames can contain notifications, usernames, chat, email, payment data, or other personal information. Public dataset eligibility is off by default. Review captures and your redistribution rights before setting publication approval.

## ADB

ADB is disabled by default. Prefer a device-serial allowlist. The implementation uses `execFile` with fixed argument arrays and validates serial syntax/coordinates; do not replace it with shell-interpolated commands.

## Network exposure

The local dataset daemon defaults to loopback. If you deliberately expose it to a network, set `DATASET_AUTH_TOKEN`, configure `ALLOWED_ORIGINS`, terminate TLS at a trusted proxy, and protect the data directory.

## Reporting

Do not include credentials, private captured frames, or personal data in public bug reports. Until the repository owner publishes a dedicated vulnerability-reporting channel, use a private owner-controlled contact path rather than a public issue for security-sensitive reports.
