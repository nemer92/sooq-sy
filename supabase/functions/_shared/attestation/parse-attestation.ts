
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

const TAG = {
  INTEGER: 2,
  OCTET_STRING: 4,
  ENUMERATED: 10,
  SEQUENCE: 16,
  SET: 17,
  BOOLEAN: 1,
};

const ANDROID_ATTESTATION_OID = "1.3.6.1.4.1.11129.2.1.17";
const RELEASE_SIGNING_DIGEST =
  "6e9dfa48d98ff81503ea4a173990e89fa07263f90b6bf31f11d9dc1825e286db";

function children(node: any): any[] {
  const value = node?.valueBlock?.value;
  return Array.isArray(value) ? value : [];
}

function isUniversal(node: any, tag: number): boolean {
  return node?.idBlock?.tagClass === 1 &&
    node?.idBlock?.tagNumber === tag;
}

function contextTag(node: any): number | null {
  return node?.idBlock?.tagClass === 3
    ? node.idBlock.tagNumber
    : null;
}

function assertSequence(node: any, code: string): any[] {
  if (!isUniversal(node, TAG.SEQUENCE)) {
    throw new Error(code);
  }
  return children(node);
}

function assertOctetString(node: any, code: string): Uint8Array {
  if (!isUniversal(node, TAG.OCTET_STRING)) {
    throw new Error(code);
  }

  const value = node.valueBlock?.valueHexView;

  if (!(value instanceof Uint8Array)) {
    throw new Error(code);
  }

  return new Uint8Array(value);
}

function assertInteger(node: any, code: string): number {
  if (
    !isUniversal(node, TAG.INTEGER) &&
    !isUniversal(node, TAG.ENUMERATED)
  ) {
    throw new Error(code);
  }

  const value = node.valueBlock?.valueDec;

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(code);
  }

  return value;
}

function assertBoolean(node: any, code: string): boolean {
  if (!isUniversal(node, TAG.BOOLEAN)) {
    throw new Error(code);
  }

  const value = node.valueBlock?.value;

  if (typeof value !== "boolean") {
    throw new Error(code);
  }

  return value;
}

function parseDer(bytes: Uint8Array, code: string): any {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error(code);
  }

  const exactBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );

  const parsed = asn1js.fromBER(exactBuffer);

  if (parsed.offset === -1 || parsed.offset !== bytes.length) {
    throw new Error(code);
  }

  return parsed.result;
}

function decodeBase64(value: string, code: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 20_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    value.length % 4 !== 0
  ) {
    throw new Error(code);
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  let normalized = "";
  for (const byte of bytes) {
    normalized += String.fromCharCode(byte);
  }

  if (btoa(normalized) !== value) {
    throw new Error(code);
  }

  return bytes;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function explicitValue(node: any, code: string): any {
  const values = children(node);

  if (values.length !== 1) {
    throw new Error(code);
  }

  return values[0];
}

function findUniqueContextTag(
  nodes: any[],
  tag: number,
  required = false,
): any | null {
  const matches = nodes.filter((node) => contextTag(node) === tag);

  if (matches.length > 1) {
    throw new Error("DUPLICATE_AUTHORIZATION_TAG");
  }

  if (matches.length === 0) {
    if (required) throw new Error("REQUIRED_AUTHORIZATION_TAG_MISSING");
    return null;
  }

  return matches[0];
}

function parseApplicationId(bytes: Uint8Array): {
  packageName: string;
  applicationVersion: number;
  signingDigests: string[];
} {
  const root = parseDer(bytes, "INVALID_APPLICATION_ID_ASN1");
  const fields = assertSequence(root, "INVALID_APPLICATION_ID_SEQUENCE");

  if (fields.length !== 2) {
    throw new Error("INVALID_APPLICATION_ID_FIELD_COUNT");
  }

  if (!isUniversal(fields[0], TAG.SET)) {
    throw new Error("INVALID_APPLICATION_PACKAGE_SET");
  }

  if (!isUniversal(fields[1], TAG.SET)) {
    throw new Error("INVALID_APPLICATION_DIGEST_SET");
  }

  const packageInfos = children(fields[0]);

  if (packageInfos.length !== 1) {
    throw new Error("INVALID_APPLICATION_PACKAGE_COUNT");
  }

  const packageFields = assertSequence(
    packageInfos[0],
    "INVALID_APPLICATION_PACKAGE_INFO",
  );

  if (
    packageFields.length !== 2 ||
    !isUniversal(packageFields[0], TAG.OCTET_STRING)
  ) {
    throw new Error("INVALID_APPLICATION_PACKAGE_INFO");
  }

  const packageBytes = assertOctetString(
    packageFields[0],
    "INVALID_APPLICATION_PACKAGE_NAME",
  );

  let packageName: string;

  try {
    packageName = new TextDecoder("utf-8", { fatal: true }).decode(
      packageBytes,
    );
  } catch {
    throw new Error("INVALID_APPLICATION_PACKAGE_ENCODING");
  }

  if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(packageName)) {
    throw new Error("INVALID_APPLICATION_PACKAGE_NAME");
  }

  const applicationVersion = assertInteger(
    packageFields[1],
    "INVALID_APPLICATION_VERSION",
  );

  const digestNodes = children(fields[1]);

  if (digestNodes.length === 0 || digestNodes.length > 10) {
    throw new Error("INVALID_APPLICATION_SIGNING_DIGESTS");
  }

  const signingDigests = digestNodes.map((node) => {
    const digest = assertOctetString(
      node,
      "INVALID_APPLICATION_SIGNING_DIGEST",
    );

    if (digest.length !== 32) {
      throw new Error("INVALID_APPLICATION_SIGNING_DIGEST_LENGTH");
    }

    return hex(digest);
  });

  if (new Set(signingDigests).size !== signingDigests.length) {
    throw new Error("DUPLICATE_APPLICATION_SIGNING_DIGEST");
  }

  return {
    packageName,
    applicationVersion,
    signingDigests,
  };
}

