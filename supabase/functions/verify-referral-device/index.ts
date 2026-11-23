
import {
  parseAttestation,
  validateAttestation,
  verifyAttestedPublicKey,
} from "../_shared/attestation/parse-attestation.ts";

import { verifyCertificateChain } from "../_shared/attestation/verify-chain.ts";
import { X509Certificate } from "npm:@peculiar/x509@3.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_REQUEST_BYTES = 150_000;
const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const RATE_WINDOW_SECONDS = 600;
const DEVICE_RATE_LIMIT = 20;

const RATE_LIMITS: Record<
  string,
  { limit: number; windowSeconds: number }
> = {
  create_challenge: { limit: 5, windowSeconds: 600 },
  verify: { limit: 10, windowSeconds: 600 },
  create_proof_challenge: { limit: 10, windowSeconds: 600 },
  verify_proof: { limit: 15, windowSeconds: 600 },
};

const json = (
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function readJsonLimited(
  req: Request,
  maxBytes = MAX_REQUEST_BYTES,
): Promise<any> {
  const reader = req.body?.getReader();

  if (!reader) {
    throw new Error("EMPTY_REQUEST_BODY");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("REQUEST_TOO_LARGE");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function decodeBase64(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    value.length % 4 !== 0
  ) {
    throw new Error("INVALID_BASE64");
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

  let canonical = "";
  for (const b of bytes) canonical += String.fromCharCode(b);

  if (btoa(canonical) !== value) {
    throw new Error("NON_CANONICAL_BASE64");
  }

  return bytes;
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(value)) {
    throw new Error("INVALID_CHALLENGE");
  }

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);

  return decodeBase64(padded);
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function fingerprint(publicKey: string): Promise<string> {
  const der = decodeBase64(publicKey);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(der),
  );

  return encodeBase64Url(new Uint8Array(digest));
}

function derEcdsaToRaw(signature: Uint8Array): Uint8Array {
  let offset = 0;

  const readLength = (): number => {
    const first = signature[offset++];

    if (first === undefined) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    if (first < 128) return first;

    const count = first & 0x7f;

    if (count < 1 || count > 2 || offset + count > signature.length) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    let length = 0;

    for (let i = 0; i < count; i++) {
      length = (length << 8) | signature[offset++];
    }

    if (length < 128) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    return length;
  };

  if (signature[offset++] !== 0x30) {
    throw new Error("INVALID_ECDSA_SIGNATURE");
  }

  const sequenceLength = readLength();

  if (offset + sequenceLength !== signature.length) {
    throw new Error("INVALID_ECDSA_SIGNATURE");
  }

  const readInteger = (): Uint8Array => {
    if (signature[offset++] !== 0x02) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    const length = readLength();

    if (length < 1 || offset + length > signature.length) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    let value = signature.slice(offset, offset + length);
    offset += length;

    if (value[0] & 0x80) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    while (value.length > 1 && value[0] === 0) {
      value = value.slice(1);
    }

    if (value.length > 32) {
      throw new Error("INVALID_ECDSA_SIGNATURE");
    }

    const result = new Uint8Array(32);
    result.set(value, 32 - value.length);

    return result;
  };

  const r = readInteger();
  const s = readInteger();

  if (offset !== signature.length) {
    throw new Error("INVALID_ECDSA_SIGNATURE");
  }

  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);

  return raw;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RATE_LIMIT_SECRET = Deno.env.get("REFERRAL_RATE_LIMIT_SECRET");

function supabaseRequest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

// لا نستخدم x-forwarded-for كبديل.
function isValidClientIp(value: string): boolean {
  if (
    value.length < 2 ||
    value.length > 45 ||
    value !== value.trim() ||
    value.includes(",") ||
    /[\s%/\\]/.test(value)
  ) {
    return false;
  }

  // IPv4
  if (value.includes(".")) {
    const parts = value.split(".");

    if (parts.length !== 4) return false;

    return parts.every((part) => {
      if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) {
        return false;
      }

      const number = Number(part);
      return number >= 0 && number <= 255;
    });
  }

  // IPv6
  if (!value.includes(":")) {
    return false;
  }

  try {
    const parsed = new URL(`http://[${value}]/`);
    return parsed.hostname.length > 2;
  } catch {
    return false;
  }
}

