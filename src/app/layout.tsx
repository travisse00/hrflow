import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRFlow",
  description: "HR and internal communication platform",
};

// Runs before the page paints, so a saved dark/light choice never flashes the wrong theme.
const themeScript = `try{var t=localStorage.getItem("hrflow-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
