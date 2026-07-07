import WebSocket from 'ws'

const ws = new WebSocket(process.env.CDP_WS_URL)
let id = 0
const pending = new Map()

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw))
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
})

function send(method, params = {}) {
  const mid = ++id
  ws.send(JSON.stringify({ id: mid, method, params }))
  return new Promise((resolve, reject) => {
    pending.set(mid, { resolve, reject })
    setTimeout(() => reject(new Error('timeout')), 20_000)
  })
}

ws.on('open', async () => {
  const r = await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('button,h2,h3,p,label,input,textarea,[role=dialog]')].map(e=>({tag:e.tagName,id:e.id,text:(e.textContent||'').trim().slice(0,80),ph:e.placeholder||'',role:e.getAttribute('role')}))`,
    returnByValue: true,
  })
  console.log(JSON.stringify(r.result?.value, null, 2))
  ws.close()
})
