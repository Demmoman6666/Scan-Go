import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ensures Next doesn't try to treat it as static

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

export async function GET() {
  const shop = process.env.SHOPIFY_SHOP;       // r0x6ms-5d.myshopify.com
  const apiKey = process.env.SHOPIFY_API_KEY;  // Client ID
  const scopes = process.env.SHOPIFY_SCOPES;   // comma-separated
  const appUrl = process.env.APP_URL;          // https://scan-go-theta.vercel.app

  if (!shop || !apiKey || !scopes || !appUrl) {
    return new Response("Missing env vars", { status: 500 });
  }

  const state = nonce();
  const redirectUri = `${appUrl}/api/auth/callback`;

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(apiKey)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&grant_options[]=per-user`;

  // IMPORTANT: create a fresh Response so headers are mutable
  return new Response(null, {
    status: 302,
    headers: {
      Location: installUrl,
      "Set-Cookie": `shopify_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=300`,
    },
  });
}
