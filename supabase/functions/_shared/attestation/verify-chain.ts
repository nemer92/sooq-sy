
import "npm:reflect-metadata";
import * as asn1js from "npm:asn1js@4.1.0";
import {
  X509Certificate,
  X509ChainBuilder,
} from "npm:@peculiar/x509@3.1.0";

export interface ChainVerificationResult {
  valid: boolean;
  certificateCount: number;
  subjectNames: string[];
  errors: string[];
}

const OID = {
  BASIC_CONSTRAINTS: "2.5.29.19",
  KEY_USAGE: "2.5.29.15",
};

function isUniversal(node: any, tag: number): boolean {
  return node?.idBlock?.tagClass === 1 &&
    node?.idBlock?.tagNumber === tag;
}

function parseExtension(
  certificate: X509Certificate,
  oid: string,
): any | null {
  const matches = certificate.extensions.filter(
    (extension) => extension.type === oid,
  );

  if (matches.length > 1) {
    throw new Error("DUPLICATE_CERTIFICATE_EXTENSION");
  }

  if (matches.length === 0) return null;

  const bytes = new Uint8Array(matches[0].value);
  const parsed = asn1js.fromBER(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
  );

  if (parsed.offset === -1 || parsed.offset !== bytes.length) {
    throw new Error("INVALID_CERTIFICATE_EXTENSION_ASN1");
  }

  return {
    node: parsed.result,
    critical: matches[0].critical === true,
  };
}

function parseBasicConstraints(
  certificate: X509Certificate,
): { ca: boolean; pathLength: number | null } {
  const extension = parseExtension(
    certificate,
    OID.BASIC_CONSTRAINTS,
  );

  if (!extension) return { ca: false, pathLength: null };

  if (!isUniversal(extension.node, 16)) {
    throw new Error("INVALID_BASIC_CONSTRAINTS");
  }

  const fields = extension.node.valueBlock.value as any[];

  if (fields.length > 2) {
    throw new Error("INVALID_BASIC_CONSTRAINTS_FIELDS");
  }

  let ca = false;
  let pathLength: number | null = null;
  let index = 0;

  if (fields[index] && isUniversal(fields[index], 1)) {
    const value = fields[index].valueBlock.value;

    if (typeof value !== "boolean") {
      throw new Error("INVALID_BASIC_CONSTRAINTS_CA");
    }

    ca = value;
    index++;
  }

  if (fields[index]) {
    if (!isUniversal(fields[index], 2)) {
      throw new Error("INVALID_BASIC_CONSTRAINTS_PATH_LENGTH");
    }

    const value = fields[index].valueBlock.valueDec;

    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      !ca
    ) {
      throw new Error("INVALID_BASIC_CONSTRAINTS_PATH_LENGTH");
    }

    pathLength = value;
    index++;
  }

  if (index !== fields.length) {
    throw new Error("INVALID_BASIC_CONSTRAINTS_FIELDS");
  }

  return { ca, pathLength };
}

function parseKeyUsage(
  certificate: X509Certificate,
): { digitalSignature: boolean; keyCertSign: boolean } {
  const extension = parseExtension(certificate, OID.KEY_USAGE);

  if (!extension || !isUniversal(extension.node, 3)) {
    throw new Error("KEY_USAGE_MISSING_OR_INVALID");
  }

  const block = extension.node.valueBlock as any;
  const bits = block.valueHexView as Uint8Array;
  const unusedBits = block.unusedBits;

  if (
    !(bits instanceof Uint8Array) ||
    bits.length < 1 ||
    bits.length > 2 ||
    !Number.isInteger(unusedBits) ||
    unusedBits < 0 ||
    unusedBits > 7
  ) {
    throw new Error("INVALID_KEY_USAGE_BITS");
  }

  const hasBit = (bit: number) => {
    const byteIndex = Math.floor(bit / 8);
    if (byteIndex >= bits.length) return false;
    return (bits[byteIndex] & (0x80 >> (bit % 8))) !== 0;
  };

  return {
    digitalSignature: hasBit(0),
    keyCertSign: hasBit(5),
  };
}

function bytesToBase64(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length < 100 ||
    value.length > 20_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error("INVALID_CERTIFICATE_ENCODING");
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  const normalized = btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
  );

  if (normalized !== value) {
    throw new Error("NON_CANONICAL_CERTIFICATE_ENCODING");
  }

  return bytes;
}

function validateLeaf(certificate: X509Certificate): void {
  const constraints = parseBasicConstraints(certificate);
  const usage = parseKeyUsage(certificate);

  if (constraints.ca) {
    throw new Error("DEVICE_CERTIFICATE_MUST_NOT_BE_CA");
  }

  if (!usage.digitalSignature) {
    throw new Error("DEVICE_CERTIFICATE_SIGNING_NOT_ALLOWED");
  }

  if (usage.keyCertSign) {
    throw new Error("DEVICE_CERTIFICATE_CANNOT_SIGN_CERTIFICATES");
  }
}

