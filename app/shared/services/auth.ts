import { sql, tx, session, AuthError, ValidationError } from "@elements/app";
import { isTimeZone } from "#app/shared/lib/time";

interface User {
  id: string;
  email: string;
  name: string;
  slug: string;
}

export const MIN_PASSWORD = 8;

export interface SignupForm {
  name: string;
  email: string;
  password: string;
  timeZone: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Top-level paths the app owns, so no host can claim one as their page.
const RESERVED = new Set(["signin", "signup", "signout", "bookings", "meeting-types", "availability", "booking", "dev"]);

function uniqueSlug(name: string): string {
  let base = slugify(name) || "host";
  if (RESERVED.has(base)) {
    base = `${base}-host`;
  }

  let slug = base;
  for (let n = 2; !sql(`select 1 from users where slug = ${slug}`).empty(); n++) {
    slug = `${base}-${n}`;
  }

  return slug;
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = normalizeEmail(email);

  if (!address || !password) {
    throw new AuthError("Enter your email and password");
  }

  let user = sql<User>(`
    select id, email, name, slug from users
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("Invalid email or password");
  }

  session.login({ userId: user.id, userName: user.name, userSlug: user.slug });
}

/** @rpc */
export function signup(form: SignupForm) {
  let name = form.name.trim();
  let address = normalizeEmail(form.email);

  let errors: Record<string, string[]> = {};
  if (!name) {
    errors.name = ["Enter your name"];
  }

  if (!isEmail(address)) {
    errors.email = ["Enter a valid email address"];
  }

  if (form.password.length < MIN_PASSWORD) {
    errors.password = [`At least ${MIN_PASSWORD} characters`];
  }

  if (Object.keys(errors).length) {
    throw new ValidationError(errors);
  }

  if (!sql(`select 1 from users where email = ${address}`).empty()) {
    throw new ValidationError({ email: ["That email is already registered"] });
  }

  let timeZone = isTimeZone(form.timeZone) ? form.timeZone : "UTC";

  // A new host starts with something to share: one meeting type and weekday hours.
  let user = tx(() => {
    let u = sql<User>(`
      insert into users (email, passwordHash, name, slug, timeZone)
           values (${address}, crypt(${form.password}, genSalt('bf', 12)), ${name}, ${uniqueSlug(name)}, ${timeZone})
        returning id, email, name, slug
    `).firstOrThrow("insert returned no row");

    sql(`
      insert into meetingTypes (userId, slug, name, description, durationMinutes, bufferMinutes)
           values (${u.id}, 'chat', '30 minute chat', 'A half hour to talk through whatever you need.', 30, 10)
    `);

    sql(`
      insert into availabilityRules (userId, weekday, startTime, endTime)
        select ${u.id}, d, '09:00', '17:00' from generate_series(1, 5) d
    `);

    return u;
  });

  session.login({ userId: user.id, userName: user.name, userSlug: user.slug });
}

/** @rpc */
export function signout() {
  session.logout();
}
