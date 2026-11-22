import "npm:reflect-metadata";
import * as asn1js from "npm:asn1js@4.1.0";

const data = JSON.parse(
  (await Deno.readTextFile("./attestation-chain.json")).replace(/^\uFEFF/, "")
);

const certBinary = atob(data.certificateChain[0]);
const certBytes = Uint8Array.from(certBinary, c => c.charCodeAt(0));

const parsed = asn1js.fromBER(certBytes.buffer);

if (parsed.offset === -1) {
  throw new Error("CERTIFICATE_ASN1_INVALID");
}

const certificateFields = parsed.result.valueBlock.value as any[];
const tbsFields = certificateFields[0].valueBlock.value as any[];

const hasVersion =
  tbsFields[0].idBlock.tagClass === 3 &&
  tbsFields[0].idBlock.tagNumber === 0;

const spkiIndex = (hasVersion ? 1 : 0) + 5;
const spki = tbsFields[spkiIndex];

if (!spki) {
  throw new Error("SUBJECT_PUBLIC_KEY_INFO_NOT_FOUND");
}

const certificateKey = new Uint8Array(spki.toBER(false));
const appKey = Uint8Array.from(atob(data.publicKey), c => c.charCodeAt(0));

const matches =
  certificateKey.length === appKey.length &&
  certificateKey.every((byte, index) => byte === appKey[index]);

console.log("App public key length:", appKey.length);
console.log("Certificate public key length:", certificateKey.length);
console.log("Exact DER match:", matches);
console.log(
  "Certificate key prefix:",
  Array.from(certificateKey.slice(0, 20))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
);
