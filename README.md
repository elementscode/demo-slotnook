![Slotnook, an appointment scheduling app built with Elements: a public booking page for a strategy session with a month calendar and the open times for one day, shown in the guest's own time zone.](https://elements.dev/demos/01a0f40a-56f5-7ef5-b1d1-beeab4e2ca36/poster?v=f36f514fb859)

# Slotnook

> A demo app built with [Elements](https://elements.dev).

Meeting types, weekly hours and date overrides, booking pages shown in each guest's own time zone, and emailed calendar invites with reminders, reschedule and cancel.

**Demo:** [Slotnook](https://elements.dev/demos/01a0f40a-56f5-7ef5-b1d1-beeab4e2ca36)

## Agent specs

What one run of the prompt below took, from an empty Elements project to this
app.

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 21 min
- **Cost:** $7.01 at API rates, September 2026

## Get started

```bash
elements create slotnook -scaffold=elementscode/demo-slotnook
```

## How it's built

Slotnook needed open slots computed from weekly hours and overrides, booking pages that update while a guest is looking, emailed calendar invites, and reminders on a schedule. Each of those is a part of Elements, so the agent spent its 21 minutes on the scheduling itself.

### What Elements gave the app

- **Live booking pages.** A `slotChanges` channel in `app/shared/services/scheduling.ts` tells every open booking page when a host's calendar changes. Pages listen before they read the slots, so a time another guest just took drops out of the picker on the spot.
- **Server calls as function calls.** The booking page calls `@rpc` functions such as `fetchOpenSlots`, `bookSlot` and `guestReschedule` straight from the template, with types checked end to end. `bookSlot` locks the host's row inside a transaction, so each time goes to exactly one guest.
- **Slots from SQL.** The first migration defines users, meeting types, weekly rules, date overrides and bookings, plus an `openSlots` SQL function that turns them into start times, buffers included. The second seeds two consultants, Maya in Los Angeles and Jonas in Berlin, with five meeting types, their weekly hours, a date override each, and past and upcoming bookings from guests in their own time zones.
- **Email with calendar files.** `BookingEmailJob` in `app/jobs/booking-email.ts` renders the `booking-update` email template and attaches an invite built by `app/shared/lib/ics.ts`. A reschedule raises the event's sequence and a cancel sends a CANCEL file, so the guest's calendar follows along.
- **Reminders on a schedule.** One line in `index.ts`, `app.cron("every 5m", ...)`, runs `SendRemindersJob`, which claims bookings starting within 24 hours and queues a reminder for each.
- **Sessions.** Host pages share `currentHost` in `app/shared/services/host.ts`, and host rpcs such as `hostCancel` check that the booking belongs to the signed-in user.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 46 tests pass. Every page was checked on desktop and phone before publishing.

Start in `app/shared/services/scheduling.ts`.

## Demo accounts

The seed creates two hosts in different time zones. Each has meeting types,
weekly hours, one date override, upcoming bookings from guests around the
world, and a few past and cancelled ones. Both passwords are `slotnook-demo`,
and the sign-in page lists them.

| Email              | Host        | Time zone           | Booking page |
| ------------------ | ----------- | ------------------- | ------------ |
| maya@slotnook.dev  | Maya Chen   | America/Los_Angeles | `/maya`      |
| jonas@slotnook.dev | Jonas Weber | Europe/Berlin       | `/jonas`     |

Booking pages need no account: open `/maya/strategy` or `/jonas/discovery`
and times show in your own time zone. In development, emails (with their
`.ics` invites) are written to `.elements/logs/job.log` instead of being sent.

## The prompt

```text
Build an appointment scheduling app named slotnook, for consultants to share a
booking page.

HOST (accounts)
- Meeting types: name, length, description, buffer between meetings.
- Weekly availability, date overrides, and a time zone.
- A public booking page per meeting type.
- Upcoming and past bookings. Cancel or reschedule, which emails the guest.

GUEST (no account)
- Pick a day and an open time, shown in their own time zone.
- Enter name, email and a note, and book.
- Get a confirmation email with a calendar invite (.ics) and links to
  reschedule or cancel.
- A reminder email 24 hours before.

Seed two hosts in different time zones with meeting types, availability and
upcoming bookings. Show the seeded logins on the sign-in page.

Booked slots disappear from open booking pages in real time.
```

## License

MIT. See [LICENSE](LICENSE).
