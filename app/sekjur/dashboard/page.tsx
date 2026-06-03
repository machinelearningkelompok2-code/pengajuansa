"use client";

import React, { useEffect, useState } from 'react';
import SekjurLayout from '../../../components/SekjurLayout';
import { supabase } from '../../../supabase/lib/supabase';
import { fetchPengaturan } from '../../../supabase/lib/pengaturan';
import Link from 'next/link';

// Helper: hitung periode semester aktif berdasarkan tanggal realtime
function getCurrentSemesterPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 1 && month <= 6) {
    return {
      label: `Genap ${year - 1}/${year}`,
      start: new Date(year, 0, 1),
      end: new Date(year, 5, 30, 23, 59, 59),
    };
  } else {
    return {
      label: `Ganjil ${year}/${year + 1}`,
      start: new Date(year, 6, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
    };
  }
}

const TrendingUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

const ClipboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
);

export default function SekjurDashboard() {
  const [loading, setLoading] = useState(true);
  const [sekjurName, setSekjurName] = useState('Bagian Sekretaris Jurusan');
  const [stats, setStats] = useState({ totalPeserta: 0, lunas: 0, pending: 0, percentageLunas: 0, totalPendaftaran: 0 });
  const [urgentVerifications, setUrgentVerifications] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    const loadPejabat = async () => {
      const p = await fetchPengaturan();
      if (p.sekjur_nama) {
        setSekjurName(p.sekjur_nama);
      }
    };
    loadPejabat();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    const semPeriod = getCurrentSemesterPeriod();

    const { data: pendaftaranData, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        *,
        mahasiswa:mahasiswa_id (
          nama_mahasiswa, 
          nim, 
          prodi
        )
      `)
      .gte('created_at', semPeriod.start.toISOString())
      .lte('created_at', semPeriod.end.toISOString())
      .order('created_at', { ascending: false });

    if (pendaftaranData && !error) {
      // Hitung statistik
      const { count: mCount } = await supabase
        .from('mahasiswa')
        .select('*', { count: 'exact', head: true });
      
      const totalMahasiswa = mCount || 0;
      const lunasCount = pendaftaranData.filter(p => p.status === 'Approved').length;
      const pendingCount = pendaftaranData.filter(p => p.status === 'Pending').length;
      const totalPendaftaran = pendaftaranData.length;
      const percentage = totalPendaftaran > 0 ? Math.round((lunasCount / totalPendaftaran) * 100) : 0;

      setStats({
        totalPeserta: totalMahasiswa,
        lunas: lunasCount,
        pending: pendingCount,
        percentageLunas: percentage,
        totalPendaftaran: totalPendaftaran
      });

      // Filter untuk tabel mendesak (butuh validasi)
      const urgents = pendaftaranData.filter(p => p.status === 'Pending').slice(0, 5);
      setUrgentVerifications(urgents);

      // Data aktivitas terbaru
      setRecentActivities(pendaftaranData.slice(0, 5));
    }

    setLoading(false);
  };

  const getTimeAgo = (dateString: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000); // dalam menit
    if (diff < 60) return `${diff} Menit yang lalu`;
    if (diff < 1440) return `${Math.floor(diff / 60)} Jam yang lalu`;
    return `${Math.floor(diff / 1440)} Hari yang lalu`;
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const semesterPeriod = getCurrentSemesterPeriod();

  const topbarTitle = (
    <div>
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Dashboard Terpadu Sekjur & Admin</h2>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-xs font-semibold text-gray-500">Selamat datang kembali, {sekjurName}</p>
        <span className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[9px] font-black text-blue-700 uppercase tracking-widest">
          Semester {semesterPeriod.label}
        </span>
      </div>
    </div>
  );

  return (
    <SekjurLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-8">

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-50 relative overflow-hidden">
            {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><div className="h-4 w-4 border-2 border-[#1A365D] border-t-transparent rounded-full animate-spin"></div></div>}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">TOTAL PESERTA SA</p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-extrabold text-[#1A365D]">{stats.totalPeserta}</span>
              <div className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                <TrendingUpIcon /> Aktif
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Mahasiswa terdaftar unik</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-50 relative overflow-hidden">
            {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">PEMBAYARAN LUNAS</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-extrabold text-[#1A365D]">{stats.percentageLunas}%</span>
              <span className="text-[10px] font-bold text-gray-400">{stats.lunas} / {stats.totalPendaftaran} Pendaftaran</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-blue-600 transition-all duration-1000" style={{ width: `${stats.percentageLunas}%` }}></div>
            </div>
          </div>

          <div className="relative rounded-2xl bg-white p-6 shadow-sm border border-gray-50 border-l-4 border-l-orange-400 overflow-hidden">
            {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><div className="h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">FORMULIR PENDING</p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-extrabold text-[#1A365D]">{stats.pending}</span>
              <div className="rounded-full bg-orange-50 p-1 text-orange-600">
                <SendIcon />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase text-orange-600 tracking-wider animate-pulse">Menunggu Verifikasi Sekjur</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          {/* Left Column */}
          <div className="flex flex-col gap-6 md:gap-8 flex-grow min-w-0">

            {/* Urgent Verification Table */}
            <div className="rounded-2xl bg-white p-5 md:p-8 shadow-sm border border-gray-50 relative">
              {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-2xl"></div>}
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900">Verifikasi Pembayaran Mendesak</h3>
                </div>
                <Link href="/sekjur/pembayaran" className="text-xs font-bold text-blue-600 hover:underline">Lihat Semua</Link>
              </div>

              {/* Mobile View: Card List */}
              <div className="md:hidden flex flex-col gap-3">
                {urgentVerifications.length > 0 ? urgentVerifications.map((item, idx) => (
                  <div key={`m-${item.id}-${idx}`} className="rounded-2xl border border-gray-50 bg-gray-50/20 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                        {getInitials(item.mahasiswa?.nama_mahasiswa)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.mahasiswa?.nama_mahasiswa}</p>
                        <p className="text-[10px] font-medium text-gray-400">NIM: {item.mahasiswa?.nim} • {item.mahasiswa?.prodi || 'Sistem Informasi'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="inline-flex rounded-lg bg-orange-50 px-2.5 py-1 text-[9px] font-black text-orange-700 tracking-wider">
                        BUTUH VALIDASI
                      </span>
                      <Link href="/sekjur/pembayaran" className="rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800">Verifikasi</Link>
                    </div>
                  </div>
                )) : (
                  <p className="py-6 text-center text-xs font-bold text-gray-400 uppercase">Tidak ada verifikasi mendesak</p>
                )}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      <th className="pb-4">MAHASISWA</th>
                      <th className="pb-4">PROGRAM STUDI</th>
                      <th className="pb-4">STATUS</th>
                      <th className="pb-4 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {urgentVerifications.length > 0 ? urgentVerifications.map((item) => (
                      <tr key={item.id}>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                              {getInitials(item.mahasiswa?.nama_mahasiswa)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.mahasiswa?.nama_mahasiswa}</p>
                              <p className="text-[10px] font-medium text-gray-400">NIM: {item.mahasiswa?.nim}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-sm font-semibold text-gray-600">{item.mahasiswa?.prodi || 'Sistem Informasi'}</td>
                        <td className="py-4">
                          <span className="inline-flex flex-col items-center rounded-lg bg-orange-50 px-2.5 py-1 text-[9px] font-bold text-orange-700">
                            <span>BUTUH</span>
                            <span>VALIDASI</span>
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <Link href="/sekjur/pembayaran" className="rounded-lg bg-[#0F172A] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800">Verifikasi</Link>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
                          {loading ? 'Memuat Data...' : 'Tidak ada verifikasi mendesak'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>            {/* Formulir SA Recent Activity */}
            <div className="rounded-2xl bg-white p-5 md:p-8 shadow-sm border border-gray-50 relative">
              {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-2xl"></div>}
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-bold text-gray-900">Aktivitas Formulir SA (Terbaru)</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black text-blue-700 uppercase tracking-widest">Real-Time</span>
              </div>

              <div className="space-y-4">
                {recentActivities.length > 0 ? recentActivities.map((activity) => (
                  <Link href="/sekjur/pembayaran" key={activity.id} className="block">
                    <div className="flex items-center justify-between rounded-xl border border-gray-50 p-4 hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${activity.status === 'Approved' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {activity.status === 'Approved' ? <ClipboardIcon /> : <SendIcon />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {activity.status === 'Approved' ? 'Formulir Disetujui (Lunas)' : 'Formulir Masuk (Menunggu Verifikasi)'}
                          </h4>
                          <p className="text-[10px] text-gray-400 truncate">Mahasiswa: <span className="font-bold">{activity.mahasiswa?.nama_mahasiswa} ({activity.mahasiswa?.nim})</span></p>
                          <p className="text-[9px] text-gray-400/80 mt-0.5">{getTimeAgo(activity.created_at)}</p>
                        </div>
                      </div>
                      <ChevronRightIcon />
                    </div>
                  </Link>
                )) : (
                  <div className="py-6 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
                    {loading ? 'Memuat Aktivitas...' : 'Belum ada aktivitas'}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="w-full lg:w-[340px] lg:shrink-0 flex flex-col gap-6 md:gap-8">

            {/* Timeline Semester Antara */}
            <div className="rounded-2xl bg-gray-100 p-6 md:p-8 shadow-sm border border-gray-50 relative">
              <h3 className="text-base md:text-lg font-bold text-[#1A365D] mb-6 md:mb-8">Status Alur Kerja SA</h3>

              <div className="relative pl-6 space-y-10">
                <div className="absolute left-[2px] top-1.5 bottom-1.5 w-[2px] bg-gray-200"></div>

                <div className="relative">
                  <div className={`absolute -left-[30px] top-0 flex h-6 w-6 items-center justify-center rounded-full ${stats.totalPendaftaran > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'} ring-4 ring-gray-100`}>
                    {stats.totalPendaftaran > 0 ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <div className="h-2.5 w-2.5 rounded-full bg-gray-400"></div>}
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold leading-none mb-1 ${stats.totalPendaftaran > 0 ? 'text-gray-900' : 'text-gray-400'}`}>Penerimaan Berkas</h4>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">{stats.totalPendaftaran} Formulir Masuk</p>
                  </div>
                </div>

                <div className="relative">
                  <div className={`absolute -left-[30px] top-0 flex h-6 w-6 items-center justify-center rounded-full ${stats.percentageLunas === 100 && stats.totalPendaftaran > 0 ? 'bg-green-100 text-green-600' : (stats.totalPendaftaran > 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400')} ring-4 ring-gray-100`}>
                    {stats.percentageLunas === 100 && stats.totalPendaftaran > 0 ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <div className={`h-2 w-2 rounded-full ${stats.totalPendaftaran > 0 ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></div>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold leading-none mb-2 ${stats.totalPendaftaran > 0 ? 'text-[#1A365D]' : 'text-gray-400'}`}>Validasi Sekjur</h4>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-3">
                      {stats.percentageLunas === 100 && stats.totalPendaftaran > 0 ? 'Selesai (100%)' : `Sedang Berlangsung (${stats.percentageLunas}%)`}
                    </p>
                    <div className="h-2 w-full rounded-full bg-white overflow-hidden border border-gray-200">
                      <div className="h-full rounded-full bg-blue-800 transition-all duration-1000" style={{ width: `${stats.percentageLunas}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className={`absolute -left-[30px] top-0 flex h-6 w-6 items-center justify-center rounded-full ${stats.lunas > 0 ? 'bg-blue-500 text-white' : 'bg-white border-2 border-gray-200'} ring-4 ring-gray-100`}>
                    {stats.lunas > 0 && <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>}
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold leading-none mb-1 ${stats.lunas > 0 ? 'text-gray-900' : 'text-gray-400'}`}>Tindak Lanjut Kaprodi</h4>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">{stats.lunas} Siap Diproses Kaprodi</p>
                  </div>
                </div>
              </div>

              {/* Quick Action Button */}
              <Link href="/sekjur/pembayaran" title="Verifikasi Pembayaran" className="absolute -bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400 text-2xl font-bold text-[#1A365D] shadow-lg shadow-yellow-500/30 transform hover:scale-105 active:scale-95 transition-all">
                +
              </Link>
            </div>

            {/* Quick Summary Info */}
            <div className="rounded-2xl bg-[#1A365D] p-6 text-white">
              <h4 className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-4">Catatan Jurusan</h4>
              <p className="text-[11px] leading-relaxed text-blue-100">
                Ada <span className="font-bold text-white">{stats.pending} formulir</span> yang butuh verifikasi mendesak hari ini. Mohon Sekjur memastikan semua bukti pembayaran telah diverifikasi sebelum data dikirimkan ke Kaprodi.
              </p>
            </div>

          </div>
        </div>

      </div>
    </SekjurLayout>
  );
}
