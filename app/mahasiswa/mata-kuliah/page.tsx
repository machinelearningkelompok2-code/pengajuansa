"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '../../../components/MainLayout';
import { ClockIcon } from '../../../components/icons';
import { supabase } from '../../../supabase/lib/supabase';
import Swal from 'sweetalert2';

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

export default function MataKuliahPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const semesterPeriod = getCurrentSemesterPeriod();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      fetchCourses(parsedUser.id);
    }
  }, []);

  const fetchCourses = async (userId: string) => {
    setLoading(true);

    // 1. Ambil pendaftaran aktif pada semester berjalan
    const { data: pendaftarans } = await supabase
      .from('pendaftaran_sa')
      .select('id')
      .eq('mahasiswa_id', userId)
      .eq('status', 'Approved')
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString());

    if (pendaftarans && pendaftarans.length > 0) {
      const pIds = pendaftarans.map(p => p.id);
      
      // 2. Ambil MK yang didaftarkan
      const { data: items, error } = await supabase
        .from('pendaftaran_items')
        .select(`
          pendaftaran_id,
          mata_kuliah:mata_kuliah(
            id,
            nama_mk,
            sks,
            semester_asal
          )
        `)
        .in('pendaftaran_id', pIds);

      // 3. Ambil alokasi dosen secara eksplisit berdasarkan pendaftaran_id
      const { data: alokasis } = await supabase
        .from('alokasi_dosen')
        .select('mk_id, pendaftaran_id, dosen:users(nama_lengkap)')
        .in('pendaftaran_id', pIds);

      if (!error && items) {
        // Pemetaan data untuk UI
        const mappedData = items.map((item: any, index: number) => {
          const allocation = alokasis?.find(a => a.mk_id === item.mata_kuliah.id && a.pendaftaran_id === item.pendaftaran_id);
          const isAllocated = !!allocation;
          
          return {
            id: item.mata_kuliah.id,
            title: item.mata_kuliah.nama_mk,
            sks: item.mata_kuliah.sks || 0,
            semester: item.mata_kuliah.semester_asal || '-',
            dosen: isAllocated
              ? (Array.isArray(allocation.dosen)
                ? allocation.dosen[0]?.nama_lengkap
                : (allocation.dosen as any)?.nama_lengkap) || 'Menunggu Alokasi Kaprodi'
              : 'Menunggu Alokasi Kaprodi',
            status: isAllocated ? 'AKTIF' : 'PENDING',
            color: index % 3 === 0 ? '#1A365D' : index % 3 === 1 ? '#D97706' : '#991B1B'
          };
        });
        setCourses(mappedData);
      }
    }
    setLoading(false);
  };

  const topbarTitle = (
    <div className="flex items-center gap-4">
      <h2 className="m-0 text-xl font-bold text-[#1A365D]">Data Mata Kuliah SA</h2>
      <div className="mx-4 h-5 w-px bg-gray-300"></div>
      <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Detail Akademik</span>
    </div>
  );

  return (
    <MainLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-8">

        {/* Banner Area */}
        <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-[#0B2559] p-8 md:p-12 text-white shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <h1 className="mb-3 text-2xl md:text-4xl font-black tracking-tight leading-tight">Data Mata Kuliah <br />Semester Antara</h1>
            <p className="mb-4 text-xs md:text-sm text-blue-200 font-medium">Berikut adalah daftar lengkap Mata Kuliah yang telah disetujui beserta alokasi dosen pengampunya.</p>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 border border-white/20 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>
          <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-white/5 blur-3xl"></div>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full h-32 w-full rounded-2xl bg-gray-50 animate-pulse"></div>
          ) : courses.length > 0 ? (
            courses.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="relative flex flex-col rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-gray-50 transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="absolute left-0 top-8 bottom-8 w-1.5 rounded-r-full" style={{ backgroundColor: item.color }}></div>
                
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] ${item.status === 'AKTIF' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                    {item.status}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    <ClockIcon />
                    {item.sks} SKS
                  </div>
                </div>

                <h4 className="mb-4 text-lg md:text-xl font-black text-[#1A365D] leading-tight line-clamp-2">{item.title}</h4>
                
                <div className="mt-auto pt-4 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-grow min-w-0">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-gray-400">Dosen Pengampu</p>
                    <p className={`text-sm font-bold truncate ${item.status === 'AKTIF' ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                      {item.dosen}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-gray-100 bg-gray-50/50 py-20 px-4 text-center">
              <span className="text-sm font-black uppercase tracking-widest text-gray-400">Belum ada mata kuliah yang disetujui</span>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="rounded-3xl bg-white p-5 md:p-8 shadow-sm border border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktif (Dialokasi)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-400"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menunggu Kaprodi</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
