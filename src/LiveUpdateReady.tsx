
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LiveUpdate } from "@capawesome/capacitor-live-update";

const UPDATE_MANIFEST_URL =
  "https://nemer92.github.io/sooq-sy/updates/latest.json";

let updateCheckStarted = false;

type UpdateManifest = {
  bundleId: string;
  downloadUrl: string;
  checksum?: string;
};

export default function LiveUpdateReady() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || updateCheckStarted) {
      return;
    }

    updateCheckStarted = true;

    const checkForUpdates = async () => {
      await LiveUpdate.ready();

      const currentBundle = await LiveUpdate.getCurrentBundle();

      const response = await fetch(UPDATE_MANIFEST_URL, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("تعذر جلب معلومات التحديث");
      }

      const update: UpdateManifest = await response.json();

      if (!update.bundleId || !update.downloadUrl) {
        throw new Error("بيانات التحديث غير مكتملة");
      }

      if (currentBundle.bundleId === update.bundleId) {
        return;
      }

      await LiveUpdate.downloadBundle({
        artifactType: "zip",
        bundleId: update.bundleId,
        url: update.downloadUrl,
        ...(update.checksum ? { checksum: update.checksum } : {}),
      });

      await LiveUpdate.setNextBundle({
        bundleId: update.bundleId,
      });

      await LiveUpdate.reload();
    };

    checkForUpdates().catch((error) => {
      console.error("Sooq.Sy Live Update Error:", error);
    });
  }, []);

  return null;
}
