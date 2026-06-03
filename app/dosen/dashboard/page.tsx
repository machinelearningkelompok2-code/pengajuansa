"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DosenLayout from '../../../components/DosenLayout';
import { supabase } from '../../../supabase/lib/supabase';

const TrendingUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);

const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

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

export default function DosenDashboard() {
  const [loading, setLoading] = useState(true);
  const [dosenInfo, setDosenInfo] = useState<any>(null);
  
  const semesterPeriod = getCurrentSemesterPeriod();

  const [stats, setStats] = useState({
    totalMahasiswa: 0,
    progressPenilaian: 0,
    jumlahMK: 0,
    totalUnrated: 0
  });

  const [courses, setCourses] = useState<any[]>([]);
  const [unratedTasks, setUnratedTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    // 1. Ambil data dosen yang sedang login dari localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      setLoading(false);
      return;
    }

    const user = JSON.parse(userStr);
    setDosenInfo(user);

    if (user) {
      // 2. Fetch Alokasi MK Dosen (Khusus dosen yang login)
      const { data: alokasi } = await supabase
        .from('alokasi_dosen')
        .select(`
          mk_id,
          mata_kuliah (nama_mk, sks, jurusan, prodi)
        `)
        .eq('dosen_id', user.id);

      const mkIds = alokasi?.map(a => a.mk_id) || [];
      const jumlahMK = mkIds.length;

      // 3. Fetch Jumlah Mahasiswa untuk MK tersebut
      let totalMahasiswa = 0;
      let mappedCourses: any[] = [];

      if (mkIds.length > 0) {
        const { data: pItems } = await supabase
          .from('pendaftaran_items')
          .select('mk_id, pendaftaran_sa(created_at, mahasiswa_id)')
          .in('mk_id', mkIds);

        // Filter pendaftaran yang masuk pada semester aktif
        const activePItems = (pItems || []).filter((p: any) => {
          const createdAtStr = (p.pendaftaran_sa as any)?.created_at;
          if (!createdAtStr) return false;
          const date = new Date(createdAtStr);
          return date >= semesterPeriod.start && date <= semesterPeriod.end;
        });

        // Grouping by MK ID to avoid duplicates
        const courseMap = new Map();

        alokasi?.forEach(a => {
          const mkInfo = a.mata_kuliah as any;
          if (!mkInfo) return;

          if (!courseMap.has(a.mk_id)) {
            const studentCount = activePItems.filter(p => p.mk_id === a.mk_id).length || 0;
            courseMap.set(a.mk_id, {
              id: a.mk_id,
              name: mkInfo.nama_mk,
              sks: mkInfo.sks,
              schedule: `${mkInfo.jurusan || '-'} / ${mkInfo.prodi || '-'}`,
              students: studentCount
            });
          }
        });

        mappedCourses = Array.from(courseMap.values());
        totalMahasiswa = new Set(activePItems.map(p => (p.pendaftaran_sa as any)?.mahasiswa_id).filter(Boolean)).size;
      }

      setCourses(mappedCourses);

      // 4. Fetch Tugas dan Progress Penilaian pada Semester Aktif
      const { data: tugas } = await supabase
        .from('tugas')
        .select('id, judul, mata_kuliah(nama_mk)')
        .eq('dosen_id', user.id)
        .gte('created_at', semesterPeriod.start.toISOString())
        .lte('created_at', semesterPeriod.end.toISOString());

      const tugasIds = tugas?.map(t => t.id) || [];

      let progress = 0;
      let unratedTugasList: any[] = [];
      let totalUnratedCount = 0;

      if (tugasIds.length > 0) {
        const { data: pengumpulan } = await supabase
          .from('pengumpulan_tugas')
          .select('tugas_id, nilai, mahasiswa:mahasiswa_id(nama_mahasiswa)')
          .in('tugas_id', tugasIds);

        const totalPengumpulan = pengumpulan?.length || 0;
        const gradedCount = pengumpulan?.filter(p => p.nilai !== null).length || 0;
        if (totalPengumpulan > 0) progress = Math.round((gradedCount / totalPengumpulan) * 100);

        // Group unrated tasks
        tugas?.forEach(t => {
          const unratedForThisTask = pengumpulan?.filter(p => p.tugas_id === t.id && p.nilai === null) || [];
          if (unratedForThisTask.length > 0) {
            totalUnratedCount += unratedForThisTask.length;
            unratedTugasList.push({
              id: t.id,
              judul: t.judul,
              mk_name: (t.mata_kuliah as any)?.nama_mk,
              unrated_count: unratedForThisTask.length,
              samples: unratedForThisTask.slice(0, 3).map(u => (u.mahasiswa as any)?.nama_mahasiswa || "Mhs")
            });
          }
        });
      }

      setUnratedTasks(unratedTugasList);
      setStats({
        totalMahasiswa,
        progressPenilaian: progress,
        jumlahMK: mappedCourses.length, // Gunakan hasil grouping
        totalUnrated: totalUnratedCount
      });
    }

    setLoading(false);
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const topbarTitle = (
    <div>
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Portal Dosen</h2>
      <p className="text-xs font-semibold text-gray-500">Selamat datang kembali, {dosenInfo?.nama_lengkap || 'Memuat Profil...'}</p>
    </div>
  );

  return (
    <DosenLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-8 relative">

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-50 relative overflow-hidden">
            {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><div className="h-4 w-4 border-2 border-[#1A365D] border-t-transparent rounded-full animate-spin"></div></div>}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">TOTAL MAHASISWA BIMBINGAN</p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-extrabold text-[#1A365D]">{stats.totalMahasiswa}</span>
              <div className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                <TrendingUpIcon /> Aktif
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Terdaftar di kelas Anda</p>
          </div>

          <div className="relative rounded-2xl bg-white p-6 shadow-sm border border-gray-50 border-l-4 border-l-yellow-400 overflow-hidden">
            {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><div className="h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div></div>}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">PROGRES PENILAIAN</p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-extrabold text-[#1A365D]">{stats.progressPenilaian}%</span>
              <LightningIcon />
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-yellow-400 transition-all duration-1000" style={{ width: `${stats.progressPenilaian}%` }}></div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-[#0B2559] p-6 text-white shadow-lg">
            {loading && <div className="absolute inset-0 bg-[#0B2559]/60 backdrop-blur-sm z-20 flex items-center justify-center"><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-3">MATA KULIAH DIAJAR</p>
              <span className="text-4xl font-extrabold">{stats.jumlahMK}</span>
              <p className="text-[10px] text-blue-300 mt-1">Semester {semesterPeriod.label}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column */}
          <div className="flex flex-col gap-8 flex-grow">

            {/* My Courses List */}
            <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-50 relative">
              {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-2xl"></div>}
              <h3 className="text-xl font-bold text-[#1A365D] mb-6">Mata Kuliah Saya</h3>

              <div className="grid grid-cols-1 gap-4">
                {courses.length > 0 ? courses.map((course, idx) => (
                  <div key={`${course.id}-${idx}`} className="flex items-center justify-between rounded-xl bg-gray-50 p-5 border border-gray-100 hover:bg-white hover:shadow-md hover:border-blue-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm text-blue-600 border border-gray-100">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 8h10M7 12h10M7 16h10"></path></svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{course.name}</h4>
                        <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-widest">{course.students} Pendaftar • SKS: {course.sks} • {course.schedule}</p>
                      </div>
                    </div>
                    <Link href="/dosen/penilaian" className="rounded-lg bg-blue-50 px-4 py-2.5 text-[10px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest shadow-sm">
                      Input Nilai
                    </Link>
                  </div>
                )) : (
                  <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Belum Ada Kelas</p>
                    <p className="text-[10px] font-semibold text-gray-300 mt-1 uppercase">Tunggu alokasi dari Kaprodi</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-8">

            {/* Needs Grading Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-50 relative">
              {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-2xl"></div>}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Perlu Dinilai</h3>
                {stats.totalUnrated > 0 ? (
                  <span className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm shadow-red-600/30 animate-pulse">
                    {stats.totalUnrated} Berkas
                  </span>
                ) : (
                  <span className="rounded-lg bg-green-50 px-2 py-1 text-[10px] font-bold text-green-600 border border-green-100">
                    Selesai
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {unratedTasks.length > 0 ? unratedTasks.map((task) => (
                  <div key={task.id} className="rounded-xl bg-gray-50 p-5 border border-gray-100 hover:bg-white hover:border-red-100 hover:shadow-lg transition-all">
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1 block line-clamp-1">MK: {task.mk_name}</span>
                    <h4 className="text-sm font-bold text-gray-900 mb-4 line-clamp-1">{task.judul}</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {task.samples.map((name: string, i: number) => (
                          <div key={i} className={`h-6 w-6 rounded-full border-2 border-white text-[8px] font-bold flex items-center justify-center text-white shadow-sm ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-orange-500' : 'bg-teal-500'}`}>
                            {getInitials(name)}
                          </div>
                        ))}
                        {task.unrated_count > 3 && (
                          <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-200 text-[8px] font-bold flex items-center justify-center text-gray-600">
                            +{task.unrated_count - 3}
                          </div>
                        )}
                      </div>
                      <Link href="/dosen/penilaian" className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 hover:text-red-600 transition-colors uppercase tracking-widest">
                        Beri Nilai <ChevronRightIcon />
                      </Link>
                    </div>
                  </div>
                )) : (
                  <div className="py-10 text-center font-bold text-gray-400 uppercase tracking-widest border border-dashed border-gray-200 rounded-xl">
                    Semua Telah Dinilai
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </DosenLayout>
  );
}
