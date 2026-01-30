export const metadata = {
  title: "Salon Brands Pro — Scan & Go",
  description: "Scan & Go",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "'League Spartan', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          background: "#ffffff",
          color: "#111",
        }}
      >
        {children}
      </body>
    </html>
  );
}
