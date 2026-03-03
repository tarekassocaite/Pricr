import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Pricr',
  description: 'Deal intelligence and pricing ops app'
};

const links: Array<{ href: Route; label: string }> = [
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/deals', label: 'Deals' },
  { href: '/clients', label: 'Clients' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/documents', label: 'Documents' }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-6xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between">
            <Link className="text-xl font-semibold" href="/dashboard">
              Pricr
            </Link>
            <nav className="flex gap-4 text-sm">
              {links.map((item) => (
                <Link className="text-muted-foreground hover:text-foreground" href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
