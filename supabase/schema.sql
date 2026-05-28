-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alokasi_dosen (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mk_id uuid,
  dosen_id uuid,
  tahun_akademik text,
  created_at timestamp with time zone DEFAULT now(),
  pendaftaran_id uuid,
  CONSTRAINT alokasi_dosen_pkey PRIMARY KEY (id),
  CONSTRAINT alokasi_dosen_mk_id_fkey FOREIGN KEY (mk_id) REFERENCES public.mata_kuliah(id),
  CONSTRAINT alokasi_dosen_dosen_id_fkey FOREIGN KEY (dosen_id) REFERENCES public.users(id),
  CONSTRAINT alokasi_dosen_pendaftaran_id_fkey FOREIGN KEY (pendaftaran_id) REFERENCES public.pendaftaran_sa(id)
);
CREATE TABLE public.dosen (
  id uuid NOT NULL,
  nip text NOT NULL UNIQUE,
  nama_dosen text NOT NULL,
  jurusan text,
  prodi text,
  status text DEFAULT 'Aktif'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dosen_pkey PRIMARY KEY (id),
  CONSTRAINT dosen_id_fkey FOREIGN KEY (id) REFERENCES public.users(id)
);
CREATE TABLE public.jurusan (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nama_jurusan text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT jurusan_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mahasiswa (
  id uuid NOT NULL,
  nim text NOT NULL UNIQUE,
  nama_mahasiswa text NOT NULL,
  jurusan text,
  prodi text,
  ipk double precision,
  semester integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT mahasiswa_pkey PRIMARY KEY (id),
  CONSTRAINT mahasiswa_id_fkey FOREIGN KEY (id) REFERENCES public.users(id)
);
CREATE TABLE public.mata_kuliah (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  kode_mk text NOT NULL UNIQUE,
  nama_mk text NOT NULL,
  sks integer,
  semester_asal integer,
  status_buka boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  jurusan text,
  prodi text,
  CONSTRAINT mata_kuliah_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pembayaran (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pendaftaran_id uuid,
  bukti_url text,
  status_verifikasi text DEFAULT 'Pending'::text,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pembayaran_pkey PRIMARY KEY (id),
  CONSTRAINT pembayaran_pendaftaran_id_fkey FOREIGN KEY (pendaftaran_id) REFERENCES public.pendaftaran_sa(id),
  CONSTRAINT pembayaran_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id)
);
CREATE TABLE public.pendaftaran_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pendaftaran_id uuid,
  mk_id uuid,
  nilai_lama text,
  dosen_id uuid,
  CONSTRAINT pendaftaran_items_pkey PRIMARY KEY (id),
  CONSTRAINT pendaftaran_items_pendaftaran_id_fkey FOREIGN KEY (pendaftaran_id) REFERENCES public.pendaftaran_sa(id),
  CONSTRAINT pendaftaran_items_mk_id_fkey FOREIGN KEY (mk_id) REFERENCES public.mata_kuliah(id),
  CONSTRAINT pendaftaran_items_dosen_id_fkey FOREIGN KEY (dosen_id) REFERENCES public.users(id)
);
CREATE TABLE public.pendaftaran_sa (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mahasiswa_id uuid,
  kode_pendaftaran text UNIQUE,
  status text DEFAULT 'Draft'::text,
  biaya_pendaftaran numeric,
  catatan_sekjur text,
  catatan_kaprodi text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pendaftaran_sa_pkey PRIMARY KEY (id),
  CONSTRAINT pendaftaran_sa_mahasiswa_id_fkey FOREIGN KEY (mahasiswa_id) REFERENCES public.mahasiswa(id)
);
CREATE TABLE public.pengaturan (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pengaturan_pkey PRIMARY KEY (key)
);
CREATE TABLE public.pengumpulan_tugas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tugas_id uuid,
  mahasiswa_id uuid,
  file_url text,
  nilai integer,
  CONSTRAINT pengumpulan_tugas_pkey PRIMARY KEY (id),
  CONSTRAINT pengumpulan_tugas_tugas_id_fkey FOREIGN KEY (tugas_id) REFERENCES public.tugas(id),
  CONSTRAINT pengumpulan_tugas_mahasiswa_id_fkey FOREIGN KEY (mahasiswa_id) REFERENCES public.mahasiswa(id)
);
CREATE TABLE public.prodi (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  jurusan_id uuid,
  nama_prodi text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prodi_pkey PRIMARY KEY (id),
  CONSTRAINT prodi_jurusan_id_fkey FOREIGN KEY (jurusan_id) REFERENCES public.jurusan(id)
);
CREATE TABLE public.tugas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mk_id uuid,
  dosen_id uuid,
  judul text NOT NULL,
  deskripsi text,
  deadline timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  mahasiswa_id uuid,
  CONSTRAINT tugas_pkey PRIMARY KEY (id),
  CONSTRAINT tugas_mk_id_fkey FOREIGN KEY (mk_id) REFERENCES public.mata_kuliah(id),
  CONSTRAINT tugas_dosen_id_fkey FOREIGN KEY (dosen_id) REFERENCES public.users(id),
  CONSTRAINT tugas_mahasiswa_id_fkey FOREIGN KEY (mahasiswa_id) REFERENCES public.mahasiswa(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  nim_nip text UNIQUE,
  nama_lengkap text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'dosen'::text, 'sekjur'::text, 'kaprodi'::text, 'mahasiswa'::text])),
  jurusan text,
  prodi text,
  ipk numeric,
  semester integer,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- ==========================================================
