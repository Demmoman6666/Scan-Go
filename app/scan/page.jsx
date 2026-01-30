"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "scan_go_basket_v1";
const VAT_RATE = 0.2;
const BRAND_PINK = "#FEB3E4";
const START_FLAG_KEY = "scan_go_started";

function money(n) {
  const num = Number(n || 0);
  return num.toFixed(2);
}

export default function ScanPage() {
  const router = useRouter();

  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]); // [{ barcode, title, price, qty }]
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState("");
  const [checkoutResult, setCheckoutResult] = useState(null); // { orderId, orderName, adminUrl }

  // used only as a visual indicator / last scan state (no input field)
  const lastScanAtRef = useRef(0);

  // ✅ Guard: don't allow /scan unless "Start shopping" was pressed
  useEffect(() => {
    let started = false;
    try {
      started = sessionStorage.getItem(START_FLAG_KEY) === "1";
    } catch {}

    if (!started) {
      router.replace("/");
    }
  }, [router]);

  // ✅ Prevent horizontal scroll / "not full screen" issues on Zebra WebView
  useEffect(() => {
    try {
      document.documentElement.style.overflowX = "hidden";
      document.body.style.overflowX = "hidden";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.width = "100%";
    } catch {}

    return () => {
      try {
        document.documentElement.style.overflowX = "";
        document.body.style.overflowX = "";
        document.body.style.margin = "";
        document.body.style.padding = "";
        document.body.style.width = "";
      } catch {}
    };
  }, []);

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

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0),
      0
    );
  }, [items]);

  const vat = useMemo(() => {
    // 2dp rounding
    return Math.round(subtotal * VAT_RATE * 100) / 100;
  }, [subtotal]);

  const totalIncVat = useMemo(() => {
    return Math.round((subtotal + vat) * 100) / 100;
  }, [subtotal, vat]);

  async function addByBarcode(bc) {
    setError("");
    setCheckoutResult(null);

    const code = (bc || "").trim();
    if (!code) return;

    setLoadingAdd(true);
    try {
      const res = await fetch(
        `/api/products/by-barcode?barcode=${encodeURIComponent(code)}`,
        { method: "GET" }
      );
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

      setBarcode(code);
      lastScanAtRef.current = Date.now();
    } catch (e) {
      setError((e && e.message) || "Failed to add item");
    } finally {
      setLoadingAdd(false);
    }
  }

  /**
   * ✅ GLOBAL SCANNER CAPTURE
   * No input field required.
   * Scanner types quickly + presses Enter => we capture it.
   *
   * Also: prevent the Android soft keyboard popping up by ensuring we never focus
   * an input and by blurring any accidental focus.
   */
  useEffect(() => {
    let buffer = "";
    let timer = null;

    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select")
        return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const blurIfEditableFocused = () => {
      try {
        const a = document.activeElement;
        if (isTypingTarget(a)) a.blur();
      } catch {}
    };

    // On Zebra, the WebView can sometimes focus something and pop keyboard.
    // We gently blur on first interaction and after scans.
    const onPointerDown = () => blurIfEditableFocused();
    window.addEventListener("pointerdown", onPointerDown, true);

    const onKeyDown = (e) => {
      // Let shortcuts work
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // If user is typing in a field (e.g. another page in same webview), don't hijack keys
      if (isTypingTarget(e.target)) return;

      // Reset timer for scanner bursts
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        buffer = "";
      }, 90);

      // Collect printable characters
      if (e.key && e.key.length === 1) {
        buffer += e.key;
        return;
      }

      // Enter means scanner finished the barcode
      if (e.key === "Enter") {
        e.preventDefault();

        const code = buffer.trim();
        buffer = "";
        if (!code) return;

        blurIfEditableFocused(); // ✅ helps stop keyboard after scan
        addByBarcode(code);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  function inc(barcodeValue) {
    setItems((prev) =>
      prev.map((x) =>
        x.barcode === barcodeValue ? { ...x, qty: x.qty + 1 } : x
      )
    );
  }

  function dec(barcodeValue) {
    setItems((prev) =>
      prev
        .map((x) =>
          x.barcode === barcodeValue ? { ...x, qty: x.qty - 1 } : x
        )
        .filter((x) => x.qty > 0)
    );
  }

  function remove(barcodeValue) {
    setItems((prev) => prev.filter((x) => x.barcode !== barcodeValue));
  }

  function clearBasketInternal() {
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

      setCheckoutResult({
        orderId: data.orderId,
        orderName: data.orderName,
        adminUrl: data.adminUrl,
      });

      // Clear basket
      clearBasketInternal();

      // ✅ Send back to Home after checkout (and lock /scan again)
      try {
        sessionStorage.removeItem(START_FLAG_KEY);
      } catch {}
      router.replace("/");
    } catch (e) {
      setError((e && e.message) || "Checkout failed");
    } finally {
      setLoadingCheckout(false);
    }
  }

  const justScanned =
    barcode && Date.now() - (lastScanAtRef.current || 0) < 2500;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 16,
        paddingBottom: 120, // space for sticky checkout bar
        fontFamily: "'League Spartan', system-ui, -apple-system",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* Logo header */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
        <img
          src="/Main%20Logo.png"
          alt="Salon Brands Pro"
          style={{ height: 44, width: "auto", maxWidth: "100%" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      {/* Minimal status bar (optional but helpful) */}
      <div
        style={{
          marginTop: 12,
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900 }}>
            {loadingAdd ? "Adding item…" : "Scan items to add to basket"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#777",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {barcode ? `Last scanned: ${barcode}` : "No scans yet"}
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: justScanned ? BRAND_PINK : "#fafafa",
            fontWeight: 900,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {items.length} item{items.length === 1 ? "" : "s"}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#ffe9e9",
            border: "1px solid #ffb3b3",
            borderRadius: 12,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {checkoutResult ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#e9fff0",
            border: "1px solid #9ee6b3",
            borderRadius: 12,
          }}
        >
          <strong>Order created!</strong>
          <div style={{ marginTop: 6 }}>
            Order:{" "}
            <b>{checkoutResult.orderName || "(no order name returned yet)"}</b>
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

      <h2 style={{ marginTop: 18, marginBottom: 10 }}>Basket</h2>

      {!items.length ? <p style={{ color: "#666" }}>Basket empty.</p> : null}

      {items.map((it) => (
        <div
          key={it.barcode}
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
            background: "#fff",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>{it.title}</div>
          <div
            style={{
              fontSize: 13,
              color: "#777",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            Barcode: {it.barcode}
          </div>
          <div style={{ marginTop: 6, color: "#333" }}>
            £{money(it.price)} each • Line: <b>£{money(it.price * it.qty)}</b>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => dec(it.barcode)}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 18,
                background: "#fff",
              }}
            >
              −
            </button>
            <div
              style={{
                minWidth: 34,
                textAlign: "center",
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {it.qty}
            </div>
            <button
              onClick={() => inc(it.barcode)}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 18,
                background: "#fff",
              }}
            >
              +
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => remove(it.barcode)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #ddd",
                fontWeight: 800,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {/* Totals */}
      <div
        style={{
          marginTop: 10,
          borderTop: "1px solid #eee",
          paddingTop: 12,
          fontSize: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={{ color: "#555" }}>Subtotal</span>
          <span style={{ fontWeight: 900 }}>£{money(subtotal)}</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={{ color: "#555" }}>VAT (20%)</span>
          <span style={{ fontWeight: 900 }}>£{money(vat)}</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
          }}
        >
          <span style={{ fontWeight: 1000 }}>Total (inc VAT)</span>
          <span style={{ fontWeight: 1000 }}>£{money(totalIncVat)}</span>
        </div>
      </div>

      {/* Sticky Checkout Bar (bottom) */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#fff",
          borderTop: "1px solid #eee",
          padding: 12,
          width: "100vw",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            gap: 12,
            alignItems: "center",
            paddingLeft: 16,
            paddingRight: 16,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontWeight: 900 }}>
            Total inc VAT: £{money(totalIncVat)}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={checkout}
            disabled={loadingCheckout || items.length === 0}
            style={{
              padding: "14px 18px",
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 12,
              border: "1px solid #111",
              background: BRAND_PINK,
              width: 220,
              maxWidth: "50vw",
              cursor: loadingCheckout ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loadingCheckout ? "Checking out…" : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
