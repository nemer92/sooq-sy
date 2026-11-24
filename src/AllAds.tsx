
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
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
  const [featuringAdId, setFeaturingAdId] = useState<string | null>(null);

  async function featureAd(ad: Ad) {
    const isStoreAd = Boolean(ad.store_id);

    const confirmed = await window.sooqConfirm(
      isStoreAd
        ? "هل تريد تمييز هذا الإعلان باستخدام حصة الإعلانات المميزة في اشتراك المتجر؟"
        : "هل تريد تمييز هذا الإعلان مقابل 2 نقطة؟"
    );

    if (!confirmed) return;

    setFeaturingAdId(ad.id);

    try {
      const { error } = isStoreAd
        ? await supabase.rpc("feature_ad_with_subscription", {
            p_ad_id: ad.id,
          })
        : await supabase.rpc("feature_ad_with_points", {
            p_ad_id: ad.id,
          });

      if (error) throw error;

      setAds((currentAds) =>
        currentAds.map((item) =>
          item.id === ad.id ? { ...item, is_featured: true } : item
        )
      );

      window.alert(
        isStoreAd
          ? "تم تمييز الإعلان باستخدام حصة المتجر بنجاح."
          : "تم تمييز إعلانك بنجاح مقابل 2 نقطة."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "";

      if (message.includes("لا توجد نقاط كافية")) {
        window.alert("لا توجد نقاط كافية.");
      } else {
        window.alert(message || "تعذر تمييز الإعلان.");
      }
    } finally {
      setFeaturingAdId(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadMyAds() {
      setLoading(true);

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
          published_at,
          rejection_reason,
          categories(name_ar),
          cities(name_ar),
          listing_type,
          is_featured,
          store_id,
          ad_images(image_path, sort_order)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        console.error("خطأ تحميل إعلانات المستخدم:", error);
        setError("تعذر تحميل إعلاناتك. حاول مرة أخرى.");
        setLoading(false);
        return;
      }

      try {
        const formattedAds: Ad[] = await Promise.all(
          (data ?? []).map(async (ad: any) => {
            const sortedImages = (ad.ad_images ?? []).sort(
              (a: any, b: any) => a.sort_order - b.sort_order
            );

            const signedImages = await Promise.all(
              sortedImages.map(async (image: any) => {
                const { data: imageData, error: imageError } =
                  await supabase.storage
                    .from("ad-images")
                    .createSignedUrl(image.image_path, 3600);

                if (imageError) {
                  console.error("خطأ تحميل صورة الإعلان:", imageError);
                  return "";
                }

                return imageData.signedUrl;
              })
            );

            return {
              id: ad.id,
              title: ad.title,
              price: ad.price,
              currency: ad.currency,
              status: ad.status,
              created_at: ad.created_at,
              published_at: ad.published_at,
              rejection_reason: ad.rejection_reason,
              categories: ad.categories,
              cities: ad.cities,
              listing_type: ad.listing_type,
              is_featured: ad.is_featured ?? false,
              store_id: ad.store_id,
              images: signedImages.filter(Boolean),
            };
          })
        );

        if (active) {
          setAds(formattedAds);
        }
      } catch (err) {
        console.error("خطأ تجهيز صور الإعلانات:", err);

        if (active) {
          setError("تعذر تحميل صور إعلاناتك. حاول مرة أخرى.");
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
    };
  }, [navigate]);

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5">
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

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-white p-4 shadow-sm sm:mb-7 sm:rounded-3xl sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Tag size={19} />
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"
            >
              <Plus size={18} />
              أضف إعلاناً جديداً
            </Link>
          </div>

          {!loading && !error && (
            <div className="mt-5 flex items-center gap-2 border-t border-emerald-100 pt-4 text-xs font-semibold text-slate-500">
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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {ads.map((ad) => {
              const status = statusInfo[ad.status] ?? {
                label: ad.status,
                color: "bg-slate-100 text-slate-600 border-slate-200",
              };

              return (
                <article
                  key={ad.id}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:rounded-2xl ${
                    ad.is_featured
                      ? "border-amber-200"
                      : "border-slate-100"
                  }`}
                >
                  <Link
                    to={`/ad/${ad.id}`}
                    className="group relative block aspect-square overflow-hidden bg-slate-100"
                  >
                    {ad.images?.length > 0 ? (
                      <img
                        src={ad.images[0]}
                        alt={ad.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <Tag size={34} />
                      </div>
                    )}

                    <span
                      className={`absolute right-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md border px-2 py-1 text-[9px] font-bold sm:right-3 sm:top-3 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-xs ${status.color}`}
                    >
                      {status.label}
                    </span>

                    {ad.is_featured && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-[9px] font-black text-amber-950 shadow-sm sm:left-3 sm:top-3 sm:rounded-lg sm:text-xs">
                        <Star size={11} fill="currentColor" />
                        مميز
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-2 sm:p-3">
                    <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      <span className="truncate rounded-md bg-slate-100 px-1.5 py-1 text-[9px] font-semibold text-slate-500 sm:text-[10px]">
                        {ad.categories?.name_ar ?? "غير محدد"}
                      </span>

                      {ad.store_id && (
                        <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-violet-50 px-1.5 py-1 text-[9px] font-bold text-violet-700 sm:text-[10px]">
                          <Store size={11} />
                          متجر
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/ad/${ad.id}`}
                      className="line-clamp-2 min-h-9 text-xs font-bold leading-5 text-slate-800 transition hover:text-emerald-700 sm:min-h-12 sm:text-sm sm:leading-6"
                    >
                      {ad.title}
                    </Link>

                    <div className="mt-1.5 min-h-5">
                      <span className="text-sm font-black text-emerald-700 sm:text-lg">
                        {ad.price !== null
                          ? ad.price.toLocaleString("en-US")
                          : "السعر عند التواصل"}
                      </span>

                      {ad.price !== null && (
                        <span className="mr-1 text-[9px] font-semibold text-slate-500 sm:text-xs">
                          {ad.currency === "USD"
                            ? "دولار"
                            : ad.currency === "SYP"
                              ? "ليرة سورية"
                              : ad.currency}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex min-w-0 items-center justify-between gap-1 border-t border-slate-100 pt-2 text-[9px] text-slate-400 sm:mt-3 sm:pt-2.5 sm:text-[11px]">
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <Eye size={11} className="shrink-0" />
                        <span className="truncate">
                          {ad.cities?.name_ar ?? "غير محدد"}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-1">
                        <CalendarDays size={11} />
                        {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                      </span>
                    </div>

                    {ad.status === "rejected" && ad.rejection_reason && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50/70 p-2 text-[10px] leading-5 text-red-700 sm:text-xs">
                        <span className="font-bold">سبب الرفض:</span>{" "}
                        {ad.rejection_reason}
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 mt-3">
                      {ad.status === "approved" && (
                        <>
                          <Link
                            to={`/ad/${ad.id}`}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-2 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-50 sm:text-xs"
                          >
                            <Eye size={13} />
                            عرض
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
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 sm:text-xs"
                          >
                            <Archive size={13} />
                            أرشفة
                          </button>

                          {ad.listing_type === "sale" && !ad.is_featured && (
                            <button
                              type="button"
                              onClick={() => featureAd(ad)}
                              disabled={featuringAdId === ad.id}
                              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
                            >
                              <Star size={13} fill="currentColor" />
                              {featuringAdId === ad.id
                                ? "جارٍ التمييز..."
                                : ad.store_id
                                  ? "تمييز من حصة المتجر"
                                  : "تمييز مقابل 5 نقاط"}
                            </button>
                          )}

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
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50/50 px-2 py-2 text-[10px] font-bold text-blue-700 transition hover:bg-blue-50 sm:text-xs"
                        >
                          <Pencil size={13} />
                          تعديل
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
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50/50 px-2 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-50 sm:text-xs"
                        >
                          <Trash2 size={13} />
                          حذف
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
