"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '../../../components/MainLayout';
import { supabase } from '../../../supabase/lib/supabase';

// Helper: hitung periode semester aktif berdasarkan tanggal realtime
function getCurrentSemesterPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Semester Genap: Januari - Juni
  // Semester Ganjil: Juli - Desember
  if (month >= 1 && month <= 6) {
    return {
      label: `Genap ${year - 1}/${year}`,
      start: new Date(year, 0, 1), // 1 Jan
      end: new Date(year, 5, 30, 23, 59, 59), // 30 Jun
    };
  } else {
    return {
      label: `Ganjil ${year}/${year + 1}`,
      start: new Date(year, 6, 1), // 1 Jul
      end: new Date(year, 11, 31, 23, 59, 59), // 31 Des
    };
  }
}

export default function RiwayatAkademikPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const semesterPeriod = getCurrentSemesterPeriod();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const semesterPeriod = getCurrentSemesterPeriod();

    // Fetch data pendaftaran yang terhubung dengan mata kuliah yang diambil pada Semester Aktif
    const { data, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        *,
        items:pendaftaran_items(
          mata_kuliah:mata_kuliah(nama_mk)
        )
      `)
      .eq('mahasiswa_id', user.id)
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString())
      .order('created_at', { ascending: false });

    if (!error) {
      setHistory(data || []);
    }
    setLoading(false);
  };

  const topbarTitle = (
    <h2 className="m-0 text-xl font-bold text-[#1A365D]">Riwayat Akademik</h2>
  );

  return (
    <MainLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-[#0F172A] p-8 md:p-12 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-2xl md:text-4xl font-black mb-3 md:mb-4">Riwayat Pengajuan</h1>
            <p className="text-xs md:text-sm text-gray-400 font-medium leading-relaxed mb-4">
              Daftar seluruh riwayat pendaftaran Semester Antara Anda. 
              Gunakan informasi ini untuk memantau status verifikasi dan bukti pembayaran.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 border border-white/20 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        </div>

        {/* Mobile View: Cards */}
        <div className="block md:hidden space-y-4">
          {loading ? (
            <div className="py-10 text-center font-bold text-gray-300 uppercase tracking-widest animate-pulse">Menghubungkan ke Database...</div>
          ) : history.length > 0 ? (
            history.map((item) => (
              <div key={item.id} className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-50 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">KODE REGISTRASI</span>
                    <span className="text-sm font-black text-[#1A365D] tracking-wider">{item.kode_pendaftaran}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[8px] font-black tracking-widest uppercase border ${
                    item.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' : 
                    item.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                    'bg-gray-50 text-gray-400 border-gray-100'
                  }`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'Approved' ? 'bg-green-600' : item.status === 'Pending' ? 'bg-orange-600 animate-pulse' : 'bg-gray-400'}`}></div>
                    {item.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Mata Kuliah Diambil</span>
                  <div className="rounded-2xl bg-gray-50/50 p-4 border border-gray-50 flex flex-col gap-2">
                    {item.items && item.items.length > 0 ? (
                      item.items.map((it: any, idx: number) => (
                        <span key={idx} className="text-xs font-bold text-gray-900">• {it.mata_kuliah?.nama_mk}</span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 italic">MK Belum Dialokasikan</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">TANGGAL PENGAJUAN</span>
                  <span className="text-xs font-bold text-gray-600">
                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl bg-white p-8 text-center border border-gray-50">
              <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Belum ada data riwayat pendaftaran.</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-hidden rounded-3xl bg-white shadow-sm border border-gray-50">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Kode REG</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Daftar Mata Kuliah</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Tanggal</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center font-bold text-gray-300 uppercase tracking-widest animate-pulse">Menghubungkan ke Database...</td>
                </tr>
              ) : history.length > 0 ? (
                history.map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-[#1A365D] tracking-wider">{item.kode_pendaftaran}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        {item.items && item.items.length > 0 ? (
                          item.items.map((it: any, idx: number) => (
                            <span key={idx} className="text-sm font-bold text-gray-900">• {it.mata_kuliah?.nama_mk}</span>
                          ))
                        ) : (
                          <span className="text-xs font-bold text-gray-400 italic">MK Belum Dialokasikan</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-bold text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[9px] font-black tracking-widest uppercase border ${
                        item.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' : 
                        item.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                        'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'Approved' ? 'bg-green-600' : item.status === 'Pending' ? 'bg-orange-600 animate-pulse' : 'bg-gray-400'}`}></div>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Belum ada data riwayat pendaftaran.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
