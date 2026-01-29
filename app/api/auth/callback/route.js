import crypto from "crypto";

function verifyHmac(query, secret) {
  const provided = query.get("hmac") || "";
  const copy = new URLSearchParams(query);
  copy.delete("hmac");
  copy.delete("signature");

  const message = copy.toString(); // Shopify expects sorted params; URLSearchParams preserves order as inserted.
  // To be safe, sort:
  const sorted = new URLSearchParams([...copy.entries()].sort(([a],[b]) => a.localeCompare(b)));
  const msg = sorted.toString();

  const digest = crypto.createHmac("sha256", secret).update(msg).digest("hex");

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

  if (!shop || !code) return new Response("Missing shop or code", { status: 400 });

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) return new Response("Missing env vars", { status: 500 });

  if (!verifyHmac(q, apiSecret)) {
    return new Response("HMAC verification failed", { status: 401 });
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new Response(`Token exchange failed: ${text}`, { status: 500 });
  }

  const data = await tokenRes.json();

  // IMPORTANT: This returns the token ONCE so you can copy it into Vercel env vars.
  // After you’ve copied it, tell me and we’ll change this to store it securely and stop displaying it.
  return Response.json({
    ok: true,
    shop,
    access_token: data.access_token,
    scope: data.scope,
    next_step: "Copy access_token into Vercel env var SHOPIFY_ADMIN_TOKEN, then tell ChatGPT."
  });
}