export function parseAttestation(
  certificateBase64: string,
): ParsedAttestation {
  const certBytes = decodeBase64(
    certificateBase64,
    "INVALID_CERTIFICATE_INPUT",
  );

  const cert = new X509Certificate(certBytes.buffer.slice(certBytes.byteOffset, certBytes.byteOffset + certBytes.byteLength) as ArrayBuffer);

  const extensions = cert.extensions.filter(
    (item) => item.type === ANDROID_ATTESTATION_OID,
  );

  if (extensions.length === 0) {
    throw new Error("ANDROID_ATTESTATION_EXTENSION_MISSING");
  }

  if (extensions.length !== 1) {
    throw new Error("DUPLICATE_ANDROID_ATTESTATION_EXTENSION");
  }

  const extensionBytes = new Uint8Array(extensions[0].value);
  const root = parseDer(
    extensionBytes,
    "INVALID_ATTESTATION_ASN1",
  );

  const top = assertSequence(root, "INVALID_ATTESTATION_SEQUENCE");

  if (top.length !== 8) {
    throw new Error("INVALID_ATTESTATION_FIELD_COUNT");
  }

  const attestationVersion = assertInteger(
    top[0],
    "INVALID_ATTESTATION_VERSION",
  );

  if (!isUniversal(top[1], TAG.ENUMERATED)) {
    throw new Error("INVALID_ATTESTATION_SECURITY_LEVEL");
  }

  const attestationSecurityLevel = assertInteger(
    top[1],
    "INVALID_ATTESTATION_SECURITY_LEVEL",
  );

  const keymasterVersion = assertInteger(
    top[2],
    "INVALID_KEYMASTER_VERSION",
  );

  if (!isUniversal(top[3], TAG.ENUMERATED)) {
    throw new Error("INVALID_KEYMASTER_SECURITY_LEVEL");
  }

  const keymasterSecurityLevel = assertInteger(
    top[3],
    "INVALID_KEYMASTER_SECURITY_LEVEL",
  );

  const attestationChallenge = assertOctetString(
    top[4],
    "INVALID_ATTESTATION_CHALLENGE",
  );

  if (
    attestationChallenge.length < 16 ||
    attestationChallenge.length > 128
  ) {
    throw new Error("INVALID_ATTESTATION_CHALLENGE_LENGTH");
  }

  assertOctetString(top[5], "INVALID_ATTESTATION_UNIQUE_ID");

  const softwareEnforced = assertSequence(
    top[6],
    "INVALID_SOFTWARE_ENFORCED_AUTHORIZATION_LIST",
  );

  const teeEnforced = assertSequence(
    top[7],
    "INVALID_TEE_ENFORCED_AUTHORIZATION_LIST",
  );

  const applicationIdNode = findUniqueContextTag(
    softwareEnforced,
    709,
    true,
  );

  const applicationIdBytes = assertOctetString(
    explicitValue(applicationIdNode, "INVALID_APPLICATION_ID_TAG"),
    "INVALID_APPLICATION_ID_TAG_VALUE",
  );

  const appId = parseApplicationId(applicationIdBytes);

  const purposeNode = findUniqueContextTag(teeEnforced, 1, true);
  const purposeSet = explicitValue(
    purposeNode,
    "INVALID_PURPOSE_TAG",
  );

  if (!isUniversal(purposeSet, TAG.SET)) {
    throw new Error("INVALID_PURPOSE_SET");
  }

  const purposes = children(purposeSet).map((node) =>
    assertInteger(node, "INVALID_PURPOSE_VALUE")
  );

  if (
    purposes.length === 0 ||
    purposes.length > 10 ||
    new Set(purposes).size !== purposes.length
  ) {
    throw new Error("INVALID_PURPOSE_SET");
  }

  const algorithmNode = findUniqueContextTag(teeEnforced, 2, true);
  const keySizeNode = findUniqueContextTag(teeEnforced, 3, true);
  const curveNode = findUniqueContextTag(teeEnforced, 10, true);
  const rootNode = findUniqueContextTag(teeEnforced, 704, true);

  const keyAlgorithm = assertInteger(
    explicitValue(algorithmNode, "INVALID_KEY_ALGORITHM"),
    "INVALID_KEY_ALGORITHM",
  );

  const keySize = assertInteger(
    explicitValue(keySizeNode, "INVALID_KEY_SIZE"),
    "INVALID_KEY_SIZE",
  );

  const ecCurve = assertInteger(
    explicitValue(curveNode, "INVALID_EC_CURVE"),
    "INVALID_EC_CURVE",
  );

  const rootSequence = explicitValue(
    rootNode,
    "INVALID_ROOT_OF_TRUST",
  );

  const rootFields = assertSequence(
    rootSequence,
    "INVALID_ROOT_OF_TRUST_SEQUENCE",
  );

  if (rootFields.length !== 3 && rootFields.length !== 4) {
    throw new Error("INVALID_ROOT_OF_TRUST_FIELD_COUNT");
  }

  const verifiedBootKey = assertOctetString(
    rootFields[0],
    "INVALID_VERIFIED_BOOT_KEY",
  );

  if (verifiedBootKey.length === 0) {
    throw new Error("INVALID_VERIFIED_BOOT_KEY");
  }

  const deviceLocked = assertBoolean(
    rootFields[1],
    "INVALID_DEVICE_LOCKED",
  );

  if (!isUniversal(rootFields[2], TAG.ENUMERATED)) {
    throw new Error("INVALID_VERIFIED_BOOT_STATE");
  }

  const verifiedBootState = assertInteger(
    rootFields[2],
    "INVALID_VERIFIED_BOOT_STATE",
  );

  if (rootFields.length === 4) {
    assertOctetString(rootFields[3], "INVALID_VERIFIED_BOOT_HASH");
  }

  return {
    purposes,
    attestationVersion,
    attestationSecurityLevel,
    keymasterVersion,
    keymasterSecurityLevel,
    attestationChallenge,
    ...appId,
    keyAlgorithm,
    keySize,
    ecCurve,
    deviceLocked,
    verifiedBootState,
  };
}

