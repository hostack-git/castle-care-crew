import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const TORRIDONIA_PROPERTY_ID = "bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a";

function getAdminClient() {
  const key = process.env.HOSTACK_SERVICE_ROLE_KEY;
  if (!key) throw new Error("HOSTACK_SERVICE_ROLE_KEY missing");
  return createClient("https://yskzkobduekupiobrbxr.supabase.co", key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getUserAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const { data: staff, error } = await sb
      .from("staff")
      .select("id, name, email, phone, preferred_language, role, status, auth_user_id, property_id")
      .eq("auth_user_id", data.userId)
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .maybeSingle();

    if (error) {
      return { profile: null, isAdmin: false, isRoomManager: false, error: error.message };
    }
    if (!staff) {
      return { profile: null, isAdmin: false, isRoomManager: false, error: null };
    }

    const roleLc = (staff.role ?? "").toLowerCase();
    const isAdmin = ["admin", "manager", "owner"].includes(roleLc);
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
