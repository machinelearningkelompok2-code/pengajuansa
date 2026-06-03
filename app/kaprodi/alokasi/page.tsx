"use client";

import React, { useState, useEffect, useRef } from 'react';
import KaprodiLayout from '../../../components/KaprodiLayout';
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

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const SearchableSelect = ({ 
  options, 
  placeholder, 
  value, 
  onChange,
  onOpenChange 
}: { 
  options: any[], 
  placeholder: string, 
  value: string, 
  onChange: (val: string) => void,
  onOpenChange?: (open: boolean) => void 
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = options.find(o => o.id === value);
  const filtered = options.filter(o => o.nama_lengkap.toLowerCase().includes(query.toLowerCase()));

  // Lapor status open/close ke parent component
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
  }, [isOpen, onOpenChange]);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div
        className="w-full rounded-2xl bg-gray-50 px-6 py-4.5 text-sm font-black text-gray-700 border border-gray-100 flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedItem ? selectedItem.nama_lengkap : placeholder}</span>
        <ChevronDownIcon />
      </div>
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-2xl bg-white shadow-2xl shadow-blue-900/10 border border-gray-100 flex flex-col">
          <div className="p-3 sticky top-0 bg-white border-b border-gray-50 shrink-0">
            <input
              type="text"
              className="w-full rounded-xl bg-gray-100 px-4 py-3 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-blue-100 transition-all text-gray-800"
              placeholder="Ketik nama dosen..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-[205px]">
            {filtered.length > 0 ? filtered.map(o => (
              <div
                key={o.id}
                className="px-5 py-3 text-xs font-bold text-gray-700 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-50/50 last:border-0"
                onClick={() => {
                  onChange(o.id);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                {o.nama_lengkap}
              </div>
            )) : (
              <div className="px-5 py-4 text-xs font-bold text-gray-400 text-center">Dosen tidak ditemukan</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AlokasiDosenKaprodi() {
  const [notification, setNotification] = useState<{ show: boolean, msg: string }>({ show: false, msg: "" });
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState<any[]>([]);
  const [dosenList, setDosenList] = useState<any[]>([]);
  const [bebanDosen, setBebanDosen] = useState<any[]>([]);
  const [allBebanDosen, setAllBebanDosen] = useState<any[]>([]);
  const [showBebanModal, setShowBebanModal] = useState(false);
  const [allocatedMkIds, setAllocatedMkIds] = useState<string[]>([]);
  const [selectedLecturers, setSelectedLecturers] = useState<Record<string, string>>({});
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const [allocatedCount, setAllocatedCount] = useState(0);
  const [totalMK, setTotalMK] = useState(0);
  
  const semesterPeriod = getCurrentSemesterPeriod();

  useEffect(() => {
    fetchAlokasiData();
  }, []);

  const fetchAlokasiData = async () => {
    setLoading(true);

    // 1. Fetch Dosen
    const { data: dosens } = await supabase.from('users').select('id, nama_lengkap, prodi').eq('role', 'dosen');
    if (dosens) setDosenList(dosens);

    // 2. Fetch Alokasi (Termasuk master pengampu & alokasi mahasiswa) pada Semester Aktif
    const { data: alokasis } = await supabase.from('alokasi_dosen').select(`
      id, mk_id, dosen_id, pendaftaran_id,
      dosen:dosen_id (id, nama_lengkap),
      pendaftaran_sa (created_at)
    `);

    const activeAlokasis = (alokasis || []).filter((a: any) => {
      if (!a.pendaftaran_id) return true; // keep master
      const createdAtStr = (a.pendaftaran_sa as any)?.created_at;
      if (!createdAtStr) return false;
      const date = new Date(createdAtStr);
      return date >= semesterPeriod.start && date <= semesterPeriod.end;
    });

    // Master Pengampu: Alokasi yang pendaftaran_id-nya NULL
    const masterPengampu = activeAlokasis.filter(a => !a.pendaftaran_id);

    // we need to keep track of both mk_id and pendaftaran_id to make it unique per student
    const allocatedPairs = activeAlokasis.map(a => `${a.mk_id}-${a.pendaftaran_id}`);
    setAllocatedMkIds(allocatedPairs);

    // 3. Fetch Pengajuan SA dari menu formulir SA pada Semester Aktif
    const { data: applications } = await supabase.from('pendaftaran_sa').select(`
      id,
      kode_pendaftaran,
      mahasiswa:mahasiswa_id(id, nama_mahasiswa, nim, prodi),
      items:pendaftaran_items(
        id,
        mk_id,
        mata_kuliah:mk_id(nama_mk, sks)
      ),
      pembayaran(id)
    `)
      .eq('status', 'Approved')
      .gte('created_at', semesterPeriod.start.toISOString())
      .lte('created_at', semesterPeriod.end.toISOString())
      .order('created_at', { ascending: false });

    // Tampilkan SEMUA pendaftaran yang sudah Approved (dari alur mahasiswa maupun formulir Sekjur)
    const filteredApplications = applications || [];

    const allRequestedItems = filteredApplications.flatMap((app: any) => app.items || []);

    const mappedCourses = filteredApplications.flatMap((app: any) => {
      const requestedItems = app.items || [];

      return requestedItems.map((item: any) => {
          const isAllocated = allocatedPairs.includes(`${item.mk_id}-${app.id}`);
          const allocation = activeAlokasis.find((a: any) => a.mk_id === item.mk_id && a.pendaftaran_id === app.id);
 
          let lecturerObj = null;
          if (allocation && allocation.dosen) {
            const dosenData = Array.isArray(allocation.dosen)
              ? allocation.dosen[0] as { nama_lengkap: string }
              : allocation.dosen as { nama_lengkap: string };
 
            const loadSKS = activeAlokasis.filter((a: any) => a.dosen_id === allocation.dosen_id).reduce((sum: number, a: any) => {
              const reqItem = allRequestedItems.find((i: any) => i.mk_id === a.mk_id);
              return sum + (reqItem?.mata_kuliah?.sks || 0);
            }, 0) || 0;

          lecturerObj = {
            id: allocation.dosen_id,
            alokasi_id: allocation.id,
            name: dosenData.nama_lengkap,
            initials: getInitials(dosenData.nama_lengkap),
            load: loadSKS
          };
        }

        // Mengambil semua dosen agar kaprodi bisa memilih siapa saja
        const allDosen = dosens || [];

        return {
          id: `${app.id}-${item.mk_id}`, // Unique identifier for UI state
          pendaftaran_id: app.id,
          mk_id: item.mk_id,
          studentName: app.mahasiswa?.nama_mahasiswa || 'Mahasiswa',
          kode: app.kode_pendaftaran,
          prodi: app.mahasiswa?.prodi || 'Tidak Diketahui',
          mkName: item.mata_kuliah?.nama_mk,
          sks: item.mata_kuliah?.sks || 0,
          status: isAllocated ? 'ALLOCATED' : 'PENDING',
          lecturer: lecturerObj,
          availableLecturers: allDosen
        };
      });
    });

    setTotalMK(mappedCourses.length);
    setAllocatedCount(mappedCourses.filter(c => c.status === 'ALLOCATED').length);

    setCourses(mappedCourses);

    // Mapping Beban Kerja Dosen (Sidebar & Modal)
    const allMappedBeban = dosens?.map(d => {
      const loadSKS = activeAlokasis.filter(a => a.dosen_id === d.id).reduce((sum: number, a: any) => {
        const item = allRequestedItems.find((i: any) => i.mk_id === a.mk_id);
        return sum + (item?.mata_kuliah?.sks || 0);
      }, 0) || 0;

      return {
        id: d.id,
        name: d.nama_lengkap,
        initials: getInitials(d.nama_lengkap),
        load: loadSKS
      };
    }).sort((a, b) => b.load - a.load) || [];

    setAllBebanDosen(allMappedBeban);
    setBebanDosen(allMappedBeban.slice(0, 2));

    setLoading(false);
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const showNotify = (msg: string) => {
    setNotification({ show: true, msg });
    setTimeout(() => setNotification({ show: false, msg: "" }), 3000);
  };

  const handleAllocate = async (courseUniqueId: string, lecturerId: string) => {
    if (!lecturerId || lecturerId === "") {
      showNotify("Silakan pilih dosen pengajar terlebih dahulu.");
      return;
    }

    const selectedCourse = courses.find(c => c.id === courseUniqueId);
    if (!selectedCourse) {
      showNotify("Pengajuan mata kuliah tidak ditemukan.");
      return;
    }

    const { error } = await supabase.from('alokasi_dosen').insert([{
      mk_id: selectedCourse.mk_id,
      dosen_id: lecturerId,
      pendaftaran_id: selectedCourse.pendaftaran_id,
      tahun_akademik: "2024"
    }]);

    if (!error) {
      showNotify("Alokasi dosen berhasil disimpan di database.");

      // Bersihkan state selectedLecturer untuk course ini
      const newSelected = { ...selectedLecturers };
      delete newSelected[courseUniqueId];
      setSelectedLecturers(newSelected);

      fetchAlokasiData();
    } else {
      Swal.fire({
        title: 'Gagal',
        text: "Gagal alokasi: " + error.message,
        icon: 'error',
        confirmButtonColor: '#1A365D'
      });
    }
  };

  const handleReset = async (alokasiId: string) => {
    const { error } = await supabase.from('alokasi_dosen').delete().eq('id', alokasiId);

    if (!error) {
      showNotify("Alokasi dosen berhasil direset.");
      fetchAlokasiData();
    } else {
      Swal.fire({
        title: 'Gagal',
        text: "Gagal mereset alokasi: " + error.message,
        icon: 'error',
        confirmButtonColor: '#1A365D'
      });
    }
  };

  const completionRate = totalMK > 0 ? Math.round((allocatedCount / totalMK) * 100) : 0;

  const topbarTitle = (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="m-0 text-base md:text-xl font-extrabold text-[#0F172A]">Alokasi Dosen Pengajar</h2>
      <span className="rounded-full bg-yellow-100 px-3 py-1 text-[9px] md:text-[10px] font-black tracking-[0.15em] text-yellow-800 uppercase border border-yellow-200">SEMESTER {semesterPeriod.label}</span>
    </div>
  );

  return (
    <KaprodiLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-6 md:gap-10 relative w-full max-w-full overflow-x-hidden min-w-0">

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-900">Menyinkronkan Data Kaprodi...</p>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {notification.show && (
          <div className="fixed top-8 right-8 z-[110] flex items-center gap-3 rounded-2xl bg-[#0F172A] px-6 py-4 text-white shadow-2xl animate-in slide-in-from-right border border-white/10">
            <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></div>
            <p className="text-xs font-black uppercase tracking-widest">{notification.msg}</p>
          </div>
        )}

        {/* Top Header Cards */}
        <div className="flex flex-col xl:flex-row gap-4 md:gap-8">
          <div className="flex-grow rounded-2xl md:rounded-[2.5rem] bg-white p-4 sm:p-5 md:p-10 shadow-sm border border-gray-50 group hover:shadow-lg transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 bg-blue-50/50 rounded-full -mr-16 -mt-16"></div>

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-5 mb-6 md:mb-12">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em]">Status Alokasi Departemen</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-6xl font-black text-[#0F172A] tracking-tighter">{completionRate}%</span>
                  <span className="text-base md:text-xl font-black text-gray-400 uppercase tracking-widest">Selesai</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-16 mb-6 md:mb-10">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider sm:tracking-widest truncate">TOTAL PENGAJUAN</span>
                  <span className="text-xl sm:text-3xl font-black text-[#0F172A]">{totalMK}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider sm:tracking-widest truncate">TERALOKASI</span>
                  <span className="text-xl sm:text-3xl font-black text-green-600">{allocatedCount}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider sm:tracking-widest truncate">SISA</span>
                  <span className="text-xl sm:text-3xl font-black text-red-600">{totalMK - allocatedCount}</span>
                </div>
              </div>

              <div className="h-4 w-full rounded-full bg-gray-50 overflow-hidden relative border border-gray-100 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0F172A] to-blue-600 transition-all duration-1000 shadow-md"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="w-full xl:w-[420px] shrink-0 rounded-2xl md:rounded-[2.5rem] bg-white p-4 sm:p-5 md:p-10 shadow-sm border border-gray-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5 md:mb-10">
                <h3 className="text-xs font-black text-[#0F172A] uppercase tracking-[0.2em]">Kapasitas Beban Dosen TI</h3>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shadow-inner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                </div>
              </div>

              <div className="space-y-5 md:space-y-8 mb-5 md:mb-10">
                {bebanDosen.length > 0 ? bebanDosen.map((dosen, idx) => (
                  <div key={`${dosen.id}-${idx}`} className="flex flex-col gap-3 group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center text-[11px] font-black border border-white shadow-sm ${dosen.load > 8 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                          {dosen.initials}
                        </div>
                        <span className="text-sm font-black text-gray-800 line-clamp-1 truncate">{dosen.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">{dosen.load}/16 SKS</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-50 overflow-hidden border border-gray-100">
                      <div className={`h-full rounded-full transition-all duration-1000 ${dosen.load > 8 ? 'bg-orange-500 group-hover:bg-orange-600' : 'bg-[#0F172A] group-hover:bg-blue-600'}`} style={{ width: `${Math.min((dosen.load / 16) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 italic font-medium">Belum ada data beban dosen teralokasi.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowBebanModal(true)}
              className="text-[11px] font-black text-blue-600 hover:text-blue-800 w-full text-center uppercase tracking-[0.2em] bg-blue-50 py-4 rounded-2xl transition-all"
            >
              Lihat Detail Beban Kerja
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div>
          <div className="flex flex-col gap-4 mb-6 md:mb-10 bg-gray-50/50 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-gray-100">
            <div>
              <h2 className="text-base md:text-2xl font-black text-[#0F172A] mb-1 tracking-tight">Daftar Pengajuan Mahasiswa SA</h2>
              <p className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest">Menampilkan pengajuan yang diteruskan dari menu Formulir SA.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => fetchAlokasiData()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-xs font-black text-[#0F172A] shadow-sm hover:bg-gray-50 transition-all uppercase tracking-widest w-full sm:w-auto"
              >
                Refresh Data
              </button>
              <button
                onClick={() => showNotify("Seluruh draf alokasi saat ini telah sinkron dengan Supabase!")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-5 py-3 text-xs font-black text-white shadow-2xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest w-full sm:w-auto"
              >
                Data Tersinkronisasi
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {courses.length > 0 ? courses.map((c, idx) => {
              const isActive = activeCardId === c.id;
              return (
                <div 
                  key={`${c.id}-${idx}`} 
                  className={`rounded-2xl md:rounded-[2.5rem] bg-white p-4 sm:p-6 md:p-10 shadow-sm border transition-all ${
                    c.status === 'ALLOCATED' ? 'border-blue-100' : 'border-gray-50'
                  } group hover:shadow-xl hover:shadow-blue-900/5 relative ${
                    isActive ? 'shadow-xl ring-2 ring-blue-100' : ''
                  }`}
                  style={{ zIndex: isActive ? 200 : (100 - idx) }}
                >
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-4 md:gap-6 relative z-10">
                    <div className="flex-grow w-full">
                    <div className="flex items-center gap-3 mb-4">
                      {c.status === 'PENDING' ? (
                        <span className="rounded-xl bg-orange-50 px-3 py-1.5 text-[9px] font-black text-orange-700 uppercase tracking-[0.15em] border border-orange-100 animate-pulse">BELUM DIALOKASI</span>
                      ) : (
                        <span className="rounded-xl bg-green-50 px-3 py-1.5 text-[9px] font-black text-green-700 uppercase tracking-[0.15em] border border-green-100">TERALOKASI</span>
                      )}
                      <span className="text-[10px] font-black text-gray-300 tracking-[0.25em] uppercase italic">SA {semesterPeriod.label}</span>
                    </div>
                    <h3 className="text-lg md:text-2xl font-black text-[#0F172A] mb-1 md:mb-2 tracking-tight group-hover:text-blue-900 transition-colors">{c.studentName}</h3>
                    <p className="text-sm font-bold text-gray-500 mb-3">{c.mkName}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        Bobot MK: <span className="text-blue-600">{c.sks} SKS</span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        Prodi: <span className="text-gray-900">{c.prodi}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-4 shrink-0 w-full lg:w-[400px]">
                    {c.status === 'PENDING' ? (
                      <div className="flex flex-col gap-2 w-full">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">PILIH DOSEN PENGAJAR</p>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                          <div className="flex-grow min-w-0 w-full">
                            <SearchableSelect
                              options={c.availableLecturers || []}
                              placeholder={c.availableLecturers?.length > 0 ? "-- Pilih Dosen Pengampu --" : "Tidak ada pengampu terdaftar"}
                              value={selectedLecturers[c.id] || ""}
                              onChange={(val) => setSelectedLecturers({ ...selectedLecturers, [c.id]: val })}
                              onOpenChange={(open) => setActiveCardId(open ? c.id : null)}
                            />
                          </div>
                          <button
                            onClick={() => handleAllocate(c.id, selectedLecturers[c.id] || "")}
                            className="flex shrink-0 h-12 w-full sm:w-12 md:w-14 items-center justify-center rounded-2xl bg-[#0F172A] text-white shadow-2xl shadow-blue-900/20 hover:bg-green-600 hover:scale-[1.02] sm:hover:scale-105 active:scale-95 transition-all gap-2 py-3.5 sm:py-0"
                          >
                            <span className="inline sm:hidden text-[10px] font-black tracking-widest uppercase">Konfirmasi Alokasi</span>
                            <CheckIcon />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 w-full">
                        <div className="flex-grow flex items-center gap-4 rounded-[1.5rem] md:rounded-[2rem] border border-blue-50 bg-blue-50/20 p-3 md:p-4 shadow-sm group/card hover:bg-blue-50 transition-all min-w-0">
                          <div className="h-12 w-12 md:h-14 md:w-14 shrink-0 rounded-[1rem] md:rounded-[1.2rem] bg-blue-600 flex items-center justify-center text-white font-black text-base md:text-xl shadow-lg border-2 md:border-4 border-white/20">
                            {c.lecturer?.initials}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5 md:mb-1">DOSEN PENGAJAR</p>
                            <h4 className="text-sm md:text-lg font-black text-[#0F172A] truncate">{c.lecturer?.name}</h4>
                            <p className="text-[10px] md:text-[11px] font-black text-blue-600 mt-0.5 md:mt-1 uppercase tracking-tighter">Total Beban: {c.lecturer?.load} SKS</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleReset(c.lecturer?.alokasi_id)}
                          className="shrink-0 rounded-xl md:rounded-2xl bg-gray-50 py-3.5 sm:py-4 px-4 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all active:scale-95 shadow-sm text-center w-full sm:w-auto"
                        >
                          RESET
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Decorative background circle inside an overflow-hidden relative container */}
                <div className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none z-0">
                  <div className="absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-blue-50/20 group-hover:scale-150 transition-transform duration-1000"></div>
                </div>
              </div>
              );
            }) : (
              <div className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest">
                Belum ada pengajuan SA yang tersedia.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal Detail Beban Kerja */}
      {showBebanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 md:px-8 py-5 md:py-6">
              <h3 className="text-lg md:text-xl font-black text-[#1A365D]">Detail Kapasitas Beban Dosen</h3>
              <button
                onClick={() => setShowBebanModal(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-5 md:p-8 overflow-y-auto flex-grow bg-gray-50/50 space-y-4 md:space-y-6">
              {allBebanDosen.map((dosen, idx) => (
                <div key={`${dosen.id}-${idx}`} className="flex flex-col gap-3 group bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`h-11 w-11 md:h-12 md:w-12 shrink-0 rounded-2xl flex items-center justify-center text-xs font-black border border-white shadow-sm ${dosen.load > 8 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                        {dosen.initials}
                      </div>
                      <span className="text-sm md:text-base font-black text-gray-800 line-clamp-1 truncate">{dosen.name}</span>
                    </div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest shrink-0">{dosen.load}/16 SKS</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-50 overflow-hidden border border-gray-100 mt-2">
                    <div className={`h-full rounded-full transition-all duration-1000 ${dosen.load > 8 ? 'bg-orange-500 group-hover:bg-orange-600' : 'bg-[#0F172A] group-hover:bg-blue-600'}`} style={{ width: `${Math.min((dosen.load / 16) * 100, 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </KaprodiLayout>
  );
}
