import "npm:reflect-metadata";
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

  console.log(JSON.stringify({
    index: i,
    subject: cert.subject,
    serialNumber: cert.serialNumber
  }));
}
