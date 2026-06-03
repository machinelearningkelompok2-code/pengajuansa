"use client";

import React, { useState, useEffect, Suspense } from 'react';
import AdminLayout from '../../../components/SekjurLayout';
import { supabase } from '../../../supabase/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

// Icons
const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

const BookOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);

function PengisianFormulirSAInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pendaftaranId = searchParams.get('pendaftaran_id');

  const [mataKuliahList, setMataKuliahList] = useState<any[]>([]);
  const [jurusanList, setJurusanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nama: "",
    nim: "",
    jurusan: "",
    prodi: "",
    ipk: "",
    semester: ""
  });

  const [items, setItems] = useState([{ mk_id: "", alasan: "Mengulang (Nilai D/E)" }]);
  const [catatan, setCatatan] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);

  useEffect(() => {
    fetchMataKuliah();
    if (pendaftaranId) {
      setIsEditMode(true);
      fetchExistingPendaftaran(pendaftaranId);
    }
  }, [pendaftaranId]);

  // Auto-fill student data when NIM is entered
  useEffect(() => {
    if (!formData.nim || isEditMode) return;

    const delayDebounce = setTimeout(async () => {
      if (formData.nim.length < 5) return;

      try {
        const { data: mhs, error } = await supabase
          .from('mahasiswa')
          .select('nama_mahasiswa, jurusan, prodi, ipk, semester')
          .eq('nim', formData.nim)
          .maybeSingle();

        if (!error && mhs) {
          let ipkVal = mhs.ipk !== null && mhs.ipk !== undefined ? mhs.ipk.toString() : "";
          let semVal = mhs.semester !== null && mhs.semester !== undefined ? mhs.semester.toString() : "";

          // Fallback ke tabel users jika IPK/Semester kosong di tabel mahasiswa
          if (!ipkVal || !semVal) {
            const { data: userData } = await supabase
              .from('users')
              .select('ipk, semester')
              .eq('nim_nip', formData.nim)
              .maybeSingle();

            if (userData) {
              if (!ipkVal && userData.ipk !== null && userData.ipk !== undefined) {
                ipkVal = userData.ipk.toString();
              }
              if (!semVal && userData.semester !== null && userData.semester !== undefined) {
                semVal = userData.semester.toString();
              }
            }
          }

          setFormData(prev => ({
            ...prev,
            nama: mhs.nama_mahasiswa || prev.nama,
            jurusan: mhs.jurusan || prev.jurusan,
            prodi: mhs.prodi || prev.prodi,
            ipk: ipkVal || prev.ipk,
            semester: semVal || prev.semester
          }));
        }
      } catch (err) {
        console.error("Error auto-filling student:", err);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [formData.nim, isEditMode]);

  // Ambil data mahasiswa dari pendaftaran yang sudah ada (mode pre-fill)
  const fetchExistingPendaftaran = async (id: string) => {
    const { data, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        catatan_sekjur,
        mahasiswa:mahasiswa_id(
          id, nim, nama_mahasiswa, jurusan, prodi, ipk, semester
        ),
        items:pendaftaran_items(mk_id, nilai_lama)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return;

    const mhs = data.mahasiswa as any;
    let ipkVal = mhs?.ipk?.toString() || '';
    let semVal = mhs?.semester?.toString() || '';

    // Fallback ke tabel users jika IPK/Semester kosong di tabel mahasiswa
    if (mhs?.id && (!ipkVal || !semVal)) {
      const { data: userData } = await supabase
        .from('users')
        .select('ipk, semester')
        .eq('id', mhs.id)
        .maybeSingle();

      if (userData) {
        if (!ipkVal && userData.ipk !== null && userData.ipk !== undefined) {
          ipkVal = userData.ipk.toString();
        }
        if (!semVal && userData.semester !== null && userData.semester !== undefined) {
          semVal = userData.semester.toString();
        }
      }
    }

    setFormData({
      nama: mhs?.nama_mahasiswa || '',
      nim: mhs?.nim || '',
      jurusan: mhs?.jurusan || '',
      prodi: mhs?.prodi || '',
      ipk: ipkVal,
      semester: semVal
    });
    setCatatan((data as any).catatan_sekjur || '');
    const existingItems = (data as any).items;
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map((i: any) => ({
        mk_id: i.mk_id,
        alasan: i.nilai_lama || 'Mengulang (Nilai D/E)'
      })));
    }
  };

  const fetchMataKuliah = async () => {
    const { data: mkData } = await supabase.from('mata_kuliah').select('id, kode_mk, nama_mk, sks').order('nama_mk');
    if (mkData) setMataKuliahList(mkData);

    const { data: jurData } = await supabase.from('jurusan').select('nama_jurusan, prodi(nama_prodi)').order('nama_jurusan');
    if (jurData) setJurusanList(jurData);
  };

  const handleAddItem = () => {
    if (items.length < 3) {
      setItems([...items, { mk_id: "", alasan: "Mengulang (Nilai D/E)" }]);
    } else {
      Swal.fire({
      title: 'Informasi',
      text: "Maksimal pengambilan adalah 3 mata kuliah.",
      icon: 'warning',
      confirmButtonColor: '#1A365D'
    });
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!konfirmasi) {
      Swal.fire({
      title: 'Informasi',
      text: "Harap centang kotak konfirmasi validitas data.",
      icon: 'warning',
      confirmButtonColor: '#1A365D'
    });
      return;
    }
    if (!formData.nama || !formData.nim || !formData.jurusan || !formData.prodi) {
      Swal.fire({
      title: 'Informasi',
      text: "Nama, NIM, Jurusan, dan Prodi wajib diisi.",
      icon: 'warning',
      confirmButtonColor: '#1A365D'
    });
      return;
    }
    const validItems = items.filter(i => i.mk_id !== "");
    if (validItems.length === 0) {
      Swal.fire({
      title: 'Informasi',
      text: "Minimal pilih 1 mata kuliah.",
      icon: 'warning',
      confirmButtonColor: '#1A365D'
    });
      return;
    }

    setLoading(true);
    try {
      // -------------------------------------------------------
      // MODE EDIT: update pendaftaran yang sudah ada (dari mahasiswa)
      // Hanya insert/replace pendaftaran_items & update catatan
      // -------------------------------------------------------
      if (isEditMode && pendaftaranId) {
        // Hapus items lama lalu insert baru
        await supabase.from('pendaftaran_items').delete().eq('pendaftaran_id', pendaftaranId);
        const insertItems = validItems.map(item => ({
          pendaftaran_id: pendaftaranId,
          mk_id: item.mk_id,
          nilai_lama: item.alasan
        }));
        const { error: itemsErr } = await supabase.from('pendaftaran_items').insert(insertItems);
        if (itemsErr) throw itemsErr;
        await supabase.from('pendaftaran_sa').update({ catatan_sekjur: catatan || null }).eq('id', pendaftaranId);
        Swal.fire({
      title: 'Berhasil',
      text: "Data mata kuliah berhasil disimpan! Silakan kembali ke Verifikasi Pembayaran untuk memvalidasi dan meneruskan ke Kaprodi.",
      icon: 'success',
      confirmButtonColor: '#1A365D'
    });
        router.push('/sekjur/pembayaran');
        return;
      }

      // -------------------------------------------------------
      // MODE BARU: buat pendaftaran_sa baru (formulir manual)
      // -------------------------------------------------------
      let mahasiswaId = "";
      const { data: existingUser } = await supabase.from('users').select('id').eq('nim_nip', formData.nim).single();
      if (existingUser) {
        mahasiswaId = existingUser.id;
      } else {
        const { data: newUser, error: userErr } = await supabase.from('users').insert({
          nama_lengkap: formData.nama,
          nim_nip: formData.nim,
          jurusan: formData.jurusan,
          prodi: formData.prodi,
          role: 'mahasiswa',
          email: `${formData.nim}@polimdo.ac.id`,
          password: '123456'
        }).select('id').single();
        if (userErr) throw userErr;
        mahasiswaId = newUser.id;
      }

      const kodePendaftaran = `SA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const totalBiaya = validItems.length * 150000;
      const { data: pendaftaran, error: pendErr } = await supabase.from('pendaftaran_sa').insert({
        mahasiswa_id: mahasiswaId,
        kode_pendaftaran: kodePendaftaran,
        status: 'Approved', // Langsung Approved karena diinput manual oleh Sekjur, langsung diteruskan ke Kaprodi
        biaya_pendaftaran: totalBiaya,
        catatan_sekjur: catatan || null
      }).select('id').single();
      if (pendErr) throw pendErr;

      const insertItems = validItems.map(item => ({
        pendaftaran_id: pendaftaran.id,
        mk_id: item.mk_id,
        nilai_lama: item.alasan
      }));
      const { error: itemsErr } = await supabase.from('pendaftaran_items').insert(insertItems);
      if (itemsErr) throw itemsErr;

      Swal.fire({
      title: 'Berhasil',
      text: "Formulir SA berhasil disimpan! Silakan buka halaman Verifikasi Pembayaran untuk meneruskan ke Kaprodi.",
      icon: 'success',
      confirmButtonColor: '#1A365D'
    });
      setFormData({ nama: "", nim: "", jurusan: "", prodi: "", ipk: "", semester: "" });
      setItems([{ mk_id: "", alasan: "Mengulang (Nilai D/E)" }]);
      setKonfirmasi(false);
      setCatatan("");

    } catch (err: any) {
      Swal.fire({
      title: 'Gagal',
      text: "Terjadi kesalahan: " + err.message,
      icon: 'error',
      confirmButtonColor: '#1A365D'
    });
    } finally {
      setLoading(false);
    }
  };

  const topbarTitle = (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">
          {isEditMode ? 'Lengkapi Formulir SA Mahasiswa' : 'Pengisian Formulir SA'}
        </h2>
        {isEditMode ? (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black text-blue-700 tracking-widest uppercase">Mode: Isi dari Data Mahasiswa</span>
        ) : (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-black text-orange-700 tracking-widest uppercase">Role: Sekjur</span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-500">
        {isEditMode ? 'Data mahasiswa telah diisi otomatis. Pilih mata kuliah SA lalu simpan.' : 'Input data pengajuan mahasiswa untuk diteruskan ke Kaprodi'}
      </p>
    </div>
  );

  return (
    <AdminLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col flex-grow min-h-full">
      {/* Banner info saat mode edit (pre-fill dari mahasiswa) */}
      {isEditMode && (
        <div className="w-full mb-6 flex items-center gap-4 rounded-2xl bg-blue-50 border border-blue-100 px-6 py-4">
          <div className="text-2xl">✏️</div>
          <div>
            <p className="text-xs font-black text-blue-800 uppercase tracking-widest">Mode Pengisian Formulir SA</p>
            <p className="text-xs text-blue-600 mt-0.5 font-medium">Data mahasiswa telah diisi otomatis dari pendaftaran yang ada. Pilih mata kuliah SA, lalu klik Simpan. Setelah itu kembali ke halaman Verifikasi Pembayaran untuk memvalidasi.</p>
          </div>
        </div>
      )}
      <div className="w-full flex flex-col gap-8 relative flex-grow">

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-900">Menyimpan ke Database...</p>
            </div>
          </div>
        )}

        {/* Main Form Card */}
        <div className="rounded-3xl bg-white shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
          <div className="bg-[#1A365D] px-6 md:px-10 py-5 md:py-6 text-white">
            <h3 className="text-lg font-bold">Formulir Pengajuan Semester Antara</h3>
            <p className="text-xs text-blue-200 mt-1">Pastikan seluruh data mahasiswa valid sebelum dikirimkan ke Kaprodi.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 md:p-10 flex flex-col gap-8 md:gap-10">

            {/* Section 1: Identitas Mahasiswa */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <UserIcon />
                </div>
                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Identitas Mahasiswa</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nama Lengkap Mahasiswa</label>
                  <input
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Masukkan nama lengkap..."
                    className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">NIM (Nomor Induk Mahasiswa)</label>
                  <input
                    type="text"
                    required
                    value={formData.nim}
                    onChange={(e) => setFormData({ ...formData, nim: e.target.value })}
                    placeholder="Contoh: 210240XX..."
                    className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Jurusan</label>
                  <select
                    value={formData.jurusan}
                    onChange={(e) => setFormData({ ...formData, jurusan: e.target.value, prodi: "" })}
                    className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 appearance-none"
                  >
                    <option value="">Pilih Jurusan...</option>
                    {jurusanList.map((j: any) => (
                      <option key={j.nama_jurusan} value={j.nama_jurusan}>{j.nama_jurusan}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Program Studi</label>
                  <select
                    value={formData.prodi}
                    onChange={(e) => setFormData({ ...formData, prodi: e.target.value })}
                    className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 appearance-none"
                    disabled={!formData.jurusan}
                  >
                    <option value="">Pilih Prodi...</option>
                    {jurusanList.find(j => j.nama_jurusan === formData.jurusan)?.prodi.map((p: any) => (
                      <option key={p.nama_prodi} value={p.nama_prodi}>{p.nama_prodi}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">IPK Terakhir</label>
                  <input
                    type="text"
                    value={formData.ipk}
                    onChange={(e) => setFormData({ ...formData, ipk: e.target.value })}
                    placeholder="Contoh: 3.85"
                    className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semester Aktif</label>
                  <input
                    type="number"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    placeholder="Contoh: 6"
                    className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Rencana Mata Kuliah SA */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <BookOpenIcon />
                </div>
                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Detail Mata Kuliah SA</h4>
              </div>

              <div className="flex flex-col gap-4">
                {items.map((item, index) => (
                  <div key={index} className="rounded-2xl border border-dashed border-gray-200 p-4 md:p-6 bg-gray-50/30">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 flex flex-col gap-2 w-full">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pilih Mata Kuliah {index + 1}</label>
                        <select
                          value={item.mk_id}
                          onChange={(e) => updateItem(index, 'mk_id', e.target.value)}
                          className="w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:ring-2 focus:ring-orange-100 appearance-none"
                        >
                          <option value="">Pilih Mata Kuliah...</option>
                          {mataKuliahList.map(mk => (
                            <option key={mk.id} value={mk.id}>{mk.kode_mk} - {mk.nama_mk} ({mk.sks} SKS)</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Alasan Pengambilan</label>
                        <select
                          value={item.alasan}
                          onChange={(e) => updateItem(index, 'alasan', e.target.value)}
                          className="w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:ring-2 focus:ring-orange-100 appearance-none"
                        >
                          <option>Mengulang (Nilai D/E)</option>
                          <option>Perbaikan Nilai (C)</option>
                          <option>Akselerasi (Maju)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {items.length < 3 && (
                  <button onClick={handleAddItem} type="button" className="text-xs font-black text-blue-600 self-start ml-2 hover:underline">
                    + Tambah Mata Kuliah Lain (Maks. 3)
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Catatan Tambahan Sekjur</label>
                <textarea
                  rows={3}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Berikan catatan jika diperlukan..."
                  className="w-full rounded-xl bg-gray-50 px-5 py-3.5 text-sm font-semibold outline-none ring-1 ring-gray-100 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 resize-none"
                ></textarea>
              </div>
            </div>

            {/* Checkbox Konfirmasi */}
            <div className="flex items-start gap-4 rounded-2xl bg-blue-50/50 p-5 md:p-6 border border-blue-100">
              <input
                type="checkbox"
                checked={konfirmasi}
                onChange={(e) => setKonfirmasi(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-bold text-[#1A365D]">Konfirmasi Validitas Data</p>
                <p className="text-[10px] font-medium text-blue-600/80 leading-relaxed uppercase tracking-wide">Saya menyatakan bahwa data mahasiswa di atas telah diperiksa dan siap untuk ditinjau oleh Kaprodi.</p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-6 border-t border-gray-50">
              {!isEditMode && (
                <button type="button" className="w-full sm:w-auto rounded-xl px-8 py-3.5 text-sm font-bold text-gray-400 hover:bg-gray-100 transition-all">
                  Simpan Draft
                </button>
              )}
              <button type="submit" disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1A365D] to-[#0F172A] px-10 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                <SendIcon /> {loading ? "Memproses Data..." : isEditMode ? "Simpan Mata Kuliah SA" : "Kirim Ke Kaprodi"}
              </button>
            </div>

          </form>
        </div>

        {/* Info Box */}
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
            <InfoIcon />
          </div>
          <p className="text-[11px] font-semibold text-gray-500 leading-relaxed">
            <span className="font-bold text-gray-700">PENTING:</span> Data yang telah dikirim ke Kaprodi tidak dapat diubah kembali oleh Sekjur kecuali jika Kaprodi melakukan pengembalian berkas (*return*).
          </p>
        </div>

      </div>
      </div>
    </AdminLayout>
  );
}

// Suspense wrapper wajib karena menggunakan useSearchParams (Next.js App Router)
export default function PengisianFormulirSA() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A365D] border-t-transparent"></div>
      </div>
    }>
      <PengisianFormulirSAInner />
    </Suspense>
  );
}
