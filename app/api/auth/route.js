import crypto from "crypto";

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

export async function GET() {
  const shop = process.env.SHOPIFY_SHOP;
  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES;
  const appUrl = process.env.APP_URL;

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
    `&state=${encodeURIComponent(state)}`;

  return Response.redirect(installUrl);
}
