const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PACKAGE_NAME = "com.sooqsy.app";
const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/playintegrity";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const accountSecret = Deno.env.get(
  "GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_B64",
)!;
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
// تسجيل سبب الرفض برمز واضح، دون تسجيل الرموز السرية
function reject(
  status: number,
  reason: string,
  message: string,
  details?: Record<string, unknown>,
) {
  console.warn(
    "PLAY_INTEGRITY_REJECT",
    JSON.stringify({
      reason,
      status,
      ...details,
    }),
  );
  return jsonResponse({
    success: false,
    reason,
    error: message,
    ...(details ? { details } : {}),
  }, status);
}
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
// توحيد nonce القادم من Google مع صيغة Base64URL المخزنة في قاعدة البيانات.
// Google/بعض طبقات النقل قد تعيد padding (=) أو أحرف Base64 القياسية.
function normalizeIntegrityNonce(value: string): string {
  return value
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function encodeBase64Url(value: string): string {
  return base64Url(new TextEncoder().encode(value));
}
async function createGoogleAccessToken(
  serviceAccount: Record<string, string>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    }),
  );
  const claims = encodeBase64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: GOOGLE_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedToken = `${header}.${claims}`;
  const pem = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(
    atob(pem),
    (char) => char.charCodeAt(0),
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion =
    `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    console.error(
      "GOOGLE_ACCESS_TOKEN_FAILED",
      JSON.stringify({
        status: response.status,
        error: result.error ?? null,
        description: result.error_description ?? null,
      }),
    );
    throw new Error("تعذر الحصول على رمز Google للوصول.");
  }
  return result.access_token;
}
async function databaseRequest(
  path: string,
  method: string,
  body?: unknown,
) {
  return await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });
}
// استخراج هوية المستخدم من جلسة Supabase الموثقة
async function getVerifiedVisitorUserId(
  req: Request,
): Promise<{ valid: boolean; userId: string | null }> {
  const authorization = req.headers.get("Authorization");
  // السماح بالزائر المجهول باستخدام مفتاح anon المعروف فقط
  if (!authorization || authorization === `Bearer ${anonKey}`) {
    return { valid: true, userId: null };
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  });
  if (!response.ok) {
    console.warn(
      "VISITOR_AUTH_FAILED",
      JSON.stringify({
        status: response.status,
      }),
    );
    return { valid: false, userId: null };
  }
  const user = await response.json();
  if (typeof user.id !== "string") {
    return { valid: false, userId: null };
  }
  return { valid: true, userId: user.id };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  try {
    const body = await req.json();
    // إصدار تحدٍّ جديد للتطبيق
    if (body.action === "create_challenge") {
      if (
        typeof body.share_token !== "string" ||
        !body.share_token.trim() ||
        typeof body.visitor_id !== "string" ||
        !body.visitor_id.startsWith("android:") ||
        body.visitor_id.length > 200
      ) {
        return reject(
          400,
          "INVALID_CHALLENGE_INPUT",
          "بيانات المشاركة غير صالحة.",
        );
      }
      const randomBytes = crypto.getRandomValues(
        new Uint8Array(32),
      );
      const nonce = base64Url(randomBytes);
      const expiresAt = new Date(
        Date.now() + 3 * 60 * 1000,
      ).toISOString();
      const response = await databaseRequest(
        "play_integrity_challenges",
        "POST",
        {
          nonce,
          expires_at: expiresAt,
          share_token: body.share_token,
          visitor_id: body.visitor_id,
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "CHALLENGE_CREATION_FAILED",
          JSON.stringify({
            status: response.status,
            error: errorText.slice(0, 1000),
          }),
        );
        throw new Error("تعذر إنشاء تحدي التحقق.");
      }
      console.info("CHALLENGE_CREATED");
      return jsonResponse({
        success: true,
        nonce,
        expires_at: expiresAt,
      });
    }
    // التحقق من رمز Google
    if (body.action === "verify") {
      if (
        typeof body.share_token !== "string" ||
        !body.share_token.trim() ||
        typeof body.visitor_id !== "string" ||
        !body.visitor_id.startsWith("android:") ||
        body.visitor_id.length > 200
      ) {
        return reject(
          400,
          "INVALID_VERIFY_INPUT",
          "بيانات مشاركة الإعلان غير صالحة.",
        );
      }
      const integrityToken = body.token;
      if (
        typeof integrityToken !== "string" ||
        integrityToken.length < 20 ||
        integrityToken.length > 20000
      ) {
        return reject(
          400,
          "INVALID_INTEGRITY_TOKEN",
          "رمز التحقق غير صالح.",
        );
      }
      const serviceAccount = JSON.parse(
        atob(accountSecret),
      );
      const accessToken =
        await createGoogleAccessToken(serviceAccount);
      const googleResponse = await fetch(
        `https://playintegrity.googleapis.com/v1/${PACKAGE_NAME}:decodeIntegrityToken`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            integrityToken,
          }),
        },
      );
      const googleResult = await googleResponse.json();
      if (
        !googleResponse.ok ||
        !googleResult.tokenPayloadExternal
      ) {
        console.warn(
          "GOOGLE_DECODE_FAILED",
          JSON.stringify({
            status: googleResponse.status,
            error: googleResult.error?.message ?? null,
            code: googleResult.error?.code ?? null,
          }),
        );
        return reject(
          400,
          "GOOGLE_DECODE_FAILED",
          "تعذر التحقق من الرمز لدى Google.",
          {
            google_status: googleResponse.status,
          },
        );
      }
      console.info("GOOGLE_DECODE_SUCCEEDED");
      const payload = googleResult.tokenPayloadExternal;
      const requestDetails = payload.requestDetails || {};
      const rawNonce = requestDetails.nonce;
      if (typeof rawNonce !== "string" || rawNonce.length === 0) {
        return reject(
          403,
          "MISSING_NONCE",
          "رمز التحدي غير صالح.",
        );
      }
      const nonce = normalizeIntegrityNonce(rawNonce);
      // تشخيص آمن ثم جلب التحدي بالـ nonce بعد توحيد ترميزه.
      // فحص الصلاحية والاستهلاك النهائي يتم ذرياً داخل RPC.
      console.info(
        "CHALLENGE_LOOKUP_DIAGNOSTIC",
        JSON.stringify({
          nonce_present: nonce.length > 0,
          nonce_length: nonce.length,
          google_nonce_length: rawNonce.length,
          google_nonce_had_padding: rawNonce.endsWith("="),
          nonce_normalized: rawNonce !== nonce,
          share_token_present: typeof body.share_token === "string",
          visitor_id_present: typeof body.visitor_id === "string",
          visitor_id_prefix: body.visitor_id.slice(0, 12),
          lookup_time: new Date().toISOString(),
        }),
      );

      const challengeResponse = await databaseRequest(
        `play_integrity_challenges?nonce=eq.${encodeURIComponent(nonce)}&select=nonce,share_token,visitor_id,expires_at,consumed_at`,
        "GET",
      );
      if (!challengeResponse.ok) {
        console.error(
          "CHALLENGE_READ_FAILED",
          JSON.stringify({
            status: challengeResponse.status,
          }),
        );
        throw new Error("تعذر قراءة تحدي التحقق.");
      }
      const challengeRows = await challengeResponse.json();
      const challenge = challengeRows?.[0];
      if (!challenge) {
        return reject(
          403,
          "CHALLENGE_NONCE_NOT_FOUND",
          "لم يتم العثور على تحدٍّ مطابق لقيمة nonce الواردة من Google.",
          {
            nonce_length: nonce.length,
            lookup_time: new Date().toISOString(),
          },
        );
      }
      const tokenMatches =
        challenge.share_token === body.share_token;
      const visitorMatches =
        challenge.visitor_id === body.visitor_id;
      if (!tokenMatches || !visitorMatches) {
        return reject(
          403,
          "CHALLENGE_DATA_MISMATCH",
          "بيانات التحدي لا تطابق بيانات المشاركة.",
          {
            share_token_matches: tokenMatches,
            visitor_id_matches: visitorMatches,
            challenge_expired:
              !challenge.expires_at ||
              new Date(challenge.expires_at).getTime() <= Date.now(),
            challenge_consumed: challenge.consumed_at !== null,
          },
        );
      }
      const packageName = requestDetails.requestPackageName;
      const timestamp = Number(requestDetails.timestampMillis);
      if (
        packageName !== PACKAGE_NAME ||
        !Number.isFinite(timestamp)
      ) {
        return reject(
          403,
          "PACKAGE_OR_TIMESTAMP_INVALID",
          "بيانات طلب التحقق غير مطابقة.",
          {
            package_matches: packageName === PACKAGE_NAME,
            timestamp_valid: Number.isFinite(timestamp),
          },
        );
      }
      const age = Date.now() - timestamp;
      if (age < -30000 || age > 180000) {
        return reject(
          403,
          "INTEGRITY_TOKEN_EXPIRED",
          "انتهت صلاحية رمز التحقق.",
          {
            token_age_ms: age,
          },
        );
      }
      const deviceVerdicts =
        payload.deviceIntegrity?.deviceRecognitionVerdict || [];
      const deviceTrusted =
        deviceVerdicts.includes("MEETS_DEVICE_INTEGRITY");
      if (!deviceTrusted) {
        return reject(
          403,
          "DEVICE_INTEGRITY_FAILED",
          "لم يجتز الجهاز فحص سلامة الجهاز.",
          {
            device_verdicts: deviceVerdicts,
          },
        );
      }
      console.info(
        "DEVICE_INTEGRITY_SUCCEEDED",
        JSON.stringify({
          device_verdicts: deviceVerdicts,
        }),
      );
      // استخراج هوية الزائر من جلسة Supabase
      const visitorAuth = await getVerifiedVisitorUserId(req);
      if (!visitorAuth.valid) {
        return reject(
          401,
          "VISITOR_AUTH_INVALID",
          "جلسة المستخدم غير صالحة.",
        );
      }
      // استهلاك التحدي وتسجيل الزيارة وإضافة النقطة
      // تتم جميعها ضمن معاملة واحدة في قاعدة البيانات
      const rewardResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/record_ad_share_visit_verified_atomic`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_nonce: nonce,
            p_token: body.share_token,
            p_visitor_id: body.visitor_id,
            p_visitor_user_id: visitorAuth.userId,
          }),
        },
      );
      if (!rewardResponse.ok) {
        const errorText = await rewardResponse.text();
        console.error(
          "ATOMIC_REWARD_RPC_FAILED",
          JSON.stringify({
            status: rewardResponse.status,
            error: errorText.slice(0, 1000),
          }),
        );
        throw new Error("تعذر تسجيل زيارة الإعلان.");
      }
      const visitRecorded = await rewardResponse.json();
      console.info(
        "ATOMIC_REWARD_RESULT",
        JSON.stringify({
          visit_recorded: visitRecorded === true,
        }),
      );
      return jsonResponse({
        success: true,
        verified: true,
        visit_recorded: visitRecorded === true,
        reason: visitRecorded === true
          ? "VISIT_RECORDED"
          : "DUPLICATE_OR_INELIGIBLE_VISIT",
        device_verdicts: deviceVerdicts,
        app_verdict:
          payload.appIntegrity?.appRecognitionVerdict ?? null,
        licensing_verdict:
          payload.accountDetails?.appLicensingVerdict ?? null,
      });
    }
    return jsonResponse({
      error: "إجراء غير معروف.",
    }, 400);
  } catch (error) {
    console.error(
      "PLAY_INTEGRITY_UNEXPECTED_ERROR",
      error instanceof Error
        ? error.message
        : String(error),
    );
    return jsonResponse({
      success: false,
      reason: "INTERNAL_ERROR",
      error: "حدث خطأ أثناء التحقق.",
    }, 500);
  }
});
