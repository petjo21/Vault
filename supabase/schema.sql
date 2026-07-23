-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)

-- Albums
create table albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  created_at timestamptz default now()
);

-- Memories (photos/videos)
create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  album_id uuid references albums on delete set null,
  storage_path text not null,       -- path inside the 'memories' storage bucket
  media_type text not null,          -- 'photo' or 'video'
  caption text,
  taken_at date,                     -- for timeline sorting; falls back to created_at
  created_at timestamptz default now()
);

-- Tags
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  unique (user_id, name)
);

-- Many-to-many: memory <-> tag
create table memory_tags (
  memory_id uuid references memories on delete cascade,
  tag_id uuid references tags on delete cascade,
  primary key (memory_id, tag_id)
);

-- Row Level Security: every user only sees their own data
alter table albums enable row level security;
alter table memories enable row level security;
alter table tags enable row level security;
alter table memory_tags enable row level security;

create policy "own albums" on albums for all using (auth.uid() = user_id);
create policy "own memories" on memories for all using (auth.uid() = user_id);
create policy "own tags" on tags for all using (auth.uid() = user_id);
create policy "own memory_tags" on memory_tags for all using (
  exists (select 1 from memories m where m.id = memory_id and m.user_id = auth.uid())
);

-- After running this, go to Storage -> create a bucket named "memories" (private),
-- then add a storage policy so users can only access their own folder (see README).
