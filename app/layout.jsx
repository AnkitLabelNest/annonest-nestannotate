export const metadata = {
  title: "AnnoNest",
  description: "Annotation Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
