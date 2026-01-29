"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "scan_go_basket_v1";

function money(n) {
  const num = Number(n || 0);
  return num.toFixed(2);
}

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]); // [{ barcode, title, price, qty }]
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState("");
  const [checkoutResult, setCheckoutResult] = useState(null); // { orderId, orderName, adminUrl }

  // Load basket from localStorage on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist basket to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const total = useMemo(() => {
    return items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0);
  }, [items]);

  async function addByBarcode(bc) {
    setError("");
    setCheckoutResult(null);

    const code = (bc || "").trim();
    if (!code) return;

    setLoadingAdd(true);
    try {
      const res = await fetch(`/api/products/by-barcode?barcode=${encodeURIComponent(code)}`, {
        method: "GET",
      });
      const data = await res.json();

      if (!res.ok || !data?.found) {
        setError(data?.message || "Not found");
        return;
      }

      const product = data.product;

      // If already in basket, increment qty
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.barcode === product.barcode);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            barcode: product.barcode,
            title: product.title,
            price: Number(product.price || 0),
            qty: 1,
          },
        ];
      });

      setBarcode("");
    } catch (e) {
      setError(e?.message || "Failed to add item");
    } finally {
      setLoadingAdd(false);
    }
  }

  function inc(barcode) {
    setItems((prev) =>
      prev.map((x) => (x.barcode === barcode ? { ...x, qty: x.qty + 1 } : x))
    );
  }

  function dec(barcode) {
    setItems((prev) =>
      prev
        .map((x) => (x.barcode === barcode ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    );
  }

  function remove(barcode) {
    setItems((prev) => prev.filter((x) => x.barcode !== barcode));
  }

  function clearBasket() {
    setItems([]);
    setCheckoutResult(null);
    setError("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  async function checkout() {
    setError("");
    setCheckoutResult(null);

    if (!items.length) {
      setError("Basket is empty");
      return;
    }

    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/orders/create-unpaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "scan-and-go",
          deviceId: "BROWSER-TEST-01",
          items: items.map((x) => ({
            barcode: x.barcode,
            quantity: x.qty,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.error || data?.message || "Checkout failed");
        return;
      }

      // Expecting: { ok:true, orderId, orderName, adminUrl? }
      setCheckoutResult({
        orderId: data.orderId,
        orderName: data.orderName,
        adminUrl: data.adminUrl,
      });

      // MVP behaviour: clear basket after successful checkout
      clearBasket();
    } catch (e) {
      setError(e?.message || "Checkout failed");
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>Salon Brands Pro — Scan & Go (Device Basket)</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Scan/enter a barcode → adds to basket stored on this device (localStorage).
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Enter barcode..."
          style={{ flex: 1, padding: 10, fontSize: 16 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addByBarcode(barcode);
          }}
        />
        <button
          onClick={() => addByBarcode(barcode)}
          disabled={loadingAdd}
          style={{ padding: "10px 14px", fontSize: 16 }}
        >
          {loadingAdd ? "Adding..." : "Add"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => addByBarcode("8005610625973")} style={{ padding: "8px 10px" }}>
          Test add known barcode
        </button>
        <button onClick={clearBasket} style={{ padding: "8px 10px" }}>
          Clear basket
        </button>

        <div style={{ flex: 1 }} />

        {/* ✅ CHECKOUT BUTTON */}
        <button
          onClick={checkout}
          disabled={loadingCheckout || items.length === 0}
          style={{
            padding: "10px 14px",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {loadingCheckout ? "Checking out..." : `Checkout £${money(total)}`}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 10, background: "#ffe9e9", border: "1px solid #ffb3b3" }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {checkoutResult ? (
        <div style={{ marginTop: 12, padding: 10, background: "#e9fff0", border: "1px solid #9ee6b3" }}>
          <strong>Order created!</strong>
          <div style={{ marginTop: 6 }}>
            Order: <b>{checkoutResult.orderName || "(no order name returned yet)"}</b>
          </div>
          {checkoutResult.adminUrl ? (
            <div style={{ marginTop: 6 }}>
              <a href={checkoutResult.adminUrl} target="_blank" rel="noreferrer">
                Open in Shopify Admin
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 style={{ marginTop: 18 }}>Basket</h2>

      {!items.length ? <p style={{ color: "#666" }}>Basket empty.</p> : null}

      {items.map((it) => (
        <div
          key={it.barcode}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>{it.title}</div>
          <div style={{ fontSize: 13, color: "#666" }}>Barcode: {it.barcode}</div>
          <div style={{ marginTop: 6 }}>
            £{money(it.price)} each • Line: <b>£{money(it.price * it.qty)}</b>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <button onClick={() => dec(it.barcode)} style={{ padding: "6px 10px" }}>
              −
            </button>
            <div style={{ minWidth: 30, textAlign: "center", fontWeight: 700 }}>{it.qty}</div>
            <button onClick={() => inc(it.barcode)} style={{ padding: "6px 10px" }}>
              +
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => remove(it.barcode)}
              style={{ padding: "6px 10px", background: "#ffe9e9", border: "1px solid #ffb3b3" }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, marginTop: 10 }}>
        <span>Total</span>
        <span>£{money(total)}</span>
      </div>

      <p style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
        Tip: this basket is stored on this device only. Refreshing the page keeps it.
      </p>
    </div>
  );
}
