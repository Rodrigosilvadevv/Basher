import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Converte base64url para Uint8Array
function b64ToUint8(b64: string): Uint8Array {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - b64.length % 4)
  const b = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(b, c => c.charCodeAt(0))
}

// Gera o cabeçalho VAPID JWT
async function vapidJWT(audience: string): Promise<string> {
  const privKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!
  const pubKeyB64  = Deno.env.get('VAPID_PUBLIC_KEY')!
  const email      = Deno.env.get('VAPID_EMAIL') ?? 'mailto:contato@basher.com.br'

  const header  = { alg: 'ES256', typ: 'JWT' }
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: email }

  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const toSign = `${enc(header)}.${enc(payload)}`

  // Importa a chave ECDSA P-256
  const keyData = b64ToUint8(privKeyB64)
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(toSign)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')

  return `${toSign}.${sigB64}`
}

serve(async (req) => {
  try {
    const { user_id, title, body, icon, data, url } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id e title obrigatórios' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca todos os tokens de push do usuário
    const { data: rows } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    const payload = JSON.stringify({
      title,
      body:  body  ?? '',
      icon:  icon  ?? '/icon.svg',
      badge: '/icon.svg',
      data:  { url: url ?? '/', ...data }
    })

    let sent = 0
    for (const row of rows) {
      const sub = row.subscription
      const pushUrl = new URL(sub.endpoint)
      const audience = `${pushUrl.protocol}//${pushUrl.host}`

      const jwt    = await vapidJWT(audience)
      const pubKey = Deno.env.get('VAPID_PUBLIC_KEY')!

      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt},k=${pubKey}`,
          'Content-Type':  'application/json',
          'TTL': '86400',
        },
        body: payload,
      })

      if (res.ok) sent++
      else if (res.status === 410) {
        // Token expirado — remove
        await supabase.from('push_subscriptions')
          .delete().eq('user_id', user_id).eq('subscription->>endpoint', sub.endpoint)
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
