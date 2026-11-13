
const FIREBASE_PROJECT_ID = "sooq-sy-ca531";

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodePrivateKey(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getFirebaseAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  token_uri: string;
}) {
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncode(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );

  const claims = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );

  const unsignedToken = `${header}.${claims}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodePrivateKey(serviceAccount.private_key),
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
    `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error("Firebase authentication failed.");
  }

  return result.access_token as string;
}

async function getRows(
  table: string,
  filters: Record<string, string>,
  serviceKey: string,
  supabaseUrl: string,
) {
  const params = new URLSearchParams({ select: "*" });

  for (const [key, value] of Object.entries(filters)) {
    params.set(key, value);
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Could not read ${table} from Supabase.`);
  }

  return await response.json();
}

async function sendToDevice(
  token: string,
  accessToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: {
            priority: "HIGH",
          },
        },
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("FCM delivery failed:", result);
    return false;
  }

  return true;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    const suppliedSecret = request.headers.get("x-webhook-secret");

    if (!webhookSecret || suppliedSecret !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const serviceAccountEncoded = Deno.env.get(
      "FIREBASE_SERVICE_ACCOUNT_B64",
    );
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceAccountEncoded || !serviceKey || !supabaseUrl) {
      throw new Error("Required server configuration is missing.");
    }

    const serviceAccountJson = new TextDecoder().decode(
      Uint8Array.from(atob(serviceAccountEncoded), (char) =>
        char.charCodeAt(0)
      ),
    );

    const serviceAccount = JSON.parse(serviceAccountJson);

    if (serviceAccount.project_id !== FIREBASE_PROJECT_ID) {
      throw new Error("Firebase project ID mismatch.");
    }

    const event = await request.json();
    const table = event.table;
    const record = event.record;

    if (!record || !["messages", "user_notifications"].includes(table)) {
      return Response.json({ error: "Unsupported event" }, { status: 400 });
    }

    let recipientId: string;
    let title: string;
    let body: string;
    let data: Record<string, string>;

    if (table === "messages") {
      const message = record;

      if (
        !message.conversation_id ||
        !message.sender_id ||
        !message.body
      ) {
        return Response.json({ error: "Invalid message record" }, {
          status: 400,
        });
      }

      const conversations = await getRows(
        "conversations",
        { id: `eq.${message.conversation_id}` },
        serviceKey,
        supabaseUrl,
      );

      const conversation = conversations[0];

      if (!conversation) {
        return Response.json({ error: "Conversation not found" }, {
          status: 404,
        });
      }

      if (message.sender_id === conversation.buyer_id) {
        recipientId = conversation.seller_id;
      } else if (message.sender_id === conversation.seller_id) {
        recipientId = conversation.buyer_id;
      } else {
        return Response.json({ error: "Sender is not a participant" }, {
          status: 403,
        });
      }

      title = "رسالة جديدة";
      body = String(message.body).slice(0, 180);

      data = {
        type: "message",
        conversation_id: String(message.conversation_id),
        message_id: String(message.id),
      };
    } else {
      const userNotification = record;

      if (!userNotification.user_id || !userNotification.notification_id) {
        return Response.json({ error: "Invalid notification record" }, {
          status: 400,
        });
      }

      recipientId = userNotification.user_id;

      const notifications = await getRows(
        "notifications",
        { id: `eq.${userNotification.notification_id}` },
        serviceKey,
        supabaseUrl,
      );

      const notification = notifications[0];

      if (!notification) {
        return Response.json({ error: "Notification not found" }, {
          status: 404,
        });
      }

      title = String(notification.title);
      body = String(notification.body).slice(0, 180);

      data = {
        type: "admin_notification",
        notification_id: String(userNotification.notification_id),
        user_notification_id: String(userNotification.id),
        link: notification.link ? String(notification.link) : "",
      };
    }

    const devices = await getRows(
      "push_tokens",
      { user_id: `eq.${recipientId}` },
      serviceKey,
      supabaseUrl,
    );

    if (!devices.length) {
      return Response.json({
        success: true,
        sent: 0,
        message: "No registered devices for recipient.",
      });
    }

    const accessToken = await getFirebaseAccessToken(serviceAccount);

    const results = await Promise.all(
      devices.map((device: { token: string }) =>
        sendToDevice(device.token, accessToken, title, body, data)
      ),
    );

    const sent = results.filter(Boolean).length;

    return Response.json({
      success: true,
      sent,
      failed: results.length - sent,
    });
  } catch (error) {
    console.error("send-push error:", error);

    return Response.json(
      { error: "Push notification processing failed." },
      { status: 500 },
    );
  }
});
