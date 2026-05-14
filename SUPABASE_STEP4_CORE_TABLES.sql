-- ============================================================================
-- STADIONE STEP 4: Core Application Data Tables (Missing)
-- ============================================================================
-- Creates: venues, news, coaches, tournament standings/schedule/bracket,
--          admin_audit_logs, chats, and sample data
-- ============================================================================

-- Venues
CREATE TABLE IF NOT EXISTS venues (
  id integer primary key,
  name text not null,
  city text,
  sport text,
  price integer,
  rating numeric,
  reviews integer,
  color text
);

CREATE TABLE IF NOT EXISTS venue_tags (
  venue_id integer references venues(id),
  tag text not null,
  primary key (venue_id, tag)
);

-- Tournament metadata tables
CREATE TABLE IF NOT EXISTS tournament_standings (
  tournament_id integer references tournaments(id),
  pos integer,
  team text,
  p integer,
  w integer,
  d integer,
  l integer,
  gf integer,
  ga integer,
  pts integer,
  primary key (tournament_id, pos)
);

CREATE TABLE IF NOT EXISTS tournament_schedule (
  tournament_id integer references tournaments(id),
  entry_id integer primary key,
  date text,
  home text,
  away text,
  score text,
  status text
);

CREATE TABLE IF NOT EXISTS tournament_bracket_rounds (
  id serial primary key,
  tournament_id integer references tournaments(id),
  round_order integer,
  name text
);

CREATE TABLE IF NOT EXISTS tournament_bracket_matches (
  id serial primary key,
  round_id integer references tournament_bracket_rounds(id),
  p1 text,
  p2 text,
  s1 integer,
  s2 integer,
  w integer
);

-- News
CREATE TABLE IF NOT EXISTS news (
  id integer primary key,
  category text,
  title text,
  excerpt text,
  author text,
  date text,
  read_time text,
  featured boolean,
  color text
);

-- Coaches
CREATE TABLE IF NOT EXISTS coaches (
  id integer primary key,
  name text,
  sport text,
  exp integer,
  rating numeric,
  sessions integer,
  price integer,
  initial text
);

CREATE TABLE IF NOT EXISTS coach_certs (
  coach_id integer references coaches(id),
  cert text,
  primary key(coach_id, cert)
);

CREATE TABLE IF NOT EXISTS coach_extra (
  coach_id integer primary key references coaches(id),
  bio text,
  location text
);

CREATE TABLE IF NOT EXISTS coach_languages (
  coach_id integer references coaches(id),
  language text,
  primary key(coach_id, language)
);

CREATE TABLE IF NOT EXISTS coach_schedule (
  coach_id integer references coaches(id),
  schedule_line text,
  primary key(coach_id, schedule_line)
);

CREATE TABLE IF NOT EXISTS coach_programs (
  coach_id integer references coaches(id),
  program_id integer,
  name text,
  price integer,
  duration text,
  description text,
  primary key(coach_id, program_id)
);

-- Chat
CREATE TABLE IF NOT EXISTS chats (
  id integer primary key,
  coach_id integer references coaches(id),
  name text,
  sport text,
  initial text,
  online boolean,
  last_msg text,
  time text,
  unread integer
);

