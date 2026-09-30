-- demo hosts for local work
/** @env development */

insert into users (email, passwordHash, name, slug, headline, timeZone) values
  ('maya@slotnook.dev', crypt('slotnook-demo', genSalt('bf', 12)), 'Maya Chen', 'maya', 'Product strategy for early-stage teams', 'America/Los_Angeles'),
  ('jonas@slotnook.dev', crypt('slotnook-demo', genSalt('bf', 12)), 'Jonas Weber', 'jonas', 'Growth and pricing for B2B software', 'Europe/Berlin');

insert into meetingTypes (userId, slug, name, description, durationMinutes, bufferMinutes)
  select u.id, t.slug, t.name, t.description, t.durationMinutes, t.bufferMinutes
    from users u
    join (values
      ('maya', 'intro', 'Intro call', 'A quick first conversation to see whether we are a fit.', 15, 5),
      ('maya', 'strategy', 'Strategy session', 'A working hour on your roadmap, positioning, or next launch. Bring your hardest question.', 60, 15),
      ('maya', 'portfolio-review', 'Portfolio review', 'I read your product portfolio ahead of time and we walk through what to cut and what to double down on.', 45, 10),
      ('jonas', 'discovery', 'Discovery call', 'Tell me where growth has stalled and I will tell you honestly whether I can help.', 30, 10),
      ('jonas', 'pricing-audit', 'Pricing audit', 'A deep review of your pricing page, packaging and plan limits, with a written follow-up.', 90, 15)
    ) as t(host, slug, name, description, durationMinutes, bufferMinutes)
      on t.host = u.slug;

insert into availabilityRules (userId, weekday, startTime, endTime)
  select u.id, w.weekday, w.startTime::time, w.endTime::time
    from users u
    join (values
      ('maya', 1, '09:00', '12:00'), ('maya', 1, '13:00', '17:00'),
      ('maya', 2, '09:00', '12:00'), ('maya', 2, '13:00', '17:00'),
      ('maya', 3, '09:00', '12:00'), ('maya', 3, '13:00', '17:00'),
      ('maya', 4, '09:00', '12:00'), ('maya', 4, '13:00', '17:00'),
      ('maya', 5, '09:00', '13:00'),
      ('jonas', 1, '08:30', '12:30'), ('jonas', 1, '14:00', '18:00'),
      ('jonas', 2, '08:30', '12:30'), ('jonas', 2, '14:00', '18:00'),
      ('jonas', 3, '08:30', '12:30'), ('jonas', 3, '14:00', '18:00'),
      ('jonas', 4, '08:30', '12:30'), ('jonas', 4, '14:00', '18:00')
    ) as w(host, weekday, startTime, endTime)
      on w.host = u.slug;

-- Weekdays counted from today in each host's zone, so the demo stays upcoming
-- whenever the database is built.
create temporary table demoDays on commit drop as
  select u.slug as host,
         d::date as day,
         row_number() over (partition by u.slug order by d) as n
    from users u,
         generate_series((now() at time zone u.timeZone)::date + 1, (now() at time zone u.timeZone)::date + 30, interval '1 day') d
   where extract(isodow from d) between 1 and 4;

-- Maya is off on her fourth working day; Jonas starts late on his fifth.
insert into dateOverrides (userId, date, startTime, endTime)
  select u.id, dd.day, null, null
    from users u join demoDays dd on dd.host = u.slug
   where u.slug = 'maya' and dd.n = 4;

insert into dateOverrides (userId, date, startTime, endTime)
  select u.id, dd.day, '11:00'::time, '15:00'::time
    from users u join demoDays dd on dd.host = u.slug
   where u.slug = 'jonas' and dd.n = 5;

