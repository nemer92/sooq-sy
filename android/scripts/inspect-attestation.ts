import "npm:reflect-metadata";
import * as x509 from "npm:@peculiar/x509@3.1.0";

const data = JSON.parse(
  (await Deno.readTextFile("./attestation-chain.json")).replace(/^\uFEFF/, "")
);

const rootsData = JSON.parse(
  (await Deno.readTextFile("./android-attestation-roots.json")).replace(/^\uFEFF/, "")
);

const chain = data.certificateChain.map(
  (cert: string) => new x509.X509Certificate(cert)
);

const trustedRoots = rootsData.map(
  (cert: string) => new x509.X509Certificate(cert)
);

console.log("Certificates received:", chain.length);
console.log("Google trusted roots:", trustedRoots.length);

const builder = new x509.X509ChainBuilder({
  certificates: chain.slice(1, -1),
});

try {
  const verifiedPath = await builder.buildToAnchor(chain[0], {
    trustAnchors: trustedRoots,
    limits: { maxDepth: 8, maxSearchSteps: 1000 },
  });

  console.log("\nSIGNATURE CHAIN: VALID");
  console.log("Path length:", verifiedPath.length);

  verifiedPath.forEach((cert, index) => {
    console.log(`${index}: ${cert.subject}`);
  });

  console.log("\nTRUSTED GOOGLE ROOT: MATCHED");
} catch (error) {
  console.log("\nSIGNATURE CHAIN: FAILED");
  console.log(String(error));
}