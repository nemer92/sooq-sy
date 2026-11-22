import "npm:reflect-metadata";
import * as asn1js from "npm:asn1js@4.1.0";
import { X509Certificate } from "npm:@peculiar/x509@3.1.0";

const data = JSON.parse(
  (await Deno.readTextFile("./attestation-chain.json")).replace(/^\uFEFF/, "")
);

const certBinary = atob(data.certificateChain[0]);
const certBytes = Uint8Array.from(
  certBinary,
  (character) => character.charCodeAt(0),
);

const cert = new X509Certificate(certBytes);
const ext = cert.extensions.find(
  (e) => e.type === "1.3.6.1.4.1.11129.2.1.17"
);

if (!ext) throw new Error("Android attestation extension missing");

const bytes = new Uint8Array(ext.value);
const parsed = asn1js.fromBER(bytes.buffer);

if (parsed.offset === -1) {
  throw new Error("Could not parse attestation ASN.1");
}

console.log("Attestation extension length:", bytes.length);

function inspect(node: any, depth = 0): void {
  const id = node.idBlock;
  const vb = node.valueBlock;
  const type = node.constructor.name;
  let detail = "";

  if (type === "Integer" || type === "Enumerated") {
    detail = ` value=${vb.valueDec}`;
  } else if (type === "Boolean") {
    detail = ` value=${vb.value}`;
  } else if (type === "OctetString") {
    const raw = vb.valueHexView;
    detail = ` bytes=${raw?.length ?? 0}`;
    if (raw && raw.length <= 64) {
      detail += ` hex=${Array.from(raw).map((b: number) => b.toString(16).padStart(2, "0")).join("")}`;
    }
  }

  console.log(
    " ".repeat(depth * 2) +
    `${type} class=${id.tagClass} tag=${id.tagNumber}${detail}`
  );

  if (Array.isArray(vb.value)) {
    for (const child of vb.value) inspect(child, depth + 1);
  }
}

inspect(parsed.result);
