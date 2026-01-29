"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "scan_go_basket_v1";

// This is your known working barcode for testing quickly
const TEST_BARCODE = "805610625973";

export default function ScanPage() {
  const inputRef = useRef(null);

  // Basket state lives ONLY on the device (browser) for MVP
  const [basket, setBasket] = useState({ items: [] });

  // UI state
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1) Load basket from localStorage (device storage) on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setBasket(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  // 2) Save basket to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
    } catch {
      // ignore
    }
  }, [basket]);

  // Auto-focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Compute totals (not stored, just calculated)
  const total = useMemo(() => {
    return basket.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }, [basket.items]);

  function addProductToBasket(product) {
    setBasket((prev) => {
      const items = [...prev.items];
      const idx = items.findIndex((x) => x.barcode === product.barcode);

      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
      } else {
        items.push({
          barcode: product.barcode,
          title: product.title,
          price: Number(product.price),
          quantity: 1,
          stock: product.stock ?? null,
          inStock: product.inStock ?? true,
          variantId: product.variantId ?? null,
          variantTitle: product.variantTitle ?? null,
        });
      }

      return { ...prev, items };
    });
  }

  function inc(barcode) {
    setBasket((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.barcode === barcode ? { ...i, quantity: i.quantity + 1 } : i
      ),
    }));
  }

  function dec(barcode) {
    setBasket((prev) => ({
      ...prev,
      items: prev.items
        .map((i) =>
          i.barcode === barcode ? { ...i, quantity: i.quantity - 1 } : i
        )
        .filter((i) => i.quantity > 0),
    }));
  }

  function removeItem(barcode) {
    setBasket((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.barcode !== barcode),
    }));
  }

  function clearBasket() {
    setBasket({ items: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setError("");
    setBarcode("");
    inputRef.current?.focus();
  }

  async function lookupAndAdd(inputBarcode) {
    const b = (inputBarcode || "").trim();
    if (!b) return;

    setLoading(true);
    setError("");

    try {
      // Calls YOUR backend endpoint you already built
      const res = await fetch(`/api/products/by-barcode?barcode=${encodeURIComponent(b)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Lookup failed");
      }

      if (!data.found) {
        setError(`Not found: ${b}`);
      } else {
        addProductToBasket(data.product);
        setBarcode("");
        // keep it fast to scan again
        inputRef.current?.focus();
      }
    } catch (e) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    lookupAndAdd(barcode);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "0 0 6px 0" }}>Salon Brands Pro — Scan &amp; Go (Device Basket)</h1>
      <p style={{ margin: "0 0 16px 0", opacity: 0.75 }}>
        Scan/enter a barcode → it adds to the basket stored on this device (localStorage).
      </p>

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          ref={inputRef}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Enter barcode…"
          inputMode="numeric"
          style={{
            flex: 1,
            padding: "12px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          disabled={loading || !barcode.trim()}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#777" : "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Adding…" : "Add"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => lookupAndAdd(TEST_BARCODE)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Test add known barcode
        </button>

        <button
          type="button"
          onClick={clearBasket}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Clear basket
        </button>
      </div>

      {error ? (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: "#ffe8e8", border: "1px solid #ffb3b3" }}>
          <strong style={{ display: "block", marginBottom: 4 }}>Error</strong>
          <div>{error}</div>
        </div>
      ) : null}

      <h2 style={{ margin: "0 0 10px 0" }}>Basket</h2>

      {basket.items.length === 0 ? (
        <div style={{ padding: 14, borderRadius: 10, border: "1px solid #ddd", background: "#fafafa" }}>
          No items yet. Scan something.
        </div>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          {basket.items.map((i) => (
            <div key={i.barcode} style={{ display: "flex", gap: 12, padding: 12, borderTop: "1px solid #eee", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{i.title}</div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  Barcode: {i.barcode}
                  {i.variantTitle ? ` • Variant: ${i.variantTitle}` : ""}
                  {typeof i.stock === "number" ? ` • Stock: ${i.stock}` : ""}
                </div>
                <div style={{ marginTop: 4 }}>
                  £{i.price.toFixed(2)} each • Line: £{(i.price * i.quantity).toFixed(2)}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => dec(i.barcode)} style={btnSmall}>−</button>
                <div style={{ minWidth: 28, textAlign: "center", fontWeight: 700 }}>{i.quantity}</div>
                <button type="button" onClick={() => inc(i.barcode)} style={btnSmall}>+</button>
              </div>

              <button type="button" onClick={() => removeItem(i.barcode)} style={btnDanger}>
                Remove
              </button>
            </div>
          ))}

          <div style={{ padding: 12, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <div>Total</div>
            <div>£{total.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
        Tip: this basket is stored on this device only. Refreshing the page keeps it.
      </div>
    </div>
  );
}

const btnSmall = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: "18px",
};

const btnDanger = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ffb3b3",
  background: "#ffe8e8",
  cursor: "pointer",
  fontWeight: 700,
};
