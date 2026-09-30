-- add scheduling

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  passwordHash text not null,
  name text not null,
  slug text not null unique,
  headline text not null default '',
  timeZone text not null default 'UTC'
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

create table meetingTypes (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  durationMinutes integer not null check (durationMinutes between 5 and 480),
  bufferMinutes integer not null default 0 check (bufferMinutes between 0 and 240),
  active boolean not null default true,
  unique (userId, slug)
);

create trigger meetingTypesTouchUpdatedAt
  before update on meetingTypes
  for each row execute function touchUpdatedAt();

-- One row per window: a day can have a morning and an afternoon.
create table availabilityRules (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  startTime time not null,
  endTime time not null,
  check (endTime > startTime)
);

create index availabilityRulesUserIdx on availabilityRules (userId, weekday);

create trigger availabilityRulesTouchUpdatedAt
  before update on availabilityRules
  for each row execute function touchUpdatedAt();

-- Any row for a date replaces that weekday's hours. A row with no times marks
-- the whole day unavailable.
create table dateOverrides (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  date date not null,
  startTime time,
  endTime time,
  check ((startTime is null and endTime is null) or endTime > startTime)
);

create index dateOverridesUserIdx on dateOverrides (userId, date);

create trigger dateOverridesTouchUpdatedAt
  before update on dateOverrides
  for each row execute function touchUpdatedAt();

create table bookings (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  meetingTypeId uuid not null references meetingTypes(id) on delete cascade,
  guestName text not null,
  guestEmail text not null,
  guestNote text not null default '',
  guestTimeZone text not null default 'UTC',
  startsAt timestamptz not null,
  endsAt timestamptz not null,
  -- Copied from the meeting type so editing the type does not move old bookings' buffers.
  bufferMinutes integer not null default 0,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  -- The guest has no account; this token in their email links is their key.
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  -- Bumped on every change so calendar apps replace the earlier invite.
  sequence integer not null default 0,
  reminderSentAt timestamptz,
  cancelledAt timestamptz,
  check (endsAt > startsAt)
);

create index bookingsUserStartsIdx on bookings (userId, startsAt);
create index bookingsReminderIdx on bookings (startsAt) where status = 'confirmed' and reminderSentAt is null;

create trigger bookingsTouchUpdatedAt
  before update on bookings
  for each row execute function touchUpdatedAt();

-- Every open start time for a meeting type in [pFrom, pTo). Weekly hours and
-- overrides are wall-clock times in the host's zone, converted per date so a
-- daylight saving change lands on the right instant. A slot is open when the
-- gap to every confirmed booking is at least the larger of the two buffers.
create or replace function openSlots(
  pMeetingTypeId uuid,
  pFrom timestamptz,
  pTo timestamptz,
  pIgnoreBookingId uuid default null
)
returns table (startsAt timestamptz)
language sql
stable
as $$
  with mt as (
    select m.userId, m.durationMinutes, m.bufferMinutes, u.timeZone
      from meetingTypes m
      join users u on u.id = m.userId
     where m.id = pMeetingTypeId
       and m.active
  ),
  days as (
    select d::date as day
      from mt,
           generate_series(
             (pFrom at time zone mt.timeZone)::date,
             (pTo at time zone mt.timeZone)::date,
             interval '1 day'
           ) d
  ),
  windows as (
    select days.day, o.startTime, o.endTime
      from days
      join mt on true
      join dateOverrides o on o.userId = mt.userId and o.date = days.day
     where o.startTime is not null
    union all
    select days.day, r.startTime, r.endTime
      from days
      join mt on true
      join availabilityRules r on r.userId = mt.userId and r.weekday = extract(dow from days.day)
     where not exists (
       select 1 from dateOverrides o where o.userId = mt.userId and o.date = days.day
     )
  ),
  candidates as (
    select s as startsAt
      from windows
      join mt on true,
           generate_series(
             (windows.day + windows.startTime) at time zone mt.timeZone,
             ((windows.day + windows.endTime) at time zone mt.timeZone) - make_interval(mins => mt.durationMinutes),
             make_interval(mins => mt.durationMinutes)
           ) s
  )
  select c.startsAt
    from candidates c
    join mt on true
   where c.startsAt >= pFrom
     and c.startsAt < pTo
     and c.startsAt > now()
     and not exists (
       select 1
         from bookings b
        where b.userId = mt.userId
          and b.status = 'confirmed'
          and b.id is distinct from pIgnoreBookingId
          and tstzrange(
                b.startsAt - make_interval(mins => greatest(b.bufferMinutes, mt.bufferMinutes)),
                b.endsAt + make_interval(mins => greatest(b.bufferMinutes, mt.bufferMinutes))
              ) && tstzrange(c.startsAt, c.startsAt + make_interval(mins => mt.durationMinutes))
     )
   order by c.startsAt
$$;