CREATE TABLE IF NOT EXISTS chat_messages (
  chat_id integer references chats(id),
  message_id integer,
  sender text,
  text text,
  time text,
  primary key(chat_id, message_id)
);

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigserial primary key,
  actor_user_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_operator_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registration_roster ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid conflicts)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view venues" ON venues';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view news" ON news';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view coaches" ON coaches';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can read audit logs" ON admin_audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can write audit logs" ON admin_audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS "Public can view tournaments" ON tournaments';
  EXECUTE 'DROP POLICY IF EXISTS "Reviewer can update verification fields on tournaments" ON tournaments';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view role catalog" ON app_roles';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view permission catalog" ON app_permissions';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view role permission matrix" ON role_permissions';
  EXECUTE 'DROP POLICY IF EXISTS "Super admin can manage role permission matrix" ON role_permissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles';
  EXECUTE 'DROP POLICY IF EXISTS "Requester can create verification request" ON tournament_operator_verification_requests';
  EXECUTE 'DROP POLICY IF EXISTS "Requester can view own verification requests" ON tournament_operator_verification_requests';
  EXECUTE 'DROP POLICY IF EXISTS "Reviewer can view verification queue" ON tournament_operator_verification_requests';
  EXECUTE 'DROP POLICY IF EXISTS "Reviewer can update verification requests" ON tournament_operator_verification_requests';
  EXECUTE 'DROP POLICY IF EXISTS "User can create own tournament registration" ON tournament_registrations';
  EXECUTE 'DROP POLICY IF EXISTS "User can view own tournament registrations" ON tournament_registrations';
  EXECUTE 'DROP POLICY IF EXISTS "User can update own registration before approval" ON tournament_registrations';
  EXECUTE 'DROP POLICY IF EXISTS "Reviewer can view registration queue" ON tournament_registrations';
  EXECUTE 'DROP POLICY IF EXISTS "Reviewer can update registration queue" ON tournament_registrations';
  EXECUTE 'DROP POLICY IF EXISTS "User can manage own roster" ON tournament_registration_roster';
  EXECUTE 'DROP POLICY IF EXISTS "Reviewer can view roster queue" ON tournament_registration_roster';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Anyone can view venues" ON venues FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view news" ON news FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view coaches" ON coaches FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view role catalog" ON app_roles FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view permission catalog" ON app_permissions FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view role permission matrix" ON role_permissions FOR SELECT USING (TRUE);
CREATE POLICY "Super admin can manage role permission matrix" ON role_permissions FOR ALL USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage')) WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));
CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage user roles" ON user_roles FOR ALL USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage')) WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));
CREATE POLICY "Admins can read audit logs" ON admin_audit_logs FOR SELECT USING (public.has_app_role('super_admin') OR public.has_permission('audit.read'));
CREATE POLICY "Admins can write audit logs" ON admin_audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (public.has_app_role('super_admin') OR public.has_permission('audit.write')));
CREATE POLICY "Public can view tournaments" ON tournaments FOR SELECT USING (TRUE);
CREATE POLICY "Reviewer can update verification fields on tournaments" ON tournaments FOR UPDATE USING (public.is_admin_or_reviewer()) WITH CHECK (public.is_admin_or_reviewer());
CREATE POLICY "Requester can create verification request" ON tournament_operator_verification_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND requester_user_id = auth.uid()::text);
CREATE POLICY "Requester can view own verification requests" ON tournament_operator_verification_requests FOR SELECT USING (requester_user_id = auth.uid()::text);
CREATE POLICY "Reviewer can view verification queue" ON tournament_operator_verification_requests FOR SELECT USING (public.is_admin_or_reviewer());
CREATE POLICY "Reviewer can update verification requests" ON tournament_operator_verification_requests FOR UPDATE USING (public.is_admin_or_reviewer()) WITH CHECK (public.is_admin_or_reviewer());
CREATE POLICY "User can create own tournament registration" ON tournament_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can view own tournament registrations" ON tournament_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User can update own registration before approval" ON tournament_registrations FOR UPDATE USING (auth.uid() = user_id AND registration_status IN ('draft', 'waiting_payment', 'rejected')) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Reviewer can view registration queue" ON tournament_registrations FOR SELECT USING (public.is_admin_or_reviewer());
CREATE POLICY "Reviewer can update registration queue" ON tournament_registrations FOR UPDATE USING (public.is_admin_or_reviewer()) WITH CHECK (public.is_admin_or_reviewer());
CREATE POLICY "User can manage own roster" ON tournament_registration_roster FOR ALL USING (EXISTS (SELECT 1 FROM tournament_registrations tr WHERE tr.id = tournament_registration_roster.registration_id AND tr.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM tournament_registrations tr WHERE tr.id = tournament_registration_roster.registration_id AND tr.user_id = auth.uid()));
CREATE POLICY "Reviewer can view roster queue" ON tournament_registration_roster FOR SELECT USING (public.is_admin_or_reviewer());

