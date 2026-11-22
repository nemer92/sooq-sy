import { verifyAttestedPublicKey } from "./parse-attestation.ts";

const data = JSON.parse(
  (await Deno.readTextFile("./android/attestation-chain.json")).replace(/^\uFEFF/, "")
);

const result = verifyAttestedPublicKey(
  data.certificateChain[0],
  data.publicKey
);

console.log("Original public key:");
console.log(JSON.stringify(result, null, 2));

const negativeTest = verifyAttestedPublicKey(
  data.certificateChain[0],
  data.publicKey.slice(0, -4) + "AAAA"
);

console.log("Modified public key:");
console.log(JSON.stringify(negativeTest, null, 2));