function validateCa(certificate: X509Certificate): number | null {
  const constraints = parseBasicConstraints(certificate);
  const usage = parseKeyUsage(certificate);

  if (!constraints.ca) {
    throw new Error("CA_CERTIFICATE_REQUIRED");
  }

  if (!usage.keyCertSign) {
    throw new Error("CA_KEY_CERT_SIGN_REQUIRED");
  }

  return constraints.pathLength;
}

async function certificateFingerprint(
  certificate: X509Certificate,
): Promise<string> {
  const digest = await certificate.getThumbprint("SHA-256");

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyCertificateChain(
  certificateChainBase64: string[],
  trustedRootsPem: string[],
): Promise<ChainVerificationResult> {
  const subjectNames: string[] = [];
  let certificateCount = 0;

  try {
    if (
      !Array.isArray(certificateChainBase64) ||
      certificateChainBase64.length < 2 ||
      certificateChainBase64.length > 10 ||
      !Array.isArray(trustedRootsPem) ||
      trustedRootsPem.length === 0 ||
      trustedRootsPem.length > 10
    ) {
      throw new Error("INVALID_CERTIFICATE_INPUT");
    }

    certificateCount = certificateChainBase64.length;

    const certificateBytes = certificateChainBase64.map(
      bytesToBase64,
    );

    const certificates = certificateBytes.map(
      (bytes) =>
        new X509Certificate(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        ),
    );

    const suppliedFingerprints = new Set<string>();

    for (const certificate of certificates) {
      const fingerprint = await certificateFingerprint(certificate);

      if (suppliedFingerprints.has(fingerprint)) {
        throw new Error("DUPLICATE_CERTIFICATE");
      }

      suppliedFingerprints.add(fingerprint);
    }

    const roots = trustedRootsPem.map((pem) => {
      if (
        typeof pem !== "string" ||
        !pem.includes("-----BEGIN CERTIFICATE-----") ||
        !pem.includes("-----END CERTIFICATE-----")
      ) {
        throw new Error("INVALID_TRUSTED_ROOT");
      }

      return new X509Certificate(pem);
    });

    const rootFingerprints = new Set<string>();

    for (const root of roots) {
      rootFingerprints.add(await certificateFingerprint(root));
    }

    validateLeaf(certificates[0]);

    const builder = new X509ChainBuilder({
      certificates: certificates.slice(1),
    });

    const chain = await builder.buildToAnchor(
      certificates[0],
      {
        trustAnchors: roots,
        limits: {
          maxDepth: 10,
          maxSearchSteps: 1000,
        },
      },
    );

    if (chain.length < 2 || chain.length > 10) {
      throw new Error("INVALID_VERIFIED_CHAIN_LENGTH");
    }

    const usedFingerprints = new Set<string>();

    for (const certificate of chain) {
      usedFingerprints.add(await certificateFingerprint(certificate));
    }

    for (const fingerprint of suppliedFingerprints) {
      if (!usedFingerprints.has(fingerprint)) {
        throw new Error("UNUSED_CERTIFICATE_SUPPLIED");
      }
    }

    const terminalFingerprint = await certificateFingerprint(
      chain[chain.length - 1],
    );

    if (!rootFingerprints.has(terminalFingerprint)) {
      throw new Error("CHAIN_DOES_NOT_END_AT_TRUSTED_ROOT");
    }

    const now = Date.now();
    const caPathLengths: Array<number | null> = [];

    for (let index = 0; index < chain.length; index++) {
      const certificate = chain[index];

      const notBefore = certificate.notBefore.getTime();
      const notAfter = certificate.notAfter.getTime();

      if (
        !Number.isFinite(notBefore) ||
        !Number.isFinite(notAfter) ||
        notBefore > notAfter ||
        now < notBefore ||
        now > notAfter
      ) {
        throw new Error("CERTIFICATE_OUTSIDE_VALIDITY_PERIOD");
      }

      if (index > 0) {
        caPathLengths.push(validateCa(certificate));
      }

      subjectNames.push(certificate.subject);
    }

    for (let index = 0; index < caPathLengths.length; index++) {
      const limit = caPathLengths[index];

      if (limit === null) continue;

      const subordinateCaCount = index;

      if (subordinateCaCount > limit) {
        throw new Error("CA_PATH_LENGTH_EXCEEDED");
      }
    }

    return {
      valid: true,
      certificateCount: chain.length,
      subjectNames,
      errors: [],
    };
  } catch (error) {
    return {
      valid: false,
      certificateCount,
      subjectNames,
      errors: [
        error instanceof Error
          ? error.message
          : "UNKNOWN_CHAIN_ERROR",
      ],
    };
  }
}
