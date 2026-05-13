export const TASK_TYPES = [
  "housekeeping",
  "breakfast",
  "dinner",
  "cottages",
  "maintenance",
  "laundry",
  "special",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  housekeeping: "Housekeeping",
  breakfast: "Breakfast shift",
  dinner: "Dinner shift",
  cottages: "Cottages",
  maintenance: "Maintenance",
  laundry: "Laundry",
  special: "Special",
};

export const TASK_TYPE_DOT: Record<TaskType, string> = {
  housekeeping: "bg-[oklch(0.55_0.08_145)]",
  breakfast: "bg-[oklch(0.7_0.13_75)]",
  dinner: "bg-[oklch(0.65_0.14_38)]",
  cottages: "bg-[oklch(0.55_0.08_180)]",
  maintenance: "bg-[oklch(0.5_0.04_60)]",
  laundry: "bg-[oklch(0.55_0.08_250)]",
  special: "bg-[oklch(0.55_0.13_320)]",
};

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "gd", label: "Gàidhlig", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday-start week
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export { TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
