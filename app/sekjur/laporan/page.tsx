"use client";

import React, { useEffect, useState } from 'react';
import SekjurLayout from '../../../components/SekjurLayout';
import { supabase } from '../../../supabase/lib/supabase';

// Helper: hitung periode semester aktif berdasarkan tanggal realtime
function getCurrentSemesterPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  if (month >= 1 && month <= 6) {
    return {
      label: `Genap ${year - 1}/${year}`,
      start: new Date(year, 0, 1),
      end: new Date(year, 5, 30, 23, 59, 59),
    };
  } else {
    return {
      label: `Ganjil ${year}/${year + 1}`,
      start: new Date(year, 6, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
    };
  }
}

// Helper: dapatkan label semester dari suatu tanggal
function getSemesterPeriodFromDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 1 && month <= 6) {
    return `Genap ${year - 1}/${year}`;
  } else {
    return `Ganjil ${year}/${year + 1}`;
  }
}

// Helper: dapatkan rentang waktu dari label semester
function parseSemesterPeriodLabel(label: string) {
  const parts = label.split(' ');
  const type = parts[0];
  const years = parts[1].split('/');
  const yearStart = parseInt(years[0]);
  const yearEnd = parseInt(years[1]);
  if (type === 'Genap') {
    return {
      start: new Date(yearEnd, 0, 1),
      end: new Date(yearEnd, 5, 30, 23, 59, 59),
    };
  } else {
    return {
      start: new Date(yearStart, 6, 1),
      end: new Date(yearStart, 11, 31, 23, 59, 59),
    };
  }
}

