// Manager-only: invite a staff member by email. Runs server-side so the
// service-role key never reaches the browser.
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateInvite } from "./validate.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "unauthorized" });

  const { data: isManager } = await caller.rpc("is_manager");
  if (!isManager) return json(403, { error: "not_manager" });

  const invite = validateInvite(await req.json().catch(() => null));
  if (!invite) return json(400, { error: "bad_request" });

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(invite.email, {
    data: { full_name: invite.full_name },
    redirectTo: `${appUrl}/set-password`,
  });
  if (error || !data.user) return json(400, { error: "invite_failed", detail: error?.message });

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: invite.role, full_name: invite.full_name })
    .eq("id", data.user.id);
  if (roleError) return json(500, { error: "role_update_failed" });

  return json(200, { user_id: data.user.id });
});
