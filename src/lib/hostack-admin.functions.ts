import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const HOSTACK_URL = "https://yskzkobduekupiobrbxr.supabase.co";
const HOSTACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlza3prb2JkdWVrdXBpb2JyYnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjAxNjAsImV4cCI6MjA5MDEzNjE2MH0.5t6mm90F7k_8zXVVzUJAYzFA4IoNdTm6-UTRWFzsjfg";
const TORRIDONIA_PROPERTY_ID = "bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a";
const MANAGER_EMAILS = new Set(["jorge.ibanez.ciej@gmail.com"]);

function profileFromUser(user: { id: string; email?: string | null }) {
  const email = user.email ?? null;
  return {
    id: user.id,
    full_name: email?.split("@")[0] ?? "Manager",
    email,
    phone: null,
    language: "en" as const,
    nationality: null,
    passport_number: null,
    passport_url: null,
    avatar_url: null,
    bio: null,
    onboarded: true,
  };
}

function getAdminClient() {
  const key = process.env.HOSTACK_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("HOSTACK_SERVICE_ROLE_KEY missing");
  return createClient(HOSTACK_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAuthClient() {
  return createClient(HOSTACK_URL, HOSTACK_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getUserAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const accessToken = data.accessToken?.trim();
    if (!accessToken) {
      return { profile: null, isAdmin: false, isRoomManager: false, error: "Missing session" };
    }

    const { data: authData, error: authError } = await getAuthClient().auth.getUser(accessToken);
    if (authError || !authData.user) {
      return { profile: null, isAdmin: false, isRoomManager: false, error: authError?.message ?? "Invalid session" };
    }

    const verifiedEmail = authData.user.email?.toLowerCase() ?? "";
    if (MANAGER_EMAILS.has(verifiedEmail)) {
      return { profile: profileFromUser(authData.user), isAdmin: true, isRoomManager: true, error: null };
    }

    const sb = getAdminClient();
    let { data: staff, error } = await sb
      .from("staff")
      .select("id, name, email, phone, preferred_language, role, status, auth_user_id, property_id")
      .eq("auth_user_id", authData.user.id)
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .maybeSingle();

    if (error) {
      return { profile: null, isAdmin: false, isRoomManager: false, error: error.message };
    }

    if (!staff && authData.user.email) {
      const byEmail = await sb
        .from("staff")
        .select("id, name, email, phone, preferred_language, role, status, auth_user_id, property_id")
        .eq("email", authData.user.email)
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .maybeSingle();

      if (byEmail.error) {
        return { profile: null, isAdmin: false, isRoomManager: false, error: byEmail.error.message };
      }

      staff = byEmail.data;
      if (staff && !staff.auth_user_id) {
        await sb.from("staff").update({ auth_user_id: authData.user.id }).eq("id", staff.id);
      }
    }

    if (!staff) {
      return { profile: null, isAdmin: false, isRoomManager: false, error: null };
    }

    const roleLc = (staff.role ?? "").toLowerCase();
    const isAdmin = ["admin", "owner"].includes(roleLc) || roleLc.includes("manager");
    const isRoomManager = isAdmin || roleLc.includes("room");

    const profile = {
      id: staff.id as string,
      full_name: staff.name as string | null,
      email: staff.email as string | null,
      phone: staff.phone as string | null,
      language: (staff.preferred_language ?? "en") as "en" | "pt" | "es" | "fr" | "it",
      nationality: null,
      passport_number: null,
      passport_url: null,
      avatar_url: null,
      bio: null,
      onboarded: staff.status === "active",
    };

    return { profile, isAdmin, isRoomManager, error: null };
  });

type HostackPlaybook = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  content_type: string | null;
  content_text: string | null;
  file_url: string | null;
  order_index: number | null;
};

export const getPublishedPlaybooks = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await getAdminClient()
    .from("playbooks")
    .select("id, title, category, description, content_type, content_text, file_url, order_index")
    .eq("property_id", TORRIDONIA_PROPERTY_ID)
    .eq("is_archived", false)
    .order("order_index", { ascending: true });

  if (error) return { playbooks: [] as HostackPlaybook[], error: error.message };
  return { playbooks: (data as HostackPlaybook[]) ?? [], error: null };
});

type RotaVolunteer = { id: string; name: string | null; role_type: string | null; auth_user_id?: string | null };
type RotaTemplate = { id: string; name: string; start_time: string | null; end_time: string | null };
type RotaShift = {
  id?: string;
  shift_date: string;
  volunteer_id?: string | null;
  staff_id?: string | null;
  shift_template_id: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
};

