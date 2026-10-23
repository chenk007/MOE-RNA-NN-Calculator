const encoder = new TextEncoder();

async function equalCredentials(actual, expected) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

function response(body, status, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Vary': 'Authorization',
      ...extra,
    },
  });
}

function unauthorized() {
  return response('Authentication required.', 401, {
    'WWW-Authenticate': 'Basic realm="Reviewer access", charset="UTF-8"',
  });
}

export default {
  async fetch(request, env) {
    // Only an explicit false enables public access. Missing/invalid values fail closed.
    if (env.REQUIRE_AUTH !== 'false') {
      if (!env.BASIC_AUTH_USERNAME || !env.BASIC_AUTH_PASSWORD) {
        return response('Reviewer access is not configured.', 503);
      }
      const authorization = request.headers.get('Authorization') || '';
      const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
      if (!match) return unauthorized();
      let credentials;
      try {
        const bytes = Uint8Array.from(atob(match[1]), char => char.charCodeAt(0));
        credentials = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return unauthorized();
      }
      if (!await equalCredentials(credentials, `${env.BASIC_AUTH_USERNAME}:${env.BASIC_AUTH_PASSWORD}`)) {
        return unauthorized();
      }
    }

    // No assets are requested until authorization succeeds; never forward the password.
    const headers = new Headers(request.headers);
    headers.delete('Authorization');
    const asset = await env.ASSETS.fetch(new Request(request, { headers }));
    const result = new Response(asset.body, asset);
    result.headers.set('Cache-Control', 'no-store');
    result.headers.set('Vary', [...new Set([
      ...(result.headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean),
      'Authorization',
    ])].join(', '));
    result.headers.set('X-Content-Type-Options', 'nosniff');
    return result;
  },
};
