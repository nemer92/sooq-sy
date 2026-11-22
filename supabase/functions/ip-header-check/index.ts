const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-forwarded-for, cf-connecting-ip, x-real-ip",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const probe = "203.0.113.77";

  return new Response(JSON.stringify({
    cf_connecting_ip_present: !!req.headers.get("cf-connecting-ip"),
    cf_connecting_ip_matches_probe: req.headers.get("cf-connecting-ip") === probe,
    x_forwarded_for_present: !!req.headers.get("x-forwarded-for"),
    x_forwarded_for_matches_probe: req.headers.get("x-forwarded-for") === probe,
    x_real_ip_present: !!req.headers.get("x-real-ip"),
    diagnostic: "temporary"
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
});
