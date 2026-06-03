"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabase/lib/supabase';
import { fetchPengaturan } from '../../../supabase/lib/pengaturan';
import AkademikLayout from '../../../components/AkademikLayout';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Icons ──────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);
const GradIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
);

// ─── Helpers ────────────────────────────────────────────────
const getInitials = (name?: string) => {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getSemesterText = (sem: number) => {
  const romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return romawi[sem - 1] || sem.toString();
};

const gradeFromScore = (score: number): string => {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'E';
};

const bobotFromGrade = (grade: string): number => {
  switch (grade) {
    case 'A': return 4;
    case 'B': return 3;
    case 'C': return 2;
    case 'D': return 1;
    default: return 0;
  }
};

export default function AkademikDashboardPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [akademikUser, setAkademikUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setAkademikUser(JSON.parse(userStr));
    fetchData();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      records.filter(r =>
        r.mahasiswa?.nama_mahasiswa?.toLowerCase().includes(q) ||
        r.mahasiswa?.nim?.toLowerCase().includes(q) ||
        r.items?.[0]?.mata_kuliah?.nama_mk?.toLowerCase().includes(q)
      )
    );
  }, [search, records]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        id,
        mahasiswa_id,
        mahasiswa:mahasiswa_id(nama_mahasiswa, nim, prodi, jurusan, ipk, semester),
        items:pendaftaran_items(
          *,
          mata_kuliah:mk_id(kode_mk, nama_mk, sks, semester_asal)
        ),
        status
      `)
      .in('status', ['KHS_Forwarded', 'KHS_Diterima'])
      .order('created_at', { ascending: false });

    if (!error && data) setRecords(data);
    setLoading(false);
  };

  const handleVerifyKHS = async (record: any) => {
    try {
      const { error } = await supabase
        .from('pendaftaran_sa')
        .update({ status: 'KHS_Diterima' })
        .eq('id', record.id);

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'KHS Diverifikasi',
        text: `KHS mahasiswa ${record.mahasiswa?.nama_mahasiswa} berhasil diterima dan diverifikasi!`,
        confirmButtonColor: '#1A365D'
      });
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', 'Gagal memverifikasi KHS: ' + err.message, 'error');
    }
  };

  // ─── Compute per-row metrics ─────────────────────────────────
  const computeRows = (record: any, tasksData: any[]) => {
    let totalSks = 0, totalSksBobot = 0;
    const rows = (record.items || []).map((item: any, idx: number) => {
      const mk = item.mata_kuliah;
      const mkTasks = tasksData.filter(t => t.mk_id === mk?.id);
      let sum = 0, cnt = 0;
      mkTasks.forEach((t: any) => {
        const sub = t.pengumpulan_tugas?.find((s: any) => s.mahasiswa_id === record.mahasiswa_id);
        if (sub && sub.nilai !== null) { sum += parseFloat(sub.nilai); cnt++; }
      });
      
      let score = 85;
      if (item.nilai_akhir !== null && item.nilai_akhir !== undefined) {
        score = parseFloat(item.nilai_akhir);
      } else if (cnt > 0) {
        score = sum / cnt;
      }
      
      const grade = gradeFromScore(score);
      const sksVal = mk?.sks || 0;
      const bbtVal = bobotFromGrade(grade);
      const rowBobot = sksVal * bbtVal;

      totalSks += sksVal;
      totalSksBobot += rowBobot;

      return {
        idx: idx + 1,
        kode: mk?.kode_mk || '-',
        nama: mk?.nama_mk || '-',
        sks: sksVal,
        huruf: grade,
        angka: bbtVal,
        bobot: rowBobot
      };
    });

    const ips = totalSks > 0 ? (totalSksBobot / totalSks).toFixed(2) : '0.00';
    return { rows, totalSks, totalSksBobot, ips };
  };

  // ─── PDF Engine ──────────────────────────────────────────────
  const handleDownload = async (record: any) => {
    try {
      Swal.fire({
        title: 'Mempersiapkan Dokumen...',
        text: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      // 1. Check if a scanned KHS exists in the pengaturan table
      const scanKey = `khs_scan_${record.id}`;
      const { data: scanData } = await supabase
        .from('pengaturan')
        .select('value')
        .eq('key', scanKey)
        .single();

      if (scanData?.value) {
        // Download the scanned PDF directly
        const link = document.createElement('a');
        link.href = scanData.value;
        link.download = `KHS_Scan_${record.mahasiswa?.nama_mahasiswa?.replace(/\s+/g, '_')}_${record.mahasiswa?.nim}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Swal.fire({ icon: 'success', title: 'Berhasil!', text: `KHS Scan ${record.mahasiswa?.nama_mahasiswa} berhasil diunduh.`, confirmButtonColor: '#1A365D' });
        return;
      }

      // 2. Fallback: Fetch dynamic tugas data for grade computation
      let tasksData: any[] = [];
      const mkIds = record.items?.map((item: any) => item.mata_kuliah?.id).filter(Boolean);
      if (mkIds && mkIds.length > 0) {
        const { data } = await supabase
          .from('tugas')
          .select(`
            id,
            mk_id,
            pengumpulan_tugas(mahasiswa_id, nilai)
          `)
          .in('mk_id', mkIds)
          .eq('mahasiswa_id', record.mahasiswa_id);
        tasksData = data || [];
      }

      const { rows, totalSks, totalSksBobot, ips } = computeRows(record, tasksData);
      const mhs = record.mahasiswa;
      const jurusan = mhs?.jurusan || 'TEKNIK ELEKTRO';
      const ipkVal = mhs?.ipk !== null && mhs?.ipk !== undefined ? parseFloat(mhs.ipk).toFixed(2) : '0.00';

      // ── Load Logo Polimdo (icon.jpeg) ──
      let logoBase64: string | null = null;
      try {
        const logoRes = await fetch('/icon.jpeg');
        const logoBlob = await logoRes.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
      } catch (err) {
        console.error('Gagal memuat icon.jpeg:', err);
      }

      const doc = new jsPDF();

      // ── Header Box ──
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(20, 15, 170, 25);
      doc.line(55, 15, 55, 40);
      doc.line(55, 28, 190, 28);
      doc.line(85, 28, 85, 40);
      doc.line(115, 28, 115, 40);
      doc.line(135, 28, 135, 40);
      doc.line(165, 28, 165, 40);

      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
      doc.text('FORMULIR', 37.5, 39, { align: 'center' });
      doc.text('FM-44 ed.A rev.0', 57, 34);
      doc.text('ISSUE : A', 87, 34);
      doc.text('Issued :', 117, 34);
      doc.text('UPDATE :', 137, 34);
      doc.text('Update :', 167, 34);

      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('POLITEKNIK NEGERI MANADO', 122, 22, { align: 'center' });

      // ── Logo Polimdo (icon.jpeg) ──
      if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', 27.5, 16, 20, 20);
      }

      // ── Jurusan & Judul ──
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`Jurusan : ${jurusan.toUpperCase()}`, 20, 48);
      doc.setFontSize(14);
      doc.text('KARTU HASIL STUDI', 105, 58, { align: 'center' });

      // ── Info Mahasiswa ──
      doc.setFontSize(9.5);
      let y = 68;
      const lx = 20, rx = 55;
      const row = (label: string, val: string) => {
        doc.setFont('helvetica', 'bold'); doc.text(label, lx, y);
        doc.setFont('helvetica', 'normal'); doc.text(`: ${val}`, rx, y);
        y += 6;
      };
      row('Nama', mhs?.nama_mahasiswa?.toUpperCase() || '-');
      row('NIM', mhs?.nim || '-');
      row('IPK', ipkVal);
      row('Status', 'Lulus');

      const curYear = new Date().getFullYear();
      const curMonth = new Date().getMonth() + 1;
      const academicYear = curMonth >= 7
        ? `${curYear}/${curYear + 1}`
        : `${curYear - 1}/${curYear}`;

      row('Tahun Akademik', academicYear);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text(`Semester : ${getSemesterText(mhs?.semester || 1)}`, lx, y);
      y += 6;

      // ── Tabel ──
      autoTable(doc, {
        startY: y,
        head: [['No', 'Kode', 'Matakuliah', 'SKS R', 'Nilai Huruf', 'Nilai Angka', '(B)×(A)(N)']],
        body: rows.map((r: any) => [r.idx, r.kode, r.nama, r.sks, r.huruf, r.angka, r.bobot]),
        foot: [[
          { content: 'Jumlah SKS', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: totalSks.toString(), styles: { fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 2 },
          { content: totalSksBobot.toFixed(2), styles: { fontStyle: 'bold', halign: 'center' } }
        ]],
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [200, 200, 200], lineWidth: 0.1, halign: 'center' },
        footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.1 },
        bodyStyles: { fontSize: 8.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
        margin: { left: 20, right: 20 }
      });

      const fy = (doc as any).lastAutoTable.finalY;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');

      // ── Tanda Tangan ──
      const pejabat = await fetchPengaturan();
      const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Manado, ${today}`, 140, fy + 18);
      doc.text(`Ketua Jurusan ${jurusan}`, 20, fy + 26);
      doc.text('Sekretaris Jurusan', 140, fy + 26);

      doc.setFont('helvetica', 'bold');
      doc.text(pejabat.kajur_nama, 20, fy + 46);
      doc.setFont('helvetica', 'normal');
      doc.text(pejabat.kajur_nip, 20, fy + 51);

      doc.setFont('helvetica', 'bold');
      doc.text(pejabat.sekjur_nama, 140, fy + 46);
      doc.setFont('helvetica', 'normal');
      doc.text(pejabat.sekjur_nip, 140, fy + 51);

      doc.save(`KHS_SA_${mhs?.nama_mahasiswa?.replace(/\s+/g, '_')}_${mhs?.nim}.pdf`);
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `KHS ${mhs?.nama_mahasiswa} diunduh.`, confirmButtonColor: '#1A365D' });
    } catch (err: any) {
      Swal.fire('Error', 'Gagal: ' + err.message, 'error');
    }
  };

  return (
    <AkademikLayout topbarTitle={
      <div className="flex items-center gap-4">
        <h2 className="m-0 text-xl font-bold text-[#1A365D]">Akademik KHS</h2>
        <div className="mx-4 h-5 w-px bg-gray-300" />
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Verifikasi & Cetak KHS</span>
      </div>
    }>
      <div className="flex flex-col gap-8">

        {/* Banner */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#1A365D] to-[#1E3A8A] p-8 md:p-12 text-white shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-200 backdrop-blur">
              <GradIcon /> Bagian Akademik Polimdo
            </div>
            <h1 className="mb-2 text-2xl md:text-4xl font-black tracking-tight leading-tight">
              Verifikasi & Pencetakan<br />Kartu Hasil Studi (KHS)
            </h1>
            <p className="text-xs md:text-sm text-blue-200 font-medium">
              Selamat datang di portal akademik. Di sini Anda dapat melihat KHS mahasiswa yang telah diteruskan oleh Sekretaris Jurusan (Sekjur), memverifikasi berkas, dan mencetak dokumen resmi.
            </p>
          </div>
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'KHS Menunggu', value: records.filter(r => r.status === 'KHS_Forwarded').length, color: 'yellow' },
            { label: 'KHS Terverifikasi', value: records.filter(r => r.status === 'KHS_Diterima').length, color: 'green' },
            { label: 'Total KHS Masuk', value: records.length, color: 'blue' }
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</span>
              <span className={`text-3xl font-black ${stat.color === 'yellow' ? 'text-yellow-600' : stat.color === 'green' ? 'text-green-600' : 'text-blue-600'
                }`}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* List View */}
        <div className="rounded-3xl bg-white shadow-sm border border-gray-100 overflow-hidden">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-[#1A365D]">Daftar KHS dari Sekjur</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Memproses berkas Kartu Hasil Studi untuk diverifikasi secara institusional</p>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama, NIM, atau prodi..."
                className="w-full sm:w-72 rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm font-medium text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
              />
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col divide-y divide-gray-50">
            {loading ? (
              <div className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest animate-pulse">Memuat data...</div>
            ) : filtered.length > 0 ? filtered.map((rec, idx) => {
              const mk = rec.items?.[0]?.mata_kuliah;
              return (
                <div key={`${rec.id}-${idx}`} className="p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 text-xs font-black text-blue-700 shadow-sm">
                      {getInitials(rec.mahasiswa?.nama_mahasiswa)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">{rec.mahasiswa?.nama_mahasiswa}</p>
                      <p className="text-[10px] font-medium text-gray-500">{rec.mahasiswa?.nim} • {rec.mahasiswa?.prodi}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleDownload(rec)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#1A365D]/10 hover:bg-[#1A365D]/20 px-3.5 py-2.5 text-[10px] font-black text-[#1A365D] transition-all uppercase tracking-widest"
                    >
                      <DownloadIcon /> KHS
                    </button>
                    {rec.status === 'KHS_Forwarded' ? (
                      <button
                        onClick={() => handleVerifyKHS(rec)}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 px-3.5 py-2.5 text-[10px] font-black text-white shadow-lg shadow-green-900/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                      >
                        <CheckIcon /> Verifikasi
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-[9px] font-black text-green-700 border border-green-100 uppercase tracking-wider">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Selesai
                      </span>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="py-20 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
                Belum ada berkas KHS masuk.
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr>
                  {['No', 'Mahasiswa', 'Program Studi', 'Semester Asal', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest animate-pulse">Memuat data...</td></tr>
                ) : filtered.length > 0 ? filtered.map((rec, idx) => {
                  return (
                    <tr key={`${rec.id}-${idx}`} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-5 text-xs font-bold text-gray-400">{idx + 1}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 text-[10px] font-black text-blue-700">
                            {getInitials(rec.mahasiswa?.nama_mahasiswa)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{rec.mahasiswa?.nama_mahasiswa}</p>
                            <p className="text-[10px] font-medium text-gray-500">{rec.mahasiswa?.nim}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{rec.mahasiswa?.prodi}</p>
                          <p className="text-[10px] font-medium text-gray-400">{rec.mahasiswa?.jurusan}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-gray-700">Semester {rec.mahasiswa?.semester}</span>
                      </td>
                      <td className="px-6 py-5">
                        {rec.status === 'KHS_Forwarded' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-50 px-3 py-1.5 text-[10px] font-black text-yellow-700 border border-yellow-100 uppercase tracking-wider">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                            Menunggu Verifikasi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-[10px] font-black text-green-700 border border-green-100 uppercase tracking-wider">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Terverifikasi
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDownload(rec)}
                            className="flex items-center gap-2 rounded-xl bg-[#1A365D] px-4 py-2.5 text-[10px] font-black text-white shadow-lg shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap"
                          >
                            <DownloadIcon /> Unduh KHS
                          </button>
                          {rec.status === 'KHS_Forwarded' && (
                            <button
                              onClick={() => handleVerifyKHS(rec)}
                              className="flex items-center gap-2 rounded-xl bg-[#1A365D] px-4 py-2.5 text-[10px] font-black text-white shadow-lg shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap"
                            >
                              <CheckIcon /> Terima & Verifikasi
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
                      Belum ada berkas KHS masuk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </AkademikLayout>
  );
}
