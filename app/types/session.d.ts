/**
 * The keys your app stores in the session, so `session.get("userId")` is
 * typed.
 */
declare module "@elements/app" {
  interface SessionData {
    userId: string;
    userName: string;
    userSlug: string;
  }
}

export {};
