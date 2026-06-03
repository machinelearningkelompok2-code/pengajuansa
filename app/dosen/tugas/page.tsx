"use client";

import React, { useEffect, useState } from 'react';
import DosenLayout from '../../../components/DosenLayout';
import Link from 'next/link';
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

// Icons
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V11a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);

export default function ManajemenTugasDosen() {
  const [activePage, setActivePage] = useState(1);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const semesterPeriod = getCurrentSemesterPeriod();
  
  const [stats, setStats] = useState({
    aktif: 0,
    menungguNilai: 0,
    submissionRate: 0
  });

  const itemsPerPage = 4;

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);

    const userStr = localStorage.getItem('user');
    if (!userStr) {
      setLoading(false);
      return;
    }
    const user = JSON.parse(userStr);

    // 1. Fetch Tugas Khusus Dosen yang Login pada Semester Aktif
    const { data: tugasData } = await supabase
      .from('tugas')
      .select('*, mata_kuliah(id, nama_mk), mahasiswa(id, nama_mahasiswa, nim)')
      .eq('dosen_id', user.id)
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString())
      .order('created_at', { ascending: false });

    if (tugasData) {
      const tugasIds = tugasData.map(t => t.id);
      const mkIds = Array.from(new Set(tugasData.map(t => t.mk_id)));

      // 2. Ambil pengumpulan khusus tugas milik dosen ini
      const { data: pengumpulan } = await supabase
        .from('pengumpulan_tugas')
        .select('tugas_id, nilai')
        .in('tugas_id', tugasIds);
      
      // 3. Ambil peserta khusus MK yang diajar dosen ini
      const { data: pItems } = await supabase
        .from('pendaftaran_items')
        .select('mk_id, pendaftaran_sa(mahasiswa_id)')
        .in('mk_id', mkIds);

      let totalMenunggu = 0;
      let totalKumpulKeseluruhan = 0;
      let totalMahasiswaSeharusnya = 0;

      const mappedTasks = tugasData.map(t => {
        const mkItems = pItems?.filter(p => p.mk_id === t.mk_id) || [];
        const uniqueMahasiswa = new Set();
        mkItems.forEach(p => {
          if ((p.pendaftaran_sa as any)?.mahasiswa_id) uniqueMahasiswa.add((p.pendaftaran_sa as any).mahasiswa_id);
        });
        const kuota = uniqueMahasiswa.size;
        
        const terkumpul = pengumpulan?.filter(p => p.tugas_id === t.id) || [];
        const menungguDinilai = terkumpul.filter(p => p.nilai === null).length;

        totalMenunggu += menungguDinilai;
        totalKumpulKeseluruhan += terkumpul.length;
        totalMahasiswaSeharusnya += kuota;

        let deadlineStr = 'TBA';
        if (t.deadline) {
          const d = new Date(t.deadline);
          deadlineStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + 
                        d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        }

        const isExpired = t.deadline ? new Date(t.deadline) < new Date() : false;

        return {
          id: t.id,
          mk: (t.mata_kuliah as any)?.nama_mk || 'MK Tidak Ditemukan',
          judul: t.judul,
          mahasiswa: (t.mahasiswa as any)?.nama_mahasiswa || 'Seluruh Kelas',
          deadline: deadlineStr,
          pengumpul: `${terkumpul.length}/${kuota}`,
          progressPersen: kuota > 0 ? Math.round((terkumpul.length / kuota) * 100) : 0,
          status: isExpired ? 'SELESAI' : 'AKTIF',
          desc: t.deskripsi || 'Tidak ada deskripsi.'
        };
      });

      setTasks(mappedTasks);
      
      setStats({
        aktif: mappedTasks.filter(t => t.status === 'AKTIF').length,
        menungguNilai: totalMenunggu,
        submissionRate: totalMahasiswaSeharusnya > 0 ? Math.round((totalKumpulKeseluruhan / totalMahasiswaSeharusnya) * 100) : 0
      });
    }

    setLoading(false);
  };

  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedTasks = tasks.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(tasks.length / itemsPerPage) || 1;

  const topbarTitle = (
    <div className="flex items-center gap-4">
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Portal Dosen</h2>
      <div className="mx-2 h-5 w-px bg-gray-200"></div>
      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manajemen Tugas</span>
    </div>
  );

  return (
    <DosenLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-10 relative">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl md:text-4xl font-black text-[#1A365D] mb-2 tracking-tight">Penugasan Mahasiswa</h1>
            <p className="text-sm font-semibold text-gray-400">Kelola daftar tugas untuk setiap mata kuliah secara real-time.</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 border border-blue-100">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>
          <Link 
            href="/dosen/tugas/buat"
            className="flex items-center gap-3 rounded-2xl bg-[#0B2559] px-6 md:px-10 py-4 md:py-5 text-sm font-black text-white shadow-2xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap"
          >
            <PlusIcon /> BUAT TUGAS
          </Link>
        </div>

        {/* Stats Area */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
           <div className="rounded-[2rem] bg-white p-7 shadow-sm border border-gray-50 flex flex-col gap-1 group hover:shadow-lg transition-all relative overflow-hidden">
              {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"></div>}
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TUGAS AKTIF</span>
              <span className="text-3xl font-black text-[#1A365D]">{stats.aktif}</span>
           </div>
           <div className="rounded-[2rem] bg-white p-7 shadow-sm border border-gray-50 flex flex-col gap-1 group hover:shadow-lg transition-all relative overflow-hidden">
              {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"></div>}
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">MENUNGGU PENILAIAN</span>
              <span className="text-3xl font-black text-yellow-600">{stats.menungguNilai}</span>
           </div>
           <div className="rounded-[2rem] bg-white p-7 shadow-sm border border-gray-50 flex flex-col gap-1 group hover:shadow-lg transition-all relative overflow-hidden">
              {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"></div>}
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SUBMISSION RATE</span>
              <span className="text-3xl font-black text-blue-600">{stats.submissionRate}%</span>
           </div>
           <div className="rounded-[2rem] bg-white p-7 shadow-sm border border-gray-50 flex flex-col gap-1 group hover:shadow-lg transition-all relative overflow-hidden">
              {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"></div>}
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TOTAL TUGAS (ALL)</span>
              <span className="text-3xl font-black text-gray-900">{tasks.length}</span>
           </div>
        </div>

        {/* Tasks Section */}
        <div className="rounded-[2.5rem] bg-white shadow-sm border border-gray-50 overflow-hidden relative min-h-[400px]">
          {loading && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
             </div>
          )}
          <div className="px-6 md:px-10 py-6 md:py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
            <h3 className="text-lg md:text-xl font-black text-[#1A365D] uppercase tracking-wider">Daftar Penugasan</h3>
            <div className="flex gap-2">
               <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live System</span>
            </div>
          </div>

          {/* ── MOBILE: Card List (hidden on md+) ── */}
          <div className="md:hidden divide-y divide-gray-50">
            {paginatedTasks.length > 0 ? paginatedTasks.map((task, idx) => (
              <div key={`m-${task.id}-${idx}`} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-grow min-w-0">
                    <span className="inline-flex mb-1 text-[9px] font-black text-[#114093] uppercase tracking-tight bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 line-clamp-1">
                      {task.mk}
                    </span>
                    <p className="text-sm font-black text-[#1A365D] leading-tight line-clamp-2">{task.judul}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5 line-clamp-1">{task.mahasiswa}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9px] font-black tracking-widest border ${
                    task.status === 'AKTIF' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${task.status === 'AKTIF' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    {task.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 uppercase">
                      <CalendarIcon /> {task.deadline}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-900">{task.pengumpul}</span>
                      <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${task.progressPersen}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/dosen/tugas/kelola/${task.id}`}
                    className="rounded-xl bg-gray-100 px-4 py-2.5 text-[10px] font-black text-gray-600 hover:bg-[#1A365D] hover:text-white transition-all uppercase tracking-widest"
                  >
                    Kelola
                  </Link>
                </div>
              </div>
            )) : (
              <div className="py-16 text-center text-sm font-black text-gray-400 uppercase tracking-widest">
                Belum Ada Penugasan
              </div>
            )}
          </div>

          {/* ── DESKTOP: Table (hidden on mobile) ── */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 bg-gray-50/50 border-b border-gray-50">
                <th className="px-6 py-5">MATA KULIAH</th>
                <th className="px-6 py-5">MAHASISWA</th>
                <th className="px-6 py-5">DETAIL TUGAS</th>
                <th className="px-6 py-5">BATAS WAKTU</th>
                <th className="px-6 py-5 text-center">PENGUMPULAN</th>
                <th className="px-6 py-5 text-center">STATUS</th>
                <th className="px-6 py-5 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedTasks.length > 0 ? paginatedTasks.map((task, idx) => (
                <tr key={`d-${task.id}-${idx}`} className="transition-all hover:bg-blue-50/30 group">
                  <td className="px-6 py-6">
                     <span className="text-[10px] font-black text-[#114093] uppercase tracking-tight bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 line-clamp-1">
                        {task.mk}
                     </span>
                  </td>
                  <td className="px-6 py-6">
                     <p className="text-sm font-bold text-gray-900 line-clamp-1">{task.mahasiswa}</p>
                  </td>
                  <td className="px-6 py-6">
                    <p className="text-sm font-bold text-gray-900 mb-1 group-hover:text-[#114093] transition-colors">{task.judul}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter line-clamp-1 max-w-[200px]">{task.desc}</p>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-600 bg-gray-100/50 w-fit px-3 py-2 rounded-xl border border-gray-100 uppercase tracking-widest whitespace-nowrap">
                       <CalendarIcon />
                       {task.deadline}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                       <span className="text-xs font-black text-gray-900">{task.pengumpul}</span>
                       <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${task.progressPersen}%` }}></div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[9px] font-black tracking-[0.2em] border ${task.status === 'AKTIF' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                       <span className={`h-1.5 w-1.5 rounded-full ${task.status === 'AKTIF' ? 'bg-green-600' : 'bg-gray-400'}`}></span>
                       {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <Link 
                      href={`/dosen/tugas/kelola/${task.id}`}
                      className="rounded-xl bg-gray-100 px-5 py-3 text-[10px] font-black text-gray-600 hover:bg-[#1A365D] hover:text-white transition-all uppercase tracking-widest"
                    >
                      Kelola
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-sm font-black text-gray-400 uppercase tracking-widest">
                    Belum Ada Penugasan di Database
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-50 bg-gray-50/50 px-6 md:px-10 py-5 md:py-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menampilkan {paginatedTasks.length} dari {tasks.length} Tugas</p>
            <div className="flex items-center gap-3">
              <button 
                disabled={activePage === 1}
                onClick={() => setActivePage(p => Math.max(1, p - 1))} 
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:bg-blue-50 transition-all disabled:opacity-30"
              >
                <PlusIcon />
              </button>
              
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePage(i + 1)}
                  className={`h-10 w-10 rounded-xl text-xs font-black transition-all ${activePage === i + 1
                    ? 'bg-[#1A365D] text-white shadow-lg shadow-blue-900/20'
                    : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'
                    }`}
                >
                  {i + 1}
                </button>
              ))}

              <button 
                disabled={activePage === totalPages}
                onClick={() => setActivePage(p => p + 1)} 
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:bg-blue-50 transition-all rotate-45 disabled:opacity-30"
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>

      </div>
    </DosenLayout>
  );
}
