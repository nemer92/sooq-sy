import { parseAttestation } from "./parse-attestation.ts";

const data = JSON.parse(
  (await Deno.readTextFile("./android/attestation-chain.json")).replace(/^\uFEFF/, "")
);

const result = parseAttestation(data.certificateChain[0]);

console.log(JSON.stringify({
  ...result,
  attestationChallenge: new TextDecoder().decode(result.attestationChallenge),
}, null, 2));