function addDaysIso(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function currentMondayIso() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

async function verifyHostackUser(accessToken: string) {
  const { data, error } = await getAuthClient().auth.getUser(accessToken);
  if (error || !data.user) throw new Error(error?.message ?? "Invalid session");
  return data.user;
}

async function assertManager(accessToken: string) {
  const user = await verifyHostackUser(accessToken);
  const email = user.email?.toLowerCase() ?? "";
  if (MANAGER_EMAILS.has(email)) return user;

  const { data: staff, error } = await getAdminClient()
    .from("staff")
    .select("role,status")
    .eq("property_id", TORRIDONIA_PROPERTY_ID)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = ((staff?.role as string | null) ?? "").toLowerCase();
  if (staff?.status === "active" && (role.includes("manager") || role === "admin" || role === "owner")) return user;
  throw new Error("Not authorized");
}

async function fetchRotaWeek(weekStart: string) {
  const sb = getAdminClient();
  const end = addDaysIso(weekStart, 6);
  const [volRes, tplRes, shiftRes] = await Promise.all([
    sb
      .from("volunteers")
      .select("id, name, role_type, auth_user_id")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("status", "active")
      .order("name"),
    sb
      .from("shift_templates")
      .select("id, name, start_time, end_time")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .order("name"),
    sb
      .from("shifts")
      .select("id, shift_date, volunteer_id, staff_id, shift_template_id, start_time, end_time, status")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .gte("shift_date", weekStart)
      .lte("shift_date", end),
  ]);
  if (volRes.error) throw new Error(volRes.error.message);
  if (tplRes.error) throw new Error(tplRes.error.message);
  if (shiftRes.error) throw new Error(shiftRes.error.message);
  return {
    volunteers: (volRes.data as RotaVolunteer[]) ?? [],
    templates: (tplRes.data as RotaTemplate[]) ?? [],
    shifts: (shiftRes.data as RotaShift[]) ?? [],
  };
}

export const getAdminRotaWeek = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; weekStart: string }) => d)
  .handler(async ({ data }) => {
    await assertManager(data.accessToken?.trim());
    return fetchRotaWeek(data.weekStart);
  });

export const saveAdminRotaWeek = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; upserts: Record<string, unknown>[]; deletes: string[] }) => d)
  .handler(async ({ data }) => {
    await assertManager(data.accessToken?.trim());
    const sb = getAdminClient();
    if (data.deletes?.length) {
      const { error } = await sb.from("shifts").delete().in("id", data.deletes);
      if (error) throw new Error(error.message);
    }
    if (data.upserts?.length) {
      const rows = data.upserts.map((row) => ({ ...row, property_id: TORRIDONIA_PROPERTY_ID }));
      const { error } = await sb.from("shifts").upsert(rows);
      if (error) throw new Error(error.message);
    }
    return { saved: data.upserts?.length ?? 0, deleted: data.deletes?.length ?? 0 };
  });

export const bindVolunteerByName = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; name: string }) => d)
  .handler(async ({ data }) => {
    const user = await verifyHostackUser(data.accessToken?.trim());
    const name = data.name?.trim();
    if (!name) throw new Error("Name required");
    const sb = getAdminClient();
    const { data: volunteer, error } = await sb
      .from("volunteers")
      .select("id")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .ilike("name", name)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (volunteer?.id) {
      const { error: updateError } = await sb.from("volunteers").update({ auth_user_id: user.id }).eq("id", volunteer.id);
      if (updateError) throw new Error(updateError.message);
    }
    return { volunteerId: (volunteer?.id as string | undefined) ?? null };
  });

export const getDashboardRota = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; weekStart?: string }) => d)
  .handler(async ({ data }) => {
    const user = await verifyHostackUser(data.accessToken?.trim());
    const weekStart = data.weekStart || currentMondayIso();
    const rota = await fetchRotaWeek(weekStart);
    const email = user.email?.toLowerCase() ?? "";
    const isManager = MANAGER_EMAILS.has(email);

    if (isManager) return { mode: "manager" as const, weekStart, ...rota };

    const metaName = (user.user_metadata as { full_name?: string } | undefined)?.full_name?.trim();
    const byAuth = rota.volunteers.find((v) => v.auth_user_id === user.id);
    const byName = metaName ? rota.volunteers.find((v) => (v.name ?? "").trim().toLowerCase() === metaName.toLowerCase()) : null;
    const volunteer = byAuth ?? byName ?? null;
    const shifts = volunteer ? rota.shifts.filter((s) => s.volunteer_id === volunteer.id) : [];
    return {
      mode: "volunteer" as const,
      weekStart,
      volunteer,
      templates: rota.templates,
      shifts,
      allVolunteers: rota.volunteers.map((v) => ({ id: v.id, name: v.name })),
    };
  });
