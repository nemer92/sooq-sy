
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-topup-notification-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("TOPUP_NOTIFICATION_SECRET");
    const suppliedSecret = req.headers.get("x-topup-notification-secret") ?? "";

    if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const recipient = Deno.env.get("TOPUP_NOTIFICATION_EMAIL");

    if (!supabaseUrl || !serviceKey || !resendKey || !recipient) {
      return jsonResponse({ error: "Missing server configuration" }, 500);
    }

    const body = await req.json();
    const requestId = body?.request_id;

    if (typeof requestId !== "string" || !requestId) {
      return jsonResponse({ error: "Missing request_id" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: request, error: requestError } = await supabase
      .from("point_topup_requests")
      .select("id,user_id,package_id,amount_usd,points,proof_url,status,created_at,phone,exchange_rate,amount_syp")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !request) {
      return jsonResponse({ error: "Top-up request not found" }, 404);
    }

    const [profileResult, phoneResult, packageResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", request.user_id)
        .maybeSingle(),
      supabase
        .from("private_profiles")
        .select("phone")
        .eq("user_id", request.user_id)
        .maybeSingle(),
      supabase
        .from("point_packages")
        .select("name")
        .eq("id", request.package_id)
        .maybeSingle(),
    ]);

    const name = profileResult.data?.display_name || "غير محدد";
    const phone = phoneResult.data?.phone || request.phone || "غير محدد";
    const packageName = packageResult.data?.name || "باقة نقاط";

    const usd = Number(request.amount_usd).toFixed(2);
    const syp = request.amount_syp != null
      ? Number(request.amount_syp).toLocaleString("en-US")
      : "غير محدد";

    const proofUrl =
      typeof request.proof_url === "string" &&
      /^https?:\/\//i.test(request.proof_url)
        ? request.proof_url
        : null;

    const proofHtml = proofUrl
      ? `<a href="${escapeHtml(proofUrl)}" target="_blank">عرض إثبات الدفع</a>`
      : "لم يتم إرفاق إثبات دفع";

    const createdAt = new Date(request.created_at).toLocaleString("ar");

    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:2;color:#222">
        <h2>طلب شحن نقاط جديد - سوق سوريا</h2>
        <p>تم إنشاء طلب شحن نقاط جديد ويحتاج إلى المراجعة.</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          <tr><td style="padding:8px;border:1px solid #ddd">رقم الطلب</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(request.id)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">اسم المستخدم</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">رقم الهاتف</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(phone)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">الباقة</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(packageName)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">النقاط</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(request.points)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">المبلغ بالدولار</td><td style="padding:8px;border:1px solid #ddd">$${escapeHtml(usd)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">المبلغ بالليرة</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(syp)} ل.س</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">الحالة</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(request.status)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">تاريخ الطلب</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(createdAt)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd">إثبات الدفع</td><td style="padding:8px;border:1px solid #ddd">${proofHtml}</td></tr>
        </table>
      </div>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sooqsy <onboarding@resend.dev>",
        to: [recipient],
        subject: `طلب شحن نقاط جديد - ${name}`,
        html,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      return jsonResponse({ error: "Email provider rejected the request" }, 502);
    }

    return jsonResponse({ success: true, email_id: emailResult.id });
  } catch (error) {
    console.error("Top-up notification error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
