
import { Capacitor } from "@capacitor/core";
import { LiveUpdate } from "@capawesome/capacitor-live-update";

const UPDATE_MANIFEST_URL =
  "https://nemer92.github.io/sooq-sy/updates/latest.json";

type UpdateManifest = {
  version: string;
  bundleId: string;
  downloadUrl: string;
  checksum?: string;
};

export type LiveUpdateState = {
  status:
    | "idle"
    | "checking"
    | "downloading"
    | "applying"
    | "upToDate"
    | "error";
  progress: number;
  message: string;
  currentVersion: string;
  latestVersion: string;
};

let state: LiveUpdateState = {
  status: "idle",
  progress: 0,
  message: "",
  currentVersion: "2.1",
  latestVersion: "2.1",
};

const listeners = new Set<() => void>();

let readyPromise: Promise<void> | null = null;
let checkPromise: Promise<void> | null = null;
let autoStarted = false;

function publish(next: Partial<LiveUpdateState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "غير معروف";

  if (bytes < 1024) return `${bytes} بايت`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getErrorDetails(error: any): string {
  if (typeof error === "string") return error;

  const details = [
    error?.message,
    error?.code,
    error?.errorCode,
    error?.cause?.message,
    error?.cause,
  ]
    .filter(Boolean)
    .map((item) =>
      typeof item === "object" ? JSON.stringify(item) : String(item)
    );

  return [...new Set(details)].join(" | ") ||
    "خطأ غير معروف، راجع سجل التطبيق";
}

export function getLiveUpdateState() {
  return state;
}

export function subscribeLiveUpdate(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = LiveUpdate.ready().then(() => undefined);
  }

  return readyPromise;
}

export function checkForLiveUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    publish({
      status: "error",
      message: "التحديث متاح داخل التطبيق فقط",
    });

    return Promise.resolve();
  }

  if (checkPromise) return checkPromise;

  checkPromise = (async () => {
    let progressListener:
      | Awaited<ReturnType<typeof LiveUpdate.addListener>>
      | null = null;

    let lastProgress = 0;
    let lastDownloadedBytes = 0;
    let lastTotalBytes = 0;
    let downloadStarted = false;

    try {
      publish({
        status: "checking",
        progress: 0,
        message: "جارٍ البحث عن تحديث...",
      });

      await ensureReady();

      const currentBundle = await LiveUpdate.getCurrentBundle();

      const response = await fetch(UPDATE_MANIFEST_URL, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `تعذر جلب معلومات التحديث. HTTP ${response.status}`
        );
      }

      const update: UpdateManifest = await response.json();

      if (!update.version || !update.bundleId || !update.downloadUrl) {
        throw new Error("بيانات التحديث أو رقم النسخة غير مكتمل");
      }

      publish({
        latestVersion: update.version,
        currentVersion:
          currentBundle.bundleId === update.bundleId
            ? update.version
            : state.currentVersion,
      });

      if (currentBundle.bundleId === update.bundleId) {
        publish({
          status: "upToDate",
          progress: 100,
          currentVersion: update.version,
          latestVersion: update.version,
          message: `التطبيق محدّث إلى الإصدار ${update.version}`,
        });

        return;
      }

      publish({
        status: "downloading",
        progress: 0,
        message: `يتوفر الإصدار ${update.version}، جارٍ تحميله...`,
      });

      progressListener = await LiveUpdate.addListener(
        "downloadBundleProgress",
        (event) => {
          if (event.bundleId !== update.bundleId) return;

          downloadStarted = true;

          lastProgress = Math.min(
            100,
            Math.max(0, Math.round(event.progress * 100))
          );

          lastDownloadedBytes = event.downloadedBytes ?? 0;
          lastTotalBytes = event.totalBytes ?? 0;

          const sizeInfo =
            lastTotalBytes > 0
              ? ` (${formatBytes(lastDownloadedBytes)} من ${formatBytes(lastTotalBytes)})`
              : "";

          publish({
            status: "downloading",
            progress: lastProgress,
            message: `جارٍ تحميل الإصدار ${update.version}... ${lastProgress}%${sizeInfo}`,
          });

          console.log("Sooq.Sy OTA Download Progress:", {
            bundleId: event.bundleId,
            progress: lastProgress,
            downloadedBytes: lastDownloadedBytes,
            totalBytes: lastTotalBytes,
          });
        }
      );

      console.log("Sooq.Sy OTA Download Started:", {
        version: update.version,
        bundleId: update.bundleId,
        downloadUrl: update.downloadUrl,
        checksum: update.checksum,
      });

      await LiveUpdate.downloadBundle({
        artifactType: "zip",
        bundleId: update.bundleId,
        url: update.downloadUrl,
        ...(update.checksum ? { checksum: update.checksum } : {}),
      });

      console.log("Sooq.Sy OTA Download Completed:", {
        bundleId: update.bundleId,
        lastProgress,
        lastDownloadedBytes,
        lastTotalBytes,
      });

      await progressListener.remove();
      progressListener = null;

      publish({
        status: "applying",
        progress: 100,
        message: `اكتمل تحميل الإصدار ${update.version}، جارٍ تطبيقه...`,
      });

      await LiveUpdate.setNextBundle({
        bundleId: update.bundleId,
      });

      console.log("Sooq.Sy OTA Bundle Set Successfully:", update.bundleId);

      await LiveUpdate.reload();
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);

      console.error("Sooq.Sy Live Update Error:", {
        error,
        errorDetails,
        downloadStarted,
        lastProgress,
        lastDownloadedBytes,
        lastTotalBytes,
      });

      const stage = downloadStarted
        ? `فشل التحديث أثناء أو بعد التحميل عند ${lastProgress}%`
        : "فشل التحديث قبل اكتمال بدء التحميل";

      publish({
        status: "error",
        message: `${stage}. ${errorDetails}`,
      });

      throw error;
    } finally {
      if (progressListener) {
        await progressListener.remove().catch((error) => {
          console.error("Sooq.Sy OTA Listener Removal Error:", error);
        });
      }

      checkPromise = null;
    }
  })();

  return checkPromise;
}

export function startAutomaticLiveUpdateCheck() {
  if (!Capacitor.isNativePlatform() || autoStarted) return;

  autoStarted = true;

  void checkForLiveUpdate().catch(() => {});
}
