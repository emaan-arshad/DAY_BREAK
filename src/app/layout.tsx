import type { Metadata } from "next";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAYBREAK — Your morning, edited for you.",
  description:
    "A finite, personalized daily morning newspaper with grounded summaries and printable editions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F5F1E8] text-[#191919]">
        {children}
      </body>
    </html>
  );
}
