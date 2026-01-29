export const metadata = {
  title: "Salon Brands Pro — Scan & Go Backend",
  description: "Backend services for Scan & Go",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