-- KEBIJAKAN KEAMANAN (ROW LEVEL SECURITY)
-- ==========================================================

ALTER TABLE pendaftaran_sa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mahasiswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE dosen ENABLE ROW LEVEL SECURITY;
ALTER TABLE mata_kuliah ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendaftaran_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alokasi_dosen ENABLE ROW LEVEL SECURITY;
ALTER TABLE tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengumpulan_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prodi ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurusan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and owner view pendaftaran" ON pendaftaran_sa;
CREATE POLICY "Staff and owner view pendaftaran" ON pendaftaran_sa FOR SELECT TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('sekjur', 'admin', 'kaprodi') OR auth.uid() = mahasiswa_id);

DROP POLICY IF EXISTS "Mhs can insert pendaftaran" ON pendaftaran_sa;
CREATE POLICY "Mhs can insert pendaftaran" ON pendaftaran_sa FOR INSERT TO authenticated WITH CHECK (auth.uid() = mahasiswa_id);

DROP POLICY IF EXISTS "Staff and owner view pembayaran" ON pembayaran;
CREATE POLICY "Staff and owner view pembayaran" ON pembayaran FOR SELECT TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('sekjur', 'admin', 'kaprodi') OR EXISTS (SELECT 1 FROM pendaftaran_sa WHERE pendaftaran_sa.id = pembayaran.pendaftaran_id AND pendaftaran_sa.mahasiswa_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view all profiles" ON users;
CREATE POLICY "Users can view all profiles" ON users FOR SELECT TO authenticated USING (true);

-- Kebijakan untuk Tabel Mahasiswa
DROP POLICY IF EXISTS "Admins and staff can view all students" ON mahasiswa;
CREATE POLICY "Admins and staff can view all students" ON mahasiswa FOR SELECT TO authenticated USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'sekjur', 'kaprodi', 'dosen') 
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'sekjur', 'kaprodi', 'dosen'))
  OR auth.uid() = id
);

-- Kebijakan untuk Tabel Dosen
DROP POLICY IF EXISTS "All authenticated can view dosen" ON dosen;
CREATE POLICY "All authenticated can view dosen" ON dosen FOR SELECT TO authenticated USING (true);

-- Kebijakan untuk Tabel Mata Kuliah
DROP POLICY IF EXISTS "All authenticated can view mata_kuliah" ON mata_kuliah;
CREATE POLICY "All authenticated can view mata_kuliah" ON mata_kuliah FOR SELECT TO authenticated USING (true);

-- Kebijakan untuk Tabel Pendaftaran Items
DROP POLICY IF EXISTS "Users can view pendaftaran items" ON pendaftaran_items;
CREATE POLICY "Users can view pendaftaran items" ON pendaftaran_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM pendaftaran_sa 
    WHERE pendaftaran_sa.id = pendaftaran_items.pendaftaran_id 
    AND ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('sekjur', 'admin', 'kaprodi', 'dosen') OR pendaftaran_sa.mahasiswa_id = auth.uid())
  )
);

-- Kebijakan untuk Tabel Tugas & Pengumpulan
DROP POLICY IF EXISTS "All view tugas" ON tugas;
CREATE POLICY "All view tugas" ON tugas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Dosen can manage tugas" ON tugas;
CREATE POLICY "Dosen can manage tugas" ON tugas FOR ALL TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'dosen'));

