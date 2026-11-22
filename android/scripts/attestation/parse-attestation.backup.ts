
import "npm:reflect-metadata";
import * as asn1js from "npm:asn1js@4.1.0";
import { X509Certificate } from "npm:@peculiar/x509@3.1.0";

export interface ParsedAttestation {
  purposes: number[];
  attestationVersion: number;
  attestationSecurityLevel: number;
  keymasterVersion: number;
  keymasterSecurityLevel: number;
  attestationChallenge: Uint8Array;
  packageName: string | null;
  applicationVersion: number | null;
  signingDigests: string[];
  keyAlgorithm: number | null;
  keySize: number | null;
  ecCurve: number | null;
  deviceLocked: boolean | null;
  verifiedBootState: number | null;
}

function children(node: any): any[] {
  return Array.isArray(node?.valueBlock?.value)
    ? node.valueBlock.value
    : [];
}

function contextTag(node: any): number | null {
  const id = node?.idBlock;
  return id?.tagClass === 3 ? id.tagNumber : null;
}

function integerValue(node: any): number | null {
  const value = node?.valueBlock?.valueDec;
  return typeof value === "number" ? value : null;
}

function octets(node: any): Uint8Array {
  const value = node?.valueBlock?.valueHexView;
  if (!value) throw new Error("INVALID_OCTET_STRING");
  return new Uint8Array(value);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseApplicationId(bytes: Uint8Array): {
  packageName: string | null;
  applicationVersion: number | null;
  signingDigests: string[];
} {
  const parsed = asn1js.fromBER(bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ));

  if (parsed.offset === -1) {
    throw new Error("INVALID_APPLICATION_ID_ASN1");
  }

  let packageName: string | null = null;
  let applicationVersion: number | null = null;
  const signingDigests: string[] = [];

  for (const set of children(parsed.result)) {
    for (const sequence of children(set)) {
      const fields = children(sequence);
      if (fields.length < 2) continue;

      const nameBytes = octets(fields[0]);
      packageName = new TextDecoder().decode(nameBytes);
      applicationVersion = integerValue(fields[1]);
    }

    if (set.constructor.name === "Set") {
      for (const item of children(set)) {
        if (item.constructor.name === "OctetString") {
          signingDigests.push(hex(octets(item)));
        }
      }
    }
  }

  return { packageName, applicationVersion, signingDigests };
}

export function parseAttestation(
  certificateBase64: string,
): ParsedAttestation {
  if (
    typeof certificateBase64 !== "string" ||
    certificateBase64.length < 100 ||
    certificateBase64.length > 20_000
  ) {
    throw new Error("INVALID_CERTIFICATE_INPUT");
  }

  const binary = atob(certificateBase64);
  const certBytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  const cert = new X509Certificate(certBytes);
  const extension = cert.extensions.find(
    (item) => item.type === "1.3.6.1.4.1.11129.2.1.17",
  );

  if (!extension) {
    throw new Error("ANDROID_ATTESTATION_EXTENSION_MISSING");
  }

  const extensionBytes = new Uint8Array(extension.value);
  const parsed = asn1js.fromBER(extensionBytes.buffer.slice(
    extensionBytes.byteOffset,
    extensionBytes.byteOffset + extensionBytes.byteLength,
  ));

  if (parsed.offset === -1) {
    throw new Error("INVALID_ATTESTATION_ASN1");
  }

  const top = children(parsed.result);
  if (top.length !== 8) {
    throw new Error("INVALID_ATTESTATION_FIELD_COUNT");
  }

  const softwareEnforced = children(top[6]);
  const teeEnforced = children(top[7]);

  const applicationIdNode = softwareEnforced.find(
    (node) => contextTag(node) === 709,
  );

  if (!applicationIdNode || children(applicationIdNode).length !== 1) {
    throw new Error("ATTESTATION_APPLICATION_ID_MISSING");
  }

  const appId = parseApplicationId(
    octets(children(applicationIdNode)[0]),
  );

  const findTeeTag = (tag: number) =>
    teeEnforced.find((node) => contextTag(node) === tag);

  const purposeNode = findTeeTag(1);
const purposeSet = purposeNode ? children(purposeNode)[0] : null;

const purposes = purposeSet
  ? children(purposeSet)
      .map(integerValue)
      .filter((value): value is number => value !== null)
  : [];

  const rootNode = findTeeTag(704);
const rootSequence = rootNode ? children(rootNode)[0] : null;
const rootFields = rootSequence ? children(rootSequence) : [];

  return {
    purposes,
    attestationVersion: integerValue(top[0])!,
    attestationSecurityLevel: integerValue(top[1])!,
    keymasterVersion: integerValue(top[2])!,
    keymasterSecurityLevel: integerValue(top[3])!,
    attestationChallenge: octets(top[4]),
    ...appId,
    keyAlgorithm: findTeeTag(2)
      ? integerValue(children(findTeeTag(2))[0])
      : null,
    keySize: findTeeTag(3)
      ? integerValue(children(findTeeTag(3))[0])
      : null,
    ecCurve: findTeeTag(10)
      ? integerValue(children(findTeeTag(10))[0])
      : null,
    deviceLocked: rootFields[1]?.valueBlock?.value ?? null,
    verifiedBootState: integerValue(rootFields[2]),
  };
}

