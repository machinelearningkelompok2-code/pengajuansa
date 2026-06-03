"use client";

import React, { useState, useEffect, useMemo } from 'react';
import DosenLayout from '../../../components/DosenLayout';
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

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
);

const PaperclipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
);

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
);

export default function PenilaianTugasDosen() {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ show: boolean, msg: string }>({ show: false, msg: "" });

  const [dosenInfo, setDosenInfo] = useState<any>(null);
  const [mkList, setMkList] = useState<any[]>([]);
  const [tugasList, setTugasList] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const [selectedMK, setSelectedMK] = useState("");
  const [selectedMhs, setSelectedMhs] = useState<any>(null); // State mahasiswa yang sedang dikelola
  const [mhsList, setMhsList] = useState<any[]>([]);
  const [tugasMhs, setTugasMhs] = useState<any[]>([]);

  // State for Add Task Modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    judul: "",
    deskripsi: "",
    deadline: "",
    nilai: ""
  });

  // Menyimpan nilai lokal sementara sebelum disave
  const [editScores, setEditScores] = useState<Record<string, string>>({});

  const [activePage, setActivePage] = useState(1);
  const itemsPerPage = 4;

  const showNotify = (msg: string) => {
    setNotification({ show: true, msg });
    setTimeout(() => setNotification({ show: false, msg: "" }), 3000);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedMK) {
      fetchStudents(selectedMK);
    }
  }, [selectedMK]);

  useEffect(() => {
    if (selectedMhs) {
      fetchTugasMahasiswa(selectedMhs.id, selectedMK);
    }
  }, [selectedMhs]);


  const fetchInitialData = async () => {
    setLoading(true);

    // 1. Ambil data dosen yang sedang login dari localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      setLoading(false);
      return;
    }

    const user = JSON.parse(userStr);
    setDosenInfo(user);

    // 2. Ambil MK yang DIALOKASIKAN untuk dosen ini saja
    const { data: alokasi } = await supabase
      .from('alokasi_dosen')
      .select(`
        mk_id,
        mata_kuliah (id, nama_mk)
      `)
      .eq('dosen_id', user.id);

    if (alokasi && alokasi.length > 0) {
      // Pastikan list MK unik
      const uniqueMks: any[] = [];
      const mkIds = new Set();

      alokasi.forEach((a: any) => {
        if (a.mata_kuliah && !mkIds.has(a.mk_id)) {
          mkIds.add(a.mk_id);
          uniqueMks.push(a.mata_kuliah);
        }
      });

      setMkList(uniqueMks);
      if (uniqueMks.length > 0) setSelectedMK(uniqueMks[0].id);
    }
    setLoading(false);
  };

  const semesterPeriod = getCurrentSemesterPeriod();

  const fetchStudents = async (mkId: string) => {
    setLoading(true);
    // Ambil daftar mahasiswa di MK ini
    const { data } = await supabase
      .from('pendaftaran_items')
      .select('*, pendaftaran_sa(mahasiswa:mahasiswa_id(id, nama_mahasiswa, nim, prodi))')
      .eq('mk_id', mkId);

    // Fetch tugas and pengumpulan
    const { data: tugasData } = await supabase
      .from('tugas')
      .select('mahasiswa_id, pengumpulan_tugas(nilai, file_url)')
      .eq('mk_id', mkId)
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString());

    if (data) {
      const rawList = data.map((d: any) => {
        const mhs = (d.pendaftaran_sa as any)?.mahasiswa;
        if (mhs) {
          let unreadTugas = 0;
          if (tugasData) {
            const mhsTugas = tugasData.filter(t => t.mahasiswa_id === mhs.id);
            unreadTugas = mhsTugas.reduce((acc, curr) => {
              const submission = curr.pengumpulan_tugas?.[0];
              // Hitung tugas yang sudah ada file tapi belum dinilai
              if (submission && submission.file_url && (submission.nilai === null || submission.nilai === undefined)) {
                return acc + 1;
              }
              return acc;
            }, 0);
          }
          return { ...mhs, pendaftaran_item_id: d.id, nilai_akhir: d.nilai_akhir, unread_tugas: unreadTugas };
        }
        return null;
      }).filter(Boolean);

      // Deduplikasi: hanya tampilkan 1 entry per mahasiswa (berdasarkan id)
      const seen = new Set<string>();
      const uniqueList = rawList.filter((mhs: any) => {
        if (seen.has(mhs.id)) return false;
        seen.add(mhs.id);
        return true;
      });

      // Urutkan: yang punya tugas belum dinilai paling atas, lalu alfabetis
      uniqueList.sort((a, b) => {
        if (b.unread_tugas !== a.unread_tugas) {
          return b.unread_tugas - a.unread_tugas;
        }
        return a.nama_mahasiswa.localeCompare(b.nama_mahasiswa);
      });

      setMhsList(uniqueList);
    }
    setLoading(false);
  };

  const fetchTugasMahasiswa = async (mhsId: string, mkId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('tugas')
      .select('*, pengumpulan_tugas(*)')
      .eq('mk_id', mkId)
      .eq('mahasiswa_id', mhsId)
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      setTugasMhs(data);
    }
    setLoading(false);
  };

  const handleCreateTaskForMhs = async () => {
    if (!newTask.judul || !selectedMhs) return;

    // 1. Buat Tugas khusus mahasiswa tersebut
    const { data: taskData, error: taskError } = await supabase
      .from('tugas')
      .insert({
        mk_id: selectedMK,
        dosen_id: dosenInfo.id,
        mahasiswa_id: selectedMhs.id,
        judul: newTask.judul,
        deskripsi: newTask.deskripsi,
        deadline: newTask.deadline || null
      })
      .select()
      .single();

    if (!taskError && taskData) {
      // 2. Jika ada nilai langsung, buat row di pengumpulan_tugas
      if (newTask.nilai) {
        await supabase.from('pengumpulan_tugas').insert({
          tugas_id: taskData.id,
          mahasiswa_id: selectedMhs.id,
          nilai: parseInt(newTask.nilai)
        });
      }
      showNotify(`Tugas berhasil ditambahkan untuk ${selectedMhs.nama_mahasiswa}`);
      setIsTaskModalOpen(false);
      setNewTask({ judul: "", deskripsi: "", deadline: "", nilai: "" });
      fetchTugasMahasiswa(selectedMhs.id, selectedMK);
    } else {
      Swal.fire({
        title: 'Gagal',
        text: "Gagal: " + (taskError?.message || "Error tidak diketahui"),
        icon: 'error',
        confirmButtonColor: '#1A365D'
      });
    }
  };

  const openFile = (base64Data: string) => {
    try {
      // Jika bukan base64 (misal URL asli), langsung buka
      if (!base64Data.startsWith('data:')) {
        window.open(base64Data, '_blank');
        return;
      }

      // Konversi Base64 ke Blob agar bisa dibuka di tab baru dengan lancar
      const parts = base64Data.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      const url = URL.createObjectURL(blob);

      // Buka di tab baru
      const newWindow = window.open(url, '_blank');

      // Bersihkan memory setelah tab ditutup (opsional)
      if (newWindow) {
        newWindow.onload = () => {
          setTimeout(() => URL.revokeObjectURL(url), 100);
        };
      }
    } catch (e) {
      console.error("Gagal membuka file:", e);
      // Fallback: coba buka langsung
      window.open(base64Data, '_blank');
    }
  };

  const handleUpdateScore = async (tugasId: string, mhsId: string, score: string) => {
    if (score === "") return;

    const { error } = await supabase
      .from('pengumpulan_tugas')
      .upsert({
        tugas_id: tugasId,
        mahasiswa_id: mhsId,
        nilai: parseInt(score)
      }, { onConflict: 'tugas_id,mahasiswa_id' });

    if (!error) {
      showNotify(`Nilai berhasil diperbarui!`);
      fetchTugasMahasiswa(mhsId, selectedMK);
    } else {
      Swal.fire({
        title: 'Gagal',
        text: "Gagal memperbarui nilai: " + error.message,
        icon: 'error',
        confirmButtonColor: '#1A365D'
      });
    }
  };


  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRandomColorClass = (idx: number) => {
    const colors = [
      { bg: 'bg-blue-100', text: 'text-blue-700' },
      { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      { bg: 'bg-orange-100', text: 'text-orange-700' },
      { bg: 'bg-green-100', text: 'text-green-700' }
    ];
    return colors[idx % colors.length];
  };

  // Kalkulasi Stats
  const sudahKumpulCount = submissions.length;
  const belumDinilaiCount = submissions.filter(s => s.nilai === null).length;
  const scores = submissions.filter(s => s.nilai !== null).map(s => s.nilai);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;

  // Paginate
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedSubmissions = submissions.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(submissions.length / itemsPerPage) || 1;

  const topbarTitle = (
    <div className="flex items-center gap-4">
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Portal Dosen</h2>
      <div className="mx-2 h-5 w-px bg-gray-200"></div>
      <span className="text-sm font-bold text-gray-500">Manajemen Tugas & Nilai Per Mahasiswa</span>
    </div>
  );

  return (
    <DosenLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-8 relative">

        {/* Toast Notification */}
        {notification.show && (
          <div className="fixed top-8 right-8 z-[110] flex items-center gap-3 rounded-2xl bg-[#0F172A] px-6 py-4 text-white shadow-2xl animate-in slide-in-from-right border border-white/10">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-xs font-black uppercase tracking-widest">{notification.msg}</p>
          </div>
        )}

        {/* Header & Main Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl md:text-4xl font-black text-[#1A365D] mb-3 md:mb-4 tracking-tight">Penilaian Mahasiswa</h1>
            <p className="text-sm font-semibold text-gray-400">Kelola tugas dan berikan penilaian khusus untuk setiap mahasiswa secara mandiri.</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 border border-blue-100">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pilih Mata Kuliah</label>
            <div className="relative group">
              <select
                value={selectedMK}
                onChange={(e) => setSelectedMK(e.target.value)}
                className="appearance-none w-full md:w-80 rounded-2xl bg-white border border-gray-100 px-6 py-4 text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm pr-12"
              >
                {mkList.length > 0 ? mkList.map(mk => (
                  <option key={mk.id} value={mk.id}>{mk.nama_mk}</option>
                )) : (
                  <option>Tidak ada MK Teralokasi</option>
                )}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300">
                <ChevronDownIcon />
              </div>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="rounded-[2.5rem] bg-white shadow-sm border border-gray-50 overflow-hidden relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          )}

          <div className="flex items-center justify-between px-6 md:px-10 py-6 md:py-8 border-b border-gray-50 bg-gray-50/30">
            <h3 className="text-lg md:text-xl font-black text-[#1A365D] uppercase tracking-wider">Daftar Mahasiswa di Kelas</h3>
          </div>

          {/* ── MOBILE: Card List (hidden on md+) ── */}
          <div className="md:hidden divide-y divide-gray-50">
            {mhsList.length > 0 ? mhsList.map((mhs, index) => {
              const color = getRandomColorClass(index);
              return (
                <div key={`m-${mhs.id}-${index}`} className="p-5 flex items-center gap-4 relative">
                  <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] font-black text-sm shadow-sm ${color.bg} ${color.text} border border-white/50`}>
                    {getInitials(mhs.nama_mahasiswa)}
                    {mhs.unread_tugas > 0 && (
                      <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border-2 border-white">
                        {mhs.unread_tugas}
                      </span>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-gray-900 line-clamp-1">{mhs.nama_mahasiswa}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{mhs.nim}</p>
                    <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{mhs.prodi || 'Informatika'}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedMhs(mhs); setIsDetailModalOpen(true); }}
                    className="shrink-0 rounded-xl bg-gray-100 px-3 py-2.5 text-[10px] font-black text-gray-600 hover:bg-[#1A365D] hover:text-white transition-all uppercase tracking-widest"
                  >
                    Kelola
                  </button>
                </div>
              );
            }) : (
              <div className="py-16 text-center text-sm font-black text-gray-400 uppercase tracking-widest">
                Belum Ada Mahasiswa di Kelas Ini
              </div>
            )}
          </div>

          {/* ── DESKTOP: Table (hidden on mobile) ── */}
          <div className="hidden md:block">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 bg-gray-50/50">
                  <th className="px-6 py-5">MAHASISWA</th>
                  <th className="px-6 py-5">PROGRAM STUDI</th>
                  <th className="px-6 py-5 text-center">STATUS</th>
                  <th className="px-6 py-5 text-right">AKSI MANAJEMEN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mhsList.length > 0 ? mhsList.map((mhs, index) => {
                  const color = getRandomColorClass(index);
                  return (
                    <tr key={`d-${mhs.id}-${index}`} className="transition-all hover:bg-blue-50/30 group">
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] font-black text-sm shadow-sm ${color.bg} ${color.text} border border-white/50`}>
                            {getInitials(mhs.nama_mahasiswa)}
                            {mhs.unread_tugas > 0 && (
                              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border-2 border-white">
                                {mhs.unread_tugas}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 group-hover:text-blue-900 transition-colors line-clamp-1">{mhs.nama_mahasiswa}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{mhs.nim}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{mhs.prodi || 'Informatika'}</span>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700">Terdaftar</span>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <button
                          onClick={() => { setSelectedMhs(mhs); setIsDetailModalOpen(true); }}
                          className="rounded-xl bg-gray-100 px-5 py-3 text-[10px] font-black text-gray-600 hover:bg-[#1A365D] hover:text-white transition-all uppercase tracking-widest"
                        >
                          Kelola Tugas & Nilai
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-sm font-black text-gray-400 uppercase tracking-widest">
                      Belum Ada Mahasiswa di Kelas Ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Detail Modal */}
        {isDetailModalOpen && selectedMhs && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-md p-4">
            <div className="w-full max-w-4xl rounded-2xl md:rounded-[2.5rem] bg-white p-6 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="h-12 w-12 md:h-16 md:w-16 rounded-[1.2rem] md:rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-xl">
                    {getInitials(selectedMhs.nama_mahasiswa)}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-black text-[#1A365D] uppercase tracking-tight">{selectedMhs.nama_mahasiswa}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{selectedMhs.nim} • Manajemen Tugas Individu</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-600 transition-all shrink-0"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div className="flex-grow overflow-y-auto pr-4 -mr-4">

                {/* Bagian Input Nilai Akhir Khusus */}
                <div className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 shadow-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                  <div className="relative z-10">
                    <h4 className="text-sm font-black text-[#1A365D] uppercase tracking-widest flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">★</span>
                      NILAI AKHIR MATA KULIAH
                    </h4>
                    <p className="text-[10px] font-bold text-gray-500 mt-2 max-w-sm leading-relaxed">
                      Masukkan nilai akhir mahasiswa untuk mata kuliah ini. Nilai ini yang akan
                      dijadikan dasar pencetakan Kartu Hasil Studi (KHS) oleh Bagian Akademik.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
                    <input
                      type="number"
                      id="input-nilai-akhir"
                      defaultValue={selectedMhs.nilai_akhir ?? ""}
                      placeholder="0-100"
                      className="w-full md:w-24 rounded-2xl bg-white border border-gray-200 px-4 py-4 text-center text-2xl font-black text-[#1A365D] outline-none focus:ring-4 focus:ring-blue-200 transition-all shadow-sm"
                    />
                    <button
                      onClick={async () => {
                        const val = (document.getElementById('input-nilai-akhir') as HTMLInputElement).value;
                        if (!val) {
                          Swal.fire('Informasi', 'Harap masukkan nilai.', 'warning');
                          return;
                        }
                        const { error } = await supabase
                          .from('pendaftaran_items')
                          .update({ nilai_akhir: parseInt(val) })
                          .eq('id', selectedMhs.pendaftaran_item_id);

                        if (!error) {
                          showNotify("Nilai Akhir berhasil disimpan!");
                          setSelectedMhs({ ...selectedMhs, nilai_akhir: parseInt(val) });
                          fetchStudents(selectedMK);
                        } else {
                          Swal.fire({
                            title: 'Kolom Belum Tersedia',
                            html: 'Sepertinya kolom <b>nilai_akhir</b> belum ada di tabel pendaftaran_items pada database Anda.<br/><br/>Harap jalankan SQL berikut di Dashboard Supabase:<br/><br/><code style="background:#eee;padding:10px;display:block;border-radius:8px">ALTER TABLE pendaftaran_items ADD COLUMN nilai_akhir NUMERIC;</code>',
                            icon: 'error',
                            confirmButtonColor: '#1A365D'
                          });
                        }
                      }}
                      className="h-16 px-8 rounded-2xl bg-[#1A365D] flex items-center justify-center text-white font-black text-xs hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-900/30 uppercase tracking-[0.1em] shrink-0"
                    >
                      Simpan
                    </button>
                  </div>
                  <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Daftar Tugas & Nilai</h4>
                </div>

                <div className="space-y-4">
                  {tugasMhs.length > 0 ? tugasMhs.map((t) => (
                    <div key={t.id} className="rounded-2xl bg-gray-50 p-6 border border-gray-100 group hover:border-blue-200 transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-sm font-black text-[#1A365D] group-hover:text-blue-700 transition-colors">{t.judul}</h5>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Dibuat: {new Date(t.created_at).toLocaleDateString('id-ID')}</p>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">NILAI (0-100)</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                id={`score-input-${t.id}`}
                                defaultValue={t.pengumpulan_tugas?.[0]?.nilai || ""}
                                className="w-16 rounded-xl bg-white border border-gray-100 px-2 py-2 text-center text-lg font-black text-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`score-input-${t.id}`) as HTMLInputElement;
                                  handleUpdateScore(t.id, selectedMhs.id, input.value);
                                }}
                                className="h-10 w-10 rounded-xl bg-[#1A365D] flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20"
                              >
                                <SaveIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-100/30">
                        <div className="flex items-center gap-4">
                          {t.pengumpulan_tugas?.[0]?.file_url ? (
                            <div
                              onClick={() => openFile(t.pengumpulan_tugas[0].file_url)}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[10px] font-black text-white cursor-pointer hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                            >
                              <PaperclipIcon /> LIHAT BERKAS TUGAS
                            </div>
                          ) : (
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-lg">Belum Mengumpulkan</span>
                          )}
                        </div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Penilaian Mandiri</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center font-bold text-gray-300 uppercase tracking-[0.3em] border-2 border-dashed border-gray-100 rounded-2xl">
                      Belum Ada Tugas Individu
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#0F172A]/90 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-[#1A365D] mb-6 uppercase tracking-tight">Beri Tugas Baru</h3>
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Judul Tugas</label>
                  <input
                    type="text"
                    value={newTask.judul}
                    onChange={(e) => setNewTask({ ...newTask, judul: e.target.value })}
                    placeholder="Contoh: Perbaikan Algoritma"
                    className="w-full rounded-2xl bg-gray-50 border border-gray-100 px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Input Nilai (Jika Ada)</label>
                  <input
                    type="number"
                    value={newTask.nilai}
                    onChange={(e) => setNewTask({ ...newTask, nilai: e.target.value })}
                    placeholder="0-100"
                    className="w-full rounded-2xl bg-gray-50 border border-gray-100 px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-4 text-xs font-black text-gray-400 uppercase">Batal</button>
                  <button onClick={handleCreateTaskForMhs} className="flex-1 rounded-2xl bg-[#1A365D] py-4 text-xs font-black text-white shadow-xl shadow-blue-900/20">Simpan</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DosenLayout>
  );
}
