import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DarkScore",
  description: "Dark-themed risk score reports for any stock ticker"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

