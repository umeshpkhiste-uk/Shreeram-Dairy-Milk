// Securely provisions a worker account. There is no public worker sign-up —
// this is the only way a worker account comes into existence (besides the
// one-time, manually-bootstrapped first admin account — see
// docs/database-schema.md).
//
// Requires a valid admin session JWT ("user" auth mode). Uses the
// service-role client (ctx.supabaseAdmin) only for the privileged steps
// (creating the auth user, activating the profile) — never ships the
// service-role key to any client.

import { withSupabase } from "@supabase/server";

type CreateWorkerRequest = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  routeId?: string | null;
};

function isValidRequest(body: unknown): body is CreateWorkerRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.email === "string" &&
    b.email.includes("@") &&
    typeof b.password === "string" &&
    b.password.length >= 8 &&
    typeof b.fullName === "string" &&
    b.fullName.trim().length >= 2 &&
    (b.phone === undefined || typeof b.phone === "string") &&
    (b.routeId === undefined || b.routeId === null || typeof b.routeId === "string")
  );
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const callerId = ctx.userClaims?.id;
    if (!callerId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Authorization decision made explicitly here, using the service-role
    // client deliberately (not relying on RLS for this internal check) —
    // the actual enforcement is this check, not a side effect of a policy.
    const { data: callerProfile, error: callerError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("role, is_active")
      .eq("id", callerId)
      .single();

    if (callerError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return Response.json({ error: "Only an active admin can create worker accounts" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!isValidRequest(body)) {
      return Response.json(
        {
          error:
            "email, password (min 8 chars), and fullName (min 2 chars) are required; phone and routeId are optional",
        },
        { status: 400 },
      );
    }

    const { email, password, fullName, phone, routeId } = body;

    const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone ?? null, role: "worker" },
    });

    if (createError || !created.user) {
      return Response.json({ error: createError?.message ?? "Failed to create user" }, { status: 400 });
    }

    const newUserId = created.user.id;

    // handle_new_user already inserted a profile row (role='worker',
    // is_active=false). An admin-provisioned worker should be active
    // immediately — this is the deliberate activation step.
    const { error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName, phone: phone ?? null, is_active: true })
      .eq("id", newUserId);

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    const { error: workerError } = await ctx.supabaseAdmin
      .from("workers")
      .insert({ id: newUserId, route_id: routeId ?? null });

    if (workerError) {
      return Response.json({ error: workerError.message }, { status: 500 });
    }

    // Audit triggers can't see the calling admin's identity here (this
    // request runs as service_role, not as the admin's own session), so
    // record attribution explicitly.
    await ctx.supabaseAdmin.from("audit_logs").insert({
      actor_id: callerId,
      action: "ADMIN_CREATE_WORKER",
      entity_type: "workers",
      entity_id: newUserId,
      after_data: { email, full_name: fullName, phone: phone ?? null, route_id: routeId ?? null },
    });

    return Response.json({ id: newUserId, email, fullName }, { status: 201 });
  }),
};
