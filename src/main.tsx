
import {
  StrictMode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "./lib/supabase";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";

import Auth from "./Auth.tsx";
import "./index.css";
import App from "./App.tsx";
import Home from "./Home.tsx";
import AdDetails from "./AdDetails.tsx";
import AddAd from "./AddAd.tsx";
import MyAds from "./MyAds.tsx";
import EditAd from "./EditAd.tsx";
import Messages from "./Messages.tsx";
import Favorites from "./Favorites.tsx";
import Profile from "./Profile";
import AdminConversation from "./AdminConversation";
import PushNotificationsSetup from "./PushNotificationsSetup";
import LiveUpdateReady from "./LiveUpdateReady";
import FeaturedCampaign from "./FeaturedCampaign.tsx";
import Subscriptions from "./Subscriptions.tsx";
import AllAds from "./AllAds.tsx";
import Stores from "./Stores";
import StoreDetails from "./StoreDetails";
import MyStores from "./MyStores";
import ManageStore from "./ManageStore";
import StoreSubscription from "./StoreSubscription.tsx";
import PublicProfile from "./PublicProfile";
import MySales from "./MySales";

// ==========================================
// أنواع نوافذ Sooq.sy المخصصة
// ==========================================

declare global {
  interface Window {
    sooqConfirm: (message: string) => Promise<boolean>;
    sooqPrompt: (message: string) => Promise<string | null>;
  }
}

type DialogRequest =
  | {
      id: number;
      type: "alert";
      message: string;
    }
  | {
      id: number;
      type: "confirm";
      message: string;
      resolve: (value: boolean) => void;
    }
  | {
      id: number;
      type: "prompt";
      message: string;
      resolve: (value: string | null) => void;
    };

let enqueueCustomDialog:
  | ((dialog: DialogRequest) => void)
  | null = null;

const pendingDialogs: DialogRequest[] = [];
let nextDialogId = 0;

function queueCustomDialog(dialog: DialogRequest) {
  if (enqueueCustomDialog) {
    enqueueCustomDialog(dialog);
  } else {
    pendingDialogs.push(dialog);
  }
}

// استبدال alert الافتراضي
window.alert = (message?: any): void => {
  queueCustomDialog({
    id: ++nextDialogId,
    type: "alert",
    message: String(message ?? ""),
  });
};

// نافذة تأكيد مخصصة
window.sooqConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    queueCustomDialog({
      id: ++nextDialogId,
      type: "confirm",
      message: String(message ?? ""),
      resolve,
    });
  });
};

// نافذة إدخال نص مخصصة
window.sooqPrompt = (message: string): Promise<string | null> => {
  return new Promise((resolve) => {
    queueCustomDialog({
      id: ++nextDialogId,
      type: "prompt",
      message: String(message ?? ""),
      resolve,
    });
  });
};

// ==========================================
// عرض نوافذ التنبيه والتأكيد والإدخال
// ==========================================

