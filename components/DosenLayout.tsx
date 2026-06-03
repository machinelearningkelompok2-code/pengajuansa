"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase/lib/supabase';
import DosenSidebar from './DosenSidebar';
import Topbar from './Topbar';

interface DosenLayoutProps {
  children: React.ReactNode;
  topbarTitle?: React.ReactNode;
}

export default function DosenLayout({ children, topbarTitle }: DosenLayoutProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (!session || !user || user.role !== 'dosen') {
        router.push('/login');
      } else {
        setIsAuthorized(true);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      setTimeStr(now.toLocaleString('id-ID', options));
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A365D] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FB] font-sans text-gray-900">
      <DosenSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex flex-grow flex-col lg:ml-[260px] min-w-0 overflow-x-hidden w-full max-w-full">
        <Topbar
          title={topbarTitle}
          onMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex-grow p-4 md:p-8">
          {children}
        </main>

        <footer className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-gray-200 py-6 px-4 md:px-8 text-[10px] font-bold text-gray-400 gap-2">
          <p className="uppercase tracking-widest">
            © {new Date().getFullYear()} POLITEKNIK NEGERI MANADO. PORTAL DOSEN.
          </p>
          {timeStr && (
            <p className="uppercase tracking-widest text-[#1A365D] bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100/50">
              {timeStr}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
