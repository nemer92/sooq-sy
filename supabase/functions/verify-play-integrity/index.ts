
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

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
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
): Promise<string | null> {
  const authorization = req.headers.get("Authorization");

  if (!authorization) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json();

  return typeof user.id === "string" ? user.id : null;
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
        return jsonResponse({
          success: false,
          error: "بيانات المشاركة غير صالحة.",
        }, 400);
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
        throw new Error("تعذر إنشاء تحدي التحقق.");
      }

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
        return jsonResponse({
          success: false,
          error: "بيانات مشاركة الإعلان غير صالحة.",
        }, 400);
      }

      const integrityToken = body.token;

      if (
        typeof integrityToken !== "string" ||
        integrityToken.length < 20 ||
        integrityToken.length > 20000
      ) {
        return jsonResponse({
          success: false,
          error: "رمز التحقق غير صالح.",
        }, 400);
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
        return jsonResponse({
          success: false,
          error: "تعذر التحقق من الرمز لدى Google.",
        }, 400);
      }

      const payload = googleResult.tokenPayloadExternal;
      const requestDetails = payload.requestDetails || {};
      const nonce = requestDetails.nonce;

      if (typeof nonce !== "string") {
        return jsonResponse({
          success: false,
          error: "رمز التحدي غير صالح.",
        }, 403);
      }

      const challengeResponse = await databaseRequest(
        `play_integrity_challenges?nonce=eq.${encodeURIComponent(nonce)}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=nonce,share_token,visitor_id`,
        "GET",
      );

      if (!challengeResponse.ok) {
        throw new Error("تعذر قراءة تحدي التحقق.");
      }

      const challengeRows = await challengeResponse.json();
      const challenge = challengeRows?.[0];

      if (
        !challenge ||
        challenge.share_token !== body.share_token ||
        challenge.visitor_id !== body.visitor_id
      ) {
        return jsonResponse({
          success: false,
          error: "بيانات التحدي لا تطابق بيانات المشاركة.",
        }, 403);
      }

      const packageName = requestDetails.requestPackageName;
      const timestamp = Number(requestDetails.timestampMillis);

      if (
        packageName !== PACKAGE_NAME ||
        !Number.isFinite(timestamp)
      ) {
        return jsonResponse({
          success: false,
          error: "بيانات طلب التحقق غير مطابقة.",
        }, 403);
      }

      const age = Date.now() - timestamp;

      if (age < -30000 || age > 180000) {
        return jsonResponse({
          success: false,
          error: "انتهت صلاحية رمز التحقق.",
        }, 403);
      }

      const deviceVerdicts =
        payload.deviceIntegrity?.deviceRecognitionVerdict || [];

      const deviceTrusted =
        deviceVerdicts.includes("MEETS_DEVICE_INTEGRITY");

      if (!deviceTrusted) {
        return jsonResponse({
          success: false,
          error: "لم يجتز الجهاز فحص سلامة الجهاز.",
          device_verdicts: deviceVerdicts,
        }, 403);
      }

      // استهلاك التحدي مرة واحدة فقط
      const consumeResponse = await databaseRequest(
        `play_integrity_challenges?nonce=eq.${encodeURIComponent(nonce)}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
        "PATCH",
        {
          consumed_at: new Date().toISOString(),
        },
      );

      if (!consumeResponse.ok) {
        throw new Error("تعذر تأكيد استخدام التحدي.");
      }

      const consumedRows = await consumeResponse.json();

      if (!Array.isArray(consumedRows) || consumedRows.length !== 1) {
        return jsonResponse({
          success: false,
          error: "التحدي غير موجود أو منتهي أو مستخدم سابقاً.",
        }, 403);
      }

      // استخراج هوية الزائر من جلسة Supabase
      const visitorUserId = await getVerifiedVisitorUserId(req);

      // تسجيل الزيارة عبر الدالة الآمنة الجديدة
      const rewardResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/record_ad_share_visit_verified`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_token: body.share_token,
            p_visitor_id: body.visitor_id,
            p_visitor_user_id: visitorUserId,
          }),
        },
      );

      if (!rewardResponse.ok) {
        console.error(
          "Reward RPC failed:",
          await rewardResponse.text(),
        );

        throw new Error("تعذر تسجيل زيارة الإعلان.");
      }

      const visitRecorded = await rewardResponse.json();

      return jsonResponse({
        success: true,
        verified: true,
        visit_recorded: visitRecorded === true,
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
    console.error("Play Integrity error:", error);

    return jsonResponse({
      success: false,
      error: "حدث خطأ أثناء التحقق.",
    }, 500);
  }
});
