import { StrictMode, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./lib/supabase";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import PushNotificationsSetup from "./PushNotificationsSetup";import LiveUpdateReady from "./LiveUpdateReady";

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
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
        <p className="font-bold text-slate-500">جاري تحميل الموقع...</p>
      </div>
    );
  }

  if (maintenanceMode) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
<BrowserRouter basename={Capacitor.isNativePlatform() ? "/" : "/sooq-sy"}>
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
        
        </Routes>
</MaintenanceGuard>
    </BrowserRouter>
  </StrictMode>
);
