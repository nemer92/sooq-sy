
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
        throw new Error("تعذر جلب معلومات التحديث");
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

          publish({
            status: "downloading",
            progress: Math.min(
              100,
              Math.max(0, Math.round(event.progress * 100))
            ),
            message: `جارٍ تحميل الإصدار ${update.version}...`,
          });
        }
      );

      await LiveUpdate.downloadBundle({
        artifactType: "zip",
        bundleId: update.bundleId,
        url: update.downloadUrl,
        ...(update.checksum ? { checksum: update.checksum } : {}),
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

      await LiveUpdate.reload();
    } catch (error: any) {
      console.error("Sooq.Sy Live Update Error:", error);

      publish({
        status: "error",
        message:
          error?.message || "تعذر تحميل التحديث، حاول مرة أخرى",
      });

      throw error;
    } finally {
      if (progressListener) {
        await progressListener.remove().catch(() => {});
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
