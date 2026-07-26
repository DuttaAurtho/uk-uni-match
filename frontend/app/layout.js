import "./globals.css";

export const metadata = {
  title: "UK Uni Match — University Comparison Tool",
  description:
    "Enter your GPA, IELTS score, and budget to instantly see which UK universities you're eligible for.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
