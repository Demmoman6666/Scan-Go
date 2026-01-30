export const runtime = "nodejs";

const baskets = new Map(); // MVP only

function generateCode() {
  return "SG-" + Math.floor(10000 + Math.random() * 90000);
}

export async function POST(req) {
  const body = await req.json();

  if (!Array.isArray(body.items) || !body.items.length) {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  const code = generateCode();

  baskets.set(code, {
    items: body.items,
    createdAt: Date.now(),
  });

  // Auto-expire after 60 mins
  setTimeout(() => baskets.delete(code), 60 * 60 * 1000);

  return Response.json({
    ok: true,
    code,
  });
}
