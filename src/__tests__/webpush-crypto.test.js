// Interop test for the edge function's Web Push crypto (RFC 8291 + RFC 8292).
// The counterparty is `http_ece` — the encrypted-content-encoding reference
// implementation by the RFC's author — playing the browser: if it can decrypt
// what our WebCrypto code encrypted (and verify our VAPID JWT), a real push
// service / user agent can too.
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import ece from 'http_ece';
import {
  encryptPayload,
  vapidAuthHeader,
  b64uEncode,
  b64uDecode,
  utf8,
} from '../../supabase/functions/notify-worker/webpush.ts';

// A simulated browser subscription: P-256 keypair + 16-byte auth secret,
// exactly what PushManager.subscribe() would mint.
function makeBrowserSubscription() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    ecdh,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  };
}

describe('web push encryption (RFC 8291)', () => {
  it('http_ece (reference implementation) decrypts our aes128gcm message', async () => {
    const sub = makeBrowserSubscription();
    const payload = JSON.stringify({ title: 'You have been scheduled', body: 'Sunday service — drums' });

    const message = await encryptPayload(utf8(payload), { p256dh: sub.p256dh, auth: sub.auth });

    const decrypted = ece.decrypt(Buffer.from(message), {
      version: 'aes128gcm',
      privateKey: sub.ecdh,
      authSecret: b64uDecode(sub.auth),
    });
    expect(decrypted.toString('utf8')).toBe(payload);
  });

  it('produces a well-formed aes128gcm header', async () => {
    const sub = makeBrowserSubscription();
    const message = await encryptPayload(utf8('x'), { p256dh: sub.p256dh, auth: sub.auth });
    // salt(16) | rs(4) | idlen(1) | keyid(65) | ciphertext(plain + delimiter + 16-byte tag)
    expect(message.length).toBe(16 + 4 + 1 + 65 + (1 + 1 + 16));
    const rs = new DataView(message.buffer, message.byteOffset + 16, 4).getUint32(0);
    expect(rs).toBe(4096);
    expect(message[20]).toBe(65); // keyid length = uncompressed P-256 point
    expect(message[21]).toBe(4);  // uncompressed-point marker
  });

  it('every message uses a fresh salt and ephemeral key', async () => {
    const sub = makeBrowserSubscription();
    const a = await encryptPayload(utf8('hi'), { p256dh: sub.p256dh, auth: sub.auth });
    const b = await encryptPayload(utf8('hi'), { p256dh: sub.p256dh, auth: sub.auth });
    expect(b64uEncode(a.slice(0, 16))).not.toBe(b64uEncode(b.slice(0, 16))); // salt
    expect(b64uEncode(a.slice(21, 86))).not.toBe(b64uEncode(b.slice(21, 86))); // keyid
  });
});

describe('VAPID (RFC 8292)', () => {
  it('emits an ES256 JWT that verifies against the public key with the right claims', async () => {
    // Generate a VAPID pair the same way the deployment key was made.
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = privateKey.export({ format: 'jwk' });
    const pub = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url'),
    ]);
    const vapid = {
      publicKey: pub.toString('base64url'),
      privateKey: jwk.d,
      subject: 'mailto:test@example.com',
    };

    const header = await vapidAuthHeader('https://fcm.googleapis.com/fcm/send/abc123', vapid);
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header) || [];
    expect(k).toBe(vapid.publicKey);

    const [h, c, s] = t.split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    expect(JSON.parse(Buffer.from(h, 'base64url').toString('utf8'))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toBe(vapid.subject);
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    expect(claims.exp).toBeLessThanOrEqual(Date.now() / 1000 + 24 * 3600); // ≤24h per RFC

    const ok = crypto.verify(
      'sha256',
      Buffer.from(`${h}.${c}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    );
    expect(ok).toBe(true);
  });
});
