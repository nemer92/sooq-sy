import "npm:reflect-metadata";
import * as asn1js from "npm:asn1js@4.1.0";
import { X509Certificate } from "npm:@peculiar/x509@3.1.0";

const data = JSON.parse(
  await Deno.readTextFile("./android/attestation-chain.json")
);

for (let i = 0; i < data.certificateChain.length; i++) {
  const bytes = Uint8Array.from(
    atob(data.certificateChain[i]),
    c => c.charCodeAt(0)
  );

  const cert = new X509Certificate(bytes);

  const result: Record<string, unknown> = {
    index: i,
    subject: cert.subject,
  };

  for (const oid of ["2.5.29.19", "2.5.29.15"]) {
    const ext = cert.extensions.find(e => e.type === oid);
    if (!ext) continue;

    const parsed = asn1js.fromBER(
      new Uint8Array(ext.value).buffer
    );

    if (parsed.offset === -1) {
      result[oid] = "INVALID_ASN1";
      continue;
    }

    const node = parsed.result;

    if (oid === "2.5.29.19") {
      const fields = node.valueBlock.value as any[];
      result.basicConstraints = {
        ca: fields[0]?.valueBlock?.value ?? false,
        pathLength: fields[1]?.valueBlock?.valueDec ?? null,
      };
    } else {
      const bits = (node as any).valueBlock.valueHexView as Uint8Array;
      const flags = [
        "digitalSignature",
        "nonRepudiation",
        "keyEncipherment",
        "dataEncipherment",
        "keyAgreement",
        "keyCertSign",
        "cRLSign",
      ];

      result.keyUsage = Object.fromEntries(
        flags.map((name, bit) => [
          name,
          Boolean(bits[Math.floor(bit / 8)] & (0x80 >> (bit % 8))),
        ])
      );
    }
  }

  console.log(JSON.stringify(result, null, 2));
}
