-- ============================================================
-- Migration 002 — Ministry Platform
-- Run in Supabase SQL editor
-- ============================================================

-- ─── Posts (content/announcements) ───────────────────────────

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  author_id    uuid not null references profiles(id) on delete cascade,
  title        text not null,
  content      text not null default '',     -- HTML from Tiptap
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index posts_org_idx on posts(org_id);

alter table posts enable row level security;

create policy "org members can read published posts"
  on posts for select
  using (
    org_id = get_my_org_id()
    and (published = true or author_id = auth.uid())
  );

create policy "org members can insert posts"
  on posts for insert
  with check (org_id = get_my_org_id() and author_id = auth.uid());

create policy "authors can update their posts"
  on posts for update
  using (author_id = auth.uid() and org_id = get_my_org_id());

create policy "admins can delete posts"
  on posts for delete
  using (
    org_id = get_my_org_id()
    and get_my_role() in ('org_admin', 'super_admin')
  );

-- ─── Conversations ────────────────────────────────────────────

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text,                           -- null = direct message
  is_group    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index conversations_org_idx on conversations(org_id);

alter table conversations enable row level security;

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

alter table conversation_members enable row level security;

-- Members can see conversations they belong to
create policy "members can read their conversations"
  on conversations for select
  using (
    org_id = get_my_org_id()
    and exists (
      select 1 from conversation_members cm
      where cm.conversation_id = id
        and cm.profile_id = auth.uid()
    )
  );

create policy "members can create conversations"
  on conversations for insert
  with check (org_id = get_my_org_id());

create policy "members can read conversation membership"
  on conversation_members for select
  using (
    exists (
      select 1 from conversation_members cm2
      where cm2.conversation_id = conversation_id
        and cm2.profile_id = auth.uid()
    )
  );

create policy "members can join conversations"
  on conversation_members for insert
  with check (profile_id = auth.uid());

-- ─── Messages ────────────────────────────────────────────────

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on messages(conversation_id, created_at desc);

alter table messages enable row level security;

create policy "members can read messages in their conversations"
  on messages for select
  using (
    exists (
      select 1 from conversation_members cm
      join conversations c on c.id = cm.conversation_id
      where cm.conversation_id = messages.conversation_id
        and cm.profile_id = auth.uid()
        and c.org_id = get_my_org_id()
    )
  );

create policy "members can send messages"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversation_members cm
      join conversations c on c.id = cm.conversation_id
      where cm.conversation_id = conversation_id
        and cm.profile_id = auth.uid()
        and c.org_id = get_my_org_id()
    )
  );

-- ─── Sessions (live video) ────────────────────────────────────

create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  chaplain_id     uuid not null references profiles(id) on delete cascade,
  title           text not null,
  description     text,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  livekit_room    text,                       -- LiveKit room name (populated when live)
  recording_url   text,                       -- post-session recording
  created_at      timestamptz not null default now()
);

create index sessions_org_idx on sessions(org_id, scheduled_at desc);

alter table sessions enable row level security;

create policy "org members can view sessions"
  on sessions for select
  using (org_id = get_my_org_id());

create policy "chaplains and admins can create sessions"
  on sessions for insert
  with check (
    org_id = get_my_org_id()
    and chaplain_id = auth.uid()
    and get_my_role() in ('chaplain', 'org_admin', 'super_admin')
  );

create policy "chaplains and admins can update sessions"
  on sessions for update
  using (
    org_id = get_my_org_id()
    and (chaplain_id = auth.uid() or get_my_role() in ('org_admin', 'super_admin'))
  );

-- ─── Session Participants ─────────────────────────────────────

create table if not exists session_participants (
  session_id   uuid not null references sessions(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  primary key (session_id, profile_id)
);

alter table session_participants enable row level security;

create policy "members can read session participants"
  on session_participants for select
  using (
    exists (
      select 1 from sessions s
      where s.id = session_id and s.org_id = get_my_org_id()
    )
  );

create policy "members can join sessions"
  on session_participants for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from sessions s
      where s.id = session_id and s.org_id = get_my_org_id()
    )
  );

-- ─── Videos (library) ────────────────────────────────────────

create table if not exists videos (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  uploaded_by     uuid not null references profiles(id) on delete cascade,
  title           text not null,
  description     text,
  mux_asset_id    text,                       -- Mux asset ID
  mux_playback_id text,                       -- Mux playback ID
  thumbnail_url   text,
  duration_secs   integer,
  published       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index videos_org_idx on videos(org_id, created_at desc);

alter table videos enable row level security;

create policy "org members can view published videos"
  on videos for select
  using (
    org_id = get_my_org_id()
    and (published = true or uploaded_by = auth.uid())
  );

create policy "admins can insert videos"
  on videos for insert
  with check (
    org_id = get_my_org_id()
    and get_my_role() in ('org_admin', 'super_admin', 'chaplain')
  );

create policy "uploaders and admins can update videos"
  on videos for update
  using (
    org_id = get_my_org_id()
    and (uploaded_by = auth.uid() or get_my_role() in ('org_admin', 'super_admin'))
  );

-- ─── AI Conversations ─────────────────────────────────────────

create table if not exists ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create index ai_conversations_user_idx on ai_conversations(user_id, created_at desc);

alter table ai_conversations enable row level security;

create policy "users can manage their own ai conversations"
  on ai_conversations for all
  using (user_id = auth.uid() and org_id = get_my_org_id())
  with check (user_id = auth.uid() and org_id = get_my_org_id());

-- ─── AI Messages ──────────────────────────────────────────────

create table if not exists ai_messages (
  id                  uuid primary key default gen_random_uuid(),
  ai_conversation_id  uuid not null references ai_conversations(id) on delete cascade,
  role                text not null check (role in ('user', 'assistant')),
  content             text not null,
  created_at          timestamptz not null default now()
);

create index ai_messages_conv_idx on ai_messages(ai_conversation_id, created_at asc);

alter table ai_messages enable row level security;

create policy "users can manage messages in their own ai conversations"
  on ai_messages for all
  using (
    exists (
      select 1 from ai_conversations ac
      where ac.id = ai_conversation_id
        and ac.user_id = auth.uid()
        and ac.org_id = get_my_org_id()
    )
  )
  with check (
    exists (
      select 1 from ai_conversations ac
      where ac.id = ai_conversation_id
        and ac.user_id = auth.uid()
        and ac.org_id = get_my_org_id()
    )
  );

-- ─── Enable Realtime for messages ────────────────────────────

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table sessions;
