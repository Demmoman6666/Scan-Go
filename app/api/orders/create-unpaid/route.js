export const runtime = "nodejs";

const ALLOWED_ORIGINS = [
  "https://scan-go-theta.vercel.app",
  "https://dev.shopify.com"
];

// Handle preflight (CORS)
export async function OPTIONS(req) {
  const origin = req.headers.get("origin") || "";

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-device-key",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export async function POST(req) {
  const origin = req.headers.get("origin") || "";

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response("CORS blocked", { status: 403 });
  }

  const headers = {
    "Access-Control-Allow-Origin": origin
  };

  try {
    const body = await req.json();

    // your existing logic here
    // create unpaid order
    // validate barcode
    // etc

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Unpaid order created"
      }),
      {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status: 500,
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      }
    );
  }
}
