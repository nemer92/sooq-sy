import { verifyCertificateChain } from "./verify-chain.ts";

const chainData = JSON.parse(
  await Deno.readTextFile("./android/attestation-chain.json")
);

const roots = JSON.parse(
  await Deno.readTextFile("./android/android-attestation-roots.json")
);

if (
  !Array.isArray(chainData.certificateChain) ||
  !Array.isArray(roots) ||
  roots.length === 0 ||
  !roots.every((root) => typeof root === "string")
) {
  throw new Error("INVALID_TEST_FIXTURE");
}

const result = await verifyCertificateChain(
  chainData.certificateChain,
  roots
);

console.log(JSON.stringify(result, null, 2));

if (!result.valid) {
  Deno.exit(1);
}