export interface AttestationPolicy {
  expectedChallenge: Uint8Array;
  expectedApplicationVersion?: number;
}

export function validateAttestation(
  attestation: ParsedAttestation,
  policy: AttestationPolicy,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (attestation.packageName !== "com.sooqsy.app") {
    errors.push("PACKAGE_NAME_MISMATCH");
  }

  if (!attestation.signingDigests.includes(RELEASE_SIGNING_DIGEST)) {
    errors.push("RELEASE_SIGNING_CERTIFICATE_MISMATCH");
  }

  if (
    policy.expectedApplicationVersion !== undefined &&
    attestation.applicationVersion !== policy.expectedApplicationVersion
  ) {
    errors.push("APPLICATION_VERSION_MISMATCH");
  }

  if (!attestation.purposes.includes(2)) {
    errors.push("SIGN_PURPOSE_REQUIRED");
  }

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

  if (attestation.verifiedBootState !== 0) {
    errors.push("VERIFIED_BOOT_REQUIRED");
  }

  const actual = attestation.attestationChallenge;
  const expected = policy.expectedChallenge;

  if (
    !(expected instanceof Uint8Array) ||
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
    const certBytes = decodeBase64(
      certificateBase64,
      "INVALID_CERTIFICATE_INPUT",
    );

    const certRoot = parseDer(
      certBytes,
      "INVALID_CERTIFICATE_ASN1",
    );

    const certificateFields = assertSequence(
      certRoot,
      "INVALID_CERTIFICATE_STRUCTURE",
    );

    if (certificateFields.length !== 3) {
      throw new Error("INVALID_CERTIFICATE_STRUCTURE");
    }

    const tbsFields = assertSequence(
      certificateFields[0],
      "INVALID_TBS_CERTIFICATE",
    );

    const hasVersion =
      tbsFields[0]?.idBlock?.tagClass === 3 &&
      tbsFields[0]?.idBlock?.tagNumber === 0;

    const spkiIndex = (hasVersion ? 1 : 0) + 5;
    const spki = tbsFields[spkiIndex];

    if (!spki || !isUniversal(spki, TAG.SEQUENCE)) {
      throw new Error("SUBJECT_PUBLIC_KEY_INFO_NOT_FOUND");
    }

    const certificateKey = new Uint8Array(spki.toBER(false));
    const appKey = decodeBase64(
      publicKeyBase64,
      "INVALID_PUBLIC_KEY_ENCODING",
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
