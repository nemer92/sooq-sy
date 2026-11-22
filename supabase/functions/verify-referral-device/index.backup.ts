
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Convert Uint8Array into a guaranteed ArrayBuffer for Web Crypto.
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function decodeBase64(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
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

// Android Java SHA256withECDSA returns ASN.1 DER.
// Web Crypto ECDSA verification expects fixed-width r||s.
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

  if (!data || typeof data.entries !== "object" || !data.entries) {
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

    const cert = new X509Certificate(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );

    const serial = normalizeSerial(cert.serialNumber);
    const status = entries[serial];

    if (status === "REVOKED" || status === "SUSPENDED") {
      throw new Error("ATTESTATION_CERTIFICATE_REVOKED_OR_SUSPENDED");
    }
  }
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

    const contentLength = Number(
      req.headers.get("content-length") ?? "0",
    );

    if (contentLength > 150_000) {
      return json({ error: "REQUEST_TOO_LARGE" }, 413);
    }

    const body = await req.json();
    const action = body?.action;

    // ----------------------------------------
    // CREATE CHALLENGE
    // ----------------------------------------

    if (action === "create_challenge") {
      const referralCode =
        typeof body.referral_code === "string"
          ? body.referral_code.trim().toUpperCase()
          : "";

      if (!/^[A-Z0-9]{2,100}$/.test(referralCode)) {
        return json({ error: "INVALID_REFERRAL_CODE" }, 400);
      }

      const codeParams = new URLSearchParams({
        select: "code",
        code: `eq.${referralCode}`,
        limit: "1",
      });

      const codeResponse = await supabaseRequest(
        `referral_codes?${codeParams}`,
      );

      if (!codeResponse.ok) {
        return json({ error: "REFERRAL_LOOKUP_FAILED" }, 500);
      }

      const codes = await codeResponse.json();

      if (!Array.isArray(codes) || codes.length !== 1) {
        return json({ error: "INVALID_REFERRAL_CODE" }, 400);
      }

      const challenge = encodeBase64Url(
        crypto.getRandomValues(new Uint8Array(32)),
      );

      const expiresAt = new Date(
        Date.now() + 3 * 60 * 1000,
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
          }),
        },
      );

      if (!insertResponse.ok) {
        console.error(
          "Challenge insert failed:",
          await insertResponse.text(),
        );

        return json({ error: "CHALLENGE_CREATION_FAILED" }, 500);
      }

      return json({
        challenge,
        expires_at: expiresAt,
      });
    }

    // ----------------------------------------
    // VERIFY DEVICE
    // ----------------------------------------

    if (action === "verify") {
      const challenge = body?.challenge;

      const referralCode =
        typeof body?.referral_code === "string"
          ? body.referral_code.trim().toUpperCase()
          : "";

      const publicKey = body?.public_key;
      const signature = body?.signature;
      const chain = body?.certificate_chain;

      if (
        typeof challenge !== "string" ||
        typeof publicKey !== "string" ||
        typeof signature !== "string" ||
        !Array.isArray(chain) ||
        chain.length < 2 ||
        chain.length > 10 ||
        chain.some(
          (x: unknown) =>
            typeof x !== "string" || x.length > 30000,
        ) ||
        !/^[A-Z0-9]{2,100}$/.test(referralCode)
      ) {
        return json({ error: "INVALID_INPUT" }, 400);
      }

      const challengeBytes = decodeBase64Url(challenge);

      if (challengeBytes.length !== 32) {
        return json({ error: "INVALID_CHALLENGE" }, 400);
      }

      const publicKeyBytes = decodeBase64(publicKey);

      if (
        publicKeyBytes.length < 80 ||
        publicKeyBytes.length > 1000
      ) {
        return json({ error: "INVALID_PUBLIC_KEY" }, 400);
      }

      const keyFingerprint = await fingerprint(publicKey);

      const challengeParams = new URLSearchParams({
        select: "challenge,referral_code,expires_at,consumed_at",
        challenge: `eq.${challenge}`,
        referral_code: `eq.${referralCode}`,
        consumed_at: "is.null",
        expires_at: `gt.${new Date().toISOString()}`,
        limit: "1",
      });

      const challengeResponse = await supabaseRequest(
        `referral_attestation_challenges?${challengeParams}`,
      );

      if (!challengeResponse.ok) {
        return json({ error: "CHALLENGE_LOOKUP_FAILED" }, 500);
      }

      const challengeRows = await challengeResponse.json();

      if (
        !Array.isArray(challengeRows) ||
        challengeRows.length !== 1
      ) {
        return json(
          { error: "CHALLENGE_INVALID_OR_EXPIRED" },
          400,
        );
      }

      // Verify proof of possession of the private key.
      const key = await crypto.subtle.importKey(
        "spki",
        toArrayBuffer(publicKeyBytes),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );

      const rawSignature = derEcdsaToRaw(
        decodeBase64(signature),
      );

      const signatureValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        toArrayBuffer(rawSignature),
        toArrayBuffer(new TextEncoder().encode(challenge)),
      );

      if (!signatureValid) {
        return json({ error: "INVALID_DEVICE_SIGNATURE" }, 401);
      }

      // Verify certificate chain against trusted Google roots.
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

        return json({ error: "CERTIFICATE_CHAIN_INVALID" }, 401);
      }

      // Check revocation/suspension status.
      await checkCertificateStatus(chain);

      // Verify that the supplied public key belongs to the leaf certificate.
      const leafCertificate = chain[0];

      const publicKeyResult = verifyAttestedPublicKey(
        leafCertificate,
        publicKey,
      );

      if (!publicKeyResult.valid) {
        return json(
          { error: "ATTESTED_PUBLIC_KEY_MISMATCH" },
          401,
        );
      }

      // Parse and validate Android Key Attestation policy.
      const attestation = parseAttestation(leafCertificate);

      const policyResult = validateAttestation(attestation, {
        expectedChallenge: challengeBytes,
      });

      if (!policyResult.valid) {
        console.error(
          "Attestation policy rejected:",
          policyResult.errors,
        );

        return json(
          { error: "ATTESTATION_POLICY_REJECTED" },
          401,
        );
      }

      // Atomically finalize the verified device claim.
      const finalizeResponse = await supabaseRequest(
        "rpc/finalize_referral_device_claim",
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
        const errorText = await finalizeResponse.text();

        console.error(
          "Claim finalization failed:",
          errorText,
        );

        return json(
          { error: "DEVICE_CLAIM_FINALIZATION_FAILED" },
          409,
        );
      }

      const claimId = await finalizeResponse.json();

      return json({
        verified: true,
        claim_id: claimId,
        key_fingerprint: keyFingerprint,
        referral_code: referralCode,
      });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("verify-referral-device error:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "INTERNAL_ERROR",
      },
      500,
    );
  }
});
