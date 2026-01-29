export const runtime = "nodejs";

// --- helpers ---
async function shopifyGraphql(shop, token, query, variables) {
  const res = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL HTTP error: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

function gidToNumericId(gid) {
  // "gid://shopify/ProductVariant/7562343727229" -> 7562343727229
  const part = String(gid || "").split("/").pop();
  const n = Number(part);
  return Number.isFinite(n) ? n : null;
}

async function lookupVariantByBarcode(shop, token, barcode) {
  const query = `
    query VariantByBarcode($q: String!) {
      productVariants(first: 1, query: $q) {
        edges {
          node {
            id
            title
            barcode
            price
            inventoryQuantity
            product { id title }
          }
        }
      }
    }
  `;

  const data = await shopifyGraphql(shop, token, query, { q: barcode });
  return data.productVariants.edges[0]?.node || null;
}

// --- route ---
export async function POST(req) {
  const shop = process.env.SHOPIFY_SHOP;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!shop || !token) {
    return new Response("Missing SHOPIFY_SHOP or SHOPIFY_ADMIN_TOKEN", { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const deviceId = String(body.deviceId || "UNKNOWN");
  const source = String(body.source || "scan-and-go");

  if (!items.length) {
    return new Response("No items provided", { status: 400 });
  }

  // 1) Resolve barcodes to variants + validate stock
  const restLineItems = [];
  const resolved = [];

  for (const it of items) {
    const barcode = String(it.barcode || "").trim();
    const quantity = Number(it.quantity || 0);

    if (!barcode || !Number.isFinite(quantity) || quantity <= 0) {
      return new Response(`Invalid item: ${JSON.stringify(it)}`, { status: 400 });
    }

    const variant = await lookupVariantByBarcode(shop, token, barcode);
    if (!variant) {
      return Response.json({ ok: false, error: `Barcode not found: ${barcode}` }, { status: 404 });
    }

    const available = Number(variant.inventoryQuantity || 0);
    if (available < quantity) {
      return Response.json(
        {
          ok: false,
          error: `Out of stock: ${variant.product.title} (${barcode})`,
          details: { available, requested: quantity },
        },
        { status: 409 }
      );
    }

    const numericVariantId = gidToNumericId(variant.id);
    if (!numericVariantId) {
      return new Response(`Could not convert variant id: ${variant.id}`, { status: 500 });
    }

    // Shopify REST line items
    restLineItems.push({
      variant_id: numericVariantId,
      quantity,
      // price optional; if omitted Shopify uses variant price.
      // Keeping it ensures “price at scan time”.
      price: variant.price,
    });

    resolved.push({
      barcode,
      quantity,
      title: variant.product.title,
      variantTitle: variant.title,
      price: variant.price,
      stock: available,
    });
  }

  // 2) Create unpaid + unfulfilled order in Shopify
  const orderPayload = {
    order: {
      line_items: restLineItems,
      financial_status: "pending", // unpaid
      // fulfillment_status left null => unfulfilled
      tags: `${source},device:${deviceId}`,
      note: `Scan & Go order created from device ${deviceId}`,
      currency: "GBP",
    },
  };

  const res = await fetch(`https://${shop}/admin/api/2024-10/orders.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify(orderPayload),
  });

  const json = await res.json();

  if (!res.ok) {
    return new Response(`Order create failed: ${JSON.stringify(json)}`, { status: 500 });
  }

  const order = json.order;

  return Response.json({
    ok: true,
    orderId: order.id,
    name: order.name, // e.g. "#1001"
    orderNumber: order.order_number,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    resolvedItems: resolved,
    message: "Order created (unpaid & unfulfilled). Customer can proceed to desk to pay.",
  });
}
