# Vercel Draw Lots — Full implementation

This document contains a complete, copy-paste friendly Next.js project you can deploy to Vercel **without any external database**. It uses **URL‑encoded state** (Base64 JSON in `?state=`) so the app is fully stateless and shareable: after someone draws, the app generates a new link with the updated list.

---

## Project structure (all files provided below)

- package.json
- README.md (this file)
- pages/index.js
- next.config.js
- public/favicon.ico (optional)

---

## How it works (short)

1. A host creates a list of items (your 9 sports themes) and clicks **Create Link**. That generates a shareable URL with the encoded list in the `state` query parameter.
2. Each person visits the URL. When they press **Draw**, the app randomly selects one remaining theme, removes it from the list, and generates a **new URL** for the updated state.
3. The drawer can copy the **Updated link** and paste it to the group (or press "Copy updated link"). No database, no accounts.

Security note: The state is only base64-encoded JSON. It's not secret or signed. If you want tamper detection, we can add HMAC signing with a secret stored in an environment variable (still no DB).

---

## Files

### package.json

```json
{
  "name": "vercel-draw-lots",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "nanoid": "4.0.0"
  }
}
```

> Note: Versions are example stable values. If `next 14` isn't available, `next 13` works too. Adjust as needed.

---

### next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}
module.exports = nextConfig
```

---

### pages/index.js

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { nanoid } from 'nanoid'

// --- Helpers: encode/decode state in URL ---
function encodeState(obj) {
  try {
    return Buffer.from(JSON.stringify(obj)).toString('base64url')
  } catch (e) {
    return ''
  }
}
function decodeState(s) {
  try {
    if (!s) return null
    const json = Buffer.from(s, 'base64url').toString('utf8')
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}

function randomPick(arr) {
  if (!arr || arr.length === 0) return null
  const i = Math.floor(Math.random() * arr.length)
  return { item: arr[i], index: i }
}

export default function Home() {
  const router = useRouter()
  const { state: stateParam } = router.query

  // local UI form
  const [inputText, setInputText] = useState('Football\nBasketball\nTennis\nCricket\nBaseball\nRugby\nHockey\nVolleyball\nSwimming')
  const [session, setSession] = useState(() => ({ id: nanoid(), createdAt: Date.now() }))
  const decoded = useMemo(() => decodeState(stateParam), [stateParam])

  // decoded state has shape: { id, items: [{id, label}], meta: {createdAt}}
  const items = decoded?.items ?? []

  // UI state for the drawer result
  const [lastPick, setLastPick] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2200)
      return () => clearTimeout(t)
    }
  }, [copied])

  function createInitialLink() {
    const lines = inputText.split('\n').map(s => s.trim()).filter(Boolean)
    const items = lines.map((label, idx) => ({ id: `${session.id}-${idx}`, label }))
    const payload = {
      id: session.id,
      items,
      meta: { createdAt: Date.now() }
    }
    const enc = encodeState(payload)
    const url = `${window.location.origin}${window.location.pathname}?state=${enc}`
    copyToClipboard(url)
    // navigate to the created URL
    router.push(`/?state=${enc}`, undefined, { shallow: true })
  }

  function copyToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {
        // fallback
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
      })
    }
  }

  async function drawOne() {
    if (!items || items.length === 0) return
    const { item, index } = randomPick(items)
    setLastPick(item)

    // remove picked item -> new items
    const newItems = items.filter((_, i) => i !== index)
    const newState = { id: decoded?.id ?? session.id, items: newItems, meta: decoded?.meta ?? {}} 
    const enc = encodeState(newState)
    const newUrl = `${window.location.origin}${window.location.pathname}?state=${enc}`

    // navigate to new url shallow - replaces query
    router.push(`/?state=${enc}`, undefined, { shallow: true })

    // copy the updated link for convenience
    copyToClipboard(newUrl)
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{fontSize: 28}}>Draw Lots — Shareable links (no DB)</h1>
      <p>Use this page to create a shareable link. When someone draws, the app removes that theme and generates a new link. The app stores state only in the URL (Base64 JSON).</p>

      <section style={{ marginTop: 20, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <h2 style={{fontSize:18}}>1) Create initial list</h2>
        <label>Enter one theme per line (example sports themes):</label>
        <textarea value={inputText} onChange={e => setInputText(e.target.value)} rows={9} style={{ width:'100%', marginTop:8, padding:8 }} />
        <div style={{ marginTop: 10 }}>
          <button onClick={createInitialLink} style={{ padding: '8px 12px', borderRadius:6 }}>Create Link & Copy</button>
          <span style={{ marginLeft: 12, opacity: 0.8 }}>{copied ? 'Link copied!' : 'Link will be copied to clipboard'}</span>
        </div>
      </section>

      <section style={{ marginTop: 18, padding: 12, border: '1px dashed #eee', borderRadius: 8 }}>
        <h2 style={{fontSize:18}}>2) Draw from shared link</h2>
        {items.length === 0 ? (
          <div>
            <em>No active list found. Create a link above and send to participants.</em>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems:'center' }}>
              <div>
                <strong>Remaining themes:</strong>
                <ul>
                  {items.map(it => <li key={it.id}>{it.label}</li>)}
                </ul>
              </div>
              <div>
                <button onClick={drawOne} style={{ padding:'10px 14px', borderRadius:8 }}>Draw</button>
                <p style={{ marginTop:8, fontSize:13, opacity:0.9 }}>After drawing, the app copies the updated share link to your clipboard.</p>
              </div>
            </div>

            {lastPick && (
              <div style={{ marginTop: 12, padding:10, background:'#f7fff7', border:'1px solid #dff5df', borderRadius:8 }}>
                <strong>You drew:</strong>
                <div style={{ fontSize:18, marginTop:6 }}>{lastPick.label}</div>
                <div style={{ marginTop:8 }}>
                  <button onClick={() => {
                    // rebuild current encoded state to copy again
                    const enc = stateParam
                    const curUrl = `${window.location.origin}${window.location.pathname}?state=${enc}`
                    copyToClipboard(curUrl)
                  }}>Copy current link</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section style={{ marginTop: 22, padding: 12, borderRadius: 8 }}>
        <h3>Notes & options</h3>
        <ul>
          <li>Anyone who has the latest link can draw next. The app generates updated link after each draw.</li>
          <li>If you want server-side enforcement (to avoid race conditions) we can add Vercel KV or a small API route with locking.</li>
          <li>To make links non-guessable, use many themes or add a short secret token in the URL when creating the initial link.</li>
        </ul>
      </section>

      <footer style={{ marginTop: 26, opacity:0.8 }}>
        <small>Built for a 9-theme best-dressed party. If you want improvements (HMAC signing, per-user claim links, or a visual countdown), tell me and I’ll add them.</small>
      </footer>
    </div>
  )
}
```