insert into bookings (userId, meetingTypeId, guestName, guestEmail, guestNote, guestTimeZone, startsAt, endsAt, bufferMinutes)
  select u.id,
         m.id,
         b.guestName,
         b.guestEmail,
         b.guestNote,
         b.guestTimeZone,
         (dd.day + b.at::time) at time zone u.timeZone,
         (dd.day + b.at::time) at time zone u.timeZone + make_interval(mins => m.durationMinutes),
         m.bufferMinutes
    from (values
      ('maya', 'strategy', 1, '10:00', 'Priya Nair', 'priya@example.com', 'We are deciding between two launch plans for Q4.', 'America/New_York'),
      ('maya', 'intro', 1, '14:00', 'Leo Martins', 'leo@example.com', '', 'America/Sao_Paulo'),
      ('maya', 'portfolio-review', 2, '09:00', 'Hana Sato', 'hana@example.com', 'Deck attached to the follow-up email.', 'Asia/Tokyo'),
      ('maya', 'strategy', 3, '13:00', 'Sam Okafor', 'sam@example.com', '', 'Europe/London'),
      ('jonas', 'discovery', 1, '09:00', 'Clara Jensen', 'clara@example.com', 'Our trial-to-paid rate dropped after the redesign.', 'Europe/Copenhagen'),
      ('jonas', 'pricing-audit', 2, '14:00', 'Ravi Patel', 'ravi@example.com', 'Pricing page: acme.example/pricing', 'America/Chicago'),
      ('jonas', 'discovery', 3, '10:30', 'Emma Rossi', 'emma@example.com', '', 'Europe/Rome')
    ) as b(host, typeSlug, n, at, guestName, guestEmail, guestNote, guestTimeZone)
    join users u on u.slug = b.host
    join meetingTypes m on m.userId = u.id and m.slug = b.typeSlug
    join demoDays dd on dd.host = b.host and dd.n = b.n;

-- A little history for the past tab, on recent working days in each host's zone.
create temporary table demoPast on commit drop as
  select u.slug as host,
         d::date as day,
         row_number() over (partition by u.slug order by d desc) as n
    from users u,
         generate_series((now() at time zone u.timeZone)::date - 21, (now() at time zone u.timeZone)::date - 1, interval '1 day') d
   where extract(isodow from d) between 1 and 5;

insert into bookings (userId, meetingTypeId, guestName, guestEmail, guestNote, guestTimeZone, startsAt, endsAt, bufferMinutes, reminderSentAt, status, cancelledAt)
  select u.id,
         m.id,
         b.guestName,
         b.guestEmail,
         b.guestNote,
         b.guestTimeZone,
         (dp.day + b.at::time) at time zone u.timeZone,
         (dp.day + b.at::time) at time zone u.timeZone + make_interval(mins => m.durationMinutes),
         m.bufferMinutes,
         case when b.cancelled then null else (dp.day + b.at::time) at time zone u.timeZone - interval '1 day' end,
         case when b.cancelled then 'cancelled' else 'confirmed' end,
         case when b.cancelled then (dp.day + b.at::time) at time zone u.timeZone - interval '2 days' end
    from (values
      ('maya', 'intro', 1, '11:00', 'Nora Lindqvist', 'nora@example.com', '', 'Europe/Stockholm', false),
      ('maya', 'strategy', 3, '10:00', 'Priya Nair', 'priya@example.com', 'First session: where the roadmap stands today.', 'America/New_York', false),
      ('maya', 'portfolio-review', 5, '14:00', 'Diego Alvarez', 'diego@example.com', '', 'America/Mexico_City', true),
      ('maya', 'intro', 7, '09:30', 'Grace Liu', 'grace@example.com', '', 'America/Denver', false),
      ('jonas', 'discovery', 2, '09:00', 'Tom Becker', 'tom@example.com', '', 'Europe/Berlin', false),
      ('jonas', 'pricing-audit', 4, '14:00', 'Aisha Khan', 'aisha@example.com', 'Three plans today, thinking about usage pricing.', 'Europe/London', false),
      ('jonas', 'discovery', 6, '11:00', 'Lukas Meyer', 'lukas@example.com', '', 'Europe/Zurich', true)
    ) as b(host, typeSlug, n, at, guestName, guestEmail, guestNote, guestTimeZone, cancelled)
    join users u on u.slug = b.host
    join meetingTypes m on m.userId = u.id and m.slug = b.typeSlug
    join demoPast dp on dp.host = b.host and dp.n = b.n;