function CustomAlertHost() {
  const [dialogs, setDialogs] = useState<DialogRequest[]>([]);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    enqueueCustomDialog = (dialog: DialogRequest) => {
      setDialogs((previous) => [...previous, dialog]);
    };

    if (pendingDialogs.length > 0) {
      const previousDialogs = pendingDialogs.splice(0);

      setDialogs((previous) => [
        ...previous,
        ...previousDialogs,
      ]);
    }

    return () => {
      enqueueCustomDialog = null;
    };
  }, []);

  const currentDialog = dialogs[0];

  useEffect(() => {
    setPromptValue("");
  }, [currentDialog?.id]);

  const finishDialog = (
    result: boolean | string | null = null
  ) => {
    if (!currentDialog) return;

    if (currentDialog.type === "confirm") {
      currentDialog.resolve(result === true);
    }

    if (currentDialog.type === "prompt") {
      currentDialog.resolve(
        typeof result === "string" ? result : null
      );
    }

    setDialogs((previous) => previous.slice(1));
  };

  if (!currentDialog) {
    return null;
  }

  const isAlert = currentDialog.type === "alert";
  const isConfirm = currentDialog.type === "confirm";
  const isPrompt = currentDialog.type === "prompt";

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/50 px-5 py-6 backdrop-blur-sm"
      dir="rtl"
      role="presentation"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sooq-dialog-title"
        aria-describedby="sooq-dialog-message"
      >
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-600"
              aria-hidden="true"
            >
              <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>

          <h2
            id="sooq-dialog-title"
            className="text-xl font-black text-emerald-700"
          >
            Sooq.sy
          </h2>

          <div className="mt-2 h-1 w-12 rounded-full bg-emerald-500" />

          <p
            id="sooq-dialog-message"
            className="mt-5 w-full whitespace-pre-wrap break-words text-[15px] font-medium leading-8 text-slate-700"
          >
            {currentDialog.message}
          </p>

          {isPrompt && (
            <input
              key={currentDialog.id}
              type="text"
              value={promptValue}
              onChange={(event) =>
                setPromptValue(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  finishDialog(promptValue);
                }
              }}
              autoFocus
              className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-right text-base text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="اكتب هنا..."
            />
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          {isAlert && (
            <button
              type="button"
              onClick={() => finishDialog()}
              autoFocus
              className="w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 active:scale-[0.98]"
            >
              حسناً
            </button>
          )}

          {isConfirm && (
            <>
              <button
                type="button"
                onClick={() => finishDialog(false)}
                autoFocus
                className="w-1/2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-base font-bold text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98]"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={() => finishDialog(true)}
                className="w-1/2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 active:scale-[0.98]"
              >
                تأكيد
              </button>
            </>
          )}

          {isPrompt && (
            <>
              <button
                type="button"
                onClick={() => finishDialog(null)}
                className="w-1/2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-base font-bold text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98]"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={() => finishDialog(promptValue)}
                className="w-1/2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 active:scale-[0.98]"
              >
                متابعة
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// حفظ واستعادة موضع التمرير على أندرويد فقط
// ==========================================

function MobileScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  const positionsRef = useRef<Map<string, number>>(new Map());
  const currentKeyRef = useRef(location.key);

  const isAndroid =
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android";

  useEffect(() => {
    if (!isAndroid) return;

    const saveScrollPosition = () => {
      positionsRef.current.set(
        currentKeyRef.current,
        window.scrollY
      );
    };

    window.addEventListener("scroll", saveScrollPosition, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", saveScrollPosition);
    };
  }, [isAndroid]);

  useLayoutEffect(() => {
    if (!isAndroid) return;

    currentKeyRef.current = location.key;

    if (navigationType !== "POP") {
      positionsRef.current.set(location.key, 0);
      return;
    }

    const savedPosition = positionsRef.current.get(location.key);

    if (savedPosition === undefined) return;

    let frameId = 0;
    let attempts = 0;
    let cancelled = false;

    const restorePosition = () => {
      if (cancelled) return;

      const maximumScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      if (
        maximumScroll >= savedPosition ||
        attempts >= 120
      ) {
        window.scrollTo({
          top: Math.min(savedPosition, Math.max(0, maximumScroll)),
          left: 0,
          behavior: "instant",
        });

        return;
      }

      attempts += 1;
      frameId = requestAnimationFrame(restorePosition);
    };

    frameId = requestAnimationFrame(restorePosition);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [location.key, navigationType, isAndroid]);

  return null;
}

// ==========================================
// معالجة زر الرجوع في تطبيق أندرويد فقط
// ==========================================

function MobileBackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== "android"
    ) {
      return;
    }

    let active = true;
    let removeListener: (() => void) | undefined;

    const setupBackButton = async () => {
      const listener = await CapacitorApp.addListener(
        "backButton",
        () => {
          const historyState = window.history.state as
            | { idx?: number }
            | null;

          const historyIndex =
            typeof historyState?.idx === "number"
              ? historyState.idx
              : 0;

          if (historyIndex > 0) {
            window.history.back();
            return;
          }

          if (location.pathname !== "/") {
            navigate("/", { replace: true });
            return;
          }

          void CapacitorApp.exitApp();
        }
      );

      if (!active) {
        await listener.remove();
        return;
      }

      removeListener = () => {
        void listener.remove();
      };
    };

    void setupBackButton().catch((error) => {
      console.error("Back button setup error:", error);
    });

    return () => {
      active = false;
      removeListener?.();
    };
  }, [location.pathname, navigate]);

  return null;
}

// ==========================================
// التحقق من وضع الصيانة
// ==========================================

function MaintenanceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMaintenanceMode = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("maintenance_mode")
        .eq("id", 1)
        .single();

      if (!error) {
        setMaintenanceMode(data.maintenance_mode ?? false);
      }

      setLoading(false);
    };

    loadMaintenanceMode();
  }, []);

  if (location.pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="font-bold text-slate-500">
          جاري تحميل الموقع...
        </p>
      </div>
    );
  }

  if (maintenanceMode) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
      >
        <div className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
          <div className="mb-5 text-5xl">🛠️</div>

          <h1 className="text-2xl font-black text-slate-800">
            الموقع قيد الصيانة
          </h1>

          <p className="mt-4 leading-8 text-slate-500">
            نعمل حالياً على إجراء بعض التحسينات والتحديثات.
            نعتذر عن توقف الخدمة مؤقتاً، وسنعود إليكم قريباً.
          </p>

          <p className="mt-6 text-sm font-bold text-emerald-600">
            شكراً لتفهمكم ❤️
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

// ==========================================
// تشغيل التطبيق
// ==========================================

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter
      basename="/"
    >
      <MobileScrollRestoration />
      <MobileBackButtonHandler />

      <LiveUpdateReady />
      <PushNotificationsSetup />

      <MaintenanceGuard>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ad/:id" element={<AdDetails />} />
          <Route path="/admin" element={<App />} />

          <Route
            path="/admin/conversation/:id"
            element={<AdminConversation />}
          />

          <Route path="/auth" element={<Auth />} />
          <Route path="/add-ad" element={<AddAd />} />
          <Route path="/edit-ad/:id" element={<EditAd />} />

          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:id" element={<Messages />} />

          <Route path="/my-ads" element={<MyAds />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/featured-ads" element={<AllAds />} />
          <Route path="/regular-ads" element={<AllAds />} />
          <Route path="/donations" element={<AllAds />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/store/:id" element={<StoreDetails />} />
          <Route path="/my-stores" element={<MyStores />} />
          <Route path="/manage-store/:id" element={<ManageStore />} />
          <Route path="/user/:id" element={<PublicProfile />} />
          <Route path="/my-sales" element={<MySales />} />
          <Route
  path="/store-subscription"
  element={<StoreSubscription />}
/>
          <Route
            path="/featured-campaign/:adId"
            element={<FeaturedCampaign />}
          />
        </Routes>
      </MaintenanceGuard>

      <CustomAlertHost />
    </BrowserRouter>
  </StrictMode>
);
