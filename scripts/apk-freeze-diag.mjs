import WebSocket from 'ws'

const ws = new WebSocket(process.env.CDP_WS_URL)
let id = 0
const pending = new Map()

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw))
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id)
    pending.delete(msg.id)
    resolve(msg.result)
  }
})

function send(method, params = {}) {
  const mid = ++id
  ws.send(JSON.stringify({ id: mid, method, params }))
  return new Promise((resolve, reject) => {
    pending.set(mid, { resolve, reject })
    setTimeout(() => reject(new Error('timeout')), 15_000)
  })
}

ws.on('open', async () => {
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const hits = []
      for (const el of document.querySelectorAll('*')) {
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.width > 300 && r.height > 300 && (s.position === 'fixed' || s.position === 'absolute')) {
          if (Number(s.zIndex) >= 40 || s.pointerEvents === 'none' || el.getAttribute('role') === 'dialog') {
            hits.push({
              tag: el.tagName,
              z: s.zIndex,
              pe: s.pointerEvents,
              pos: s.position,
              role: el.getAttribute('role'),
              text: (el.textContent || '').trim().slice(0, 60),
            })
          }
        }
      }
      return {
        bodyPe: getComputedStyle(document.body).pointerEvents,
        htmlPe: getComputedStyle(document.documentElement).pointerEvents,
        scrollLock: document.body.getAttribute('data-scroll-locked'),
        radixOverlay: document.querySelectorAll('[data-slot="dialog-overlay"]').length,
        fixedHits: hits.slice(0, 20),
        h2: [...document.querySelectorAll('h2')].map((h) => h.textContent?.trim()),
        activeView: sessionStorage.getItem('morgendrot.dashboardActiveView.v1'),
      }
    })()`,
    returnByValue: true,
  })
  console.log(JSON.stringify(r.result?.value, null, 2))
  ws.close()
})
