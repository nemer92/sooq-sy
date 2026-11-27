
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { loadAdsCached, subscribeToAdsUpdates, invalidateAdsCache } from "./lib/adCache";
import {
  ArrowRight,
  Eye,
  CalendarDays,
  Star,
  Store,
  Tag,
  Plus,
  Trash2,
  Pencil,
  Archive,
  RotateCcw,
  Sparkles,
  MapPin,
} from "lucide-react";

type Ad = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  status: string;
  created_at: string;
  published_at: string | null;
  rejection_reason: string | null;
  categories: { name_ar: string } | null;
  cities: { name_ar: string } | null;
  listing_type: string;
  is_featured: boolean;
  store_id: string | null;
  images: string[];
};

const statusInfo: Record<string, { label: string; color: string }> = {
  pending: {
    label: "قيد المراجعة",
    color: "bg-amber-50 text-amber-700 border-amber-100",
  },
  approved: {
    label: "مقبول ومنشور",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  rejected: {
    label: "مرفوض",
    color: "bg-red-50 text-red-700 border-red-100",
  },
  sold: {
    label: "مباع",
    color: "bg-blue-50 text-blue-700 border-blue-100",
  },
  archived: {
    label: "مؤرشف",
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export default function MyAds() {
  const navigate = useNavigate();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    async function loadMyAds() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (!active) return;

        if (!sessionData.session) {
          navigate("/auth", {
            state: { from: "/my-ads" },
          });
          return;
        }

        const userId = sessionData.session.user.id;
        const cacheKey = `my-ads:${userId}`;

        const fetchMyAds = async () => {
          const { data, error } = await supabase
            .from("ads")
            .select(`
              id,
              title,
              price,
              currency,
              status,
              created_at,
              published_at,
              rejection_reason,
              categories(name_ar),
              cities(name_ar),
              listing_type,
              is_featured,
              store_id,
              ad_images(
                image_path,
                sort_order
              )
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (error) throw error;
          return { ads: data ?? [] };
        };

        const applyAds = async (result: { ads: any[] }) => {
          if (!active) return;

          const adsWithImages = await Promise.all(
            result.ads.map(async (ad: any) => {
              const sortedImages = [...(ad.ad_images ?? [])].sort(
                (a: any, b: any) =>
                  (a.sort_order ?? 0) - (b.sort_order ?? 0)
              );

              const imageResults = await Promise.all(
                sortedImages.map(async (image: any) => {
                  const { data: signedData } = await supabase.storage
                    .from("ad-images")
                    .createSignedUrl(image.image_path, 3600);

                  return signedData?.signedUrl ?? "";
                })
              );

              return {
                ...ad,
                images: imageResults.filter(Boolean),
              };
            })
          );

          if (active) setAds(adsWithImages as Ad[]);
        };

        const refreshMyAds = () => {
          void loadAdsCached<{ ads: any[] }>(
            cacheKey,
            fetchMyAds,
            (result) => {
              void applyAds(result).catch((error) =>
                console.error("خطأ تحديث إعلانات المستخدم:", error)
              );
            }
          ).catch((error) =>
            console.error("خطأ تحديث كاش إعلانات المستخدم:", error)
          );
        };

        unsubscribe = subscribeToAdsUpdates(refreshMyAds);

        await loadAdsCached<{ ads: any[] }>(
          cacheKey,
          fetchMyAds,
          (result) => {
            void applyAds(result).catch((error) =>
              console.error("خطأ عرض إعلانات المستخدم:", error)
            );
          }
        );
      } catch (err) {
        console.error("خطأ تحميل إعلانات المستخدم:", err);

        if (active) {
          setError("تعذر تحميل إعلاناتك. حاول مرة أخرى.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMyAds();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  async function invalidateCurrentUserAdsCache() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (userId) invalidateAdsCache(`my-ads:${userId}`);
  }
  async function deleteAd(adId: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: imagesData, error: imagesError } = await supabase
        .from("ad_images")
        .select("image_path")
        .eq("ad_id", adId);

      if (imagesError) throw imagesError;

      const imagePaths = (imagesData || []).map(
        (image) => image.image_path
      );

      if (imagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("ad-images")
          .remove(imagePaths);

        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from("ads")
        .delete()
        .eq("id", adId)
        .eq("user_id", user.id)
        .in("status", ["pending", "rejected"]);

      if (deleteError) throw deleteError;

      await invalidateCurrentUserAdsCache();
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

      await invalidateCurrentUserAdsCache();
      setAds((previousAds) =>
        previousAds.map((ad) =>
          ad.id === adId ? { ...ad, status: newStatus } : ad
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

      await invalidateCurrentUserAdsCache();
      setAds((previousAds) =>
        previousAds.map((ad) =>
          ad.id === adId ? { ...ad, status: "pending" } : ad
        )
      );

      alert("تمت إعادة الإعلان إلى قائمة المراجعة بنجاح.");
    } catch (error) {
      console.error("خطأ إعادة نشر الإعلان:", error);
      alert("تعذرت إعادة نشر الإعلان. حاول مرة أخرى.");
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f9f8]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            <ArrowRight size={19} />
            العودة للرئيسية
          </Link>

          <span className="text-xl font-black tracking-tight text-emerald-700">
            Sooq.sy
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8">
        <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-white p-4 shadow-sm sm:mb-7 sm:rounded-3xl sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 sm:h-9 sm:w-9">
                  <Tag size={18} />
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  إدارة إعلاناتك
                </span>
              </div>

              <h1 className="text-2xl font-black text-slate-800 sm:text-3xl">
                إعلاناتي
              </h1>

              <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                تابع إعلاناتك، راجع حالتها، وتحكم بها بسهولة.
              </p>
            </div>

            <Link
              to="/add-ad"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:px-5 sm:py-3 sm:text-sm"
            >
              <Plus size={17} />
              أضف إعلاناً جديداً
            </Link>
          </div>

          {!loading && !error && (
            <div className="mt-4 flex items-center gap-2 border-t border-emerald-100 pt-3 text-xs font-semibold text-slate-500 sm:mt-5 sm:pt-4">
              <Sparkles size={15} className="text-emerald-600" />
              لديك {ads.length} {ads.length === 1 ? "إعلان" : "إعلانات"} في حسابك
            </div>
          )}
        </section>

        {loading && (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" />
            <p className="text-sm font-medium text-slate-500">
              جارٍ تحميل إعلاناتك...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && ads.length === 0 && (
          <div className="rounded-3xl border border-slate-100 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Tag size={29} />
            </div>

            <h2 className="text-lg font-black text-slate-800">
              ما عندك إعلانات حالياً
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              ابدأ بنشر إعلانك الأول على Sooq.sy
            </p>

            <Link
              to="/add-ad"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <Plus size={17} />
              أضف إعلانك الآن
            </Link>
          </div>
        )}

        {!loading && !error && ads.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {ads.map((ad) => {
              const status = statusInfo[ad.status] ?? {
                label: ad.status,
                color: "bg-slate-100 text-slate-600 border-slate-200",
              };

              return (
                <article
                  key={ad.id}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition duration-200 hover:shadow-md sm:rounded-2xl ${
                    ad.is_featured
                      ? "border-amber-200"
                      : "border-slate-100"
                  }`}
                >
                  {ad.is_featured && (
                    <div className="flex items-center justify-center gap-1 border-b border-amber-100 bg-amber-50/70 px-2 py-1.5 text-[10px] font-bold text-amber-700 sm:text-xs">
                      <Star size={12} fill="currentColor" />
                      إعلان مميز
                    </div>
                  )}

                  <Link
                    to={`/ad/${ad.id}`}
                    className="group relative block aspect-square w-full overflow-hidden bg-slate-100"
                  >
                    {ad.images.length > 0 ? (
                      <img
                        src={ad.images[0]}
                        alt={ad.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <Tag size={38} strokeWidth={1.3} />
                      </div>
                    )}

                    <span
                      className={`absolute right-2 top-2 max-w-[85%] truncate rounded-lg border px-2 py-1 text-[9px] font-bold shadow-sm sm:text-[10px] ${status.color}`}
                    >
                      {status.label}
                    </span>

                    {ad.store_id && (
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-violet-600/95 px-2 py-1 text-[9px] font-bold text-white shadow-sm sm:text-[10px]">
                        <Store size={11} />
                        متجر
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-2 sm:p-3">
                    <div className="mb-1.5 flex min-w-0 items-center gap-1 text-[10px] text-slate-400 sm:text-xs">
                      <Tag size={11} className="shrink-0" />
                      <span className="truncate">
                        {ad.categories?.name_ar ?? "غير محدد"}
                      </span>
                    </div>

                    <Link to={`/ad/${ad.id}`}>
                      <h2 className="line-clamp-2 min-h-[2.5rem] text-xs font-black leading-5 text-slate-800 transition hover:text-emerald-700 sm:min-h-[3rem] sm:text-sm sm:leading-6">
                        {ad.title}
                      </h2>
                    </Link>

                    <div className="mt-1.5 min-h-5 text-xs font-black text-emerald-700 sm:text-sm">
                      {ad.price !== null
                        ? `${ad.price.toLocaleString("en-US")} ${
                            ad.currency === "USD"
                              ? "دولار"
                              : ad.currency === "SYP"
                                ? "ليرة سورية"
                                : ad.currency
                          }`
                        : "السعر عند التواصل"}
                    </div>

                    <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2 text-[10px] text-slate-500 sm:text-xs">
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">
                          {ad.cities?.name_ar ?? "غير محدد"}
                        </span>
                      </span>

                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} className="shrink-0" />
                        {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                      </span>
                    </div>

                    {ad.status === "rejected" && ad.rejection_reason && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50/70 p-2 text-[10px] leading-5 text-red-700 sm:text-xs">
                        <span className="font-bold">سبب الرفض:</span>{" "}
                        {ad.rejection_reason}
                      </div>
                    )}

                    <div className="mt-auto flex flex-col gap-1.5 pt-3">
                      {ad.status === "approved" && (
                        <>
                          <Link
                            to={`/ad/${ad.id}`}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-2 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-50 sm:text-xs"
                          >
                            <Eye size={13} />
                            عرض الإعلان
                          </Link>

                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = await window.sooqConfirm(
                                "هل تريد إغلاق الإعلان وأرشفته؟"
                              );

                              if (confirmed) {
                                updateAdStatus(ad.id, "archived");
                              }
                            }}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 sm:text-xs"
                          >
                            <Archive size={13} />
                            إغلاق الإعلان
                          </button>

            

                          {ad.published_at &&
                            !ad.is_featured &&
                            !ad.store_id && (
                              <Link
                                to={`/featured-campaign/${ad.id}`}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-bold text-amber-700 transition hover:bg-amber-100 sm:text-xs"
                              >
                                <Star size={13} fill="currentColor" />
                                تمييز الإعلان
                              </Link>
                            )}

                          {ad.is_featured && (
                            <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-bold text-amber-700 sm:text-xs">
                              <Star size={13} fill="currentColor" />
                              إعلان مميز
                            </span>
                          )}
                        </>
                      )}

                      {(ad.status === "sold" || ad.status === "archived") && (
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await window.sooqConfirm(
                              "هل تريد إعادة هذا الإعلان إلى قائمة المراجعة؟"
                            );

                            if (confirmed) {
                              republishAd(ad.id);
                            }
                          }}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 sm:text-xs"
                        >
                          <RotateCcw size={13} />
                          إعادة نشر الإعلان
                        </button>
                      )}

                      {(ad.status === "pending" ||
                        ad.status === "rejected" ||
                        ad.status === "approved") && (
                        <Link
                          to={`/edit-ad/${ad.id}`}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50/50 px-2 py-2 text-[10px] font-bold text-blue-700 transition hover:bg-blue-50 sm:text-xs"
                        >
                          <Pencil size={13} />
                          تعديل الإعلان
                        </Link>
                      )}

                      {(ad.status === "pending" || ad.status === "rejected") && (
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await window.sooqConfirm(
                              "هل أنت متأكد من حذف هذا الإعلان نهائياً؟ لا يمكن التراجع عن الحذف."
                            );

                            if (confirmed) {
                              deleteAd(ad.id);
                            }
                          }}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50/50 px-2 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-50 sm:text-xs"
                        >
                          <Trash2 size={13} />
                          حذف الإعلان
                        </button>
                      )}
                    </div>
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
