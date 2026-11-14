
import { useEffect, useState } from "react";
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
  const [debugMessage, setDebugMessage] = useState("جاري فحص التحديث...");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setDebugMessage("التطبيق ليس على Android");
      return;
    }

    if (updateCheckStarted) return;
    updateCheckStarted = true;

    const checkForUpdates = async () => {
      setDebugMessage("1 - تجهيز نظام التحديث...");
      await LiveUpdate.ready();

      setDebugMessage("2 - قراءة النسخة الحالية...");
      const currentBundle = await LiveUpdate.getCurrentBundle();

      setDebugMessage(
        `3 - النسخة الحالية: ${currentBundle.bundleId}`
      );

      const response = await fetch(UPDATE_MANIFEST_URL, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`فشل جلب التحديث: HTTP ${response.status}`);
      }

      const update: UpdateManifest = await response.json();

      setDebugMessage(`4 - النسخة الجديدة: ${update.bundleId}`);

      if (!update.bundleId || !update.downloadUrl) {
        throw new Error("بيانات التحديث غير مكتملة");
      }

      if (currentBundle.bundleId === update.bundleId) {
        setDebugMessage("التطبيق محدّث بالفعل");
        return;
      }

      setDebugMessage("5 - جاري تنزيل التحديث...");
      await LiveUpdate.downloadBundle({
        artifactType: "zip",
        bundleId: update.bundleId,
        url: update.downloadUrl,
        ...(update.checksum ? { checksum: update.checksum } : {}),
      });

      setDebugMessage("6 - تم التنزيل، جاري اعتماد التحديث...");
      await LiveUpdate.setNextBundle({
        bundleId: update.bundleId,
      });

      setDebugMessage("7 - جاري تشغيل النسخة الجديدة...");
      await LiveUpdate.reload();
    };

    checkForUpdates().catch((error) => {
      const message =
        error instanceof Error ? error.message : String(error);

      console.error("Sooq.Sy Live Update Error:", error);
      setDebugMessage(`خطأ بالتحديث: ${message}`);
    });
  }, []);



  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        left: 10,
        right: 10,
        zIndex: 999999,
        background: "#111827",
        color: "white",
        padding: 12,
        borderRadius: 10,
        fontSize: 13,
        direction: "rtl",
        textAlign: "center",
      }}
    >
      {debugMessage}
    </div>
  );
}
