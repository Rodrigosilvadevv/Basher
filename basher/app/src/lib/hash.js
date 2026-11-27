// Hash do PIN de bloqueio (guardado só no aparelho).
export async function hashPin(pin) {
  const data = new TextEncoder().encode('basher:' + pin);
  try {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381;
    for (const c of data) h = ((h << 5) + h + c) >>> 0;
    return 'djb2:' + h.toString(16);
  }
}
