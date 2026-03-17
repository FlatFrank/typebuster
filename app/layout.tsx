import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const labSans = localFont({
  src: "../public/fonts/IBMPlexSans-Regular.woff",
  variable: "--font-lab",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Typebuster",
  description:
    "Experimental type lab for deforming Google Fonts through a live cubic SVG workbench."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={labSans.variable}>
      <body>{children}</body>
    </html>
  );
}
