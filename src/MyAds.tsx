
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, Eye, CalendarDays } from "lucide-react";

type Ad = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  categories: { name_ar: string } | null;
  cities: { name_ar: string } | null;
};

const statusInfo: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700" },
  approved: { label: "مقبول ومنشور", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  sold: { label: "مباع", color: "bg-blue-100 text-blue-700" },
  archived: { label: "مؤرشف", color: "bg-slate-100 text-slate-600" },
};

export default function MyAds() {
  const navigate = useNavigate();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMyAds() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        navigate("/auth", {
          state: { from: "/my-ads" },
        });
        return;
      }

      const userId = sessionData.session.user.id;

      const { data, error } = await supabase
        .from("ads")
        .select(`
          id,
          title,
          price,
          currency,
          status,
          created_at,
          rejection_reason,
          categories(name_ar),
          cities(name_ar)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("خطأ تحميل إعلانات المستخدم:", error);
        setError("تعذر تحميل إعلاناتك. حاول مرة أخرى.");
      } else {
        setAds((data ?? []) as unknown as Ad[]);
      }

      setLoading(false);
    }

    loadMyAds();
  }, [navigate]);

    async function deleteAd(adId: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        navigate("/auth");
        return;
      }

      // جلب مسارات صور الإعلان
      const { data: imagesData, error: imagesError } = await supabase
        .from("ad_images")
        .select("image_path")
        .eq("ad_id", adId);

      if (imagesError) throw imagesError;

      // حذف ملفات الصور من Storage
      const imagePaths = (imagesData || []).map(
        (image) => image.image_path
      );

      if (imagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("ad-images")
          .remove(imagePaths);

        if (storageError) throw storageError;
      }

      // حذف الإعلان وسجلات صوره التابعة له
      const { error: deleteError } = await supabase
        .from("ads")
        .delete()
        .eq("id", adId)
        .eq("user_id", user.id)
        .in("status", ["pending", "rejected"]);

      if (deleteError) throw deleteError;

      setAds((previousAds) =>
        previousAds.filter((ad) => ad.id !== adId)
      );

      alert("تم حذف الإعلان بنجاح.");
    } catch (error) {
      console.error("خطأ حذف الإعلان:", error);
      alert("تعذر حذف الإعلان. حاول مرة أخرى.");
    }
  }

  async function updateAdStatus(
    adId: string,
    newStatus: "sold" | "archived"
  ) {
    try {
      const { error } = await supabase.rpc("set_own_ad_status", {
        p_ad_id: adId,
        p_status: newStatus,
      });

      if (error) throw error;

      setAds((previousAds) =>
        previousAds.map((ad) =>
          ad.id === adId
            ? { ...ad, status: newStatus }
            : ad
        )
      );

      alert(
        newStatus === "sold"
          ? "تم وضع الإعلان كإعلان مباع."
          : "تم إغلاق الإعلان وأرشفته."
      );
    } catch (error) {
      console.error("خطأ تغيير حالة الإعلان:", error);
      alert("تعذر تغيير حالة الإعلان. حاول مرة أخرى.");
    }
  }

  async function republishAd(adId: string) {
  try {
    const { error } = await supabase.rpc("republish_own_ad", {
      p_ad_id: adId,
    });

    if (error) throw error;

    setAds((previousAds) =>
      previousAds.map((ad) =>
        ad.id === adId
          ? { ...ad, status: "pending" }
          : ad
      )
    );

    alert("تمت إعادة الإعلان إلى قائمة المراجعة بنجاح.");
  } catch (error) {
    console.error("خطأ إعادة نشر الإعلان:", error);
    alert("تعذرت إعادة نشر الإعلان. حاول مرة أخرى.");
  }
}

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-emerald-700">
            <ArrowRight size={20} />
            العودة للرئيسية
          </Link>
          <span className="text-xl font-black text-emerald-700">Sooq.sy</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800">إعلاناتي</h1>
            <p className="mt-2 text-sm text-slate-500">
              تابع إعلاناتك وحالات مراجعتها
            </p>
          </div>

          <Link
            to="/add-ad"
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            + أضف إعلاناً
          </Link>
        </div>

        {loading && (
          <p className="rounded-2xl bg-white p-10 text-center text-slate-500">
            جارٍ تحميل إعلاناتك...
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && !error && ads.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center">
            <h2 className="text-lg font-bold text-slate-800">
              ما عندك إعلانات حالياً
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              ابدأ بنشر إعلانك الأول على Sooq.sy
            </p>
            <Link
              to="/add-ad"
              className="mt-5 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white"
            >
              أضف إعلانك الآن
            </Link>
          </div>
        )}

        {!loading && ads.length > 0 && (
          <div className="space-y-4">
            {ads.map((ad) => {
              const status = statusInfo[ad.status] ?? {
                label: ad.status,
                color: "bg-slate-100 text-slate-600",
              };

              return (
                <article
                  key={ad.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {ad.categories?.name_ar ?? "غير محدد"}
                        </span>
                      </div>

                      <h2 className="text-lg font-black text-slate-800">
                        {ad.title}
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                        <span>
                          {ad.price !== null
                            ? `${ad.price.toLocaleString("en-US")} ${ad.currency === "USD" ? "دولار" : ad.currency === "SYP" ? "ليرة سورية" : ad.currency}`
                            : "السعر عند التواصل"}
                        </span>

                        <span className="flex items-center gap-1">
                          <Eye size={15} />
                          {ad.cities?.name_ar ?? "غير محدد"}
                        </span>

                        <span className="flex items-center gap-1">
                          <CalendarDays size={15} />
                          {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                        </span>
                      </div>

                      {ad.status === "rejected" && ad.rejection_reason && (
                        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                          سبب الرفض: {ad.rejection_reason}
                        </p>
                      )}
                    </div>

                    {ad.status === "approved" && (
                      <Link
                      
                        to={`/ad/${ad.id}`}
                        className="shrink-0 rounded-xl border border-emerald-200 px-4 py-2.5 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        عرض الإعلان
                        {ad.status === "approved" && (
  <>
    <button
      type="button"
      onClick={() => {
        if (window.confirm("هل تؤكد أن هذا الإعلان تم بيعه؟")) {
          updateAdStatus(ad.id, "sold");
        }
      }}
      className="shrink-0 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50"
    >
      تم البيع
    </button>

    <button
      type="button"
      onClick={() => {
        if (window.confirm("هل تريد إغلاق الإعلان وأرشفته؟")) {
          updateAdStatus(ad.id, "archived");
        }
      }}
      className="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
    >
      إغلاق الإعلان
    </button>
  </>
)}
                      </Link>
                      
                    )}
                    
                    {(ad.status === "sold" || ad.status === "archived") && (
  <button
    type="button"
    onClick={() => {
      if (
        window.confirm(
          "هل تريد إعادة هذا الإعلان إلى قائمة المراجعة؟"
        )
      ) {
        republishAd(ad.id);
      }
    }}
    className="shrink-0 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
  >
    إعادة نشر الإعلان
  </button>
)}

                    {(ad.status === "pending" || ad.status === "rejected" || ad.status === "approved") && (
  <Link
    to={`/edit-ad/${ad.id}`}
    className="shrink-0 rounded-xl border border-blue-200 px-4 py-2.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50"
  >
    تعديل الإعلان
  </Link>
)}
{(ad.status === "pending" || ad.status === "rejected") && (
  <button
    onClick={() => {
      const confirmed = window.confirm(
        "هل أنت متأكد من حذف هذا الإعلان نهائياً؟ لا يمكن التراجع عن الحذف."
      );

      if (confirmed) {
        deleteAd(ad.id);
      }
    }}
    className="shrink-0 rounded-xl border border-red-200 px-4 py-2.5 text-center text-sm font-bold text-red-700 hover:bg-red-50"
  >
    حذف الإعلان
  </button>
)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
