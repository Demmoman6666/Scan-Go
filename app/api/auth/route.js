import crypto from "crypto";

export const runtime = "nodejs"; // IMPORTANT: required for Node crypto

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

export async function GET() {
  const shop = process.env.SHOPIFY_SHOP;       // e.g. r0x6ms-5d.myshopify.com
  const apiKey = process.env.SHOPIFY_API_KEY;  // Dev Dashboard Client ID
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

  // Store state to verify on callback (basic CSRF protection)
  const res = Response.redirect(installUrl, 302);
  res.headers.append(
    "Set-Cookie",
    `shopify_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=300`
  );

  return res;
}
