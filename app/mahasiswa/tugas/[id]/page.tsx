"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '../../../../components/MainLayout';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../supabase/lib/supabase';
import Swal from 'sweetalert2';

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
);

export default function DetailTugasMahasiswa() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const tugasId = params.id as string;

  useEffect(() => {
    if (tugasId) fetchDetailTugas();
  }, [tugasId]);

  const fetchDetailTugas = async () => {
    setLoading(true);
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const { data: tugasData } = await supabase
      .from('tugas')
      .select(`
        *,
        mata_kuliah (nama_mk),
        dosen:dosen_id (nama_lengkap)
      `)
      .eq('id', tugasId)
      .single();

    if (tugasData) setTask(tugasData);

    const { data: subsData } = await supabase
      .from('pengumpulan_tugas')
      .select('*')
      .eq('tugas_id', tugasId)
      .eq('mahasiswa_id', user.id)
      .single();

    if (subsData) setSubmission(subsData);

    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      Swal.fire({
        title: 'Informasi',
        text: "Pilih file tugas Anda terlebih dahulu.",
        icon: 'warning',
        confirmButtonColor: '#1A365D'
      });
      return;
    }

    setSubmitting(true);
    const userStr = localStorage.getItem('user');
    const user = JSON.parse(userStr || '{}');

    const reader = new FileReader();
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(selectedFile);
    });

    const { error: insertError } = await supabase.from('pengumpulan_tugas').insert({
      tugas_id: tugasId,
      mahasiswa_id: user.id,
      file_url: fileBase64,
      nilai: null
    });

    setSubmitting(false);

    if (!insertError) {
      Swal.fire({
        title: 'Berhasil',
        text: "Berkas tugas berhasil dikumpulkan!",
        icon: 'success',
        confirmButtonColor: '#1A365D'
      });
      fetchDetailTugas();
    } else {
      Swal.fire({
        title: 'Gagal',
        text: "Gagal mengunggah: " + insertError.message,
        icon: 'error',
        confirmButtonColor: '#1A365D'
      });
    }
  };

  const handleViewFile = () => {
    if (!submission?.file_url) return;

    // Check if it's a data URL (base64)
    if (submission.file_url.startsWith('data:')) {
      try {
        const parts = submission.file_url.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1];
        const b64Data = parts[1];

        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (err) {
        console.error("Error opening file:", err);
        // Fallback to direct open if blob conversion fails
        window.open(submission.file_url, '_blank');
      }
    } else {
      window.open(submission.file_url, '_blank');
    }
  };

  const handleCancelSubmit = async () => {
    if (submission?.nilai !== null) {
      Swal.fire({ title: 'Ditolak', text: 'Tugas sudah dinilai, pengumpulan tidak dapat dibatalkan.', icon: 'warning', confirmButtonColor: '#1A365D' });
      return;
    }

    const result = await Swal.fire({
      title: 'Batalkan Pengumpulan?',
      text: "Anda yakin ingin membatalkan kiriman tugas ini? Berkas tugas Anda akan dihapus dari sistem.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#1A365D',
      confirmButtonText: 'Ya, Batalkan',
      cancelButtonText: 'Kembali'
    });

    if (result.isConfirmed) {
      setSubmitting(true);
      const { error } = await supabase
        .from('pengumpulan_tugas')
        .delete()
        .eq('id', submission.id);
        
      setSubmitting(false);

      if (!error) {
        Swal.fire({ title: 'Dibatalkan', text: 'Tugas berhasil dibatalkan.', icon: 'success', confirmButtonColor: '#1A365D' });
        setSubmission(null);
        setSelectedFile(null);
      } else {
        Swal.fire({ title: 'Gagal', text: 'Gagal membatalkan tugas: ' + error.message, icon: 'error', confirmButtonColor: '#1A365D' });
      }
    }
  };

  const topbarTitle = (
    <div className="flex items-center gap-4">
      <Link href="/mahasiswa/tugas" className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm border border-gray-100 transition-all">
        <ArrowLeftIcon />
      </Link>
      <div>
        <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Detail Tugas</h2>
        <p className="text-xs font-semibold text-gray-500">Kumpulkan tugas Anda sebelum deadline</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <MainLayout topbarTitle={topbarTitle}>
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </MainLayout>
    );
  }

  if (!task) {
    return (
      <MainLayout topbarTitle={topbarTitle}>
        <div className="text-center py-20 font-bold text-gray-400">Tugas tidak ditemukan.</div>
      </MainLayout>
    );
  }

  const isExpired = task.deadline ? new Date(task.deadline) < new Date() : false;

  return (
    <MainLayout topbarTitle={topbarTitle}>
      <div className="mx-auto max-w-7xl px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-700">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-stretch">

          {/* Kolom Kiri: Header & Detail Instruksi (8 Kolom) */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="rounded-[2rem] md:rounded-[2.5rem] bg-white p-6 md:p-10 shadow-sm border border-gray-50 relative overflow-hidden flex-grow flex flex-col">
              <div className="relative z-10 flex-grow flex flex-col">
                <div className="mb-4 md:mb-6 flex flex-wrap items-center gap-3">
                  <span className="rounded-xl bg-[#1A365D] px-3 py-1.5 md:px-4 md:py-2 text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-blue-900/10">
                    {(task.mata_kuliah as any)?.nama_mk || 'Mata Kuliah'}
                  </span>
                  <span className={`rounded-xl px-3 py-1.5 md:px-4 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] border ${isExpired ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                    {isExpired ? 'DEADLINE BERAKHIR' : 'STATUS: AKTIF'}
                  </span>
                </div>

                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-[#1A365D] tracking-tight leading-tight mb-6 md:mb-8">
                  {task.judul}
                </h1>

                <div className="flex items-center gap-4 p-3 md:p-4 rounded-3xl bg-gray-50/80 border border-gray-100 w-fit max-w-full mb-8 md:mb-10">
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-[#1A365D] flex items-center justify-center text-base md:text-lg font-black text-white shadow-lg shadow-blue-900/10 shrink-0">
                    {(task.dosen as any)?.nama_lengkap?.charAt(0) || 'D'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm font-black text-[#1A365D] truncate">{(task.dosen as any)?.nama_lengkap || 'Dosen Pengampu'}</p>
                    <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">Dosen Utama Semester Antara</p>
                  </div>
                </div>

                {/* Instruksi Section - AGA KEBAWAH & SEJAJAR PANJANGNYA */}
                <div className="border-t border-gray-100 pt-8 md:pt-12 flex-grow flex flex-col">
                  <div className="flex items-center gap-3 mb-6 md:mb-8">
                    <div className="h-1.5 w-8 md:w-10 bg-blue-600 rounded-full"></div>
                    <h4 className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Instruksi Penugasan</h4>
                  </div>

                  <div className="text-gray-600 font-medium leading-relaxed flex-grow">
                    <p className="whitespace-pre-line text-sm md:text-base lg:text-lg">{task.deskripsi || 'Tidak ada instruksi khusus untuk tugas ini.'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Sidebar Action & Info (4 Kolom) */}
          <div className="lg:col-span-4 flex flex-col">

            {/* Action Card: Portal Pengumpulan */}
            <div className="rounded-[2rem] md:rounded-[2.5rem] bg-[#0F172A] p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col h-full">
              <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl"></div>

              <div className="relative z-10">
                <div className="mb-6 md:mb-10 flex items-center justify-between">
                  <h3 className="text-[10px] md:text-xs font-black text-blue-300 uppercase tracking-[0.3em]">Portal Tugas</h3>
                  <div className={`h-2 w-2 rounded-full ${submission ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}></div>
                </div>

                <div className="flex flex-col gap-4 md:gap-6 mb-6 md:mb-10">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">Deadline</p>
                    <p className="text-xs font-bold text-white uppercase">
                      {task.deadline ? new Date(task.deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Open'}
                    </p>
                  </div>
                  <div className="h-px w-full bg-white/5"></div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</p>
                    {submission ? (
                      <span className="text-[9px] md:text-[10px] font-black text-green-400 uppercase tracking-widest">TERKIRIM</span>
                    ) : (
                      <span className="text-[9px] md:text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">PENDING</span>
                    )}
                  </div>
                </div>

                {!submission ? (
                  <form onSubmit={handleUpload} className="flex flex-col gap-5 md:gap-6">
                    <div
                      className="group relative flex flex-col items-center justify-center rounded-[1.5rem] md:rounded-[2rem] border-2 border-dashed border-white/10 bg-white/5 py-8 md:py-10 px-4 md:px-6 text-center hover:bg-white/10 transition-all cursor-pointer"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <div className="mb-4 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-white/5 text-blue-400">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      </div>
                      <p className="text-xs font-black text-white/80 mb-1 max-w-full truncate">
                        {selectedFile ? selectedFile.name : 'Pilih Berkas'}
                      </p>
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Format: PDF, ZIP, IMG</p>
                      <input type="file" id="file-upload" className="hidden" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || isExpired}
                      className={`w-full rounded-2xl py-5 md:py-6 text-[10px] md:text-[11px] font-black text-white shadow-2xl transition-all uppercase tracking-[0.2em] ${submitting || isExpired ? 'bg-gray-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:scale-95'}`}
                    >
                      {submitting ? 'Mengirim...' : 'Submit Tugas'}
                    </button>
                  </form>
                ) : (
                  <div className="rounded-[1.5rem] md:rounded-[2rem] bg-white/5 border border-white/10 p-6 md:p-8 flex flex-col items-center text-center">
                    <div className="h-12 w-12 md:h-16 md:w-16 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center mb-4 md:mb-6 shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                    </div>
                    <h4 className="text-xs md:text-sm font-black text-white mb-6 md:mb-8 uppercase tracking-widest">Tugas Berhasil Terkirim</h4>
                    <div className="w-full flex flex-col gap-3">
                      <button
                        onClick={handleViewFile}
                        className="w-full rounded-2xl bg-white/10 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-white uppercase tracking-widest border border-white/10 hover:bg-white/20 transition-all text-center"
                      >
                        Buka Berkas Saya
                      </button>
                      
                      <button
                        onClick={handleCancelSubmit}
                        disabled={submitting || submission.nilai !== null || isExpired}
                        className={`w-full rounded-2xl py-4 md:py-5 text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all text-center ${
                          submission.nilai !== null || isExpired 
                            ? 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:text-red-300'
                        }`}
                      >
                        {submitting 
                          ? 'Memproses...' 
                          : submission.nilai !== null 
                            ? 'Tugas Sudah Dinilai' 
                            : isExpired 
                              ? 'Waktu Habis' 
                              : 'Batalkan Kirim Tugas'
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Score Display */}
              <div className="relative z-10 mt-8 md:mt-10 pt-8 md:pt-10 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nilai Akhir</p>
                    <p className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest">{submission && submission.nilai !== null ? 'Sudah Dinilai' : 'Pending'}</p>
                  </div>
                  <div className="text-right">
                    {submission && submission.nilai !== null ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl md:text-5xl font-black text-white leading-none tracking-tighter">{submission.nilai}</span>
                        <span className="text-xs md:text-sm font-black text-gray-600 uppercase tracking-widest">/100</span>
                      </div>
                    ) : (
                      <span className="text-3xl md:text-4xl font-black text-gray-800 tracking-tighter">--</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </MainLayout>
  );
}
