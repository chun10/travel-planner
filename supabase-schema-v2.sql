-- ============================================
-- TripPlanner Schema v2 — 完整版
-- 到 Supabase Dashboard → SQL Editor 貼上執行
-- ============================================

-- 清除舊的
DROP TABLE IF EXISTS trip_collaborators CASCADE;
DROP TABLE IF EXISTS trip_links CASCADE;
DROP TABLE IF EXISTS day_events CASCADE;
DROP TABLE IF EXISTS trip_days CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 1. 使用者簡介
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 旅行計畫主表
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Trip',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 每天行程
CREATE TABLE trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '自由活動',
  notes TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 每個行程事件
CREATE TABLE day_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  time TEXT NOT NULL DEFAULT '12:00',
  location_name TEXT NOT NULL DEFAULT '',
  coordinates JSONB DEFAULT '{"lat":0,"lng":0}'::jsonb,
  description TEXT DEFAULT '',
  event_type TEXT DEFAULT 'default',
  transport_to_next JSONB DEFAULT NULL,
  links JSONB DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 常用連結
CREATE TABLE trip_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 協作者
CREATE TABLE trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "select_profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trips
CREATE POLICY "select_trips" ON trips FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_trips" ON trips FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update_trips" ON trips FOR UPDATE
  USING (owner_id = auth.uid() OR id IN (SELECT trip_id FROM trip_collaborators WHERE user_id = auth.uid()));
CREATE POLICY "delete_trips" ON trips FOR DELETE
  USING (owner_id = auth.uid());

-- Trip Days
CREATE POLICY "select_trip_days" ON trip_days FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_trip_days" ON trip_days FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update_trip_days" ON trip_days FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "delete_trip_days" ON trip_days FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Day Events
CREATE POLICY "select_day_events" ON day_events FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_day_events" ON day_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update_day_events" ON day_events FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "delete_day_events" ON day_events FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trip Links
CREATE POLICY "select_trip_links" ON trip_links FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_trip_links" ON trip_links FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update_trip_links" ON trip_links FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "delete_trip_links" ON trip_links FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Collaborators
CREATE POLICY "select_collaborators" ON trip_collaborators FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_collaborators" ON trip_collaborators FOR INSERT
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));
CREATE POLICY "delete_collaborators" ON trip_collaborators FOR DELETE
  USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));

-- ============================================
-- Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_days;
ALTER PUBLICATION supabase_realtime ADD TABLE day_events;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_links;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_collaborators;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- ============================================
-- 自動建立 profile
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), '訪客'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
