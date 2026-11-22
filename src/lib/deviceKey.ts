
import { registerPlugin } from "@capacitor/core";

export interface DeviceKeyPlugin {
  getPublicKey(): Promise<{ publicKey: string }>;
hasAttestedKey(): Promise<{ exists: boolean }>;
  signChallenge(options: {
    challenge: string;
  }): Promise<{ signature: string }>;
  getAttestedKeyMaterial(): Promise<{
    publicKey: string;
    certificateChain: string[];
  }>;
  createAttestedKey(options: {
    challenge: string;
  }): Promise<{
    publicKey: string;
    certificateChain: string[];
  }>;

  signAttestedChallenge(options: {
    challenge: string;
  }): Promise<{ signature: string }>;
}



const DeviceKey = registerPlugin<DeviceKeyPlugin>("DeviceKey");

export default DeviceKey;