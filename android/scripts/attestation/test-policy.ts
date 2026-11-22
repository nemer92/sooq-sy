import {
  parseAttestation,
  validateAttestation,
} from "./parse-attestation.ts";

const data = JSON.parse(
  (await Deno.readTextFile("./android/attestation-chain.json")).replace(/^\uFEFF/, "")
);

const attestation = parseAttestation(data.certificateChain[0]);

// Deliberately use a different server challenge for this negative test.
const expectedChallenge = new TextEncoder().encode(
  "server-generated-test-challenge-123456"
);

const result = validateAttestation(attestation, {
  expectedChallenge,
});

console.log(JSON.stringify(result, null, 2));

