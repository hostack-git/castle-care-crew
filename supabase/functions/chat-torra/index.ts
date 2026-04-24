// Ask Torra - AI assistant grounded on guidebook + tasks
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language = "en" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Identify user
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id ?? null;

    // Pull guidebook in requested language (fallback to en)
    const [{ data: guideLang }, { data: guideEn }] = await Promise.all([
      supabase
        .from("guidebook_sections")
        .select("section,title,content")
        .eq("language", language)
        .order("order_index"),
      language === "en"
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("guidebook_sections")
            .select("section,title,content")
            .eq("language", "en")
            .order("order_index"),
    ]);
    const guide = (guideLang && guideLang.length > 0 ? guideLang : guideEn) ?? [];

    // Pull this volunteer's upcoming tasks (next 14 days)
    let tasksContext = "";
    if (userId) {
      const today = new Date().toISOString().slice(0, 10);
      const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("title,type,scheduled_date,start_time,end_time,location,status,description")
        .eq("assigned_to", userId)
        .gte("scheduled_date", today)
        .lte("scheduled_date", in14)
        .order("scheduled_date");
      if (tasks && tasks.length) {
        tasksContext =
          "\n\n## Your upcoming tasks (next 14 days)\n" +
          tasks
            .map(
              (t: any) =>
                `- ${t.scheduled_date} ${t.start_time ?? ""}–${t.end_time ?? ""} · ${t.title} (${t.type})${t.location ? " @ " + t.location : ""} [${t.status}]`
            )
            .join("\n");
      }
    }

    // Pull recent announcements
    const { data: announcements } = await supabase
      .from("announcements")
      .select("title,content,priority,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const guideContext = guide
      .map((s: any) => `### ${s.title}\n${s.content}`)
      .join("\n\n");

    const annContext = (announcements ?? [])
      .map((a: any) => `- [${a.priority}] ${a.title}: ${a.content}`)
      .join("\n");

    const systemPrompt = `You are Torra, the friendly AI assistant for volunteers at Torridon House — a guesthouse and castle in the Scottish Highlands hosting volunteers from around the world.

ROLE:
- Help volunteers understand house rules, schedules, shifts, and responsibilities.
- Answer questions about their tasks, the guidebook, and life at Torridon.
- Be warm, concise, practical. Use markdown (short paragraphs, bullet lists).
- Reply in the user's language (current preference: ${language}). If they switch language, follow them.
- If you don't know something, say so honestly and suggest asking the team lead.

KNOWLEDGE — HOUSE GUIDEBOOK:
${guideContext || "(no guidebook entries available)"}

RECENT ANNOUNCEMENTS:
${annContext || "(none)"}
${tasksContext}

Always ground answers in the guidebook above. Never invent rules.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit reached, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-torra error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
