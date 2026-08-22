'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/components/providers/AuthProvider';

/**
 * Wraps the app with AuthProvider and conditionally renders
 * marketing Header/Footer only on public pages (not dashboard/admin/auth).
 */
export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Routes where we hide the marketing header & footer
  const isAppRoute = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/join');

  return (
    <AuthProvider>
      {!isAppRoute && <Header />}
      <main className="flex-grow">
        {children}
      </main>
      {!isAppRoute && <Footer />}
    </AuthProvider>
  );
}
