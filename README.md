# Vercel Draw Lots

Small Next.js app for anonymous, shareable "lot" draws (no external DB required).  
Host creates a link that encodes the remaining choices in the URL; each draw produces an updated link that is copied for the next participant.

Why this exists

- Shareable, stateless group draws for small events (e.g., 9 themes for a best-dressed party).
- No hosting DB; can be deployed directly on Vercel.

Quick facts

- Items (hardcoded): Basketball, Baseball, Swimming, Golf, Gym, Badminton, Cycling, Soccer, Fencing
- State is encoded in ?state=:
  - compact format: "m<maskBase36>[.t<timeBase36>]" (short links using a 9-bit mask)
  - legacy format: Base64URL-encoded JSON (kept for backward compatibility)
- Each draw picks one random remaining theme and produces a new short URL representing the reduced set.

Usage

1. Host: open the app (base URL, no ?state=) -> click "Create link" -> copied link -> share it.
2. Participant: open shared link -> click "Draw" -> receives an anonymous theme -> updated link is copied for the next participant.
3. Reset: open the app without ?state= to start a new game (or use the Reset button in the UI if present).

Notes / limitations

- Stateless URL-only approach has inherent race conditions: if multiple people draw from the same stale link they may clash. For atomic claims use a server-side store (Vercel KV or API).
- Links are not secret or tamper-proof. Use HMAC/signing if needed.
- The UI includes a busy flag and last-draw handling to avoid duplicate draws from double clicks.

Dev & deployment

- Run locally: npm install && npm run dev
- Build: npm run build
- Deploy: push to Vercel (no DB required)
- Code entry: /pages/index.js contains all encoding, draw logic, and UI.

Docs

- Full architecture & flow: docs/ARCHITECTURE.md

Where to change themes

- Edit DEFAULT_THEMES in pages/index.js

License / notes

- Lightweight single-file concept — extend to server-backed claims in /pages/api when you need robust locking and tamper detection.
