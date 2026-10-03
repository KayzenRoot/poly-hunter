import type { ReactNode } from "react";

export const metadata = {
  title: "PolyHunter Engineering Shell",
  description: "Minimal web shell for the PH-M00 engineering foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
