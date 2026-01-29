export const metadata = {
  title: "Salon Brands Pro — Scan & Go",
  description: "Scan & Go app for in-store shopping at Salon Brands Pro",

  // PWA / Android app requirements
  manifest: "/manifest.json",
  themeColor: "#111111",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
