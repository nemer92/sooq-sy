
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    // السماح فقط باستدعاء موثوق يحمل مفتاح Service Role
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const updateSecret = Deno.env.get("EXCHANGE_RATE_UPDATE_SECRET");

    if (!secretKeysRaw || !supabaseUrl || !updateSecret) {
      throw new Error("Supabase environment variables are missing");
    }

    const secretKeys = JSON.parse(secretKeysRaw);
    const serviceKey = secretKeys.default;

    if (!serviceKey) {
      throw new Error("Supabase secret key is missing");
    }

    if (req.headers.get("x-update-secret") !== updateSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    // قراءة إعدادات الموقع
    const { data: settings, error: settingsError } = await supabase
      .from("site_settings")
      .select("id, exchange_rate_is_manual")
      .eq("id", 1)
      .single();

    if (settingsError || !settings) {
      throw new Error("Could not read site settings");
    }

    // عدم استبدال السعر إذا كان التعديل اليدوي مفعلاً
    if (settings.exchange_rate_is_manual) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: "Manual exchange rate is enabled"
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // جلب أسعار الصرف من LiraScope
    const response = await fetch(
      "https://lirascope.syria-cloud.sy/api/v1/rates/latest?currencies=USD&lang=ar"
    );

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `LiraScope API error: ${response.status} - ${responseText}`
      );
    }

    const result = JSON.parse(responseText);

    const usdRate = result.marketRates?.find(
      (item: { currency: string }) => item.currency === "USD"
    );

    if (
      !usdRate ||
      typeof usdRate.mid !== "number" ||
      !Number.isFinite(usdRate.mid) ||
      usdRate.mid <= 0 ||
      !usdRate.timestampUtc
    ) {
      throw new Error("Invalid USD market rate received from LiraScope");
    }

    const rateTimestamp = new Date(usdRate.timestampUtc);

    if (Number.isNaN(rateTimestamp.getTime())) {
      throw new Error("Invalid exchange rate timestamp");
    }

    // تحديث السعر التلقائي
    const { error: updateError } = await supabase
      .from("site_settings")
      .update({
        usd_syp_rate: usdRate.mid,
        exchange_rate_updated_at: rateTimestamp.toISOString(),
        exchange_rate_source: "LiraScope",
        exchange_rate_is_manual: false
      })
      .eq("id", 1)
      .eq("exchange_rate_is_manual", false);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        rate: usdRate.mid,
        currency: "USD",
        source: "LiraScope",
        updatedAt: rateTimestamp.toISOString()
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Exchange rate update failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
