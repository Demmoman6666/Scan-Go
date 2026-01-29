// app/api/orders/create-unpaid/route.js
export const runtime = "nodejs";

// ✅ Only allow calls from these origins (browser-based testing / Shopify dev console)
const ALLOWED_ORIGINS = [
  "https://scan-go-theta.vercel.app",
  "https://dev.shopify.com",
];

// --- Small helpers ----------------------------------------------------------

function corsOrigin(req) {
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function corsHeaders(origin) {
  // If request has no Origin (e.g. Android app / Postman / server-to-server),
  // we don't need CORS headers at all.
  if (!origin) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
  };
}

function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// --- CORS preflight ----------------------------------------------------------

export async function OPTIONS(req) {
  const origin = corsOrigin(req);

  // If a browser sends preflight with an unapproved origin → block
  if (!origin && req.headers.get("origin")) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-device-key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// --- Main handler ------------------------------------------------------------

export async function POST(req) {
  // CORS logic
  const origin = corsOrigin(req);
  if (!origin && req.headers.get("origin")) {
    // request came from a browser with an origin we don't allow
    return new Response("CORS blocked", { status: 403 });
  }

  // Required env vars
  let SHOP;
  let ADMIN_TOKEN;

  try {
    SHOP = requiredEnv("SHOPIFY_SHOP"); // e.g. r0x6ms-5d.myshopify.com
    ADMIN_TOKEN = requiredEnv("SHOPIFY_ADMIN_TOKEN"); // shpat_...
  } catch (e) {
    return json(
      { ok: false, error: e.message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "unknown-device";
  const source = typeof body.source === "string" ? body.source : "scan-and-go";

  if (!items.length) {
    return json(
      { ok: false, error: "Body must include items: [{ barcode, quantity }]" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // Basic validation / normalization
  const normalizedItems = [];
  for (const it of items) {
    const barcode = typeof it.barcode === "string" ? it.barcode.trim() : "";
    const qty = Number(it.quantity);

    if (!barcode) {
      return json(
        { ok: false, error: "Each item must include a barcode string" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return json(
        { ok: false, error: "Each item must include a positive quantity" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    normalizedItems.push({ barcode, quantity: Math.floor(qty) });
  }

  // For Shopify order creation we need variant IDs (not barcodes).
  // We’ll call your existing barcode lookup endpoint to convert barcode → variantId.
  // Assumes you already created:
  //   GET /api/products/by-barcode?barcode=XXXX
  async function lookupVariantId(barcode) {
    const url = new URL(`${process.env.APP_URL || "https://scan-go-theta.vercel.app"}/api/products/by-barcode`);
    url.searchParams.set("barcode", barcode);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Barcode lookup failed (${barcode}): ${res.status} ${t}`);
    }

    const data = await res.json();
    if (!data?.found || !data?.product?.variantId) {
      throw new Error(`No product found for barcode: ${barcode}`);
    }

    // variantId currently looks like gid://shopify/ProductVariant/...
    // For REST Admin Orders API we usually need the numeric variant_id.
    // We'll extract the numeric part.
    const gid = String(data.product.variantId);
    const match = gid.match(/ProductVariant\/(\d+)/);
    if (!match) throw new Error(`Could not parse numeric variant id from: ${gid}`);

    return Number(match[1]);
  }

  // Build line items
  let line_items = [];
  try {
    for (const it of normalizedItems) {
      const variant_id = await lookupVariantId(it.barcode);
      line_items.push({
        variant_id,
        quantity: it.quantity,
      });
    }
  } catch (e) {
    return json(
      { ok: false, error: e.message },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // Create an "unpaid" order in Shopify via Admin REST API
  // NOTE: This creates a normal order, not a draft.
  // If you prefer Draft Orders, we can switch to /draft_orders.json later.
  const createOrderPayload = {
    order: {
      line_items,
      financial_status: "pending", // unpaid/pending
      // Optional: tag so you can find these easily in Shopify
      tags: `scan-and-go,unpaid,device:${deviceId}`,
      // Optional: note for staff
      note: `Created by Scan & Go (${source}) | deviceId=${deviceId}`,
    },
  };

  const shopifyUrl = `https://${SHOP}/admin/api/2024-10/orders.json`;

  let shopifyData;
  try {
    const shopifyRes = await fetch(shopifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify(createOrderPayload),
    });

    const raw = await shopifyRes.text();
    if (!shopifyRes.ok) {
      // Shopify errors are often in raw JSON; return safely
      return json(
        { ok: false, error: `Shopify order create failed: ${raw}` },
        { status: 502, headers: corsHeaders(origin) }
      );
    }

    shopifyData = JSON.parse(raw);
  } catch (e) {
    return json(
      { ok: false, error: `Shopify request error: ${e.message}` },
      { status: 502, headers: corsHeaders(origin) }
    );
  }

  const order = shopifyData?.order;
  if (!order?.id) {
    return json(
      { ok: false, error: "Shopify returned no order id" },
      { status: 502, headers: corsHeaders(origin) }
    );
  }

  // Build a usable admin URL (best-effort)
  // Shopify "admin.shopify.com/store/{store-handle}/orders/{orderId}"
  // We don't always know store handle; so we return both options.
  const myshopifyStoreHandle = SHOP.replace(".myshopify.com", "");
  const adminUrl = `https://admin.shopify.com/store/${myshopifyStoreHandle}/orders/${order.id}`;

  return json(
    {
      ok: true,
      message: "Unpaid order created",
      orderId: order.id,
      orderName: order.name, // e.g. "#3612"
      adminUrl,
      deviceId,
      source,
    },
    { status: 200, headers: corsHeaders(origin) }
  );
}
