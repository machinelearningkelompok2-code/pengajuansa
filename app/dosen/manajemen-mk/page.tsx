"use client";

import React, { useEffect, useState } from 'react';
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

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default function ManajemenMK() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMK, setSelectedMK] = useState<any | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  
  const semesterPeriod = getCurrentSemesterPeriod();

  // State untuk Edit MK
  const [editingMK, setEditingMK] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const { data, error } = await supabase
      .from('alokasi_dosen')
      .select(`
        mata_kuliah (
          id,
          kode_mk,
          nama_mk,
          sks,
          semester_asal,
          jurusan,
          prodi,
          status_buka
        )
      `)
      .eq('dosen_id', user.id);

    if (error) {
      console.error('Error fetching courses:', error);
    } else if (data) {
      const mkIds = data.map((a: any) => a.mata_kuliah?.id).filter(Boolean);

      let pItems: any[] = [];
      if (mkIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('pendaftaran_items')
          .select('mk_id, pendaftaran_sa(created_at, mahasiswa_id)')
          .in('mk_id', mkIds);
        if (itemsData) {
          // Filter pendaftaran yang masuk pada semester aktif
          pItems = itemsData.filter((p: any) => {
            const createdAtStr = (p.pendaftaran_sa as any)?.created_at;
            if (!createdAtStr) return false;
            const date = new Date(createdAtStr);
            return date >= semesterPeriod.start && date <= semesterPeriod.end;
          });
        }
      }

      const courseMap = new Map();
      data.forEach((item: any) => {
        const mk = item.mata_kuliah;
        if (mk && !courseMap.has(mk.id)) {
          // Hitung unik mahasiswa (deduplikasi)
          const mkItems = pItems.filter(p => p.mk_id === mk.id);
          const uniqueStudents = new Set();
          mkItems.forEach(p => {
            if ((p.pendaftaran_sa as any)?.mahasiswa_id) {
              uniqueStudents.add((p.pendaftaran_sa as any).mahasiswa_id);
            }
          });
          const count = uniqueStudents.size;
          
          courseMap.set(mk.id, {
            ...mk,
            studentsCount: count
          });
        }
      });

      setCourses(Array.from(courseMap.values()));
    }
    setLoading(false);
  };

  const handleDetailClick = async (course: any) => {
    setSelectedMK(course);
    setLoadingModal(true);
    
    // Fetch students enrolled in this course
    const { data, error } = await supabase
      .from('pendaftaran_items')
      .select(`
        pendaftaran_sa (
          created_at,
          mahasiswa (
            id,
            nim,
            nama_mahasiswa,
            prodi
          )
        )
      `)
      .eq('mk_id', course.id);

    if (!error && data) {
      // Filter mahasiswa berdasarkan tanggal pendaftaran di semester aktif
      const students = data
        .filter((d: any) => {
          const createdAtStr = d.pendaftaran_sa?.created_at;
          if (!createdAtStr) return false;
          const date = new Date(createdAtStr);
          return date >= semesterPeriod.start && date <= semesterPeriod.end;
        })
        .map((d: any) => d.pendaftaran_sa?.mahasiswa)
        .filter(Boolean);

      // Deduplikasi
      const seen = new Set();
      const uniqueStudents = students.filter((s: any) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      setEnrolledStudents(uniqueStudents);
    }
    setLoadingModal(false);
  };

  const handleArchive = async (courseId: string, currentStatus: boolean) => {
    const result = await Swal.fire({
      title: 'Konfirmasi',
      text: `Apakah Anda yakin ingin ${currentStatus ? 'MENUTUP (arsip)' : 'MEMBUKA'} mata kuliah ini?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#1A365D',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Lanjutkan'
    });
    if (!result.isConfirmed) return;
    
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('mata_kuliah')
      .update({ status_buka: newStatus })
      .eq('id', courseId);

    if (!error) {
      Swal.fire({
      title: 'Berhasil',
      text: `Berhasil memperbarui status MK.`,
      icon: 'success',
      confirmButtonColor: '#1A365D'
    });
      fetchCourses();
    } else {
      Swal.fire({
      title: 'Gagal',
      text: 'Gagal memperbarui status. Pastikan Anda memiliki akses.',
      icon: 'error',
      confirmButtonColor: '#1A365D'
    });
    }
  };

  const handleUpdateMK = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMK) return;

    setSavingEdit(true);
    const { error } = await supabase
      .from('mata_kuliah')
      .update({
        nama_mk: editingMK.nama_mk,
        kode_mk: editingMK.kode_mk,
        sks: editingMK.sks,
        semester_asal: editingMK.semester_asal,
        jurusan: editingMK.jurusan,
        prodi: editingMK.prodi
      })
      .eq('id', editingMK.id);

    if (!error) {
      Swal.fire({
      title: 'Berhasil',
      text: 'Berhasil memperbarui data mata kuliah',
      icon: 'success',
      confirmButtonColor: '#1A365D'
    });
      setEditingMK(null);
      fetchCourses();
    } else {
      Swal.fire({
      title: 'Gagal',
      text: 'Gagal menyimpan perubahan.',
      icon: 'error',
      confirmButtonColor: '#1A365D'
    });
    }
    setSavingEdit(false);
  };

  const topbarTitle = (
    <h2 className="m-0 text-xl font-bold text-[#1A365D]">Manajemen Mata Kuliah</h2>
  );

  return (
    <DosenLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1A365D]">Daftar Mata Kuliah Saya</h3>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 border border-blue-100">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Periode Aktif: Semester {semesterPeriod.label}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-50">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total MK Diampu</span>
            <p className="text-3xl font-black text-[#1A365D] mt-1">{courses.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-50">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Buka</span>
            <p className="text-3xl font-black text-green-600 mt-1">
              {courses.filter(c => c.status_buka).length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-2 py-20 text-center font-bold text-gray-400 uppercase tracking-widest animate-pulse">
              Mensinkronkan Data...
            </div>
          ) : courses.length > 0 ? (
            courses.map((course, idx) => (
              <div key={`${course.id}-${idx}`} className="group relative rounded-2xl md:rounded-[2rem] bg-white p-5 md:p-8 shadow-sm border border-gray-50 transition-all hover:shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                    {course.kode_mk || 'Kode Kosong'}
                  </span>
                  <div className={`h-2.5 w-2.5 rounded-full ${course.status_buka ? 'bg-green-500 animate-pulse' : 'bg-red-500'} ring-4 ring-gray-50`}></div>
                </div>

                <h4 className="mb-2 text-lg md:text-xl font-bold text-gray-900 group-hover:text-blue-900 transition-colors line-clamp-1" title={course.nama_mk}>
                  {course.nama_mk}
                </h4>
                <p className="mb-4 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                  {course.jurusan || '-'} • {course.prodi || '-'}
                </p>
                <div className="mb-6 flex items-center gap-4">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    {course.sks} SKS • Sem {course.semester_asal}
                  </p>
                  <span className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600">
                    {course.studentsCount} Mahasiswa
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${course.status_buka ? 'text-green-600' : 'text-red-500'}`}>
                    Status: {course.status_buka ? 'DIBUKA' : 'DITUTUP'}
                  </span>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleDetailClick(course)}
                      className="text-[11px] font-bold text-blue-600 hover:underline uppercase tracking-widest"
                    >
                      Detail
                    </button>
                    <button 
                      onClick={() => setEditingMK(course)}
                      className="text-[11px] font-bold text-orange-500 hover:underline uppercase tracking-widest"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleArchive(course.id, course.status_buka)}
                      className="text-[11px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      {course.status_buka ? 'Arsip' : 'Buka'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 py-20 text-center font-bold text-gray-400 uppercase tracking-widest">
              Anda belum dialokasikan ke mata kuliah manapun.
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail MK */}
      {selectedMK && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 md:px-8 py-5 md:py-6 gap-3">
              <div className="min-w-0">
                <h3 className="text-lg md:text-xl font-black text-[#1A365D] line-clamp-2">{selectedMK.nama_mk}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {selectedMK.kode_mk} • {selectedMK.sks} SKS • {selectedMK.jurusan}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMK(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-grow bg-gray-50/50">
              <h4 className="text-sm font-bold text-gray-900 mb-4">Mahasiswa Terdaftar ({enrolledStudents.length})</h4>
              
              {loadingModal ? (
                <div className="py-10 text-center text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">
                  Memuat Daftar Mahasiswa...
                </div>
              ) : enrolledStudents.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100">
                  <table className="w-full min-w-[360px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                      <tr>
                        <th className="px-6 py-4">No</th>
                        <th className="px-6 py-4">NIM</th>
                        <th className="px-6 py-4">Nama Mahasiswa</th>
                        <th className="px-6 py-4">Prodi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {enrolledStudents.map((student, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{idx + 1}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">{student.nim}</td>
                          <td className="px-6 py-4 font-bold text-[#1A365D]">{student.nama_mahasiswa}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-gray-600">{student.prodi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm font-bold text-gray-400 uppercase tracking-widest bg-white rounded-2xl border border-gray-100">
                  Belum ada mahasiswa yang mengambil MK ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit MK */}
      {editingMK && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 md:px-8 py-5 md:py-6 gap-3">
              <h3 className="text-lg md:text-xl font-black text-[#1A365D]">Edit Mata Kuliah</h3>
              <button 
                onClick={() => setEditingMK(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="p-5 md:p-8 overflow-y-auto flex-grow bg-gray-50/50">
              <form onSubmit={handleUpdateMK} className="flex flex-col gap-5">
                <div>
                  <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">Nama Mata Kuliah</label>
                  <input 
                    type="text" 
                    value={editingMK.nama_mk || ''} 
                    onChange={e => setEditingMK({...editingMK, nama_mk: e.target.value})}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium focus:border-[#1A365D] focus:outline-none focus:ring-1 focus:ring-[#1A365D]"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">Kode MK</label>
                    <input 
                      type="text" 
                      value={editingMK.kode_mk || ''} 
                      onChange={e => setEditingMK({...editingMK, kode_mk: e.target.value})}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium focus:border-[#1A365D] focus:outline-none focus:ring-1 focus:ring-[#1A365D]"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">SKS</label>
                    <input 
                      type="number" 
                      value={editingMK.sks || ''} 
                      onChange={e => setEditingMK({...editingMK, sks: parseInt(e.target.value)})}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium focus:border-[#1A365D] focus:outline-none focus:ring-1 focus:ring-[#1A365D]"
                      required
                      min="1"
                      max="6"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">Semester Asal</label>
                    <input 
                      type="number" 
                      value={editingMK.semester_asal || ''} 
                      onChange={e => setEditingMK({...editingMK, semester_asal: parseInt(e.target.value)})}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium focus:border-[#1A365D] focus:outline-none focus:ring-1 focus:ring-[#1A365D]"
                      required
                      min="1"
                      max="8"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">Jurusan</label>
                    <input 
                      type="text" 
                      value={editingMK.jurusan || ''} 
                      onChange={e => setEditingMK({...editingMK, jurusan: e.target.value})}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium focus:border-[#1A365D] focus:outline-none focus:ring-1 focus:ring-[#1A365D]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">Program Studi</label>
                  <input 
                    type="text" 
                    value={editingMK.prodi || ''} 
                    onChange={e => setEditingMK({...editingMK, prodi: e.target.value})}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium focus:border-[#1A365D] focus:outline-none focus:ring-1 focus:ring-[#1A365D]"
                  />
                </div>
                <div className="mt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setEditingMK(null)}
                    className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={savingEdit}
                    className="rounded-xl bg-[#1A365D] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
                  >
                    {savingEdit ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </DosenLayout>
  );
}
