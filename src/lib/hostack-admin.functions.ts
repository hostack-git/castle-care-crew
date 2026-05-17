import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const HOSTACK_URL = "https://yskzkobduekupiobrbxr.supabase.co";
const HOSTACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlza3prb2JkdWVrdXBpb2JyYnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjAxNjAsImV4cCI6MjA5MDEzNjE2MH0.5t6mm90F7k_8zXVVzUJAYzFA4IoNdTm6-UTRWFzsjfg";
const TORRIDONIA_PROPERTY_ID = "bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a";

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
      language: (staff.preferred_language ?? "en") as "en" | "pt" | "es" | "de" | "gd",
      nationality: null,
      passport_number: null,
      passport_url: null,
      avatar_url: null,
      bio: null,
      onboarded: staff.status === "active",
    };

    return { profile, isAdmin, isRoomManager, error: null };
  });