export interface AttestationPolicy {
  expectedChallenge: Uint8Array;
}

export function validateAttestation(
  attestation: ParsedAttestation,
  policy: AttestationPolicy,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const EXPECTED_PACKAGE = "com.sooqsy.app";

  // SHA-256 of the production Release signing certificate.
  const RELEASE_SIGNING_DIGEST =
    "9b065a12ef33cc64cf73adb5e8e56b737ee4471d98c09c424c56f5353dd6bb21";

  if (attestation.packageName !== EXPECTED_PACKAGE) {
    errors.push("PACKAGE_NAME_MISMATCH");
  }

  if (!attestation.signingDigests.includes(RELEASE_SIGNING_DIGEST)) {
    errors.push("RELEASE_SIGNING_CERTIFICATE_MISMATCH");
  }
// Android Keymaster purpose: SIGN = 2.
if (!attestation.purposes.includes(2)) {
  errors.push("SIGN_PURPOSE_REQUIRED");
}
  // Android SecurityLevel: TrustedEnvironment=1, StrongBox=2.
  if (
    attestation.attestationSecurityLevel !== 1 &&
    attestation.attestationSecurityLevel !== 2
  ) {
    errors.push("ATTESTATION_SECURITY_LEVEL_TOO_LOW");
  }

  if (
    attestation.keymasterSecurityLevel !== 1 &&
    attestation.keymasterSecurityLevel !== 2
  ) {
    errors.push("KEYMASTER_SECURITY_LEVEL_TOO_LOW");
  }

  // Android KeyMint: EC algorithm=3, P-256 curve=1.
  if (
    attestation.keyAlgorithm !== 3 ||
    attestation.keySize !== 256 ||
    attestation.ecCurve !== 1
  ) {
    errors.push("INVALID_DEVICE_KEY_PARAMETERS");
  }

  if (attestation.deviceLocked !== true) {
    errors.push("DEVICE_NOT_LOCKED");
  }

  // Verified boot state: Verified=0.
  if (attestation.verifiedBootState !== 0) {
    errors.push("VERIFIED_BOOT_REQUIRED");
  }

  const actual = attestation.attestationChallenge;
  const expected = policy.expectedChallenge;

  if (
    actual.length !== expected.length ||
    actual.some((byte, index) => byte !== expected[index])
  ) {
    errors.push("ATTESTATION_CHALLENGE_MISMATCH");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}



export function verifyAttestedPublicKey(
  certificateBase64: string,
  publicKeyBase64: string,
): { valid: boolean; error?: string } {
  try {
    const binary = atob(certificateBase64);
    const certBytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0),
    );

    const parsed = asn1js.fromBER(certBytes.buffer);

    if (parsed.offset === -1) {
      throw new Error("INVALID_CERTIFICATE_ASN1");
    }

    const certificateFields = children(parsed.result);
    const tbsFields = children(certificateFields[0]);

    const hasVersion =
      tbsFields[0]?.idBlock?.tagClass === 3 &&
      tbsFields[0]?.idBlock?.tagNumber === 0;

    const spkiIndex = (hasVersion ? 1 : 0) + 5;
    const spki = tbsFields[spkiIndex];

    if (!spki) {
      throw new Error("SUBJECT_PUBLIC_KEY_INFO_NOT_FOUND");
    }

    const certificateKey = new Uint8Array(spki.toBER(false));

    const appBinary = atob(publicKeyBase64);
    const appKey = Uint8Array.from(
      appBinary,
      (character) => character.charCodeAt(0),
    );

    const matches =
      certificateKey.length === appKey.length &&
      certificateKey.every(
        (byte, index) => byte === appKey[index],
      );

    return matches
      ? { valid: true }
      : { valid: false, error: "ATTESTED_PUBLIC_KEY_MISMATCH" };
  } catch {
    return {
      valid: false,
      error: "PUBLIC_KEY_VERIFICATION_FAILED",
    };
  }
}


