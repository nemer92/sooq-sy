
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, UploadCloud, X, Store } from "lucide-react";

type Category = {
  id: number;
  name_ar: string;
  parent_id: number | null;
};

type City = {
  id: number;
  name_ar: string;
};

type StoreOption = {
  id: string;
  name: string;
  status: string;
};

type StoreQuota = {
  active: boolean;
  used: number;
  limit: number;
  remaining: number;
  endAt: string | null;
};

export default function AddAd() {
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const initialType = searchParams.get("type");
  const requestedStoreId = searchParams.get("store_id");

  const [listingType] = useState<"sale" | "donation">(
    initialType === "donation" ? "donation" : "sale"
  );

  const [userId, setUserId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [storeQuota, setStoreQuota] = useState<StoreQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [condition, setCondition] = useState("used");
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowNewAds, setAllowNewAds] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function getStoreQuota(storeId: string): Promise<StoreQuota> {
    const now = new Date().toISOString();

    const { data: subscription, error: subscriptionError } = await supabase
      .from("store_subscriptions")
      .select("id,ordinary_ads_limit,end_at")
      .eq("store_id", storeId)
      .eq("status", "active")
      .lte("start_at", now)
      .gt("end_at", now)
      .order("end_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    if (!subscription) {
      return {
        active: false,
        used: 0,
        limit: 0,
        remaining: 0,
        endAt: null,
      };
    }

    const { count, error: usageError } = await supabase
      .from("store_ad_usage")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", subscription.id)
      .eq("ad_type", "ordinary");

    if (usageError) throw usageError;

    const used = count ?? 0;
    const limit = subscription.ordinary_ads_limit ?? 0;

    return {
      active: true,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      endAt: subscription.end_at,
    };
  }

  async function refreshStoreQuota(storeId: string) {
    setQuotaLoading(true);

    try {
      const quota = await getStoreQuota(storeId);
      setStoreQuota(quota);
      return quota;
    } catch (err) {
      setStoreQuota(null);
      throw err;
    } finally {
      setQuotaLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          navigate("/auth", {
            state: {
              from: requestedStoreId
                ? `/add-ad?store_id=${requestedStoreId}`
                : "/add-ad",
            },
          });
          return;
        }

        const currentUserId = sessionData.session.user.id;

        if (mounted) setUserId(currentUserId);

        const { data: settings, error: settingsError } = await supabase
          .from("site_settings")
          .select("allow_new_ads")
          .eq("id", 1)
          .single();

        if (settingsError) {
          throw new Error("تعذر التحقق من إعدادات نشر الإعلانات.");
        }

        if (mounted) {
          setAllowNewAds(settings.allow_new_ads ?? true);
        }

        const [categoriesResult, citiesResult, storesResult] =
          await Promise.all([
            supabase
              .from("categories")
              .select("id, name_ar, parent_id")
              .eq("is_active", true)
              .order("sort_order", { ascending: true }),

            supabase
              .from("cities")
              .select("id, name_ar")
              .eq("is_active", true)
              .order("name_ar", { ascending: true }),

            supabase
              .from("stores")
              .select("id,name,status")
              .eq("owner_id", currentUserId)
              .eq("status", "active")
              .order("created_at", { ascending: false }),
          ]);

        if (categoriesResult.error) {
          throw new Error("تعذر تحميل التصنيفات.");
        }

        if (citiesResult.error) {
          throw new Error("تعذر تحميل المدن.");
        }

        if (storesResult.error) {
          throw new Error("تعذر تحميل متاجرك.");
        }

        const activeCategories = categoriesResult.data ?? [];
        const activeCategoryIds = new Set(
          activeCategories.map((category) => category.id)
        );

        if (mounted) {
          setCategories(
            activeCategories.filter(
              (category) =>
                category.parent_id === null ||
                activeCategoryIds.has(category.parent_id)
            )
          );

          setCities(citiesResult.data ?? []);
          setStores(storesResult.data ?? []);
        }

        if (requestedStoreId) {
          const requestedStore = (storesResult.data ?? []).find(
            (store) => store.id === requestedStoreId
          );

          if (!requestedStore) {
            throw new Error(
              "المتجر المطلوب غير موجود أو غير مفعّل أو لا تملك صلاحية إدارته."
            );
          }

          if (mounted) setSelectedStoreId(requestedStoreId);

          const quota = await getStoreQuota(requestedStoreId);

          if (mounted) {
            setStoreQuota(quota);

            if (!quota.active) {
              setError("اشتراك هذا المتجر غير فعّال. يرجى تجديد الاشتراك.");
            } else if (quota.remaining <= 0) {
              setError("استهلك المتجر كامل رصيد الإعلانات العادية.");
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "تعذر تجهيز صفحة إضافة الإعلان."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [navigate, requestedStoreId]);

  async function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    setStoreQuota(null);
    setError("");

    if (!storeId) return;

    try {
      const quota = await refreshStoreQuota(storeId);

      if (!quota.active) {
        setError("اشتراك هذا المتجر غير فعّال. يرجى تجديد الاشتراك.");
      } else if (quota.remaining <= 0) {
        setError("استهلك المتجر كامل رصيد الإعلانات العادية.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر التحقق من رصيد المتجر."
      );
    }
  }

  function handleImages(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    const validFiles = selectedFiles.filter(
      (file) =>
        allowedTypes.includes(file.type) &&
        file.size <= 5 * 1024 * 1024
    );

    const remainingSlots = Math.max(0, 3 - images.length);
    const filesToAdd = validFiles.slice(0, remainingSlots);

    setImages((current) => [...current, ...filesToAdd].slice(0, 3));

    if (validFiles.length !== selectedFiles.length) {
      setError(
        "الصور يجب أن تكون JPG أو PNG أو WEBP، وبحجم لا يتجاوز 5 ميغابايت للصورة."
      );
    } else if (validFiles.length > remainingSlots) {
      setError("الحد الأقصى المسموح به هو 3 صور للإعلان الواحد.");
    } else {
      setError("");
    }

    event.target.value = "";
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!userId) {
      navigate("/auth", {
        state: {
          from: selectedStoreId
            ? `/add-ad?store_id=${selectedStoreId}`
            : "/add-ad",
        },
      });
      return;
    }

    const { data: settings, error: settingsError } = await supabase
      .from("site_settings")
      .select("allow_new_ads")
      .eq("id", 1)
      .single();

    if (settingsError) {
      setError("تعذر التحقق من حالة نشر الإعلانات. حاول مرة أخرى.");
      return;
    }

    if (!settings.allow_new_ads) {
      setAllowNewAds(false);
      return;
    }

    if (!categoryId || !cityId) {
      setError("يرجى اختيار التصنيف والمدينة.");
      return;
    }

    if (title.trim().length < 5) {
      setError("عنوان الإعلان يجب ألا يقل عن 5 أحرف.");
      return;
    }

    if (title.trim().length > 150) {
      setError("عنوان الإعلان يجب ألا يتجاوز 150 حرفاً.");
      return;
    }

    if (description.trim().length < 10) {
      setError("وصف الإعلان يجب ألا يقل عن 10 أحرف.");
      return;
    }

    if (images.length > 3) {
      setError("لا يمكن إضافة أكثر من 3 صور للإعلان الواحد.");
      return;
    }

    if (selectedStoreId && listingType === "donation") {
      setError("إعلانات التبرع لا يمكن ربطها بمتجر.");
      return;
    }

    if (selectedStoreId) {
      try {
        const quota = await getStoreQuota(selectedStoreId);
        setStoreQuota(quota);

        if (!quota.active) {
          setError("اشتراك المتجر غير فعّال. يرجى تجديد الاشتراك.");
          return;
        }

        if (quota.remaining <= 0) {
          setError("لا يوجد رصيد متبقٍ للإعلانات العادية في هذا المتجر.");
          return;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "تعذر التحقق من اشتراك المتجر."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { data: ad, error: adError } = await supabase
        .from("ads")
        .insert({
          user_id: userId,
          category_id: Number(categoryId),
          city_id: Number(cityId),
          title: title.trim(),
          description: description.trim(),
          price:
            listingType === "donation"
              ? 0
              : price.trim() === ""
                ? 0
                : Number(price),
          currency,
          listing_type: listingType,
          condition,
          status: "pending",
          store_id: selectedStoreId || null,
        })
        .select("id")
        .single();

      if (adError) throw adError;

      if (images.length > 0) {
        const imageRecords = [];

        for (let i = 0; i < images.length; i++) {
          const file = images[i];
          const extension =
            file.name.split(".").pop()?.toLowerCase() || "jpg";
          const imagePath = `${userId}/${ad.id}/${crypto.randomUUID()}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from("ad-images")
            .upload(imagePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          imageRecords.push({
            ad_id: ad.id,
            image_path: imagePath,
            sort_order: i,
          });
        }

        const { error: imagesError } = await supabase
          .from("ad_images")
          .insert(imageRecords);

        if (imagesError) throw imagesError;
      }

      setSuccess(
        selectedStoreId
          ? "تم إرسال منتج المتجر للمراجعة بنجاح."
          : listingType === "donation"
            ? "تم إرسال التبرع بنجاح، وهو الآن بانتظار المراجعة."
            : "تم إرسال إعلانك بنجاح، وهو الآن بانتظار المراجعة."
      );

      setTimeout(() => {
        if (selectedStoreId) {
          navigate(`/store/${selectedStoreId}`);
        } else {
          navigate("/");
        }
      }, 2000);
    } catch (err: any) {
      console.error("خطأ نشر الإعلان:", err);

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          "حدث خطأ أثناء نشر الإعلان."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div dir="rtl" className="p-10 text-center">
        جارٍ تجهيز الصفحة...
      </div>
    );
  }

  if (!allowNewAds) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
      >
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-black text-slate-800">
            نشر الإعلانات متوقف مؤقتاً
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            نعتذر منك، لا يمكن إضافة إعلانات جديدة في الوقت الحالي.
            يمكنك تصفح الإعلانات الموجودة والعودة لاحقاً.
          </p>

          <Link
            to="/"
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white"
          >
            العودة للرئيسية
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            to={selectedStoreId ? `/store/${selectedStoreId}` : "/"}
            className="flex items-center gap-2 font-bold text-emerald-700"
          >
            <ArrowRight size={20} />
            {selectedStoreId ? "العودة للمتجر" : "العودة للرئيسية"}
          </Link>
          <span className="text-xl font-black text-emerald-700">
            Sooq.sy
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-800">
            {listingType === "donation"
              ? "تبرع بغرض مجاناً"
              : selectedStoreId
                ? "إضافة منتج للمتجر"
                : "أضف إعلانك"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {listingType === "donation"
              ? "شارك غرضاً لم تعد بحاجة إليه، وساعد شخصاً آخر على الاستفادة منه."
              : selectedStoreId
                ? "أضف منتجاً جديداً ليظهر في صفحة متجرك وأقسام السوق بعد الموافقة عليه."
                : "أدخل تفاصيل إعلانك وأضف الصور ليصل إلى المهتمين."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-7"
        >
          {listingType === "sale" && stores.length > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-800">
                <Store size={18} />
                أين تريد نشر الإعلان؟
              </label>

              <select
                value={selectedStoreId}
                onChange={(event) => handleStoreChange(event.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              >
                <option value="">إعلان شخصي - بدون متجر</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>

              {selectedStoreId && (
                <div className="mt-3 rounded-lg bg-white p-3 text-sm">
                  {quotaLoading ? (
                    <p className="text-slate-500">
                      جارٍ التحقق من رصيد المتجر...
                    </p>
                  ) : storeQuota?.active ? (
                    <>
                      <p className="font-bold text-emerald-800">
                        رصيد الإعلانات العادية
                      </p>
                      <p className="mt-1 text-slate-600">
                        المستخدم: {storeQuota.used} من {storeQuota.limit}
                      </p>
                      <p className="mt-1 font-bold text-emerald-700">
                        المتبقي: {storeQuota.remaining} إعلان
                      </p>
                      {storeQuota.endAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          انتهاء الاشتراك:{" "}
                          {new Date(storeQuota.endAt).toLocaleDateString(
                            "ar-SY"
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-bold text-red-600">
                      لا يوجد اشتراك فعّال لهذا المتجر.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold">
              عنوان الإعلان
            </label>
            <input
              required
              minLength={5}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: سيارة للبيع بحالة ممتازة"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              وصف الإعلان
            </label>
            <textarea
              required
              minLength={10}
              maxLength={10000}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                listingType === "donation"
                  ? "اكتب تفاصيل الغرض الذي تريد التبرع به..."
                  : "اكتب تفاصيل الإعلان..."
              }
              className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              يجب ألا يقل الوصف عن 10 أحرف.
              <span className="mr-2">
                عدد الأحرف: {description.length} / 10000
              </span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold">
                التصنيف
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              >
                <option value="">اختر التصنيف</option>
                {categories.map((category) => {
                  const parent = categories.find(
                    (item) => item.id === category.parent_id
                  );

                  return (
                    <option key={category.id} value={category.id}>
                      {parent
                        ? `${parent.name_ar} - ${category.name_ar}`
                        : category.name_ar}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                المدينة
              </label>
              <select
                required
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              >
                <option value="">اختر المدينة</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name_ar}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {listingType === "donation" ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="font-bold text-rose-700">
                ❤️ هذا الغرض للتبرع مجاناً
              </p>
              <p className="mt-1 text-sm text-rose-600">
                لن يُطلب من المستفيد دفع أي مبلغ مقابل هذا الغرض.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  السعر (اختياري)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="أدخل السعر"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  العملة
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                >
                  <option value="USD">دولار أمريكي</option>
                  <option value="SYP">ليرة سورية</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold">
              حالة المنتج
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
            >
              <option value="new">جديد</option>
              <option value="used">مستعمل</option>
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-bold">
              صور الإعلان (حتى 3 صور)
              <span className="mr-2 text-emerald-600">
                {images.length}/3
              </span>
            </label>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-emerald-500">
              <UploadCloud size={32} className="mb-3 text-emerald-600" />
              <span className="font-bold text-slate-700">
                اضغط لاختيار الصور
              </span>
              <span className="mt-2 text-xs text-slate-400">
                JPG أو PNG أو WEBP، بحد أقصى 5 ميغابايت للصورة
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImages}
                className="hidden"
              />
            </label>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="relative"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-24 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -left-2 -top-2 rounded-full bg-red-600 p-1 text-white"
                      aria-label="حذف الصورة"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              quotaLoading ||
              (!!selectedStoreId &&
                (!storeQuota?.active || storeQuota.remaining <= 0))
            }
            className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving
              ? "جارٍ الإرسال..."
              : listingType === "donation"
                ? "إرسال التبرع للمراجعة"
                : "إرسال الإعلان للمراجعة"}
          </button>
        </form>
      </div>
    </main>
  );
}
