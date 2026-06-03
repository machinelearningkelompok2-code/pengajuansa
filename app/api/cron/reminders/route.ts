import { NextResponse } from 'next/server';
import { supabase } from '../../../../supabase/lib/supabase';
import nodemailer from 'nodemailer';

// GET /api/cron/reminders
// Endpoint ini dirancang untuk dipanggil secara otomatis setiap hari oleh Vercel Cron atau cron-job.org
export async function GET(request: Request) {
  // Opsi Keamanan: Jika menggunakan Vercel Cron, bisa cek token rahasia
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Tentukan rentang waktu besok (H-1)
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // 2. Cari semua tugas yang batas waktunya (deadline) adalah besok
    const { data: dueTasks, error } = await supabase
      .from('tugas')
      .select('id, judul, deadline, mahasiswa_id, pengumpulan_tugas(id), mahasiswa:mahasiswa_id(nama_mahasiswa, nim)')
      .gte('deadline', tomorrowStart.toISOString())
      .lte('deadline', tomorrowEnd.toISOString());

    if (error) throw error;
    
    if (!dueTasks || dueTasks.length === 0) {
      return NextResponse.json({ message: 'Tidak ada tugas yang jatuh tempo besok.' });
    }

    // 3. Filter: Hanya mahasiswa yang BELUM MENGUMPULKAN tugas
    // (tabel pengumpulan_tugas kosong untuk id tugas tersebut)
    const unsubmittedTasks = dueTasks.filter(
      task => !task.pengumpulan_tugas || task.pengumpulan_tugas.length === 0
    );

    if (unsubmittedTasks.length === 0) {
      return NextResponse.json({ message: 'Semua mahasiswa sudah mengumpulkan tugas yang jatuh tempo besok.' });
    }

    // 4. Siapkan Nodemailer (Sama seperti logika /api/send-email)
    let transporter;
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Menggunakan Ethereal untuk test email Cron...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
    }

    // 5. Loop dan kirim email ke masing-masing mahasiswa yang belum kumpul
    const results = [];
    for (const task of unsubmittedTasks) {
      const mhs: any = task.mahasiswa;
      if (!mhs) continue;

      // Ambil email asli mahasiswa dari tabel users (fallback ke format nim)
      const { data: userData } = await supabase.from('users').select('email').eq('id', task.mahasiswa_id).single();
      const email = userData?.email || `${mhs.nim}@polimdo.ac.id`;

      await transporter.sendMail({
        from: `"Polimdo Academic" <${process.env.EMAIL_USER || 'testing@pansgarage.com'}>`,
        to: email,
        subject: `PENGINGAT (H-1): Tugas "${task.judul}" Belum Dikumpulkan`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #DC2626; padding: 20px; text-align: center;">
              <h2 style="color: white; margin: 0;">Pengingat Batas Waktu Tugas (H-1)</h2>
            </div>
            <div style="padding: 30px;">
              <p>Halo, <strong>${mhs.nama_mahasiswa}</strong> (${mhs.nim})</p>
              <p>Ini adalah sistem peringatan otomatis. Berdasarkan data kami, Anda memiliki tugas akademik yang <strong>BELUM DIKUMPULKAN</strong> dan batas waktunya adalah BESOK:</p>
              
              <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #991B1B;"><strong>Mata Tugas:</strong> ${task.judul}</p>
                <p style="margin: 5px 0 0 0; color: #991B1B;"><strong>Batas Waktu:</strong> ${new Date(task.deadline).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
              </div>

              <p>Mohon segera login ke <strong>Portal SA Polimdo</strong> dan mengunggah dokumen penyelesaian Anda sebelum waktu habis untuk menghindari nilai kosong.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6B7280; text-align: center;">
                <p style="margin: 0;">Email ini dihasilkan secara otomatis oleh Sistem Semester Antara Politeknik Negeri Manado. Harap tidak membalas email ini.</p>
              </div>
            </div>
          </div>
        `,
      });

      results.push({ email, task: task.judul, status: 'Sent' });
    }

    return NextResponse.json({ 
      success: true,
      message: `Berhasil memproses ${results.length} pengingat tugas (H-1).`,
      results 
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
