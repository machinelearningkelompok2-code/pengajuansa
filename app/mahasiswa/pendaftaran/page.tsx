"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '../../../components/MainLayout';
import { UploadIcon } from '../../../components/icons';
import { supabase } from '../../../supabase/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function PendaftaranPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // States for Course, SKS, and Payment
  const [mataKuliahList, setMataKuliahList] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<{mkId: string; alasan: string}[]>([
    { mkId: '', alasan: 'Mengulang (Nilai D/E)' }
  ]);
  const [totalPembayaran, setTotalPembayaran] = useState<number>(0);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
  }, []);

  // Fetch available open courses
  useEffect(() => {
    const fetchMataKuliah = async () => {
      try {
        const { data, error } = await supabase
          .from('mata_kuliah')
          .select('*')
          .eq('status_buka', true)
          .order('nama_mk', { ascending: true });
        
        if (error) throw error;
        if (data) setMataKuliahList(data);
      } catch (err: any) {
        console.error('Error fetching mata kuliah:', err.message);
      }
    };

    fetchMataKuliah();
  }, []);

  const handleAddCourse = () => {
    setSelectedCourses([...selectedCourses, { mkId: '', alasan: 'Mengulang (Nilai D/E)' }]);
  };

  const handleRemoveCourse = (index: number) => {
    if (selectedCourses.length > 1) {
      const newCourses = [...selectedCourses];
      newCourses.splice(index, 1);
      setSelectedCourses(newCourses);
    }
  };

  const handleCourseChange = (index: number, field: 'mkId' | 'alasan', value: string) => {
    const newCourses = [...selectedCourses];
    newCourses[index][field] = value;
    setSelectedCourses(newCourses);
  };

  const totalSks = selectedCourses.reduce((sum, course) => {
    const foundMk = mataKuliahList.find(mk => mk.id === course.mkId);
    return sum + (foundMk ? foundMk.sks : 0);
  }, 0);

  useEffect(() => {
    setTotalPembayaran(totalSks * 150000);
  }, [totalSks]);

  const handleSubmit = async () => {
    const validCourses = selectedCourses.filter(course => course.mkId !== '');
    if (validCourses.length === 0) {
      Swal.fire({
        title: 'Informasi',
        text: 'Harap pilih minimal satu mata kuliah terlebih dahulu!',
        icon: 'warning',
        confirmButtonColor: '#1A365D'
      });
      return;
    }

    if (!totalPembayaran || totalPembayaran <= 0) {
      Swal.fire({
        title: 'Informasi',
        text: 'Harap masukkan total pembayaran yang valid!',
        icon: 'warning',
        confirmButtonColor: '#1A365D'
      });
      return;
    }

    if (!selectedFile) {
      Swal.fire({
        title: 'Informasi',
        text: 'Harap unggah berkas bukti pembayaran terlebih dahulu!',
        icon: 'warning',
        confirmButtonColor: '#1A365D'
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Konversi Gambar ke Base64 untuk disimpan langsung di Database
      const reader = new FileReader();
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(selectedFile);
      });

      const fileUrl = fileBase64; // Tautan kini berisi data gambar mentah (Base64)

      // 2. Simpan ke tabel pendaftaran_sa
      const kodePendaftaran = `REG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const { data: pendaftaran, error: pendaftaranError } = await supabase
        .from('pendaftaran_sa')
        .insert({
          mahasiswa_id: user.id,
          kode_pendaftaran: kodePendaftaran,
          status: 'Pending',
          biaya_pendaftaran: totalPembayaran
        })
        .select()
        .single();

      if (pendaftaranError) throw pendaftaranError;

      // 3. Simpan detail item pendaftaran ke tabel pendaftaran_items
      const itemsToInsert = validCourses.map(course => ({
        pendaftaran_id: pendaftaran.id,
        mk_id: course.mkId,
        nilai_lama: course.alasan
      }));

      const { error: itemError } = await supabase
        .from('pendaftaran_items')
        .insert(itemsToInsert);

      if (itemError) throw itemError;

      // 4. Simpan tautan berkas asli ke tabel pembayaran
      const { error: pembayaranError } = await supabase
        .from('pembayaran')
        .insert({
          pendaftaran_id: pendaftaran.id,
          bukti_url: fileUrl,
          status_verifikasi: 'Pending'
        });

      if (pembayaranError) throw pembayaranError;

      Swal.fire({
        title: 'Berhasil',
        text: 'Pendaftaran Berhasil! Bukti pembayaran telah tersimpan di database.',
        icon: 'success',
        confirmButtonColor: '#1A365D'
      });
      router.push('/mahasiswa/riwayat');
    } catch (err: any) {
      Swal.fire({
        title: 'Gagal',
        text: 'Gagal menyimpan pendaftaran: ' + err.message,
        icon: 'error',
        confirmButtonColor: '#1A365D'
      });
    } finally {
      setLoading(false);
    }
  };

  const topbarTitle = (
    <h2 className="m-0 text-xl font-bold text-[#1A365D]">Pendaftaran Semester Antara</h2>
  );

  return (
    <MainLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-full overflow-x-hidden min-w-0">
        {/* Kolom Kiri: Form Upload */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          <div className="rounded-3xl bg-white p-5 md:p-10 shadow-sm border border-gray-50 min-w-0">
            <h3 className="text-xl font-bold text-[#1A365D] mb-4">Lengkapi Berkas Pendaftaran</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Silakan unggah bukti transfer pembayaran Semester Antara Anda di bawah ini untuk proses verifikasi.
            </p>

            <div className="flex flex-col gap-6 w-full min-w-0">
              {/* Form Input Mata Kuliah, SKS, dan Total Pembayaran */}
              <div className="flex flex-col gap-6 p-6 rounded-2xl bg-gray-50/50 border border-gray-100">
                {selectedCourses.map((course, index) => {
                  const foundMk = mataKuliahList.find(mk => mk.id === course.mkId);
                  const sks = foundMk ? foundMk.sks : 0;
                  
                  return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                      {/* Header with Remove button if > 1 */}
                      <div className="md:col-span-12 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-[#1A365D]">Mata Kuliah #{index + 1}</h4>
                        {selectedCourses.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveCourse(index)}
                            className="text-xs font-bold text-red-500 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      
                      {/* Mata Kuliah Field */}
                      <div className="flex flex-col gap-2 md:col-span-7">
                        <label className="text-[10px] font-black text-[#1A365D] uppercase tracking-widest ml-1">
                          Mata Kuliah <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            required
                            value={course.mkId}
                            onChange={(e) => handleCourseChange(index, 'mkId', e.target.value)}
                            className="w-full rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none shadow-sm"
                          >
                            <option value="">Pilih Mata Kuliah...</option>
                            {mataKuliahList.map((mk) => (
                              <option key={mk.id} value={mk.id}>
                                {mk.kode_mk} - {mk.nama_mk}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* SKS Field */}
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[10px] font-black text-[#1A365D] uppercase tracking-widest ml-1">
                          SKS
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={sks ? `${sks} SKS` : '-'}
                          className="w-full rounded-xl bg-gray-100 border border-gray-200 px-4 py-3 text-sm font-black text-gray-500 outline-none cursor-not-allowed shadow-sm text-center"
                        />
                      </div>

                      {/* Alasan Pengambilan Field */}
                      <div className="flex flex-col gap-2 md:col-span-3">
                        <label className="text-[10px] font-black text-[#1A365D] uppercase tracking-widest ml-1">
                          Alasan <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            required
                            value={course.alasan}
                            onChange={(e) => handleCourseChange(index, 'alasan', e.target.value)}
                            className="w-full rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none shadow-sm"
                          >
                            <option>Mengulang (Nilai D/E)</option>
                            <option>Perbaikan Nilai (C)</option>
                            <option>Akselerasi (Maju)</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <button
                  type="button"
                  onClick={handleAddCourse}
                  className="w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors"
                >
                  + Tambah Mata Kuliah
                </button>

                {/* Total SKS and Total Pembayaran Area */}
                <div className="pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Total SKS Information */}
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 w-full">
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Total SKS Diambil</p>
                      <p className="text-2xl font-black text-[#1A365D]">{totalSks} SKS</p>
                    </div>
                  </div>

                  {/* Total Pembayaran Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-[#1A365D] uppercase tracking-widest ml-1">
                      Total Pembayaran (Rp) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <input
                        type="number"
                        required
                        value={totalPembayaran || ''}
                        onChange={(e) => setTotalPembayaran(Number(e.target.value))}
                        placeholder="Masukkan total nominal transfer..."
                        className="w-full rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-black text-blue-600 tracking-wider">
                        IDR
                      </div>
                    </div>
                    <p className="text-[9px] font-semibold text-gray-400 ml-1">
                      *Biaya disarankan: Rp150.000/SKS. Anda dapat mengubah nominal jika terdapat beasiswa/potongan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Bukti Pembayaran */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-[#1A365D] uppercase tracking-widest ml-1">
                  Bukti Pembayaran <span className="text-red-500">*</span>
                </label>
                {!selectedFile ? (
                  <div 
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/30 py-12 px-6 md:px-10 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                  <input 
                    id="file-upload"
                    type="file" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    accept="image/*,.pdf"
                  />
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-[#1A365D]">
                    <UploadIcon />
                  </div>
                  <h4 className="text-lg font-bold text-[#1A365D] mb-1">Klik untuk pilih gambar bukti</h4>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">JPG, PNG, atau PDF (Maks 2MB)</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full min-w-0">
                  <div className="flex items-center gap-4 w-full min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700 font-black text-xl">✓</div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-gray-900 truncate" title={selectedFile.name}>{selectedFile.name}</h4>
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-0.5">
                        UKURAN: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline uppercase shrink-0">Hapus</button>
                </div>
              )}
              </div>

               <button 
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-2xl bg-[#1A365D] py-4 px-4 text-xs sm:text-sm font-black text-white shadow-xl shadow-blue-900/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-wider disabled:opacity-50 whitespace-normal break-words"
              >
                {loading ? "Menyimpan ke Database..." : "Kirim Pengajuan Pendaftaran"}
              </button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Panduan */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-6">
          <div className="rounded-3xl bg-[#0F172A] p-8 text-white shadow-xl relative overflow-hidden">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-6 relative z-10">Instruksi Pembayaran</h4>
            <div className="space-y-6 relative z-10">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">REKENING TUJUAN</p>
                <p className="text-lg font-black text-white">164-00-12345-678</p>
                <p className="text-xs font-bold text-gray-300">BANK MANDIRI - POLIMDO</p>
              </div>
              <ul className="text-xs text-gray-400 space-y-3 list-none p-0">
                <li className="flex gap-2"><span>•</span> Simpan bukti transfer asli</li>
                <li className="flex gap-2"><span>•</span> Verifikasi butuh waktu 1-2 hari kerja</li>
                <li className="flex gap-2"><span>•</span> Pantau status di menu Riwayat</li>
              </ul>
            </div>
            <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl"></div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
