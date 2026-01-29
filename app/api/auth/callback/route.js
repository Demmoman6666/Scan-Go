import crypto from "crypto";

export const runtime = "nodejs"; // IMPORTANT: required for Node crypto

function verifyHmac(query, secret) {
  const provided = query.get("hmac") || "";

  // Clone and remove fields that shouldn't be included in the message
  const copy = new URLSearchParams(query);
  copy.delete("hmac");
  copy.delete("signature");

  // Shopify expects parameters sorted lexicographically
  const sortedEntries = [...copy.entries()].sort(([a], [b]) => a.localeCompare(b));
  const message = new URLSearchParams(sortedEntries).toString();

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const q = url.searchParams;

  const shop = q.get("shop");
  const code = q.get("code");

  if (!shop || !code) {
    return new Response("Missing shop or code", { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    return new Response("Missing env vars", { status: 500 });
  }

  if (!verifyHmac(q, apiSecret)) {
    return new Response("HMAC verification failed", { status: 401 });
  }

  // Exchange the auth code for an offline access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new Response(`Token exchange failed: ${text}`, { status: 500 });
  }

  const data = await tokenRes.json();

  /**
   * SECURITY NOTE:
   * We DO NOT return the token to the browser.
   *
   * You have already copied the token into Vercel env var SHOPIFY_ADMIN_TOKEN.
   * If you want to store tokens automatically per-shop in future,
   * we’ll add a DB and save `data.access_token` server-side instead.
   */

  return Response.json({
    ok: true,
    shop,
    scope: data.scope,
    message: "Scan & Go successfully authorised. You can close this tab.",
  });
}
