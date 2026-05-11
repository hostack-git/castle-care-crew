export type RoomStatus = "to_clean" | "check_in" | "staying" | "free" | "maintenance";
export type TeamAssignment =
  | "housekeeping" | "cottages" | "breakfast" | "maintenance" | "off"
  | "special" | "onboarding" | "deep_cleaning" | "departure" | "arrive";

export const ROOM_STATUS_OPTIONS: { value: RoomStatus; label: string; cls: string }[] = [
  { value: "to_clean",    label: "To Clean",    cls: "bg-[oklch(0.78_0.13_28)] text-white" },
  { value: "check_in",    label: "Check In",    cls: "bg-[oklch(0.85_0.10_145)] text-[oklch(0.25_0.04_145)]" },
  { value: "staying",     label: "Staying",     cls: "bg-[oklch(0.55_0.13_245)] text-white" },
  { value: "free",        label: "Free",        cls: "bg-[oklch(0.90_0.01_75)] text-[oklch(0.35_0.02_60)]" },
  { value: "maintenance", label: "Maintenance", cls: "bg-[oklch(0.75_0.14_55)] text-white" },
];

export const TEAM_OPTIONS: { value: TeamAssignment; label: string; cls: string }[] = [
  { value: "housekeeping",  label: "Housekeeping",  cls: "bg-[oklch(0.62_0.10_145)] text-white" },
  { value: "cottages",      label: "Cottages",      cls: "bg-[oklch(0.65_0.13_38)] text-white" },
  { value: "breakfast",     label: "Breakfast",     cls: "bg-[oklch(0.80_0.13_85)] text-[oklch(0.30_0.04_60)]" },
  { value: "maintenance",   label: "Maintenance",   cls: "bg-[oklch(0.78_0.13_55)] text-[oklch(0.30_0.04_60)]" },
  { value: "off",           label: "Off",           cls: "bg-[oklch(0.88_0.04_30)] text-[oklch(0.45_0.03_60)]" },
  { value: "special",       label: "Special Task",  cls: "bg-[oklch(0.65_0.10_295)] text-white" },
  { value: "onboarding",    label: "Onboarding",    cls: "bg-[oklch(0.50_0.06_60)] text-white" },
  { value: "deep_cleaning", label: "Deep cleaning", cls: "bg-[oklch(0.78_0.10_180)] text-[oklch(0.25_0.04_180)]" },
  { value: "departure",     label: "Departure",     cls: "bg-[oklch(0.55_0.02_60)] text-white" },
  { value: "arrive",        label: "Arrive",        cls: "bg-[oklch(0.60_0.13_145)] text-white" },
];

export const ROOM_STATUS_MAP = Object.fromEntries(ROOM_STATUS_OPTIONS.map(o => [o.value, o]));
export const TEAM_MAP = Object.fromEntries(TEAM_OPTIONS.map(o => [o.value, o]));

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
