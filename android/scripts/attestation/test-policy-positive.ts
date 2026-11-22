import {
  parseAttestation,
  validateAttestation,
} from "./parse-attestation.ts";

const data = JSON.parse(
  await Deno.readTextFile("./android/attestation-chain.json")
);

const attestation = parseAttestation(data.certificateChain[0]);

// Simulate the expected production signing digest.
// This does not modify the certificate or prove a real Release signature.
const simulatedAttestation = {
  ...attestation,
  signingDigests: [
    "9b065a12ef33cc64cf73adb5e8e56b737ee4471d98c09c424c56f5353dd6bb21"
  ],
};

const result = validateAttestation(simulatedAttestation, {
  expectedChallenge: attestation.attestationChallenge,
  expectedApplicationVersion: 1,
});

console.log(JSON.stringify(result, null, 2));

if (!result.valid) Deno.exit(1);
