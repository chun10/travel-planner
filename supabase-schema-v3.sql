-- ============================================
-- TripPlanner Schema v3 — 簡化版
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

-- ============================================
-- 索引 (提升查詢速度)
-- ============================================
CREATE INDEX idx_trip_days_trip_id ON trip_days(trip_id);
CREATE INDEX idx_trip_days_sort_order ON trip_days(sort_order);
CREATE INDEX idx_day_events_day_id ON day_events(day_id);
CREATE INDEX idx_day_events_sort_order ON day_events(sort_order);
CREATE INDEX idx_trip_links_trip_id ON trip_links(trip_id);
CREATE INDEX idx_trips_owner_id ON trips(owner_id);

-- ============================================
-- Row Level Security (簡化版)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_links ENABLE ROW LEVEL SECURITY;

-- Profiles: 所有人可讀，自己的可寫
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trips: 登入者可讀可寫
CREATE POLICY "trips_select" ON trips FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "trips_delete" ON trips FOR DELETE USING (auth.uid() IS NOT NULL);

-- Trip Days: 登入者可讀可寫
CREATE POLICY "trip_days_select" ON trip_days FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trip_days_insert" ON trip_days FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "trip_days_update" ON trip_days FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "trip_days_delete" ON trip_days FOR DELETE USING (auth.uid() IS NOT NULL);

-- Day Events: 登入者可讀可寫
CREATE POLICY "day_events_select" ON day_events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "day_events_insert" ON day_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "day_events_update" ON day_events FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "day_events_delete" ON day_events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Trip Links: 登入者可讀可寫
CREATE POLICY "trip_links_select" ON trip_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trip_links_insert" ON trip_links FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "trip_links_update" ON trip_links FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "trip_links_delete" ON trip_links FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================
-- Realtime (已停用，用輪詢代替)
-- ============================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE trips;
-- ALTER PUBLICATION supabase_realtime ADD TABLE trip_days;
-- ALTER PUBLICATION supabase_realtime ADD TABLE day_events;
-- ALTER PUBLICATION supabase_realtime ADD TABLE trip_links;

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
