export const runtime = "nodejs";

const baskets = global.baskets || new Map();
global.baskets = baskets;

export async function GET(req, { params }) {
  const basket = baskets.get(params.code);

  if (!basket) {
    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  }

  return Response.json({
    ok: true,
    items: basket.items,
  });
}
