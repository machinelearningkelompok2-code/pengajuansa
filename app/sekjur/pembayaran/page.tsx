"use client";

import React, { useEffect, useState } from 'react';
import SekjurLayout from '../../../components/SekjurLayout';
import { supabase } from '../../../supabase/lib/supabase';
import Link from 'next/link';
import Swal from 'sweetalert2';

// Icons
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default function PembayaranSekjur() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // State for Modal
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingProof, setLoadingProof] = useState(false);

  useEffect(() => {
    fetchPayments();
    const userStr = localStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    // Sengaja TIDAK fetch bukti_url di sini karena berupa Base64 besar
    // yang memperlambat loading awal. Hanya fetch metadata saja.
    const { data, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        *,
        mahasiswa:mahasiswa_id (nama_mahasiswa, nim, prodi, jurusan, ipk, semester),
        pembayaran (id),
        items:pendaftaran_items(
          id,
          nilai_lama,
          mata_kuliah:mk_id(kode_mk, nama_mk, sks, semester_asal)
        )
      `)
      .neq('status', 'Draft')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPayments(data);
    }
    setLoading(false);
  };

  // Fetch bukti_url HANYA saat tombol diklik (lazy load)
  const fetchAndShowProof = async (pembayaranId: string | undefined) => {
    if (!pembayaranId) {
      Swal.fire({
        title: 'Informasi',
        text: 'Mahasiswa belum mengunggah bukti pembayaran.',
        icon: 'info',
        confirmButtonColor: '#1A365D'
      });
      return;
    }
    setLoadingProof(true);
    const { data, error } = await supabase
      .from('pembayaran')
      .select('bukti_url')
      .eq('id', pembayaranId)
      .single();
    setLoadingProof(false);

    if (error || !data?.bukti_url) {
      Swal.fire({
        title: 'Informasi',
        text: 'Bukti pembayaran tidak ditemukan.',
        icon: 'info',
        confirmButtonColor: '#1A365D'
      });
      return;
    }
    setSelectedProof(data.bukti_url);
    setIsModalOpen(true);
  };

  const verifyPayment = async (id: string, currentStatus: string) => {
    if (currentStatus === 'Approved') return;

    const result = await Swal.fire({
      title: 'Konfirmasi',
      text: "Apakah Anda yakin ingin memverifikasi pembayaran ini?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#1A365D',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Lanjutkan'
    });
    if (result.isConfirmed) {
      const { error } = await supabase
        .from('pendaftaran_sa')
        .update({ status: 'Approved' })
        .eq('id', id);

      if (!error) {
        Swal.fire({
          title: 'Berhasil',
          text: "Pembayaran berhasil diverifikasi!",
          icon: 'success',
          confirmButtonColor: '#1A365D'
        });
        fetchPayments();
      } else {
        Swal.fire({
          title: 'Gagal',
          text: "Gagal memverifikasi: " + error.message,
          icon: 'error',
          confirmButtonColor: '#1A365D'
        });
      }
    }
  };

  // openProofModal replaced by fetchAndShowProof above

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const topbarTitle = (
    <div>
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Verifikasi Pembayaran & Berkas</h2>
      <p className="text-xs font-semibold text-gray-500">Tinjau bukti pembayaran mahasiswa untuk divalidasi</p>
    </div>
  );

  return (
    <SekjurLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-6 relative">

        {/* Proof Viewer Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6">
                <h3 className="text-lg font-black text-[#1A365D]">Bukti Pembayaran</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="p-8 flex justify-center bg-gray-50/50 rounded-b-[2rem]">
                {selectedProof ? (
                  <img
                    src={selectedProof}
                    alt="Bukti Pembayaran"
                    className="max-h-[60vh] rounded-xl shadow-sm object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "https://via.placeholder.com/400x500?text=Format+File+Tidak+Didukung";
                    }}
                  />
                ) : (
                  <div className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest">
                    Tidak ada gambar bukti
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-[#1A365D]">Daftar Pendaftaran Masuk</h3>
          <span className="rounded-full bg-blue-50 px-4 py-1.5 text-[10px] font-black text-blue-700 uppercase tracking-widest border border-blue-100">
            {payments.filter(p => p.status === 'Pending').length} Pending
          </span>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col gap-4">
          {loading ? (
            <div className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest animate-pulse">Menarik Data Pendaftaran...</div>
          ) : payments.length > 0 ? payments.map((pay, idx) => (
            <div key={`${pay.id}-${idx}`} className="rounded-[2rem] bg-white p-5 border border-gray-50 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden group">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-black text-blue-700 shadow-sm">
                  {getInitials(pay.mahasiswa?.nama_mahasiswa)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{pay.mahasiswa?.nama_mahasiswa}</h4>
                  <p className="text-[10px] font-medium text-gray-500">{pay.mahasiswa?.nim} • {pay.mahasiswa?.prodi || 'Sistem Informasi'}</p>
                  {pay.items && pay.items.length > 0 && (
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-wide mt-0.5 line-clamp-1">
                      MK: {pay.items[0].mata_kuliah?.nama_mk} ({pay.items[0].mata_kuliah?.sks} SKS) • Alasan: {pay.items[0].nilai_lama || '-'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50/50 rounded-2xl p-4 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">KODE FORM</span>
                  <span className="font-bold text-gray-700">{pay.kode_pendaftaran || '-'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">TOTAL BIAYA</span>
                  <span className="font-black text-gray-900">Rp {(pay.biaya_pendaftaran || 500000).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">SUMBER</span>
                  <div>
                    {pay.pembayaran && pay.pembayaran.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-black text-blue-700 border border-blue-100 uppercase">
                        Mahasiswa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[8px] font-black text-purple-700 border border-purple-100 uppercase">
                        Form Sekjur
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">STATUS</span>
                  <div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase border ${pay.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' :
                      pay.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>
                      {pay.status === 'Approved' ? 'Lunas' : pay.status === 'Pending' ? 'Butuh Cek' : pay.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
                {/* Tombol lihat bukti hanya untuk pendaftaran dari mahasiswa */}
                {pay.pembayaran && pay.pembayaran.length > 0 && (
                  <button
                    onClick={() => fetchAndShowProof(pay.pembayaran?.[0]?.id)}
                    disabled={loadingProof}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 py-2.5 text-[9px] font-black text-gray-600 hover:bg-blue-600 hover:text-white transition-all uppercase disabled:opacity-60"
                  >
                    {loadingProof ? <span className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" /> : <EyeIcon />} Bukti
                  </button>
                )}

                {/* Tombol Isi/Detail Formulir SA */}
                {pay.pembayaran && pay.pembayaran.length > 0 && (
                  <Link href={`/sekjur/formulir-sa?pendaftaran_id=${pay.id}`} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-[9px] font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all uppercase">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      {pay.items && pay.items.length > 0 ? 'Formulir SA' : 'Isi Form'}
                    </button>
                  </Link>
                )}

                {pay.status !== 'Approved' && (
                  <button
                    onClick={() => verifyPayment(pay.id, pay.status)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-500 py-2.5 text-[9px] font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all uppercase"
                  >
                    <CheckIcon /> Validasi
                  </button>
                )}
              </div>
            </div>
          )) : (
            <div className="py-20 text-center text-sm font-bold text-gray-400 uppercase tracking-widest bg-white rounded-[2rem] border border-gray-50">
              Tidak ada data pendaftaran masuk.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-hidden rounded-3xl bg-white shadow-sm border border-gray-50">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Mahasiswa</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Kode Form</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Total Biaya</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Sumber</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-8 py-20 text-center font-bold text-gray-400 uppercase tracking-widest animate-pulse">Menarik Data Pendaftaran...</td></tr>
              ) : payments.length > 0 ? payments.map((pay, idx) => (
                <tr key={`${pay.id}-${idx}`} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-black text-blue-700 shadow-sm">
                        {getInitials(pay.mahasiswa?.nama_mahasiswa)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{pay.mahasiswa?.nama_mahasiswa}</span>
                        <span className="text-[10px] font-medium text-gray-500">{pay.mahasiswa?.nim} • {pay.mahasiswa?.prodi || 'Sistem Informasi'}</span>
                        {pay.items && pay.items.length > 0 && (
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-wide mt-1">
                            MK: {pay.items[0].mata_kuliah?.nama_mk} ({pay.items[0].mata_kuliah?.sks} SKS) • Alasan: {pay.items[0].nilai_lama || '-'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-bold text-gray-600">{pay.kode_pendaftaran || '-'}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-black text-gray-900">Rp {(pay.biaya_pendaftaran || 500000).toLocaleString('id-ID')}</span>
                  </td>
                  {/* Kolom Sumber: bedakan antara dari Mahasiswa vs dari Formulir Sekjur */}
                  <td className="px-8 py-6">
                    {pay.pembayaran && pay.pembayaran.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black text-blue-700 border border-blue-100 uppercase tracking-widest">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>Dari Mahasiswa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-[9px] font-black text-purple-700 border border-purple-100 uppercase tracking-widest">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>Formulir Sekjur
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${pay.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' :
                      pay.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>
                      {pay.status === 'Approved' ? 'Sudah Verifikasi' : pay.status === 'Pending' ? 'Butuh Cek' : pay.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Tombol lihat bukti hanya untuk pendaftaran dari mahasiswa */}
                      {pay.pembayaran && pay.pembayaran.length > 0 && (
                        <button
                          onClick={() => fetchAndShowProof(pay.pembayaran?.[0]?.id)}
                          disabled={loadingProof}
                          className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-[10px] font-black text-gray-600 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-600/20 transition-all uppercase tracking-widest disabled:opacity-60"
                        >
                          {loadingProof ? <span className="animate-spin h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full" /> : <EyeIcon />} Bukti
                        </button>
                      )}

                      {/* Tombol Isi/Detail Formulir SA */}
                      {pay.pembayaran && pay.pembayaran.length > 0 && (
                        <Link href={`/sekjur/formulir-sa?pendaftaran_id=${pay.id}`}>
                          <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-black text-white shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            {pay.items && pay.items.length > 0 ? 'Formulir SA' : 'Isi Formulir SA'}
                          </button>
                        </Link>
                      )}

                      {pay.status !== 'Approved' && (
                        <button
                          onClick={() => verifyPayment(pay.id, pay.status)}
                          className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-[10px] font-black text-white shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                        >
                          <CheckIcon /> {pay.pembayaran && pay.pembayaran.length > 0 ? 'Validasi' : 'Teruskan ke Kaprodi'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
                    Tidak ada data pendaftaran masuk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="bg-gray-50/50 p-6 flex items-center justify-between border-t border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pendaftaran: {payments.length} Data</p>
          </div>
        </div>
      </div>
    </SekjurLayout>
  );
}
