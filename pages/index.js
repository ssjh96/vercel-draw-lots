import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { nanoid } from 'nanoid'

// --- Helpers: base64url encode/decode (browser-safe) ---
function base64UrlEncode(str) {
  try {
    // btoa with unicode-safe conversion
    const b64 = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode('0x' + p1)
    ))
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch (e) {
    return ''
  }
}
function base64UrlDecode(s) {
  try {
    if (!s) return null
    s = s.replace(/-/g, '+').replace(/_/g, '/')
    // pad
    while (s.length % 4) s += '='
    const str = atob(s)
    // decode percent-encoded bytes back into string
    return decodeURIComponent(Array.prototype.map.call(str, ch =>
      '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
  } catch (e) {
    return null
  }
}

// New compact encoding:
// - For fixed DEFAULT_THEMES we encode remaining as a 9-bit mask in base36: "m<maskBase36>".
// - Optionally add a short timestamp after ".t<timeBase36>" for debugging/visibility.
// - Backwards compatible with original base64 JSON state.
function encodeState(obj) {
  // object with explicit mask uses compact format
  if (typeof obj?.mask === 'number') {
    const maskStr = obj.mask.toString(36)
    const time = obj.meta?.createdAt ? Math.floor(obj.meta.createdAt / 1000).toString(36) : ''
    return `m${maskStr}${time ? '.t' + time : ''}`
  }
  // fallback: JSON base64 url
  try {
    return base64UrlEncode(JSON.stringify(obj))
  } catch {
    return ''
  }
}

function decodeState(s) {
  if (!s) return null

  // try JSON base64 (legacy)
  const maybeJson = base64UrlDecode(s)
  if (maybeJson) {
    try {
      return JSON.parse(maybeJson)
    } catch {}
  }

  // try compact mask format: m<maskBase36>[.t<timeBase36>]
  const m = String(s).match(/^m([0-9a-z]+)(?:\.t([0-9a-z]+))?$/i)
  if (m) {
    const mask = parseInt(m[1], 36) || 0
    const createdAt = m[2] ? parseInt(m[2], 36) * 1000 : undefined
    // turn mask into items array consistent with previous shape
    const items = DEFAULT_THEMES.map((label, index) =>
      ((mask >> index) & 1) ? { id: String(index), label } : null
    ).filter(Boolean)
    return { mask, items, meta: { createdAt } }
  }

  return null
}

// --- Hardcoded 9 themes you requested (host view uses these to create the initial link) ---
const DEFAULT_THEMES = [
  'Basketball',
  'Baseball',
  'Swimming',
  'Golf',
  'Gym',
  'Badminton',
  'Cycling',
  'Soccer',
  'Fencing'
]

export default function Home() {
  const router = useRouter()
  const { state: stateParam } = router.query

  // local ephemeral session id used for item IDs
  const [session] = useState(() => ({ id: nanoid(), createdAt: Date.now() }))
  const decoded = useMemo(() => decodeState(stateParam), [stateParam])

  // decoded state shape: { id, items: [{id,label}], meta }
  const items = decoded?.items ?? []

  // UI state
  const [lastPick, setLastPick] = useState(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)  // prevent double draws
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  function copyToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {
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

  // Host: create initial encoded link using DEFAULT_THEMES
  function createInitialLink() {
    // full mask (nine 1's) -> (1<<9)-1
    const mask = (1 << DEFAULT_THEMES.length) - 1
    const payload = { mask, meta: { createdAt: Date.now() } }
    const enc = encodeState(payload)
    if (!enc) return alert('Failed to encode state in this browser.')
    const url = `${window.location.origin}${window.location.pathname}?state=${enc}`
    copyToClipboard(url)
    router.push(`/?state=${enc}`, undefined, { shallow: true })
  }

  async function drawOne() {
    if (busy || !decoded) return
    setBusy(true)

    // If decoded has a mask, use mask logic; otherwise compute items (legacy)
    const mask = typeof decoded.mask === 'number'
      ? decoded.mask
      : // reconstruct mask from decoded.items if legacy JSON
        (decoded.items || DEFAULT_THEMES.map((_, i) => ({ id: i }))).reduce((acc, it, i) =>
          (decoded.items?.some(x => x.id === String(i) || x.label === DEFAULT_THEMES[i])) ? (acc | (1 << i)) : acc
        , 0)

    // build list of available indices
    const available = []
    for (let i = 0; i < DEFAULT_THEMES.length; i++) {
      if ((mask >> i) & 1) available.push(i)
    }
    if (available.length === 0) {
      setBusy(false)
      return
    }

    const idx = available[Math.floor(Math.random() * available.length)]
    const pickLabel = DEFAULT_THEMES[idx]
    setLastPick({ label: pickLabel })

    const newMask = mask & ~(1 << idx)
    const newState = { mask: newMask, meta: decoded?.meta ?? { createdAt: Date.now() } }
    const enc = encodeState(newState)
    const newUrl = `${window.location.origin}${window.location.pathname}?state=${enc}`

    await router.push(`/?state=${enc}`, undefined, { shallow: true })
    copyToClipboard(newUrl)
    setBusy(false)
  }

  function resetToHost() {
    // clear state -> host mode (create new link)
    router.push(window.location.pathname, undefined, { shallow: true })
  }

  const isHostMode = !stateParam // show host controls when no state present
  const remainingCount = items.length

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* full-screen background image (from /public/sports.png) */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: "url('/images/sports.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -1,
          filter: 'brightness(0.85)'
        }}
      />

      {/* centered frosted panel */}
      <div
        style={{
          padding: 24,
          maxWidth: 820,
          margin: '48px auto',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.62)',           // semi-transparent so backdrop-filter shows
          WebkitBackdropFilter: 'blur(6px)',              // Safari
          backdropFilter: 'blur(6px)',                    // the frosted blur
          boxShadow: '0 6px 30px rgba(16,24,40,0.18)',
        }}
      >
        <h1 style={{fontSize: 28}}>Best-dressed theme — anonymous draw</h1>

        {isHostMode ? (
          <section style={{ marginTop: 20, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <h2 style={{fontSize:18}}>Create link for the group (host)</h2>
            <p>9 themes (sports) will be used. Click "Create link" and share the copied link with participants.</p>
            <ul>
              {DEFAULT_THEMES.map((t,i) => <li key={i}>{t}</li>)}
            </ul>
            <div style={{ marginTop: 10 }}>
              <button onClick={createInitialLink} style={{ padding: '8px 12px', borderRadius:6 }}>Create link & copy</button>
              <span style={{ marginLeft: 12, opacity: 0.8 }}>{copied ? 'Link copied!' : 'Click to create & copy link'}</span>
            </div>
          </section>
        ) : (
          <section style={{ marginTop: 20, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <h2 style={{fontSize:18}}>Draw your theme (anonymous)</h2>
            {remainingCount <= 0 ? (
              <>
                {lastPick ? (
                  <div style={{ marginTop: 14, padding:12, background:'#f7fff7', border:'1px solid #dff5df', borderRadius:8 }}>
                    <div style={{fontSize:14, opacity:0.85}}>You were assigned:</div>
                    <div style={{ fontSize:20, marginTop:6, fontWeight:600 }}>{lastPick.label}</div>
                    <div style={{ marginTop:8, opacity:0.9 }}>
                      <em>All themes have been drawn — the game is finished.</em>
                    </div>
                    <div style={{ marginTop:8 }}>
                      <button onClick={() => {
                        const enc = router.query.state
                        if (!enc) return
                        const curUrl = `${window.location.origin}${window.location.pathname}?state=${enc}`
                        copyToClipboard(curUrl)
                      }}>Copy current link</button>
                      <span style={{ marginLeft: 10, opacity:0.8 }}>{copied ? 'Link copied!' : 'Click to copy current link'}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <em>All themes have been drawn — the game is finished.</em>
                  </div>
                )}
              </>
            ) : (
              <>
                <p>Click the button below to draw one anonymous, unique theme. The updated share link will be copied automatically for the next person.</p>
                <div style={{display:'flex', gap:12, alignItems:'center'}}>
                  <button onClick={drawOne} disabled={busy} style={{ padding:'10px 14px', borderRadius:8 }}>Draw</button>
                  <div style={{opacity:0.9}}>
                    Remaining slots: <strong>{remainingCount}</strong>
                  </div>
                </div>

                {lastPick && (
                  <div style={{ marginTop: 14, padding:12, background:'#f7fff7', border:'1px solid #dff5df', borderRadius:8 }}>
                    <div style={{fontSize:14, opacity:0.85}}>You were assigned:</div>
                    <div style={{ fontSize:20, marginTop:6, fontWeight:600 }}>{lastPick.label}</div>
                    <div style={{ marginTop:8 }}>
                      <button onClick={() => {
                        const enc = router.query.state
                        if (!enc) return
                        const curUrl = `${window.location.origin}${window.location.pathname}?state=${enc}`
                        copyToClipboard(curUrl)
                      }}>Copy current link</button>
                      <span style={{ marginLeft: 10, opacity:0.8 }}>{copied ? 'Link copied!' : 'Click to copy current link'}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}