export default function LaporanSemesterPage() {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);

  // Filter semester
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [semesterOptions, setSemesterOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  // Re-filter saat semester berubah
  useEffect(() => {
    if (!selectedSemester || allData.length === 0) return;
    const range = parseSemesterPeriodLabel(selectedSemester);
    const filtered = allData.filter(item => {
      if (!item.created_at) return false;
      const date = new Date(item.created_at);
      return date >= range.start && date <= range.end;
    });
    setReportData(filtered);
  }, [selectedSemester, allData]);

  const fetchReportData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pendaftaran_sa')
      .select(`
        *,
        mahasiswa:mahasiswa_id (
          nama_mahasiswa, 
          nim, 
          prodi
        )
      `)
      .eq('status', 'Approved')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setAllData(data);

      // Hitung opsi semester dari data
      const currentPeriod = getCurrentSemesterPeriod();
      const periodsSet = new Set<string>();
      periodsSet.add(currentPeriod.label);
      data.forEach((r: any) => {
        if (r.created_at) {
          periodsSet.add(getSemesterPeriodFromDate(new Date(r.created_at)));
        }
      });
      const options = Array.from(periodsSet).sort();
      setSemesterOptions(options);

      // Default ke semester aktif
      const activeSem = currentPeriod.label;
      setSelectedSemester(activeSem);

      // Filter awal
      const range = parseSemesterPeriodLabel(activeSem);
      setReportData(data.filter(item => {
        if (!item.created_at) return false;
        const date = new Date(item.created_at);
        return date >= range.start && date <= range.end;
      }));
    }
    setLoading(false);
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const topbarTitle = (
    <div>
      <h2 className="m-0 text-xl font-extrabold text-[#1A365D]">Laporan Semester Antara</h2>
      <p className="text-xs font-semibold text-gray-500">Rekapitulasi Mahasiswa Terdaftar &amp; Disetujui</p>
    </div>
  );

  return (
    <SekjurLayout topbarTitle={topbarTitle}>
      <div className="flex flex-col gap-6" id="report-container">
        
        {/* Header Laporan (Hanya muncul saat print) */}
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-2xl font-bold text-black uppercase tracking-widest">LAPORAN SEMESTER ANTARA</h1>
          <p className="text-sm font-semibold text-gray-600 uppercase mt-1">Politeknik Negeri Manado — Semester {selectedSemester}</p>
          <hr className="mt-4 border-2 border-black" />
        </div>

        {/* Toolbar: judul + dropdown + tombol unduh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Data Pendaftaran Lunas</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-xs font-black text-blue-600 uppercase tracking-wide">
                Periode Aktif: Semester {selectedSemester}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Dropdown Pilihan Semester */}
            <select
              value={selectedSemester}
              onChange={e => setSelectedSemester(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-xs font-black text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all uppercase tracking-wider"
            >
              {semesterOptions.map(opt => (
                <option key={opt} value={opt}>
                  Semester {opt}
                </option>
              ))}
            </select>

            <button 
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Unduh PDF
            </button>
          </div>
        </div>

        {/* Stats badge */}
        <div className="flex items-center gap-3 print:hidden">
          <span className="rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-[10px] font-black text-blue-700 uppercase tracking-widest">
            {reportData.length} Mahasiswa
          </span>
          <span className="rounded-full bg-green-50 border border-green-100 px-4 py-1.5 text-[10px] font-black text-green-700 uppercase tracking-widest">
            Status: Approved
          </span>
        </div>

        {/* Mobile View: Cards (Hidden on print) */}
        <div className="block md:hidden print:hidden space-y-4">
          {loading ? (
            <div className="py-10 text-center font-bold text-gray-400 uppercase tracking-widest animate-pulse">Memuat Data...</div>
          ) : reportData.length > 0 ? (
            reportData.map((item, index) => {
              const initials = item.mahasiswa?.nama_mahasiswa?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '??';
              return (
                <div key={item.id} className="rounded-2xl bg-white p-5 border border-gray-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-black text-blue-700 shadow-sm border border-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">NO. {index + 1}</span>
                      <h4 className="text-sm font-bold text-gray-900 truncate">{item.mahasiswa?.nama_mahasiswa}</h4>
                      <p className="text-[10px] font-medium text-gray-500">{item.mahasiswa?.nim} • {item.mahasiswa?.prodi || 'Tidak Diketahui'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 bg-gray-50/50 rounded-xl p-3.5 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">STATUS</span>
                      <div>
                        <span className="inline-flex rounded-lg bg-green-50 px-2 py-0.5 text-[8px] font-black text-green-700 border border-green-100 uppercase">
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 items-end">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">TANGGAL DISETUJUI</span>
                      <span className="font-bold text-gray-800">
                        {new Date(item.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center font-bold text-gray-400 uppercase tracking-widest bg-white rounded-2xl border border-gray-50">
              Belum ada data untuk semester ini.
            </div>
          )}
        </div>

        {/* Desktop & Print View: Table */}
        <div className="hidden md:block print:block rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold print:bg-white print:text-black">
                <tr>
                  <th className="px-6 py-4">No</th>
                  <th className="px-6 py-4">NIM</th>
                  <th className="px-6 py-4">Nama Mahasiswa</th>
                  <th className="px-6 py-4">Program Studi</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Tanggal Disetujui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 print:divide-black">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center font-bold text-gray-400 uppercase tracking-widest">Memuat Data...</td>
                  </tr>
                ) : reportData.length > 0 ? (
                  reportData.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                      <td className="px-6 py-4 font-medium text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.mahasiswa?.nim}</td>
                      <td className="px-6 py-4 font-bold text-[#1A365D]">{item.mahasiswa?.nama_mahasiswa}</td>
                      <td className="px-6 py-4 text-xs font-semibold">{item.mahasiswa?.prodi || 'Tidak Diketahui'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-lg bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700 print:bg-transparent print:p-0 print:text-black">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs">
                        {new Date(item.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center font-bold text-gray-400 uppercase tracking-widest">Belum ada data untuk semester ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="border-t border-gray-50 bg-gray-50/50 px-6 py-4 print:hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Total: {reportData.length} Mahasiswa — Semester {selectedSemester}
              </p>
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background-color: white;
            margin: 0;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          #report-container, #report-container * {
            visibility: visible;
          }
          #report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border-bottom: 1px solid black !important;
            padding: 12px 8px !important;
          }
          th {
            border-bottom: 2px solid black !important;
          }
        }
      `}} />
    </SekjurLayout>
  );
}