-- Storage for Payment Proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Payment proof objects are publicly readable" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Payment proof objects are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');
CREATE POLICY "Authenticated users can upload payment proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Venues
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES
(1,'GOR Senayan Mini Soccer','Jakarta Pusat','Sepakbola',450000,4.8,234,'#0F4D2A'),
(2,'Lapangan Futsal Gelora','Bandung','Futsal',200000,4.6,189,'#1D4ED8'),
(3,'Arena Badminton Kelapa Gading','Jakarta Utara','Badminton',150000,4.7,312,'#7C3AED'),
(4,'GOR Basket Tanah Abang','Jakarta Pusat','Basket',300000,4.5,156,'#DC2626'),
(5,'Kolam Renang Senayan','Jakarta Pusat','Renang',75000,4.9,445,'#0891B2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO venue_tags (venue_id,tag) VALUES
(1,'Outdoor'),(1,'Parkir Luas'),(1,'Toilet'),(1,'Kantin'),
(2,'Indoor'),(2,'AC'),(2,'Toilet'),(2,'Parkir'),
(3,'Indoor'),(3,'AC'),(3,'Parkir'),(3,'Toilet'),
(4,'Indoor'),(4,'Tribun'),(4,'AC'),(4,'Parkir'),
(5,'Outdoor'),(5,'Olympic Size'),(5,'Tribun'),(5,'Toilet')
ON CONFLICT DO NOTHING;

-- News
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES
(1,'Sepakbola','Timnas U-23 Cetak Sejarah, Lolos Final Piala AFF','Garuda Muda menundukkan Vietnam 2-1 lewat gol dramatis di babak tambahan.','Rendy Pratama','07 Mei 2026','4 mnt',true,'#E11D2E'),
(2,'Futsal','Liga Futsal Jakarta 2026 Resmi Dimulai','Kompetisi futsal bergengsi Jakarta kembali hadir dengan format baru dan hadiah yang lebih besar.','Ahmad Fauzi','05 Mei 2026','3 mnt',false,'#D97706'),
(3,'Badminton','Kevin/Marcus Pertahankan Gelar All England','Pasangan ganda putra Indonesia kembali meraih gelar bergengsi All England untuk ketiga kalinya.','Sinta Dewi','03 Mei 2026','5 mnt',true,'#2563EB'),
(4,'Basket','IBL 2026: Satria Muda Tembus Babak Final','Tim basket asal Jakarta melaju ke final setelah mengalahkan Pacific Caesar 78-65.','Budi Santoso','01 Mei 2026','4 mnt',false,'#7C3AED'),
(5,'Renang','Atlet Renang Indonesia Pecahkan Rekor Nasional','Azzahra Permatahani memecahkan rekor nasional 100m gaya kupu-kupu di ajang Kejurnas.','Lila Puspita','29 Apr 2026','3 mnt',false,'#0891B2')
ON CONFLICT (id) DO NOTHING;

-- Coaches
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES
(1,'Coach Bambang Sutrisno','Sepakbola',12,4.9,234,250000,'BS'),
(2,'Coach Rina Marlina','Futsal',8,4.8,189,200000,'RM'),
(3,'Coach Hendra Wijaya','Badminton',15,4.7,312,300000,'HW'),
(4,'Coach Dini Pratiwi','Renang',10,4.9,156,180000,'DP'),
(5,'Coach Reza Firmansyah','Basket',7,4.6,98,220000,'RF')
ON CONFLICT (id) DO NOTHING;

INSERT INTO coach_extra (coach_id,bio,location) VALUES
(1,'Mantan pemain profesional Liga 1 dengan pengalaman melatih junior selama 12 tahun.','Jakarta Selatan'),
(2,'Pelatih futsal berpengalaman yang pernah membawa tim nasional futsal wanita ke semifinal Asia.','Bandung'),
(3,'Mantan atlet badminton nasional dengan koleksi medali SEA Games dan Asian Games.','Jakarta Timur'),
(4,'Pelatih renang tersertifikasi FINA yang fokus pada teknik dan kondisi fisik atlet muda.','Jakarta Pusat'),
(5,'Pelatih basket alumni universitas ternama AS dengan spesialisasi perimeter dan three-point shooting.','Surabaya')
ON CONFLICT (coach_id) DO NOTHING;

INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES
(1,1,'Latihan Dasar Teknik','250000','60 menit','Latihan teknik dasar passing, dribbling, dan shooting untuk pemula'),
(1,2,'Paket Premium 10 Sesi','2000000','10 sesi','Latihan intensif dengan program terstruktur untuk pemain menengah'),
(2,1,'Teknik Futsal Dasar','200000','60 menit','Teknik dasar futsal termasuk kontrol bola dan pergerakan'),
(3,1,'Smash & Defense Badminton','300000','90 menit','Fokus pada teknik smash dan pertahanan untuk pemain intermediate'),
(4,1,'Teknik Renang Gaya Bebas','180000','60 menit','Latihan teknik renang gaya bebas untuk semua level'),
(5,1,'Shooting & Dribbling Basket','220000','75 menit','Latihan shooting tiga angka dan dribbling lanjutan')
ON CONFLICT DO NOTHING;

-- Sample chats
INSERT INTO chats (id,coach_id,name,sport,initial,online,last_msg,time,unread) VALUES
(1,1,'Coach Bambang','Sepakbola','BS',true,'Sampai jumpa di sesi berikutnya!','10:30',0),
(2,3,'Coach Hendra','Badminton','HW',false,'Bagus, terus latihan ya','Kemarin',2)
ON CONFLICT (id) DO NOTHING;

-- Tournament sample data (update existing tournament if present)
UPDATE tournaments SET
  name = 'Liga Futsal Jakarta 2026',
  sport = 'Futsal',
  format = 'Liga',
  teams = 12,
  status = 'Berlangsung',
  prize = 50000000,
  reg_fee = 500000,
  start_date = '15 Mar 2026',
  color = '#92400E',
  host = 'StadioneSports',
  participants = 156,
  classification = 'official',
  operator_type = 'federation',
  is_verified = true,
  verification_status = 'approved'
WHERE id = 1;

-- Insert if not exists
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,reg_fee,start_date,color,host,participants,classification,operator_type,is_verified,verification_status)
VALUES (1,'Liga Futsal Jakarta 2026','Futsal','Liga',12,'Berlangsung',50000000,500000,'15 Mar 2026','#92400E','StadioneSports',156,'official','federation',true,'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tournaments (id,name,sport,format,teams,status,prize,reg_fee,start_date,color,host,participants,classification,operator_type,is_verified,verification_status)
VALUES
(2,'Turnamen Basket Antar Kampus','Basket','Gugur',8,'Pendaftaran',15000000,300000,'20 Jun 2026','#1D4ED8','Univ. Indonesia',0,'community','community_host',false,'unverified'),
(3,'Open Badminton Championship','Badminton','Round Robin',16,'Akan Datang',25000000,250000,'10 Jul 2026','#7C3AED','Badminton Club Jakarta',0,'official','eo_operator',true,'approved')
ON CONFLICT (id) DO NOTHING;

-- Tournament standings sample
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES
(1,1,'FC Garuda',6,5,1,0,18,5,16),
(1,2,'Bintang Timur FC',6,4,1,1,14,8,13),
(1,3,'Delta United',6,3,1,2,11,10,10),
(1,4,'Nusantara FC',6,2,2,2,9,9,8),
(1,5,'Persija Muda',6,1,2,3,7,13,5),
(1,6,'Harimau FC',6,0,1,5,4,18,1)
ON CONFLICT DO NOTHING;

SELECT '✅ Step 4 Complete: Core tables, RLS policies, and sample data created!' as status;
