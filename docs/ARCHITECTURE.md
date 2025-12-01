# vercel-draw-lots — LLM-oriented design & flow

Short description
- A minimal Next.js app to let a host create a single shareable URL that encodes the remaining "lots" (9 hardcoded sports themes) in the URL. Visitors click Draw and receive a unique theme; the app produces an updated URL representing the new state. Stateless — no external DB required.

Repo locations (important files)
- /pages/index.js    — full frontend logic, encode/decode and draw flow (single-file app)
- /README.md         — human-friendly guide (current)
- /package.json      — dependencies & scripts
- /next.config.js    — Next.js config
- /.gitignore        — excludes node_modules/.next/.vercel
- /public/favicon.ico

Hardcoded items and index mapping
DEFAULT_THEMES (index -> label)
0. Basketball
1. Baseball
2. Swimming
3. Golf
4. Gym
5. Badminton
6. Cycling
7. Soccer
8. Fencing

State formats and encoding
1) Legacy format — Base64URL-encoded JSON (compatible)
   - JSON shape:
     { id: string, items: [{id: string, label: string}, ...], meta: { createdAt: number } }
   - encodeState(JSON) -> base64url(JSON)
   - decodeState tries this first for backwards compatibility.

2) Compact format — 9-bit mask (short)
   - Format string: "m<maskBase36>[.t<timeBase36>]"
   - mask: integer where bit i (1<<i) means DEFAULT_THEMES[i] is still available
     - initial mask when all 9 items available: (1<<9)-1 = 511 -> "m" + 511 in base36 = "m..." (short)
   - Optional timestamp: ".t<timeBase36>" for debugging/visibility
   - decodeState recognizes the mask and reconstructs `items` array for UI compatibility.

Primary functions & responsibilities (pages/index.js)
- base64UrlEncode / base64UrlDecode
  - Browser-safe base64url encode/decode for legacy format.

- encodeState(obj)
  - If obj.mask (number) exists -> produce compact mask string "m..."
  - Else -> fallback to base64url(JSON)

- decodeState(s)
  - Try legacy base64 JSON parse first.
  - If fails, try compact mask regex and return { mask, items, meta }.

- createInitialLink()
  - Host action (only shown when no ?state=).
  - Creates initial mask with all bits set or items list then encodes with encodeState().
  - router.push to new URL and copies the URL to clipboard.

- drawOne()
  - Visitor action (active when ?state= is present).
  - Reads decoded state (mask or reconstructed items).
  - Builds available indices from mask.
  - Randomly picks an index from available.
  - Removes the bit (mask &= ~ (1<<idx)), encodes new state and pushes to router with shallow routing.
  - Copies the updated link to the clipboard and sets lastPick for UI.

- resetToHost()
  - Clears state from URL (router pushes path without query), returning UI to host mode.

- copyToClipboard(text)
  - Uses navigator.clipboard with DOM fallback.

Frontend flow summary
- Host opens app (no ?state=): reviews themes -> Create Link -> link copied -> share link.
- Participant opens shared link (?state=m... or base64): UI shows "Draw" and current remaining count (anonymous).
- Participant clicks Draw -> assigned a random remaining theme -> lastPick shown -> updated ?state= link generated and copied for the next participant.
- If available items = 0 -> shows "All themes have been drawn — the game is finished."

Known limitations and design notes
- Race conditions: The system is stateless and client-driven. Two participants using the same snapshot link can draw the same theme. This is inherent to URL-only state.
- Shortness: compact mask format reduces URL length drastically (2–6 characters for mask only).
- Not secret: State is not encrypted or signed. Anyone with the link can decode and see remaining items (use HMAC for tamper detection).
- Final-draw bug fixed: drawOne now handles the case where the last remaining item is assigned correctly; busy flag added to avoid double-clicks.

Recommended next enhancements
- Prevent races:
  - Add server-side atomic claims — Vercel KV or an API route to claim items atomically.
  - Or pre-generate per-user sealed one-time links (sealed tokens) with host distribution.
- Tamper detection:
  - HMAC sign the payload with an env secret; reject links failing signature.
- Extra compacting:
  - Drop timestamp in mask to shorten further.
  - Use base62 for a few additional bytes of compression.
- UX:
  - Better error messages for stale links; show link timestamp + version.
  - Explicit "use the latest link" notice and link expiry if a server store is used.

Testing hints for LLM agents
- To reproduce:
  - Create link -> make multiple browser sessions or copy link to multiple tabs -> draw sequentially using the updated link.
  - For race reproduction: open same link in two tabs and click Draw in both before sharing the updated link.
- Confirm URL changes after each draw and clipboard receives the new state.

Commit history highlights (relevant)
- feat: initial commit — stateless anonymous draw app (initial)
- fix: allow final draw, prevent duplicate draws, auto-copy updated link (race/double click mitigation)
- feat: compact URL state encoding (9-bit mask) to shorten state param (short links)

If you need, generate a machine-readable changelog or an automated test plan next.