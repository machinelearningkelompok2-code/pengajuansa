-- ======================================================================================
-- SCRIPT KEAMANAN DATABASE (ROW LEVEL SECURITY - RLS)
-- ======================================================================================
-- Instruksi:
-- 1. Buka dashboard Supabase proyek Anda
-- 2. Masuk ke menu "SQL Editor"
-- 3. Salin semua kode di bawah ini, lalu jalankan (klik Run)
-- ======================================================================================

-- 1. Aktifkan RLS pada tabel-tabel utama
ALTER TABLE pendaftaran_sa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendaftaran_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengumpulan_tugas ENABLE ROW LEVEL SECURITY;

-- 2. Kebijakan (Policy) untuk tabel pendaftaran_sa
-- Mahasiswa hanya bisa melihat data pendaftarannya sendiri
CREATE POLICY "Mahasiswa dapat melihat pendaftaran mereka sendiri" 
ON pendaftaran_sa FOR SELECT 
USING (auth.uid() = mahasiswa_id);

-- Dosen, Kaprodi, Sekjur, Akademik (yang punya session login sah) bisa melihat semua
CREATE POLICY "Staf dapat melihat semua pendaftaran" 
ON pendaftaran_sa FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() != mahasiswa_id);

-- 3. Kebijakan (Policy) untuk tabel pembayaran
-- Mahasiswa hanya bisa menginsert/melihat pembayaran miliknya sendiri
CREATE POLICY "Mahasiswa insert pembayaran sendiri" 
ON pembayaran FOR INSERT 
WITH CHECK (auth.uid() = mahasiswa_id);

CREATE POLICY "Mahasiswa lihat pembayaran sendiri" 
ON pembayaran FOR SELECT 
USING (auth.uid() = mahasiswa_id);

CREATE POLICY "Staf lihat semua pembayaran" 
ON pembayaran FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() != mahasiswa_id);

-- 4. Kebijakan (Policy) untuk tabel tugas & pengumpulan
-- Dosen bisa membuat dan mengedit tugas
CREATE POLICY "Dosen kelola tugas" 
ON tugas FOR ALL 
USING (auth.uid() = dosen_id);

-- Mahasiswa bisa melihat tugas untuknya
CREATE POLICY "Mahasiswa lihat tugas" 
ON tugas FOR SELECT 
USING (auth.uid() = mahasiswa_id);

-- Mahasiswa bisa insert & update tugas mereka sendiri
CREATE POLICY "Mahasiswa kelola pengumpulan" 
ON pengumpulan_tugas FOR ALL 
USING (auth.uid() = mahasiswa_id);

-- Dosen bisa melihat & menilai pengumpulan
CREATE POLICY "Dosen update nilai pengumpulan" 
ON pengumpulan_tugas FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Dosen lihat pengumpulan" 
ON pengumpulan_tugas FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- ======================================================================================
-- SELESAI
-- ======================================================================================
