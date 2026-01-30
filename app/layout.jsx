import "./globals.css";

export const metadata = {
  title: "Scan & Go",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "'League Spartan', system-ui, -apple-system",
          background: "#f9f9f9",
          width: "100%",
          overflowX: "hidden", // prevents horizontal scroll
          WebkitTextSizeAdjust: "100%",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {children}
      </body>
    </html>
  );
}
