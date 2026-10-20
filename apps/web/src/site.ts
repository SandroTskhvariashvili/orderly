// Public links. The site carries no email address or phone number on purpose:
// work comes in through the freelance platform. Set NEXT_PUBLIC_UPWORK_URL at
// deploy time; without it the hire buttons are left out rather than pointing nowhere.
export const UPWORK_URL: string | null = process.env.NEXT_PUBLIC_UPWORK_URL ?? null;
export const SOURCE_URL = "https://github.com/SandroTskhvariashvili/orderly";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://orderly.devsandro.com";
