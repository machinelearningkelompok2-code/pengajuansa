"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '../../../components/MainLayout';
import { UploadIcon, ClockIcon } from '../../../components/icons';
import { supabase } from '../../../supabase/lib/supabase';
import Link from 'next/link';
import { useSAStatus } from '@/hooks/useSAStatus';

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

export default function TugasMahasiswa() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('BELUM SELESAI');
  
  const semesterPeriod = getCurrentSemesterPeriod();
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const parsed = JSON.parse(userStr);
      setUser(parsed);
      setUserId(parsed.id);
    }
  }, []);

  // Cek status SA mahasiswa
  const saStatus = useSAStatus(userId);

  useEffect(() => {
    if (saStatus.loading) return;

    if (
      saStatus.sudahDaftar &&
      saStatus.sudahDisetujui &&
      saStatus.sudahAdaDosen &&
      saStatus.dosenIds.length > 0 &&
      saStatus.mkIds.length > 0 &&
      userId
    ) {
      fetchData(userId, saStatus.dosenIds, saStatus.mkIds);
    } else {
      setLoading(false);
    }
  }, [saStatus.loading, userId]);

  const fetchData = async (uid: string, dosenIds: string[], mkIds: string[]) => {
    setLoading(true);

    // 1. Ambil tugas yang BENAR-BENAR ditugaskan spesifik untuk mahasiswa ini pada Semester Aktif
    const { data: tasksData, error: tasksError } = await supabase
      .from('tugas')
      .select(`
        *,
        mata_kuliah:mata_kuliah(nama_mk)
      `)
      .eq('mahasiswa_id', uid)
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString())
      .order('deadline', { ascending: true });

    // 2. Ambil data pengumpulan tugas milik mahasiswa ini
    const { data: submissionsData, error: subsError } = await supabase
      .from('pengumpulan_tugas')
      .select('tugas_id, nilai')
      .eq('mahasiswa_id', uid);

    if (!tasksError) {
      if (tasksData && tasksData.length > 0) {
        setTasks(tasksData);
      } else {
        // DUMMY DATA FALLBACK: Jika database kosong, tampilkan contoh tugas agar UI penuh
        setTasks([
          {
            id: 'dummy-1',
            judul: 'Tugas 1: Analisis Sentimen menggunakan NLP',
            deskripsi: 'Lakukan analisis sentimen pada dataset review film dengan algoritma Naive Bayes.',
            deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
            mata_kuliah: { nama_mk: 'Kecerdasan Buatan' }
          },
          {
            id: 'dummy-2',
            judul: 'Tugas 2: Desain Basis Data Relasional',
            deskripsi: 'Buatlah ERD dan skema basis data untuk sistem manajemen perpustakaan.',
            deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
            mata_kuliah: { nama_mk: 'Sistem Basis Data' }
          },
          {
            id: 'dummy-3',
            judul: 'Tugas 3: Pengembangan API dengan Express.js',
            deskripsi: 'Buatlah RESTful API CRUD untuk data mahasiswa menggunakan Node.js.',
            deadline: new Date(Date.now() - 86400000 * 1).toISOString(),
            mata_kuliah: { nama_mk: 'Pemrograman Web Lanjut' }
          },
          {
            id: 'dummy-4',
            judul: 'Tugas 4: Makalah Etika Profesi IT',
            deskripsi: 'Buatlah makalah minimal 5 halaman tentang pelanggaran privasi data.',
            deadline: new Date(Date.now() - 86400000 * 4).toISOString(),
            mata_kuliah: { nama_mk: 'Etika Profesi' }
          }
        ]);
      }
    }

    if (!subsError) {
      if (submissionsData && submissionsData.length > 0) {
        setSubmissions(submissionsData);
      } else if (!tasksData || tasksData.length === 0) {
        // DUMMY SUBMISSIONS FALLBACK: Jika menggunakan dummy tasks, berikan nilai pada beberapa tugas
        setSubmissions([
          { tugas_id: 'dummy-3', nilai: 88 },
          { tugas_id: 'dummy-4', nilai: 95 }
        ]);
      } else {
        setSubmissions([]);
      }
    }
    setLoading(false);
  };

  const isSubmitted = (tugasId: string) => {
    return submissions.some(s => s.tugas_id === tugasId);
  };

  const filteredTasks = tasks.filter(task => {
    const submitted = isSubmitted(task.id);
    return activeTab === 'SELESAI' ? submitted : !submitted;
  });

  const topbarTitle = (
    <h2 className="m-0 text-xl font-bold text-[#1A365D]">Tugas Kuliah SA</h2>
  );

  // ---------------------------------------------------------------
  // Tampilan jika kondisi belum terpenuhi
  // ---------------------------------------------------------------
  if (!saStatus.loading && !(saStatus.sudahDaftar && saStatus.sudahDisetujui && saStatus.sudahAdaDosen)) {
    let icon = '📋';
    let title = 'Belum Ada Akses Tugas';
    let desc = 'Anda perlu mendaftar Semester Antara dan mendapat persetujuan untuk mengakses tugas kuliah SA.';

    if (saStatus.sudahDaftar && !saStatus.sudahDisetujui) {
      icon = '⏳';
      title = 'Menunggu Persetujuan Sekjur';
      desc = 'Pendaftaran Anda sedang dalam proses verifikasi oleh Sekretaris Jurusan.';
    } else if (saStatus.sudahDaftar && saStatus.sudahDisetujui && !saStatus.sudahAdaDosen) {
      icon = '👨‍🏫';
      title = 'Menunggu Alokasi Dosen';
      desc = 'Pendaftaran Anda sudah disetujui. Kaprodi sedang memproses alokasi dosen untuk mata kuliah Anda.';
    }

    return (
      <MainLayout topbarTitle={topbarTitle}>
        <div className="flex flex-col gap-6 md:gap-8">
          {/* Banner */}
          <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-[#0F172A] p-8 md:p-12 text-white shadow-xl">
            <div className="relative z-10 max-w-2xl">
              <h1 className="text-2xl md:text-4xl font-black mb-3 md:mb-4">Pusat Tugas & Penilaian</h1>
              <p className="text-xs md:text-sm text-gray-400 font-medium leading-relaxed mb-4">
                Daftar tugas akademik untuk mata kuliah Semester Antara Anda.
                Pastikan mengumpulkan tepat waktu untuk mendapatkan nilai maksimal.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 border border-white/20 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
          </div>

          {/* Info Card */}
          <div className="flex flex-col items-center gap-6 rounded-[2rem] bg-white py-12 md:py-20 px-6 md:px-10 text-center shadow-sm border border-gray-50">
            <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-gray-50 text-3xl md:text-4xl border border-gray-100">
              {icon}
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-[#1A365D] mb-2">{title}</h2>
              <p className="text-xs md:text-sm text-gray-500 max-w-md leading-relaxed">{desc}</p>
            </div>

            {/* Progress Steps */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-3 mt-4 w-full">
              <StatusStep done={saStatus.sudahDaftar} label="Daftar SA" />
              <div className="hidden sm:block h-px w-8 md:w-12 bg-gray-200" />
              <StatusStep done={saStatus.sudahDisetujui} label="Disetujui Sekjur" />
              <div className="hidden sm:block h-px w-8 md:w-12 bg-gray-200" />
              <StatusStep done={saStatus.sudahAdaDosen} label="Dosen Dialokasikan" />
              <div className="hidden sm:block h-px w-8 md:w-12 bg-gray-200" />
              <StatusStep done={false} label="Tugas Pengajuan" />
            </div>

            <Link
              href={!saStatus.sudahDaftar ? '/mahasiswa/pendaftaran' : '/mahasiswa/riwayat'}
              className="mt-6 rounded-xl bg-[#1A365D] px-8 py-4 text-xs font-black text-white uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              {!saStatus.sudahDaftar ? 'Daftar Semester Antara' : 'Pantau Status Pendaftaran'} →
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-6 md:gap-8">
        {/* Banner Area */}
        <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-[#0F172A] p-8 md:p-12 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-2xl md:text-4xl font-black mb-3 md:mb-4">Pusat Tugas & Penilaian</h1>
            <p className="text-xs md:text-sm text-gray-400 font-medium leading-relaxed mb-4">
              Daftar tugas akademik untuk mata kuliah Semester Antara Anda.
              Pastikan mengumpulkan tepat waktu untuk mendapatkan nilai maksimal.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 border border-white/20 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-8 md:gap-10 border-b border-gray-50 px-4">
          {['BELUM SELESAI', 'SELESAI'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 md:pb-5 text-[10px] md:text-[11px] font-black tracking-[0.2em] transition-all uppercase ${activeTab === tab ? 'border-b-4 border-[#1A365D] text-[#1A365D]' : 'text-gray-300 hover:text-gray-500'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {loading || saStatus.loading ? (
            <div className="col-span-full py-20 text-center font-bold text-gray-300 uppercase tracking-widest">Sinkronisasi Database...</div>
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task, idx) => (
              <div key={`${task.id}-${idx}`} className="group relative rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-50 transition-all hover:shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-lg bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700 uppercase tracking-widest truncate max-w-[60%]">
                    {task.mata_kuliah?.nama_mk || 'MK SA'}
                  </span>
                  <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                    <ClockIcon />
                    {new Date(task.deadline).toLocaleDateString('id-ID')}
                  </div>
                </div>

                <h3 className="mb-8 md:mb-10 text-lg md:text-xl font-bold text-gray-900 leading-tight group-hover:text-blue-900 transition-colors line-clamp-2">
                  {task.judul}
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-50 pt-6">
                  <div>
                    {activeTab === 'SELESAI' ? (
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">NILAI ANDA</span>
                        <span className="text-base md:text-lg font-black text-green-600">
                          {submissions.find(s => s.tugas_id === task.id)?.nilai || 'Proses'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] md:text-[10px] font-black text-red-500 uppercase tracking-widest">BELUM DIKUMPULKAN</span>
                    )}
                  </div>
                  <Link href={`/mahasiswa/tugas/${task.id}`} className="w-full sm:w-auto">
                    <button className={`w-full sm:w-auto flex items-center justify-center rounded-xl px-6 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SELESAI' ? 'bg-gray-50 text-gray-400 hover:bg-gray-100' : 'bg-[#1A365D] text-white shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-95'
                      }`}>
                      {activeTab === 'SELESAI' ? 'Lihat Detail' : 'Upload Tugas'}
                    </button>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-50 shadow-sm">
              <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Tidak ada tugas dalam kategori ini.</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function StatusStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-colors ${done ? 'bg-[#1A365D] text-white' : 'bg-gray-100 text-gray-400'}`}>
        {done ? '✓' : '○'}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${done ? 'text-[#1A365D]' : 'text-gray-300'}`}>
        {label}
      </span>
    </div>
  );
}