---

## Quick local commands

1. Create the project folder and files (copy the files above into a folder):

```bash
mkdir vercel-draw-lots
cd vercel-draw-lots
# create package.json and pages/index.js with the contents above
```

2. Install dependencies

```bash
npm install
# or
# pnpm install
# yarn
```

3. Run dev server locally

```bash
npm run dev`
# Open http://localhost:3000
```

4. Build and start production locally

```bash
npm run build
npm run start
```

---

## Deploy to Vercel (fast path)

If you have the Vercel CLI installed, these are the minimal steps.

1. Install Vercel CLI (if not already):

```bash
npm i -g vercel
```

2. Login to Vercel (one-time):

```bash
vercel login
# follow prompts to login with your email
```

3. Deploy the project (first deploy)

```bash
vercel
```

When prompted, choose the project name or accept defaults. Vercel will detect Next.js and deploy.

4. Quick production deploy

```bash
vercel --prod
```

Vercel will return a URL (https://your-project-username.vercel.app). Open it and use it.

---

## Optional: Make links shorter (friendly)

You can use a tiny URL parameter shortener (like bit.ly) or create a short redirect page that maps a short token to the `?state=` URL. That mapping *would* require a tiny database (or a Git-backed mapping) — if you want a pure no-DB approach we can base62 encode the state and rely on short tokens only if the encoded size is short enough.

---

## Optional: Race-condition considerations (two people draw at almost same time)

Because all state is client-side in the URL, two people opening the same link and pressing draw simultaneously may both get the same theme. To prevent this with serverless-only tools, you can:

- Add Vercel KV (serverless key-value) to lock and atomically claim an item.
- Use short-lived claim tokens pre-generated on the host's browser and distributed to participants (each token is tied to one theme). That requires the host to hand out one token per person.

If you want the Vercel KV option, say so and I'll add an API-route example using Vercel KV (still runs on Vercel, no external DB).

---

## Final notes

This repo is minimal and purposely simple: no DB, no accounts, stateless via encoded URL. It meets your requirement: 9 people draw unique themes, each draw removes the theme, and links are shareable.

If you'd like, I can also:
- Add HMAC signing with an environment variable to prevent tampering.
- Implement per-person one-time sealed links (the "sealed envelope" approach).
- Add a prettier UI (Tailwind, animations) and a copy-to-clipboard confirmation toast.

Tell me which extras you want and I'll update the code.