DROP POLICY IF EXISTS "Users can view submissions" ON pengumpulan_tugas;
CREATE POLICY "Users can view submissions" ON pengumpulan_tugas FOR SELECT TO authenticated USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'dosen') OR mahasiswa_id = auth.uid()
);

-- Kebijakan untuk Referensi (Jurusan/Prodi)
DROP POLICY IF EXISTS "Public view jurusan prodi" ON jurusan;
CREATE POLICY "Public view jurusan prodi" ON jurusan FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public view prodi" ON prodi;
CREATE POLICY "Public view prodi" ON prodi FOR SELECT TO authenticated USING (true);

-- ==========================================================
-- DATA AWAL (SEED DATA)
-- ==========================================================

INSERT INTO jurusan (nama_jurusan) VALUES
('Teknik Elektro'), ('Teknik Mesin'), ('Teknik Sipil'), ('Akuntansi'), ('Administrasi Bisnis'), ('Pariwisata')
ON CONFLICT (nama_jurusan) DO NOTHING;

DO $$
DECLARE
    id_elektro UUID; id_mesin UUID; id_sipil UUID; id_akuntansi UUID; id_bisnis UUID; id_pariwisata UUID;
BEGIN
    SELECT id INTO id_elektro FROM jurusan WHERE nama_jurusan = 'Teknik Elektro';
    SELECT id INTO id_mesin FROM jurusan WHERE nama_jurusan = 'Teknik Mesin';
    SELECT id INTO id_sipil FROM jurusan WHERE nama_jurusan = 'Teknik Sipil';
    SELECT id INTO id_akuntansi FROM jurusan WHERE nama_jurusan = 'Akuntansi';
    SELECT id INTO id_bisnis FROM jurusan WHERE nama_jurusan = 'Administrasi Bisnis';
    SELECT id INTO id_pariwisata FROM jurusan WHERE nama_jurusan = 'Pariwisata';

    INSERT INTO prodi (jurusan_id, nama_prodi) VALUES
    (id_elektro, 'D-4 Listrik'), (id_elektro, 'D-3 Listrik'), (id_elektro, 'D-4 Informatika'),
    (id_mesin, 'D-3 Teknologi Rekayasa Mekatronika'), (id_mesin, 'D-4 Teknik Mesin Produksi dan Perawatan'),
    (id_sipil, 'D-3 Teknik Sipil'), (id_sipil, 'D-4 Konstruksi Bangunan'), (id_sipil, 'D-4 Teknik Konstruksi Jalan dan Jembatan'),
    (id_akuntansi, 'D-4 Akuntansi Keuangan'), (id_akuntansi, 'D-3 Akuntansi'), (id_akuntansi, 'D-3 Akuntansi Perpajakan'),
    (id_bisnis, 'D-3 Administrasi Bisnis'), (id_bisnis, 'D-4 Manajemen Bisnis'),
    (id_pariwisata, 'D-3 Perhotelan'), (id_pariwisata, 'D-3 Usaha Perjalanan Wisata'), (id_pariwisata, 'D-3 Ekowisata Bawah Laut'), (id_pariwisata, 'D-4 Manajemen Perhotelan')
    ON CONFLICT (nama_prodi) DO NOTHING;
END $$;

INSERT INTO users (email, password, nim_nip, nama_lengkap, role, jurusan, prodi, ipk, semester) VALUES
('admin@polimdo.ac.id', 'admin123', '1001', 'Admin Utama', 'admin', 'Teknik Elektro', 'D-4 Informatika', 4.0, 1),
('dosen@polimdo.ac.id', 'dosen123', '2001', 'Dr. Johannes Surya', 'dosen', 'Teknik Elektro', 'D-4 Informatika', 0.0, 0),
('sekjur@polimdo.ac.id', 'sekjur123', '3001', 'Herry S. Langi, MT', 'sekjur', 'Teknik Elektro', 'D-4 Informatika', 0.0, 0),
('kaprodi@polimdo.ac.id', 'kaprodi123', '4001', 'Ir. Maryam, M.Kom', 'kaprodi', 'Teknik Elektro', 'D-4 Informatika', 0.0, 0),
('mahasiswa@polimdo.ac.id', 'mhs123', '22041011', 'Andi Saputra', 'mahasiswa', 'Teknik Elektro', 'D-4 Informatika', 3.75, 6)
ON CONFLICT (email) DO NOTHING;
