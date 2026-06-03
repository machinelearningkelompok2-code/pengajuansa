"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase/lib/supabase';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface MainLayoutProps {
  children: React.ReactNode;
  topbarTitle?: React.ReactNode;
}

export default function MainLayout({ children, topbarTitle }: MainLayoutProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (!session || !user || user.role !== 'mahasiswa') {
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
    <div className="flex min-h-screen bg-[#F8F9FB] font-sans">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex flex-grow flex-col lg:ml-[260px] min-w-0 overflow-x-hidden w-full max-w-full">
        <Topbar
          title={topbarTitle}
          onMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <div className="flex flex-grow flex-col p-3 sm:p-4 md:p-8">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-8 md:mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-gray-200 py-4 md:py-6 px-3 sm:px-4 md:px-8 text-xs font-semibold text-gray-400 gap-2">
          <p className="uppercase tracking-wider text-center sm:text-left">
            © {new Date().getFullYear()} POLITEKNIK NEGERI MANADO. EXCELLENCE IN VOCATIONAL EDUCATION.
          </p>
        </footer>
      </div>
    </div>
  );
}
