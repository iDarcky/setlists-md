// Minimal Web Push sender: RFC 8291 (aes128gcm message encryption) +
// RFC 8292 (VAPID) on pure WebCrypto — no dependencies, so the same file runs
// in the Supabase Deno edge runtime and under Node/vitest (the crypto is
// interop-tested in src/__tests__/webpush-crypto.test.js against `http_ece`,
// the RFC author's reference implementation).

type Bytes = Uint8Array;

const te = new TextEncoder();
export const utf8 = (s: string): Bytes => te.encode(s);

export function b64uDecode(s: string): Bytes {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export function b64uEncode(buf: ArrayBuffer | Bytes): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url, 65-byte uncompressed P-256 point
  auth: string;   // base64url, 16-byte auth secret
}

export interface VapidKeys {
  publicKey: string;  // base64url uncompressed point (client's applicationServerKey)
  privateKey: string; // base64url 32-byte scalar (JWK `d`)
  subject: string;    // mailto: or https: contact
}

// RFC 8291 encryption. `testKeys` pins the salt + app-server keypair so the
// interop test can produce a deterministic message; production callers omit it
// (fresh random salt + ephemeral keypair per message, as the RFC requires).
export async function encryptPayload(
  plaintext: Bytes,
  sub: { p256dh: string; auth: string },
  testKeys?: { salt: Bytes; asKeyPair: CryptoKeyPair },
): Promise<Bytes> {
  const uaPublic = b64uDecode(sub.p256dh);
  const authSecret = b64uDecode(sub.auth);
  const salt = testKeys?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const asKeys = testKeys?.asKeyPair
    ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256),
  );

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  // Single record: plaintext || 0x02 (last-record delimiter), AES-128-GCM.
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, record as BufferSource),
  );

  // aes128gcm header: salt(16) | rs(4) | idlen(1) | keyid(= as_public, 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

// RFC 8292 VAPID: a short-lived ES256 JWT over the push service origin.
export async function vapidAuthHeader(endpoint: string, vapid: VapidKeys): Promise<string> {
  const { protocol, host } = new URL(endpoint);
  const claims = {
    aud: `${protocol}//${host}`,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: vapid.subject,
  };
  const unsigned = `${b64uEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))}.${b64uEncode(utf8(JSON.stringify(claims)))}`;

  const pub = b64uDecode(vapid.publicKey); // 0x04 || x || y
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64uEncode(pub.slice(1, 33)),
    y: b64uEncode(pub.slice(33, 65)),
    d: vapid.privateKey,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto ECDSA emits the raw r||s form — exactly what JWS ES256 wants.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(unsigned) as BufferSource));
  return `vapid t=${unsigned}.${b64uEncode(sig)}, k=${vapid.publicKey}`;
}

// POST one encrypted notification to a push service. Returns the raw
// Response: 201 = accepted; 404/410 = the subscription is dead (prune it).
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: VapidKeys,
  ttlSeconds = 24 * 3600,
): Promise<Response> {
  const body = await encryptPayload(utf8(JSON.stringify(payload)), sub);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthHeader(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSeconds),
      Urgency: 'normal',
    },
    body: body as BodyInit,
  });
}
