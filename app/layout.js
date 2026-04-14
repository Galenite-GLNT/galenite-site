import './globals.css';

export const metadata = {
  title: 'Galenite — Future Systems for Intelligent Operations',
  description:
    'Premium cinematic landing page for Galenite. AI systems, business automation, and high-end digital infrastructure.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
