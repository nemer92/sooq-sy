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
    "6e9dfa48d98ff81503ea4a173990e89fa07263f90b6bf31f11d9dc1825e286db"
  ],
};

const result = validateAttestation(simulatedAttestation, {
  expectedChallenge: attestation.attestationChallenge,
  expectedApplicationVersion: 1,
});

console.log(JSON.stringify(result, null, 2));

if (!result.valid) Deno.exit(1);