function getTrustedClientIp(req: Request): string | null {
  const value = req.headers.get("cf-connecting-ip");

  if (!value || !isValidClientIp(value)) {
    return null;
  }

  return value;
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  if (!RATE_LIMIT_SECRET) {
    throw new Error("RATE_LIMIT_SECRET_NOT_CONFIGURED");
  }

  if (!hmacKeyPromise) {
    const secretBytes = decodeBase64Url(RATE_LIMIT_SECRET);

    if (secretBytes.length !== 32) {
      throw new Error("INVALID_RATE_LIMIT_SECRET");
    }

    hmacKeyPromise = crypto.subtle.importKey(
      "raw",
      toArrayBuffer(secretBytes),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }

  return await hmacKeyPromise;
}

async function createRateBucketKey(value: string): Promise<string> {
  const key = await getHmacKey();

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(new TextEncoder().encode(value)),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  currentCount: number;
}

async function consumeRateLimit(
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const bucketKey = await createRateBucketKey(identity);

  const response = await supabaseRequest(
    "rpc/consume_referral_rate_limit",
    {
      method: "POST",
      body: JSON.stringify({
        p_bucket_key: bucketKey,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
    },
  );

  if (!response.ok) {
    console.error(
      "Rate limit RPC failed:",
      response.status,
      await response.text(),
    );

    throw new Error("RATE_LIMIT_CHECK_FAILED");
  }

  const result = await response.json();
  const row = Array.isArray(result) ? result[0] : result;

  if (
    !row ||
    typeof row.allowed !== "boolean" ||
    !Number.isInteger(row.retry_after_seconds) ||
    !Number.isInteger(row.current_count)
  ) {
    throw new Error("INVALID_RATE_LIMIT_RESPONSE");
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: row.retry_after_seconds,
    currentCount: row.current_count,
  };
}

async function enforceRateLimits(
  action: string,
  ip: string,
  body: any,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const config = RATE_LIMITS[action];

  if (!config) {
    throw new Error("UNKNOWN_ACTION");
  }

  const ipResult = await consumeRateLimit(
    `ip:${action}:${ip}`,
    config.limit,
    config.windowSeconds,
  );

  if (!ipResult.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: ipResult.retryAfterSeconds,
    };
  }

  if (
    typeof body.public_key === "string" &&
    body.public_key.length >= 100 &&
    body.public_key.length <= 2000
  ) {
    try {
      const keyFingerprint = await fingerprint(body.public_key);

      const deviceResult = await consumeRateLimit(
        `device:${action}:${keyFingerprint}`,
        DEVICE_RATE_LIMIT,
        RATE_WINDOW_SECONDS,
      );

      if (!deviceResult.allowed) {
        return {
          allowed: false,
          retryAfterSeconds: deviceResult.retryAfterSeconds,
        };
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message !== "INVALID_BASE64" &&
        error.message !== "NON_CANONICAL_BASE64"
      ) {
        throw error;
      }
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function getTrustedRoots(): Promise<string[]> {
  const value = Deno.env.get("ANDROID_KEY_ATTESTATION_ROOTS");

  if (!value) {
    throw new Error("ATTESTATION_ROOTS_NOT_CONFIGURED");
  }

  const roots = JSON.parse(value);

  if (
    !Array.isArray(roots) ||
    roots.length < 1 ||
    roots.length > 10 ||
    roots.some(
      (x: unknown) =>
        typeof x !== "string" ||
        !x.includes("-----BEGIN CERTIFICATE-----") ||
        !x.includes("-----END CERTIFICATE-----"),
    )
  ) {
    throw new Error("INVALID_ATTESTATION_ROOTS");
  }

  return roots;
}

let statusCache: {
  entries: Record<string, unknown>;
  expiresAt: number;
} | null = null;

function normalizeSerial(value: string): string {
  const normalized = value
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase();

  return normalized.replace(/^0+/, "") || "0";
}

async function getRevocationEntries(): Promise<Record<string, unknown>> {
  if (statusCache && Date.now() < statusCache.expiresAt) {
    return statusCache.entries;
  }

  const response = await fetch(
    "https://android.googleapis.com/attestation/status",
  );

  if (!response.ok) {
    throw new Error("ATTESTATION_STATUS_UNAVAILABLE");
  }

  const data = await response.json();

  if (
    !data ||
    typeof data.entries !== "object" ||
    data.entries === null ||
    Array.isArray(data.entries)
  ) {
    throw new Error("INVALID_ATTESTATION_STATUS_RESPONSE");
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAge = match ? Number(match[1]) : 0;

  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    throw new Error("INVALID_ATTESTATION_STATUS_CACHE");
  }

  statusCache = {
    entries: data.entries,
    expiresAt: Date.now() + Math.min(maxAge, 86400) * 1000,
  };

  return statusCache.entries;
}

async function checkCertificateStatus(chain: string[]): Promise<void> {
  const entries = await getRevocationEntries();

  for (const encoded of chain) {
    const bytes = decodeBase64(encoded);
    const cert = new X509Certificate(toArrayBuffer(bytes));

    const serial = normalizeSerial(cert.serialNumber);
    const status = entries[serial];

    if (status === "REVOKED" || status === "SUSPENDED") {
      throw new Error("ATTESTATION_CERTIFICATE_REVOKED_OR_SUSPENDED");
    }
  }
}

function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function isValidReferralCode(value: string): boolean {
  return /^[A-Z0-9]{2,100}$/.test(value);
}

function validateChallenge(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("INVALID_CHALLENGE");
  }

  const bytes = decodeBase64Url(value);

  if (bytes.length !== 32) {
    throw new Error("INVALID_CHALLENGE");
  }

  return value;
}

async function verifySignature(
  publicKeyBase64: string,
  challenge: string,
  signatureBase64: string,
): Promise<boolean> {
  const publicKeyBytes = decodeBase64(publicKeyBase64);

  if (
    publicKeyBytes.length < 80 ||
    publicKeyBytes.length > 1000
  ) {
    throw new Error("INVALID_PUBLIC_KEY");
  }

  const key = await crypto.subtle.importKey(
    "spki",
    toArrayBuffer(publicKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  const rawSignature = derEcdsaToRaw(
    decodeBase64(signatureBase64),
  );

  return await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    toArrayBuffer(rawSignature),
    toArrayBuffer(new TextEncoder().encode(challenge)),
  );
}

async function lookupChallenge(
  challenge: string,
  referralCode: string | null,
  purpose: "attestation" | "proof",
  keyFingerprint?: string,
): Promise<boolean> {
  const filters: Record<string, string> = {
    select: "challenge,referral_code,expires_at,consumed_at,purpose,key_fingerprint",
    challenge: `eq.${challenge}`,
    referral_code: referralCode === null
      ? "is.null"
      : `eq.${referralCode}`,
    purpose: `eq.${purpose}`,
    consumed_at: "is.null",
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  };

  if (keyFingerprint) {
    filters.key_fingerprint = `eq.${keyFingerprint}`;
  }

  const response = await supabaseRequest(
    `referral_attestation_challenges?${new URLSearchParams(filters)}`,
  );

  if (!response.ok) {
    throw new Error("CHALLENGE_LOOKUP_FAILED");
  }

  const rows = await response.json();

  return Array.isArray(rows) && rows.length === 1;
}

async function createInitialChallenge(
  referralCode: string | null,
) {
  // رمز الإحالة اختياري. إذا تم إرساله، يجب أن يكون موجوداً.
  if (referralCode !== null) {
    const codeParams = new URLSearchParams({
      select: "code",
      code: `eq.${referralCode}`,
      limit: "1",
    });

    const codeResponse = await supabaseRequest(
      `referral_codes?${codeParams}`,
    );

    if (!codeResponse.ok) {
      throw new Error("REFERRAL_LOOKUP_FAILED");
    }

    const codes = await codeResponse.json();

    if (!Array.isArray(codes) || codes.length !== 1) {
      throw new Error("INVALID_REFERRAL_CODE");
    }
  }

  const challenge = encodeBase64Url(
    crypto.getRandomValues(new Uint8Array(32)),
  );

  const expiresAt = new Date(
    Date.now() + CHALLENGE_TTL_MS,
  ).toISOString();

  const insertResponse = await supabaseRequest(
    "referral_attestation_challenges",
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        challenge,
        referral_code: referralCode,
        expires_at: expiresAt,
        purpose: "attestation",
      }),
    },
  );

  if (!insertResponse.ok) {
    console.error(
      "Challenge insert failed:",
      await insertResponse.text(),
    );

    throw new Error("CHALLENGE_CREATION_FAILED");
  }

  return { challenge, expires_at: expiresAt };
}

async function createProofChallenge(
  referralCode: string | null,
  publicKey: string,
) {
  const publicKeyBytes = decodeBase64(publicKey);

  if (
    publicKeyBytes.length < 80 ||
    publicKeyBytes.length > 1000
  ) {
    throw new Error("INVALID_PUBLIC_KEY");
  }

  const keyFingerprint = await fingerprint(publicKey);

  const challenge = encodeBase64Url(
    crypto.getRandomValues(new Uint8Array(32)),
  );

  const response = await supabaseRequest(
    "rpc/create_referral_device_proof_challenge",
    {
      method: "POST",
      body: JSON.stringify({
        p_key_fingerprint: keyFingerprint,
        p_referral_code: referralCode,
        p_challenge: challenge,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Proof challenge creation failed:",
      response.status,
      errorText,
    );

    let databaseMessage = "";

    try {
      const databaseError = JSON.parse(errorText);
      databaseMessage =
        typeof databaseError.message === "string"
          ? databaseError.message
          : "";
    } catch {
      // استجابة غير JSON.
    }

    if (
      databaseMessage.includes("DEVICE_KEY_NOT_REGISTERED")
    ) {
      throw new Error("REGISTERED_DEVICE_KEY_NOT_FOUND");
    }

    throw new Error("PROOF_CHALLENGE_CREATION_FAILED");
  }

  const result = await response.json();

  const expiresAt =
    typeof result === "string" && !Number.isNaN(Date.parse(result))
      ? result
      : new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  return {
    challenge,
    expires_at: expiresAt,
    key_fingerprint: keyFingerprint,
  };
}

async function verifyInitialDevice(
  body: any,
  referralCode: string | null,
) {
  const challenge = validateChallenge(body.challenge);
  const publicKey = body.public_key;
  const signature = body.signature;
  const chain = body.certificate_chain;

  if (
    typeof publicKey !== "string" ||
    typeof signature !== "string" ||
    !Array.isArray(chain) ||
    chain.length < 2 ||
    chain.length > 10 ||
    chain.some(
      (x: unknown) =>
        typeof x !== "string" || x.length > 30_000,
    )
  ) {
    throw new Error("INVALID_INPUT");
  }

  const publicKeyBytes = decodeBase64(publicKey);

  if (
    publicKeyBytes.length < 80 ||
    publicKeyBytes.length > 1000
  ) {
    throw new Error("INVALID_PUBLIC_KEY");
  }

  const keyFingerprint = await fingerprint(publicKey);

  const challengeExists = await lookupChallenge(
    challenge,
    referralCode,
    "attestation",
  );

  if (!challengeExists) {
    throw new Error("CHALLENGE_INVALID_OR_EXPIRED");
  }

  const signatureValid = await verifySignature(
    publicKey,
    challenge,
    signature,
  );

  if (!signatureValid) {
    throw new Error("INVALID_DEVICE_SIGNATURE");
  }

  const roots = await getTrustedRoots();

  const chainResult = await verifyCertificateChain(
    chain,
    roots,
  );

  if (!chainResult.valid) {
    console.error(
      "Certificate chain rejected:",
      chainResult.errors,
    );

    throw new Error("CERTIFICATE_CHAIN_INVALID");
  }

  await checkCertificateStatus(chain);

  const publicKeyResult = verifyAttestedPublicKey(
    chain[0],
    publicKey,
  );

  if (!publicKeyResult.valid) {
    throw new Error("ATTESTED_PUBLIC_KEY_MISMATCH");
  }

  const challengeBytes = decodeBase64Url(challenge);
  const attestation = parseAttestation(chain[0]);

  const policyResult = validateAttestation(attestation, {
    expectedChallenge: challengeBytes,
  });

  if (!policyResult.valid) {
    console.error(
      "Attestation policy rejected:",
      policyResult.errors,
    );

    throw new Error("ATTESTATION_POLICY_REJECTED");
  }

  const finalizeResponse = await supabaseRequest(
    "rpc/register_referral_device_key_and_claim",
    {
      method: "POST",
      body: JSON.stringify({
        p_challenge: challenge,
        p_key_fingerprint: keyFingerprint,
        p_public_key: publicKey,
        p_certificate_chain: chain,
        p_referral_code: referralCode,
      }),
    },
  );

  if (!finalizeResponse.ok) {
    console.error(
      "Device registration failed:",
      await finalizeResponse.text(),
    );

    throw new Error("DEVICE_CLAIM_FINALIZATION_FAILED");
  }

  const claimId = await finalizeResponse.json();

  return {
    verified: true,
    claim_id: claimId,
    key_fingerprint: keyFingerprint,
    referral_code: referralCode,
  };
}

async function verifyExistingDevice(
  body: any,
  referralCode: string | null,
) {
  const challenge = validateChallenge(body.challenge);
  const publicKey = body.public_key;
  const signature = body.signature;

  if (
    typeof publicKey !== "string" ||
    typeof signature !== "string"
  ) {
    throw new Error("INVALID_INPUT");
  }

  const keyFingerprint = await fingerprint(publicKey);

  const challengeExists = await lookupChallenge(
    challenge,
    referralCode,
    "proof",
    keyFingerprint,
  );

  if (!challengeExists) {
    throw new Error("PROOF_CHALLENGE_INVALID_OR_EXPIRED");
  }

  const keyParams = new URLSearchParams({
    select: "public_key,verified_at",
    key_fingerprint: `eq.${keyFingerprint}`,
    limit: "1",
  });

  const keyResponse = await supabaseRequest(
    `referral_device_keys?${keyParams}`,
  );

  if (!keyResponse.ok) {
    throw new Error("DEVICE_KEY_LOOKUP_FAILED");
  }

  const keyRows = await keyResponse.json();

  if (
    !Array.isArray(keyRows) ||
    keyRows.length !== 1 ||
    keyRows[0].public_key !== publicKey ||
    !keyRows[0].verified_at
  ) {
    throw new Error("REGISTERED_DEVICE_KEY_NOT_FOUND");
  }

  const signatureValid = await verifySignature(
    keyRows[0].public_key,
    challenge,
    signature,
  );

  if (!signatureValid) {
    throw new Error("INVALID_DEVICE_SIGNATURE");
  }

  const finalizeResponse = await supabaseRequest(
    "rpc/finalize_referral_device_proof",
    {
      method: "POST",
      body: JSON.stringify({
        p_challenge: challenge,
        p_key_fingerprint: keyFingerprint,
        p_public_key: publicKey,
        p_referral_code: referralCode,
      }),
    },
  );

  if (!finalizeResponse.ok) {
    console.error(
      "Proof finalization failed:",
      await finalizeResponse.text(),
    );

    throw new Error("DEVICE_PROOF_FINALIZATION_FAILED");
  }

  const claimId = await finalizeResponse.json();

  return {
    verified: true,
    claim_id: claimId,
    key_fingerprint: keyFingerprint,
    referral_code: referralCode,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
    }

    if (!RATE_LIMIT_SECRET) {
      return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
    }

    const clientIp = getTrustedClientIp(req);

    if (!clientIp) {
      return json({ error: "CLIENT_IP_UNAVAILABLE" }, 403);
    }

    const contentLengthHeader = req.headers.get("content-length");

    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);

      if (
        !Number.isSafeInteger(contentLength) ||
        contentLength < 0 ||
        contentLength > MAX_REQUEST_BYTES
      ) {
        return json({ error: "REQUEST_TOO_LARGE" }, 413);
      }
    }

    const body = await readJsonLimited(req);
    const action = body?.action;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    if (
      typeof action !== "string" ||
      !Object.prototype.hasOwnProperty.call(RATE_LIMITS, action)
    ) {
      return json({ error: "UNKNOWN_ACTION" }, 400);
    }

    const rateResult = await enforceRateLimits(
      action,
      clientIp,
      body,
    );

    if (!rateResult.allowed) {
      return json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          retry_after_seconds: rateResult.retryAfterSeconds,
        },
        429,
        {
          "Retry-After": String(rateResult.retryAfterSeconds),
        },
      );
    }

    // رمز الإحالة اختياري، لكن إذا أُرسل يجب أن يكون صالحاً.
    const referralCode = normalizeReferralCode(body.referral_code);

    if (
      referralCode !== null &&
      !isValidReferralCode(referralCode)
    ) {
      return json({ error: "INVALID_REFERRAL_CODE" }, 400);
    }

    if (action === "create_challenge") {
      const result = await createInitialChallenge(referralCode);
      return json(result);
    }

    if (action === "verify") {
      const result = await verifyInitialDevice(body, referralCode);
      return json(result);
    }

    if (action === "create_proof_challenge") {
      if (typeof body.public_key !== "string") {
        return json({ error: "INVALID_PUBLIC_KEY" }, 400);
      }

      const result = await createProofChallenge(
        referralCode,
        body.public_key,
      );

      return json(result);
    }

    if (action === "verify_proof") {
      const result = await verifyExistingDevice(
        body,
        referralCode,
      );

      return json(result);
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "INTERNAL_ERROR";

    console.error("verify-referral-device failed:", message);

    if (message === "REQUEST_TOO_LARGE") {
      return json({ error: "REQUEST_TOO_LARGE" }, 413);
    }

    if (
      message === "INVALID_JSON" ||
      message === "EMPTY_REQUEST_BODY"
    ) {
      return json({ error: "INVALID_REQUEST_BODY" }, 400);
    }

    const clientErrors = new Set([
      "INVALID_REFERRAL_CODE",
      "INVALID_INPUT",
      "INVALID_CHALLENGE",
      "INVALID_PUBLIC_KEY",
      "INVALID_BASE64",
      "NON_CANONICAL_BASE64",
      "INVALID_DEVICE_SIGNATURE",
      "CHALLENGE_INVALID_OR_EXPIRED",
      "PROOF_CHALLENGE_INVALID_OR_EXPIRED",
      "REGISTERED_DEVICE_KEY_NOT_FOUND",
      "ATTESTED_PUBLIC_KEY_MISMATCH",
      "CERTIFICATE_CHAIN_INVALID",
      "ATTESTATION_POLICY_REJECTED",
    ]);

    if (clientErrors.has(message)) {
      return json({ error: message }, 400);
    }

    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
