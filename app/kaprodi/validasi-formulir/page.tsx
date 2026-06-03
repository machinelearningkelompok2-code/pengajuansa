"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import KaprodiLayout from '../../../components/KaprodiLayout';
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

export default function ValidasiFormulir() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const semesterPeriod = getCurrentSemesterPeriod();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const semesterPeriod = getCurrentSemesterPeriod();
    const { data, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        *,
        mahasiswa:mahasiswa_id(nama_mahasiswa, nim, prodi),
        items:pendaftaran_items(
          mata_kuliah:mk_id(nama_mk, sks)
        ),
        pembayaran (id)
      `)
      .eq('status', 'Approved') // Hanya tarik data yang sudah tervalidasi Sekjur
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Tampilkan semua formulir SA yang sudah di-approve oleh Sekjur (baik dari mahasiswa maupun sekjur)
      setApplications(data);
    }
    setLoading(false);
  };

  // Fungsi updateStatus dihapus karena Kaprodi hanya menampilkan formulir yang dikirim Sekjur

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const topbarTitle = (
    <div>
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Validasi Pendaftaran</h2>
      <p className="text-xs font-semibold text-gray-500">Tinjau dan putuskan pengajuan Semester Antara mahasiswa</p>
    </div>
  );

  return (
    <KaprodiLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-6 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-[#1A365D]">Antrian Pengajuan ({applications.length})</h3>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 border border-blue-100">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700 uppercase tracking-widest border border-blue-100 w-fit">
             Formulir Masuk
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 relative">
          {loading && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-3xl">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
             </div>
          )}

          {!loading && applications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center rounded-3xl bg-white border border-gray-50 border-dashed">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Antrean Kosong</p>
              <p className="text-xs font-bold text-gray-400/70 mt-1">Belum ada formulir baru yang diteruskan oleh Sekjur.</p>
            </div>
          ) : applications.map((app, idx) => (
            <div key={`${app.id}-${idx}`} className="rounded-3xl bg-white p-5 md:p-8 shadow-sm border border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all group">
              
              <div className="flex items-start gap-6 flex-grow">
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-lg font-black text-blue-700 shadow-sm border border-white">
                  {getInitials(app.mahasiswa?.nama_mahasiswa)}
                </div>
                <div className="flex flex-col gap-3 flex-grow">
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">{app.mahasiswa?.nama_mahasiswa}</h4>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">
                      {app.mahasiswa?.nim} • {app.mahasiswa?.prodi || 'Prodi Sistem Informasi'}
                    </p>
                  </div>
                  
                  {/* Daftar Mata Kuliah */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {app.items && app.items.map((item: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-600 border border-gray-100">
                         <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                         {item.mata_kuliah?.nama_mk} ({item.mata_kuliah?.sks} SKS)
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 shrink-0 items-stretch sm:items-center md:items-stretch lg:items-center">
                <div className="rounded-xl bg-blue-50 px-6 py-3.5 text-[10px] font-black text-blue-600 border border-blue-100 uppercase tracking-widest flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Diterima dari Sekjur
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </KaprodiLayout>
  );
}
