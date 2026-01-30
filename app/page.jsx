"use client";

import { useRouter } from "next/navigation";

const BRAND_PINK = "#FEB3E4";

export default function HomePage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'League Spartan', system-ui, -apple-system",
        background: "#f9f9f9",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 22,
          textAlign: "center",
        }}
      >
        <img
          src="/Main%20Logo.png"
          alt="Salon Brands Pro"
          style={{ height: 54, width: "auto", maxWidth: "100%" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <div style={{ marginTop: 14, color: "#666", fontSize: 14 }}>
          Scan &amp; Go
        </div>

        <button
          onClick={() => router.push("/scan")}
          style={{
            marginTop: 18,
            width: "100%",
            padding: 16,
            fontSize: 18,
            fontWeight: 900,
            borderRadius: 14,
            border: "1px solid #111",
            background: BRAND_PINK,
            cursor: "pointer",
          }}
        >
          Start shopping
        </button>

        <div style={{ marginTop: 14, fontSize: 12, color: "#777" }}>
          Pick items → scan → checkout at the desk
        </div>
      </div>
    </div>
  );
}
