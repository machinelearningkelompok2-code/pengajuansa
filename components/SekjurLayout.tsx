"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase/lib/supabase';
import SekjurSidebar from './SekjurSidebar';
import Topbar from './Topbar';

interface SekjurLayoutProps {
  children: React.ReactNode;
  topbarTitle?: React.ReactNode;
}

export default function SekjurLayout({ children, topbarTitle }: SekjurLayoutProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (!session || !user || user.role !== 'sekjur') {
        router.push('/login');
      } else {
        setIsAuthorized(true);
      }
    };
    checkAuth();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A365D] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB] font-sans text-gray-900">
      <SekjurSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex flex-grow flex-col lg:ml-[260px] min-w-0 h-full overflow-hidden">
        <Topbar
          title={topbarTitle}
          onMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex-grow overflow-y-auto p-4 md:p-8">
          {children}
        </main>

        <footer className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-gray-200 py-4 px-4 md:px-8 text-[10px] font-bold text-gray-400 gap-2 bg-white z-10">
          <p className="uppercase tracking-widest">
            © {new Date().getFullYear()} POLITEKNIK NEGERI MANADO. DIKEMBANGKAN OLEH DIVISI IT POLIMDO.
          </p>
        </footer>
      </div>
    </div>
  );
}
