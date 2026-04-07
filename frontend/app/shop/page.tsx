'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Product = {
  id: string
  title: string
  description: string
  priceHint: string
  configured: boolean
}

function ShopContent() {
  const sp = useSearchParams()
  const paid = sp.get('paid')
  const canceled = sp.get('canceled')
  const sessionId = sp.get('session_id')

  const [products, setProducts] = useState<Product[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [recipientIota, setRecipientIota] = useState('')
  const [claim, setClaim] = useState<{ token: string; productId: string; issuedAt: string } | null>(null)
  const [claimPending, setClaimPending] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/shop/products')
        const j = (await r.json()) as { ok?: boolean; products?: Product[]; error?: string }
        if (!r.ok || !j.ok) {
          setLoadError(j.error || `HTTP ${r.status}`)
          return
        }
        if (!cancelled) setProducts(j.products || [])
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pollSessionClaim = useCallback(async (sid: string) => {
    setClaimPending(true)
    setClaimError(null)
    for (let i = 0; i < 15; i++) {
      const r = await fetch('/api/shop/session-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
      const j = (await r.json()) as {
        ok?: boolean
        pending?: boolean
        claimToken?: string
        productId?: string
        issuedAt?: string
        error?: string
      }
      if (r.status === 202 && j.pending) {
        await new Promise((res) => setTimeout(res, 800))
        continue
      }
      if (r.ok && j.claimToken) {
        setClaim({
          token: j.claimToken,
          productId: j.productId || '',
          issuedAt: j.issuedAt || '',
        })
        setClaimPending(false)
        return
      }
      setClaimError(j.error || `HTTP ${r.status}`)
      setClaimPending(false)
      return
    }
    setClaimError('Claim noch ausstehend — Webhook verzögert. Bitte später erneut laden.')
    setClaimPending(false)
  }, [])

  useEffect(() => {
    if (paid === '1' && sessionId) {
      void pollSessionClaim(sessionId)
    }
  }, [paid, sessionId, pollSessionClaim])

  async function startCheckout(productId: string) {
    setCheckoutLoading(productId)
    setLoadError(null)
    try {
      const r = await fetch('/api/shop/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerEmail: email.trim() || undefined,
          recipientIotaAddress: recipientIota.trim() || undefined,
        }),
      })
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string }
      if (!r.ok || !j.ok || !j.url) {
        setLoadError(j.error || `HTTP ${r.status}`)
        return
      }
      window.location.href = j.url
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 text-slate-100">
      <p className="mb-6 text-sm text-slate-400">
        <Link href="/" className="text-emerald-400 hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Shop</h1>
      <p className="mb-8 text-sm text-slate-400">
        Zahlung über Stripe Hosted Checkout — keine Kartendaten auf diesem Server. Voraussetzung:{' '}
        <code className="rounded bg-slate-800 px-1">ENABLE_SHOP_API=true</code>, Stripe-Keys und Price-ID in
        der Env.
      </p>

      {canceled === '1' && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Zahlung abgebrochen.
        </div>
      )}

      {paid === '1' && sessionId && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm">
          {claimPending && <p className="text-slate-300">Warte auf Bestätigung &amp; Claim-Token…</p>}
          {claimError && <p className="text-red-300">{claimError}</p>}
          {claim && (
            <div className="space-y-2">
              <p className="text-emerald-300">Zahlung bestätigt.</p>
              <p className="text-slate-400">
                Produkt: <span className="text-slate-200">{claim.productId}</span>
              </p>
              <p className="break-all font-mono text-xs text-slate-200">{claim.token}</p>
              <p className="text-xs text-slate-500">
                Einlösen (wenn API aktiv): <code className="text-slate-400">POST /api/voucher-claim</code> mit{' '}
                <code className="text-slate-400">claimToken</code>
              </p>
            </div>
          )}
        </div>
      )}

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadError}
        </div>
      )}

      <label className="mb-4 block text-sm">
        <span
          className="text-slate-400"
          title="Eigene Wallet-Adresse. Für direkten On-Chain-Mint der Messenger-Credits nach Zahlung (wenn ENABLE_SHOP_CHAIN_MINT). Ohne gültige Adresse oft nur Claim-Token — siehe docs/STRIPE-TEST-SETUP.md und docs/API-SHOP-SPEC.md."
        >
          IOTA-Adresse (0x+64 Hex, optional — für direkten Credits-Mint wenn ENABLE_SHOP_CHAIN_MINT)
        </span>
        <input
          type="text"
          value={recipientIota}
          onChange={(e) => setRecipientIota(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="mb-6 block text-sm">
        <span className="text-slate-400">E-Mail für Stripe (optional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="kunde@example.com"
          autoComplete="email"
        />
      </label>

      <ul className="space-y-4">
        {products.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm"
          >
            <h2 className="font-medium text-slate-100">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{p.description}</p>
            <p className="mt-2 text-xs text-slate-500">{p.priceHint}</p>
            {!p.configured && (
              <p className="mt-2 text-xs text-amber-400">Price-ID in .env fehlt — Checkout nicht möglich.</p>
            )}
            <button
              type="button"
              disabled={!p.configured || checkoutLoading !== null}
              onClick={() => void startCheckout(p.id)}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkoutLoading === p.id ? 'Weiterleitung…' : 'Zur Kasse (Stripe)'}
            </button>
          </li>
        ))}
      </ul>

      {products.length === 0 && !loadError && (
        <p className="text-sm text-slate-500">Keine Produkte geladen oder Shop-API aus.</p>
      )}
    </main>
  )
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-lg px-4 py-10 text-slate-400">Laden…</main>
      }
    >
      <ShopContent />
    </Suspense>
  )
}
