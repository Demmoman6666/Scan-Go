export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");

  if (!barcode) {
    return new Response("Missing barcode", { status: 400 });
  }

  const shop = process.env.SHOPIFY_SHOP;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!shop || !token) {
    return new Response("Missing Shopify credentials", { status: 500 });
  }

  const query = `
    query ProductByBarcode($barcode: String!) {
      productVariants(first: 1, query: $barcode) {
        edges {
          node {
            id
            barcode
            price
            inventoryQuantity
            product {
              id
              title
            }
            title
          }
        }
      }
    }
  `;

  const res = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      query,
      variables: { barcode },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(`Shopify error: ${text}`, { status: 500 });
  }

  const json = await res.json();
  const variant = json.data.productVariants.edges[0]?.node;

  if (!variant) {
    return Response.json({ found: false });
  }

  return Response.json({
    found: true,
    product: {
      productId: variant.product.id,
      title: variant.product.title,
      variantId: variant.id,
      variantTitle: variant.title,
      barcode: variant.barcode,
      price: variant.price,
      stock: variant.inventoryQuantity,
      inStock: variant.inventoryQuantity > 0,
    },
  });
}
