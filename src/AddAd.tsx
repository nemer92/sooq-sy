
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import { addSooqWatermark } from "./lib/imageWatermark";

import {
  ArrowRight,
  UploadCloud,
  X,
  Store,
  MapPin,
  Tag,
  ImagePlus,
  CircleDollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Star,
} from "lucide-react";

function isNetworkError(error: any): boolean {
  if (error instanceof TypeError) return true;

  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    message.includes("fetch failed") ||
    message.includes("internet disconnected") ||
    message.includes("connection refused") ||
    message.includes("connection reset") ||
    message.includes("timeout")
  );
}

function waitUntilOnline(
  setWaiting: (value: boolean) => void
): Promise<void> {
  if (navigator.onLine) {
    setWaiting(false);
    return Promise.resolve();
  }

  setWaiting(true);

  return new Promise((resolve) => {
    window.addEventListener(
      "online",
      () => {
        setWaiting(false);
        resolve();
      },
      { once: true }
    );
  });
}

function retryDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2500));
}

function isDuplicateStorageUpload(error: any): boolean {
  const status = String(error?.statusCode ?? error?.status ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    status === "409" ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("resource already")
  );
}
type Category = {
  id: number;
  name_ar: string;
  parent_id: number | null;
};

type Governorate = {
  id: number;
  name_ar: string;
};

type City = {
  id: number;
  name_ar: string;
  governorate_id: number;
};

type StoreOption = {
  id: string;
  name: string;
  status: string;
  owner_disabled: boolean;
  admin_disabled: boolean;
};

type StoreQuota = {
  active: boolean;
  used: number;
  limit: number;
  remaining: number;
  featuredUsed: number;
  featuredLimit: number;
  featuredRemaining: number;
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
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [storeQuota, setStoreQuota] = useState<StoreQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [requestedFeatured, setRequestedFeatured] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
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
  const submitLockRef = useRef(false);
  const [waitingForNetwork, setWaitingForNetwork] = useState(false);

  const submissionRef = useRef<{
    key: string;
    adId: string | null;
    preflightComplete: boolean;
    files: File[];
    storeId: string;
    listingType: "sale" | "donation";
    requestedFeatured: boolean;
    payload: Record<string, any>;
  } | null>(null);

  const filteredCities = governorateId
    ? cities.filter(
        (city) => city.governorate_id === Number(governorateId)
      )
    : [];

  async function getStoreQuota(storeId: string): Promise<StoreQuota> {
    const now = new Date().toISOString();

    const { data: subscription, error: subscriptionError } = await supabase
      .from("store_subscriptions")
      .select("id,ordinary_ads_limit,featured_ads_limit,end_at")
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
        featuredUsed: 0,
        featuredLimit: 0,
        featuredRemaining: 0,
        endAt: null,
      };
    }

    const [
      { count: ordinaryCount, error: ordinaryError },
      { count: featuredCount, error: featuredError },
    ] = await Promise.all([
      supabase
        .from("store_ad_usage")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", subscription.id)
        .eq("ad_type", "ordinary"),

      supabase
        .from("store_ad_usage")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", subscription.id)
        .eq("ad_type", "featured"),
    ]);

    if (ordinaryError) throw ordinaryError;
    if (featuredError) throw featuredError;

    const used = ordinaryCount ?? 0;
    const limit = subscription.ordinary_ads_limit ?? 0;
    const featuredUsed = featuredCount ?? 0;
    const featuredLimit = subscription.featured_ads_limit ?? 0;

    return {
      active: true,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      featuredUsed,
      featuredLimit,
      featuredRemaining: Math.max(0, featuredLimit - featuredUsed),
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

  function handleGovernorateChange(value: string) {
    setGovernorateId(value);
    setCityId("");
    setError("");
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
          throw new Error("طھط¹ط°ط± ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط¥ط¹ط¯ط§ط¯ط§طھ ظ†ط´ط± ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ.");
        }

        if (mounted) {
          setAllowNewAds(settings.allow_new_ads ?? true);
        }

        const [
          categoriesResult,
          governoratesResult,
          citiesResult,
          storesResult,
        ] = await Promise.all([
          supabase
            .from("categories")
            .select("id, name_ar, parent_id")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),

          supabase
            .from("governorates")
            .select("id, name_ar")
            .eq("is_active", true)
            .order("name_ar", { ascending: true }),

          supabase
            .from("cities")
            .select("id, name_ar, governorate_id")
            .eq("is_active", true)
            .order("name_ar", { ascending: true }),

          supabase
            .from("stores")
            .select("id,name,status,owner_disabled,admin_disabled")
            .eq("owner_id", currentUserId)
            .eq("status", "active")
            .eq("owner_disabled", false)
            .eq("admin_disabled", false)
            .order("created_at", { ascending: false }),
        ]);

        if (categoriesResult.error) {
          throw new Error("طھط¹ط°ط± طھط­ظ…ظٹظ„ ط§ظ„طھطµظ†ظٹظپط§طھ.");
        }

        if (governoratesResult.error) {
          throw new Error("طھط¹ط°ط± طھط­ظ…ظٹظ„ ط§ظ„ظ…ط­ط§ظپط¸ط§طھ.");
        }

        if (citiesResult.error) {
          throw new Error("طھط¹ط°ط± طھط­ظ…ظٹظ„ ط§ظ„ظ…ط¯ظ†.");
        }

        if (storesResult.error) {
          throw new Error("طھط¹ط°ط± طھط­ظ…ظٹظ„ ظ…طھط§ط¬ط±ظƒ.");
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

          setGovernorates(governoratesResult.data ?? []);
          setCities(citiesResult.data ?? []);
          setStores(storesResult.data ?? []);
        }

        if (requestedStoreId) {
          const requestedStore = (storesResult.data ?? []).find(
            (store) => store.id === requestedStoreId
          );

          if (!requestedStore) {
            throw new Error(
              "ظ„ط§ ظٹظ…ظƒظ† ط§ظ„ظ†ط´ط± ظپظٹ ظ‡ط°ط§ ط§ظ„ظ…طھط¬ط± ظ„ط£ظ†ظ‡ ط؛ظٹط± ظ…ظپط¹ظ‘ظ„ ط£ظˆ ظ…ظˆظ‚ظˆظپ ظ…ظ† ط§ظ„ط¥ط¯ط§ط±ط©."
            );
          }

          if (mounted) setSelectedStoreId(requestedStoreId);

          const quota = await getStoreQuota(requestedStoreId);

          if (mounted) {
            setStoreQuota(quota);

            if (!quota.active) {
              setError("ط§ط´طھط±ط§ظƒ ظ‡ط°ط§ ط§ظ„ظ…طھط¬ط± ط؛ظٹط± ظپط¹ظ‘ط§ظ„. ظٹط±ط¬ظ‰ طھط¬ط¯ظٹط¯ ط§ظ„ط§ط´طھط±ط§ظƒ.");
            } else if (
              quota.remaining <= 0 &&
              quota.featuredRemaining <= 0
            ) {
              setError("ط§ط³طھظ‡ظ„ظƒ ط§ظ„ظ…طھط¬ط± ظƒط§ظ…ظ„ ط±طµظٹط¯ ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ط§ظ„ط¹ط§ط¯ظٹط© ظˆط§ظ„ظ…ظ…ظٹط²ط©.");
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "طھط¹ط°ط± طھط¬ظ‡ظٹط² طµظپط­ط© ط¥ط¶ط§ظپط© ط§ظ„ط¥ط¹ظ„ط§ظ†."
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
    setRequestedFeatured(false);
    setError("");

    if (!storeId) return;

    const store = stores.find((item) => item.id === storeId);

    if (
      !store ||
      store.status !== "active" ||
      store.owner_disabled ||
      store.admin_disabled
    ) {
      setSelectedStoreId("");
      setError("ظ„ط§ ظٹظ…ظƒظ† ط§ظ„ظ†ط´ط± ظپظٹ ظ…طھط¬ط± ظ…ظˆظ‚ظˆظپ ط£ظˆ ط؛ظٹط± ظ…ظپط¹ظ‘ظ„.");
      return;
    }

    try {
      const quota = await refreshStoreQuota(storeId);

      if (!quota.active) {
        setError("ط§ط´طھط±ط§ظƒ ظ‡ط°ط§ ط§ظ„ظ…طھط¬ط± ط؛ظٹط± ظپط¹ظ‘ط§ظ„. ظٹط±ط¬ظ‰ طھط¬ط¯ظٹط¯ ط§ظ„ط§ط´طھط±ط§ظƒ.");
      } else if (
        quota.remaining <= 0 &&
        quota.featuredRemaining <= 0
      ) {
        setError("ط§ط³طھظ‡ظ„ظƒ ط§ظ„ظ…طھط¬ط± ظƒط§ظ…ظ„ ط±طµظٹط¯ ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ط§ظ„ط¹ط§ط¯ظٹط© ظˆط§ظ„ظ…ظ…ظٹط²ط©.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "طھط¹ط°ط± ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط±طµظٹط¯ ط§ظ„ظ…طھط¬ط±."
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
        "ط§ظ„طµظˆط± ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† JPG ط£ظˆ PNG ط£ظˆ WEBPطŒ ظˆط¨ط­ط¬ظ… ظ„ط§ ظٹطھط¬ط§ظˆط² 5 ظ…ظٹط؛ط§ط¨ط§ظٹطھ ظ„ظ„طµظˆط±ط©."
      );
    } else if (validFiles.length > remainingSlots) {
      setError("ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ ط§ظ„ظ…ط³ظ…ظˆط­ ط¨ظ‡ ظ‡ظˆ 3 طµظˆط± ظ„ظ„ط¥ط¹ظ„ط§ظ† ط§ظ„ظˆط§ط­ط¯.");
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

    // قفل فوري ومتزامن يمنع تنفيذ أكثر من عملية إرسال.
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setSaving(true);
    setWaitingForNetwork(!navigator.onLine);
    setError("");
    setSuccess("");

    const stopWithError = (message: string) => {
      setError(message);
      setSaving(false);
      setWaitingForNetwork(false);
      submitLockRef.current = false;
    };

    if (!userId) {
      stopWithError("انتهت جلسة الدخول. يرجى تسجيل الدخول مجدداً.");
      navigate("/auth", {
        state: {
          from: selectedStoreId
            ? `/add-ad?store_id=${selectedStoreId}`
            : "/add-ad",
        },
      });
      return;
    }

    // نتحقق من البيانات محلياً قبل بدء أي طلب للشبكة.
    // عند وجود إرسال سابق غير مكتمل، نحتفظ بنفس بياناته ومفتاحه.
    if (!submissionRef.current) {
      if (!categoryId || !governorateId || !cityId) {
        stopWithError("يرجى اختيار التصنيف والمحافظة والمدينة.");
        return;
      }

      const selectedCity = cities.find(
        (city) =>
          city.id === Number(cityId) &&
          city.governorate_id === Number(governorateId)
      );

      if (!selectedCity) {
        stopWithError(
          "المدينة المختارة لا تتبع المحافظة المحددة. يرجى اختيار المدينة من جديد."
        );
        return;
      }

      if (title.trim().length < 5) {
        stopWithError("عنوان الإعلان يجب ألا يقل عن 5 أحرف.");
        return;
      }

      if (title.trim().length > 150) {
        stopWithError("عنوان الإعلان يجب ألا يتجاوز 150 حرفاً.");
        return;
      }

      if (description.trim().length < 10) {
        stopWithError("وصف الإعلان يجب ألا يقل عن 10 أحرف.");
        return;
      }

      if (images.length > 3) {
        stopWithError("لا يمكن إضافة أكثر من 3 صور للإعلان الواحد.");
        return;
      }

      if (selectedStoreId && listingType === "donation") {
        stopWithError("إعلانات التبرع لا يمكن ربطها بمتجر.");
        return;
      }

      const numericPrice =
        listingType === "donation"
          ? 0
          : price.trim() === ""
            ? 0
            : Number(price);

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        stopWithError("يرجى إدخال سعر صحيح.");
        return;
      }

      // المفتاح والبيانات والصور تبقى نفسها عند كل إعادة محاولة.
      submissionRef.current = {
        key: crypto.randomUUID(),
        adId: null,
        preflightComplete: false,
        files: [...images],
        storeId: selectedStoreId,
        listingType,
        requestedFeatured: selectedStoreId ? requestedFeatured : false,
        payload: {
          user_id: userId,
          category_id: Number(categoryId),
          city_id: Number(cityId),
          title: title.trim(),
          description: description.trim(),
          price: numericPrice,
          currency,
          listing_type: listingType,
          condition,
          status: "pending",
          store_id: selectedStoreId || null,
          requested_featured: selectedStoreId ? requestedFeatured : false,
        },
      };
    }

    const submission = submissionRef.current;
    if (!submission) {
      stopWithError("تعذر تجهيز بيانات الإعلان. حاول مرة أخرى.");
      return;
    }

    let completed = false;

    while (!completed) {
      await waitUntilOnline(setWaitingForNetwork);

      try {
        // فحوصات الموقع والمتجر تُنفّذ قبل إنشاء الإعلان.
        // بعد إنشاء الإعلان، لا نعيد هذه الفحوصات عند استكمال صوره.
        if (!submission.preflightComplete) {
          const { data: settings, error: settingsError } = await supabase
            .from("site_settings")
            .select("allow_new_ads")
            .eq("id", 1)
            .single();

          if (settingsError) throw settingsError;

          if (!settings.allow_new_ads) {
            setAllowNewAds(false);
            throw new Error("نشر الإعلانات متوقف مؤقتاً.");
          }

          if (submission.storeId) {
            const { data: store, error: storeError } = await supabase
              .from("stores")
              .select("id,status,owner_disabled,admin_disabled")
              .eq("id", submission.storeId)
              .eq("owner_id", userId)
              .maybeSingle();

            if (storeError) throw storeError;

            if (
              !store ||
              store.status !== "active" ||
              store.owner_disabled ||
              store.admin_disabled
            ) {
              setSelectedStoreId("");
              setStoreQuota(null);
              throw new Error(
                "هذا المتجر موقوف حالياً، ولا يمكنك نشر إعلان جديد باسمه."
              );
            }

            const quota = await getStoreQuota(submission.storeId);
            setStoreQuota(quota);

            if (!quota.active) {
              throw new Error("اشتراك المتجر غير فعّال. يرجى تجديد الاشتراك.");
            }

            if (
              submission.requestedFeatured &&
              quota.featuredRemaining <= 0
            ) {
              throw new Error(
                "لا يوجد رصيد متبقٍ للإعلانات المميزة في هذا المتجر."
              );
            }

            if (
              !submission.requestedFeatured &&
              quota.remaining <= 0
            ) {
              throw new Error(
                "لا يوجد رصيد متبقٍ للإعلانات العادية في هذا المتجر."
              );
            }
          }

          submission.preflightComplete = true;
        }

        // نبحث عن الإعلان أولاً؛ فقد يكون الخادم أنشأه
        // في محاولة سابقة ولم يصل رد النجاح إلى المتصفح.
        if (!submission.adId) {
          const { data: existingAd, error: lookupError } = await supabase
            .from("ads")
            .select("id")
            .eq("submission_key", submission.key)
            .eq("user_id", userId)
            .maybeSingle();

          if (lookupError) throw lookupError;

          if (existingAd?.id) {
            submission.adId = existingAd.id;
          } else {
            const { data: newAd, error: insertError } = await supabase
              .from("ads")
              .insert({
                ...submission.payload,
                submission_key: submission.key,
              })
              .select("id")
              .single();

            if (insertError) {
              // قد تكون محاولة سابقة أنشأت الإعلان بالفعل.
              // عند تعارض المفتاح نبحث عنه بدلاً من إنشاء إعلان آخر.
              if (insertError.code === "23505") {
                const { data: duplicateAd, error: duplicateLookupError } =
                  await supabase
                    .from("ads")
                    .select("id")
                    .eq("submission_key", submission.key)
                    .eq("user_id", userId)
                    .maybeSingle();

                if (duplicateLookupError) throw duplicateLookupError;

                if (!duplicateAd?.id) throw insertError;

                submission.adId = duplicateAd.id;
              } else {
                throw insertError;
              }
            } else {
              submission.adId = newAd.id;
            }
          }
        }

        // مسار ثابت لكل صورة: إعادة المحاولة لا تنشئ ملفات مكررة.
        const imageRecords: {
          ad_id: string;
          image_path: string;
          sort_order: number;
        }[] = [];

        for (let i = 0; i < submission.files.length; i++) {
          const originalFile = submission.files[i];
          const file = await addSooqWatermark(originalFile);

          const imagePath =
            `${userId}/${submission.adId}/${submission.key}-${i}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("ad-images")
            .upload(imagePath, file, {
              contentType: "image/jpeg",
              upsert: false,
            });

          // إذا كانت الصورة موجودة من محاولة سابقة، نكمل.
          // لا نستخدم upsert لأن سياسات التخزين لا تسمح بتحديثها.
          if (uploadError && !isDuplicateStorageUpload(uploadError)) {
            throw uploadError;
          }

          imageRecords.push({
            ad_id: submission.adId!,
            image_path: imagePath,
            sort_order: i,
          });
        }

        if (imageRecords.length > 0) {
          const { error: imagesError } = await supabase
            .from("ad_images")
            .upsert(imageRecords, {
              onConflict: "ad_id,image_path",
              ignoreDuplicates: true,
            });

          if (imagesError) throw imagesError;
        }

        completed = true;
        setWaitingForNetwork(false);

        setSuccess(
          submission.storeId
            ? "تم إرسال منتج المتجر للمراجعة بنجاح."
            : submission.listingType === "donation"
              ? "تم إرسال التبرع بنجاح، وهو الآن بانتظار المراجعة."
              : "تم إرسال إعلانك بنجاح، وهو الآن بانتظار المراجعة."
        );

        setTimeout(() => {
          if (submission.storeId) {
            navigate(`/store/${submission.storeId}`);
          } else {
            navigate("/");
          }
        }, 2000);
      } catch (err: any) {
        console.error("خطأ نشر الإعلان:", err);

        if (isNetworkError(err)) {
          setWaitingForNetwork(true);
          setError(
            "الاتصال بالإنترنت غير مستقر. تم الاحتفاظ ببيانات إعلانك، وستتم إعادة المحاولة تلقائياً..."
          );

          await retryDelay();
          continue;
        }

        const message =
          err?.message ||
          err?.details ||
          err?.hint ||
          "حدث خطأ أثناء نشر الإعلان.";

        if (submission.adId) {
          setError(
            `تم إنشاء الإعلان، لكن لم يكتمل حفظ جميع صوره. اضغط إعادة المحاولة لإكمال نفس الإعلان دون إنشاء إعلان جديد. التفاصيل: ${message}`
          );
        } else {
          setError(message);
          submissionRef.current = null;
        }

        setWaitingForNetwork(false);
        setSaving(false);
        submitLockRef.current = false;
        return;
      }
    }

        // يبقى القفل مفعلاً بعد النجاح حتى يتم التحويل.
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";

  const labelClass =
    "mb-2.5 block text-sm font-bold text-slate-700";

  const sectionClass =
    "rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6";

  const selectedQuotaRemaining = requestedFeatured
    ? storeQuota?.featuredRemaining ?? 0
    : storeQuota?.remaining ?? 0;

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f9f8] px-4"
      >
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-10 py-8 shadow-sm">
          <RefreshCw size={28} className="animate-spin text-emerald-600" />
          <p className="text-sm font-bold text-slate-500">
            ط¬ط§ط±ظچ طھط¬ظ‡ظٹط² طµظپط­ط© ط¥ط¶ط§ظپط© ط§ظ„ط¥ط¹ظ„ط§ظ†...
          </p>
        </div>
      </main>
    );
  }

  if (!allowNewAds) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f9f8] px-4"
      >
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle size={30} />
          </div>

          <h2 className="mt-5 text-xl font-black text-slate-800">
            ظ†ط´ط± ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ظ…طھظˆظ‚ظپ ظ…ط¤ظ‚طھط§ظ‹
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            ظ†ط¹طھط°ط± ظ…ظ†ظƒطŒ ظ„ط§ ظٹظ…ظƒظ† ط¥ط¶ط§ظپط© ط¥ط¹ظ„ط§ظ†ط§طھ ط¬ط¯ظٹط¯ط© ظپظٹ ط§ظ„ظˆظ‚طھ ط§ظ„ط­ط§ظ„ظٹ.
            ظٹظ…ظƒظ†ظƒ طھطµظپط­ ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ط§ظ„ظ…ظˆط¬ظˆط¯ط© ظˆط§ظ„ط¹ظˆط¯ط© ظ„ط§ط­ظ‚ط§ظ‹.
          </p>

          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-700"
          >
            <ArrowRight size={18} />
            ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ط±ط¦ظٹط³ظٹط©
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f9f8] pb-12"
    >
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to={selectedStoreId ? `/store/${selectedStoreId}` : "/"}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            <ArrowRight size={19} />
            <span>
              {selectedStoreId ? "ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ظ…طھط¬ط±" : "ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ط±ط¦ظٹط³ظٹط©"}
            </span>
          </Link>

          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-emerald-700">
              Sooq.sy
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
              <Store size={19} />
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-7 sm:px-6 sm:pt-10">
        <div className="mb-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Sparkles size={14} />
            <span>ط³ظˆظ‚ظƒ ط£ظ‚ط±ط¨ ظˆط£ط³ظ‡ظ„</span>
          </div>

          <h1 className="text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
            {listingType === "donation"
              ? "ط£ط¶ظپ طھط¨ط±ط¹ط§ظ‹ ط¬ط¯ظٹط¯ط§ظ‹"
              : selectedStoreId
                ? "ط¥ط¶ط§ظپط© ظ…ظ†طھط¬ ظ„ظ„ظ…طھط¬ط±"
                : "ط£ط¶ظپ ط¥ط¹ظ„ط§ظ†ظƒ ط§ظ„ط¬ط¯ظٹط¯"}
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-7 text-slate-500">
            {listingType === "donation"
              ? "ط´ط§ط±ظƒ ط؛ط±ط¶ط§ظ‹ ظ„ظ… طھط¹ط¯ ط¨ط­ط§ط¬ط© ط¥ظ„ظٹظ‡طŒ ظˆط³ط§ط¹ط¯ ط´ط®طµط§ظ‹ ط¢ط®ط± ط¹ظ„ظ‰ ط§ظ„ط§ط³طھظپط§ط¯ط© ظ…ظ†ظ‡."
              : selectedStoreId
                ? "ط£ط¶ظپ ظ…ظ†طھط¬ط§ظ‹ ط¬ط¯ظٹط¯ط§ظ‹ ط¥ظ„ظ‰ ظ…طھط¬ط±ظƒ ظ„ظٹطµظ„ ط¥ظ„ظ‰ ط§ظ„ظ…ظ‡طھظ…ظٹظ†."
                : "ط§ظ…ظ„ط£ طھظپط§طµظٹظ„ ط¥ط¹ظ„ط§ظ†ظƒ ظˆط£ط¶ظپ ط§ظ„طµظˆط±طŒ ظˆط¯ط¹ ط¥ط¹ظ„ط§ظ†ظƒ ظٹطµظ„ ط¥ظ„ظ‰ ط§ظ„ط£ط´ط®ط§طµ ط§ظ„ظ…ظ‡طھظ…ظٹظ†."}
          </p>

          <div className="mt-5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full w-full rounded-full bg-emerald-500" />
            </div>
            <span className="text-xs font-bold text-emerald-700">
              ظ†ظ…ظˆط°ط¬ ط¥ط¶ط§ظپط© ط¥ط¹ظ„ط§ظ†
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {listingType === "sale" && stores.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-emerald-50 bg-emerald-50/60 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Store size={20} />
                </div>
                <div>
                  <h2 className="font-black text-slate-800">
                    ظ…ظƒط§ظ† ظ†ط´ط± ط§ظ„ط¥ط¹ظ„ط§ظ†
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ط§ط®طھط± ط¥ظ† ظƒظ†طھ طھط±ظٹط¯ ط§ظ„ظ†ط´ط± ط¨ط§ط³ظ… ظ…طھط¬ط±ظƒ ط£ظˆ ط­ط³ط§ط¨ظƒ ط§ظ„ط´ط®طµظٹ
                  </p>
                </div>
              </div>

              <div className="p-5">
                <label className={labelClass}>
                  ط§ط®طھط± ط§ظ„ظ…طھط¬ط±
                </label>

                <select
                  value={selectedStoreId}
                  onChange={(event) => handleStoreChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">ط¥ط¹ظ„ط§ظ† ط´ط®طµظٹ - ط¨ط¯ظˆظ† ظ…طھط¬ط±</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>

                {selectedStoreId && (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    {quotaLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <RefreshCw size={16} className="animate-spin" />
                        ط¬ط§ط±ظچ ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط±طµظٹط¯ ط§ظ„ظ…طھط¬ط±...
                      </div>
                    ) : storeQuota?.active ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-emerald-800">
                            ط±طµظٹط¯ ط§ظ„ظ…طھط¬ط±
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                            ط§ط´طھط±ط§ظƒ ظپط¹ظ‘ط§ظ„
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-white/80 p-3">
                            <p className="text-xs font-bold text-slate-500">
                              ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ط§ظ„ط¹ط§ط¯ظٹط©
                            </p>
                            <p className="mt-1 text-base font-black text-slate-800">
                              {storeQuota.remaining}
                              <span className="mx-1 text-xs font-medium text-slate-400">
                                ظ…طھط¨ظ‚ظٹ ظ…ظ† {storeQuota.limit}
                              </span>
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/80 p-3">
                            <p className="text-xs font-bold text-amber-700">
                              ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ط§ظ„ظ…ظ…ظٹط²ط© â­گ
                            </p>
                            <p className="mt-1 text-base font-black text-slate-800">
                              {storeQuota.featuredRemaining}
                              <span className="mx-1 text-xs font-medium text-slate-400">
                                ظ…طھط¨ظ‚ظٹ ظ…ظ† {storeQuota.featuredLimit}
                              </span>
                            </p>
                          </div>
                        </div>

                        {storeQuota.endAt && (
                          <p className="mt-3 text-xs text-slate-500">
                            ظٹظ†طھظ‡ظٹ ط§ظ„ط§ط´طھط±ط§ظƒ ط¨طھط§ط±ظٹط®:{" "}
                            {new Date(storeQuota.endAt).toLocaleDateString(
                              "ar-SY"
                            )}
                          </p>
                        )}

                        <div className="mt-4 border-t border-emerald-100 pt-4">
                          <p className="mb-3 text-xs font-bold text-slate-600">
                            ط§ط®طھط± ظ†ظˆط¹ ط§ظ„ط¥ط¹ظ„ط§ظ†:
                          </p>

                          <div className="flex flex-wrap items-center gap-2">
                            {storeQuota.remaining > 0 && (
                              <button
                                type="button"
                                onClick={() => setRequestedFeatured(false)}
                                aria-pressed={!requestedFeatured}
                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                                  !requestedFeatured
                                    ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                                    !requestedFeatured
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {!requestedFeatured && (
                                    <CheckCircle2 size={11} strokeWidth={3} />
                                  )}
                                </span>
                                ط¥ط¹ظ„ط§ظ† ط¹ط§ط¯ظٹ
                              </button>
                            )}

                            {storeQuota.featuredRemaining > 0 && (
                              <button
                                type="button"
                                onClick={() => setRequestedFeatured(true)}
                                aria-pressed={requestedFeatured}
                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                                  requestedFeatured
                                    ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                                    requestedFeatured
                                      ? "border-amber-500 bg-amber-500 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {requestedFeatured && (
                                    <CheckCircle2 size={11} strokeWidth={3} />
                                  )}
                                </span>
                                <Star
                                  size={13}
                                  className={
                                    requestedFeatured
                                      ? "fill-amber-500 text-amber-500"
                                      : "text-amber-500"
                                  }
                                />
                                ط¥ط¹ظ„ط§ظ† ظ…ظ…ظٹط²
                              </button>
                            )}
                          </div>

                          {storeQuota.remaining <= 0 &&
                            storeQuota.featuredRemaining <= 0 && (
                              <p className="mt-2 text-xs font-bold text-red-600">
                                ط§ظ†طھظ‡ظ‰ ط±طµظٹط¯ ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ ط§ظ„ط¹ط§ط¯ظٹط© ظˆط§ظ„ظ…ظ…ظٹط²ط©.
                              </p>
                            )}

                          <p className="mt-2 text-[11px] text-slate-400">
                            ط³ظٹطھظ… ط§ط­طھط³ط§ط¨ ط§ظ„ط±طµظٹط¯ ط¨ط¹ط¯ ظ…ظˆط§ظپظ‚ط© ط§ظ„ط¥ط¯ط§ط±ط© ط¹ظ„ظ‰ ط§ظ„ط¥ط¹ظ„ط§ظ†.
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-bold text-red-600">
                        <AlertCircle size={17} />
                        ظ„ط§ ظٹظˆط¬ط¯ ط§ط´طھط±ط§ظƒ ظپط¹ظ‘ط§ظ„ ظ„ظ‡ط°ط§ ط§ظ„ظ…طھط¬ط±.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className={sectionClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Package size={20} />
              </div>
              <div>
                <h2 className="font-black text-slate-800">
                  طھظپط§طµظٹظ„ ط§ظ„ط¥ط¹ظ„ط§ظ†
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  ط§ظƒطھط¨ ظ…ط¹ظ„ظˆظ…ط§طھ ظˆط§ط¶ط­ط© طھط³ط§ط¹ط¯ ط§ظ„ظ…ط´طھط±ظٹ ط¹ظ„ظ‰ ظپظ‡ظ… ط¥ط¹ظ„ط§ظ†ظƒ
                </p>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                ط¹ظ†ظˆط§ظ† ط§ظ„ط¥ط¹ظ„ط§ظ†
                <span className="mr-1 text-red-500">*</span>
              </label>

              <input
                required
                minLength={5}
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ظ…ط«ظ„ط§ظ‹: ط³ظٹط§ط±ط© ظ„ظ„ط¨ظٹط¹ ط¨ط­ط§ظ„ط© ظ…ظ…طھط§ط²ط©"
                className={inputClass}
              />

              <p className="mt-2 text-left text-xs text-slate-400">
                {title.length} / 150
              </p>
            </div>

            <div className="mt-5">
              <label className={labelClass}>
                ظˆطµظپ ط§ظ„ط¥ط¹ظ„ط§ظ†
                <span className="mr-1 text-red-500">*</span>
              </label>

              <textarea
                required
                minLength={10}
                maxLength={10000}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  listingType === "donation"
                    ? "ط§ظƒطھط¨ طھظپط§طµظٹظ„ ط§ظ„ط؛ط±ط¶ ط§ظ„ط°ظٹ طھط±ظٹط¯ ط§ظ„طھط¨ط±ط¹ ط¨ظ‡..."
                    : "ط§ظƒطھط¨ طھظپط§طµظٹظ„ ط§ظ„ط¥ط¹ظ„ط§ظ†طŒ ظˆط§ظ„ظ…ظˆط§طµظپط§طھطŒ ظˆط§ظ„ط­ط§ظ„ط©طŒ ظˆط£ظٹ ظ…ط¹ظ„ظˆظ…ط§طھ ظ…ظ‡ظ…ط©..."
                }
                className={`${inputClass} min-h-36 resize-y leading-7`}
              />

              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>ظٹظپط¶ظ„ ظƒطھط§ط¨ط© ظˆطµظپ ظˆط§ط¶ط­ ظˆظ…ظپطµظ„.</span>
                <span>{description.length} / 10000</span>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="font-black text-slate-800">
                  ط§ظ„طھطµظ†ظٹظپ ظˆط§ظ„ظ…ظˆظ‚ط¹
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  ط­ط¯ط¯ ط§ظ„ظ‚ط³ظ… ظˆط§ظ„ظ…ط­ط§ظپط¸ط© ظˆط§ظ„ظ…ط¯ظٹظ†ط© ط§ظ„ظ…ظ†ط§ط³ط¨ط© ظ„ط¥ط¹ظ„ط§ظ†ظƒ
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <Tag size={15} className="text-slate-400" />
                    ط§ظ„طھطµظ†ظٹظپ
                  </span>
                  <span className="mr-1 text-red-500">*</span>
                </label>

                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">ط§ط®طھط± ط§ظ„طھطµظ†ظٹظپ</option>
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
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-slate-400" />
                    ط§ظ„ظ…ط­ط§ظپط¸ط©
                  </span>
                  <span className="mr-1 text-red-500">*</span>
                </label>

                <select
                  required
                  value={governorateId}
                  onChange={(e) => handleGovernorateChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">ط§ط®طھط± ط§ظ„ظ…ط­ط§ظپط¸ط©</option>
                  {governorates.map((governorate) => (
                    <option key={governorate.id} value={governorate.id}>
                      {governorate.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-slate-400" />
                    ط§ظ„ظ…ط¯ظٹظ†ط©
                  </span>
                  <span className="mr-1 text-red-500">*</span>
                </label>

                <select
                  required
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  disabled={!governorateId}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">
                    {!governorateId
                      ? "ط§ط®طھط± ط§ظ„ظ…ط­ط§ظپط¸ط© ط£ظˆظ„ط§ظ‹"
                      : filteredCities.length > 0
                        ? "ط§ط®طھط± ط§ظ„ظ…ط¯ظٹظ†ط©"
                        : "ظ„ط§ طھظˆط¬ط¯ ظ…ط¯ظ† ظ…طھط§ط­ط© ظپظٹ ظ‡ط°ظ‡ ط§ظ„ظ…ط­ط§ظپط¸ط©"}
                  </option>

                  {filteredCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <CircleDollarSign size={21} />
              </div>
              <div>
                <h2 className="font-black text-slate-800">
                  ط§ظ„ط³ط¹ط± ظˆط­ط§ظ„ط© ط§ظ„ظ…ظ†طھط¬
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  ط£ط¶ظپ ط§ظ„ط³ط¹ط± ظˆط­ط¯ط¯ ط­ط§ظ„ط© ط§ظ„ظ…ظ†طھط¬
                </p>
              </div>
            </div>

            {listingType === "donation" ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4">
                <div className="flex items-center gap-2 font-black text-rose-700">
                  <span className="text-xl">â‌¤ï¸ڈ</span>
                  ظ‡ط°ط§ ط§ظ„ط؛ط±ط¶ ظ„ظ„طھط¨ط±ط¹ ظ…ط¬ط§ظ†ط§ظ‹
                </div>
                <p className="mt-2 text-sm leading-6 text-rose-600">
                  ظ„ظ† ظٹظڈط·ظ„ط¨ ظ…ظ† ط§ظ„ظ…ط³طھظپظٹط¯ ط¯ظپط¹ ط£ظٹ ظ…ط¨ظ„ط؛ ظ…ظ‚ط§ط¨ظ„ ظ‡ط°ط§ ط§ظ„ط؛ط±ط¶.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    ط§ظ„ط³ط¹ط±
                    <span className="mr-1 text-xs font-normal text-slate-400">
                      (ط§ط®طھظٹط§ط±ظٹ)
                    </span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="ط£ط¯ط®ظ„ ط§ظ„ط³ط¹ط±"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    ط§ظ„ط¹ظ…ظ„ط©
                  </label>

                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputClass}
                  >
                    <option value="USD">ط¯ظˆظ„ط§ط± ط£ظ…ط±ظٹظƒظٹ</option>
                    <option value="SYP">ظ„ظٹط±ط© ط³ظˆط±ظٹط©</option>
                  </select>
                </div>
              </div>
            )}

            <div className="mt-5">
              <label className={labelClass}>
                ط­ط§ظ„ط© ط§ظ„ظ…ظ†طھط¬
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCondition("new")}
                  className={`rounded-xl border px-4 py-3.5 text-sm font-bold transition ${
                    condition === "new"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/10"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {condition === "new" && <CheckCircle2 size={17} />}
                    ط¬ط¯ظٹط¯
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCondition("used")}
                  className={`rounded-xl border px-4 py-3.5 text-sm font-bold transition ${
                    condition === "used"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/10"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {condition === "used" && <CheckCircle2 size={17} />}
                    ظ…ط³طھط¹ظ…ظ„
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <ImagePlus size={21} />
                </div>
                <div>
                  <h2 className="font-black text-slate-800">
                    طµظˆط± ط§ظ„ط¥ط¹ظ„ط§ظ†
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    ط§ظ„طµظˆط± ط§ظ„ظˆط§ط¶ط­ط© طھط²ظٹط¯ ط§ظ‡طھظ…ط§ظ… ط§ظ„ظ…ط´طھط±ظٹظ†
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                {images.length} / 3
              </span>
            </div>

            {images.length < 3 && (
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-5 py-9 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm transition group-hover:scale-105">
                  <UploadCloud size={27} />
                </div>

                <span className="mt-4 text-sm font-black text-slate-700 transition group-hover:text-emerald-700">
                  ط§ط¶ط؛ط· ظ‡ظ†ط§ ظ„ط§ط®طھظٹط§ط± ط§ظ„طµظˆط±
                </span>

                <span className="mt-2 text-xs text-slate-400">
                  JPG ط£ظˆ PNG ط£ظˆ WEBP
                </span>

                <span className="mt-1 text-xs text-slate-400">
                  ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ 5 ظ…ظٹط؛ط§ط¨ط§ظٹطھ ظ„ظ„طµظˆط±ط©
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImages}
                  className="hidden"
                />
              </label>
            )}

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {images.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-28 w-full object-cover transition duration-300 group-hover:scale-105 sm:h-36"
                    />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-2 pt-5">
                      <p className="truncate text-[10px] font-medium text-white">
                        {file.name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm transition hover:bg-red-600 hover:text-white"
                      aria-label="ط­ط°ظپ ط§ظ„طµظˆط±ط©"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs leading-6 text-slate-400">
              ظٹظ…ظƒظ†ظƒ ط¥ط¶ط§ظپط© 3 طµظˆط± ظƒط­ط¯ ط£ظ‚طµظ‰. طھط£ظƒط¯ ط£ظ† ط§ظ„طµظˆط± ظˆط§ط¶ط­ط© ظˆطھط¹ط¨ط± ط¹ظ† ط§ظ„ظ…ظ†طھط¬
              ط£ظˆ ط§ظ„ط؛ط±ط¶ ط§ظ„ظ…ط¹ط±ظˆط¶.
            </p>
          </section>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black">{success}</p>
                <p className="mt-1 text-xs text-emerald-600">
                  ط³ظٹطھظ… طھط­ظˆظٹظ„ظƒ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¨ط¹ط¯ ظ‚ظ„ظٹظ„...
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <button
              type="submit"
              disabled={
                saving ||
                quotaLoading ||
                !governorateId ||
                !cityId ||
                (!!selectedStoreId &&
                  (!storeQuota?.active || selectedQuotaRemaining <= 0))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/15 transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {saving ? (
                <>
                  <RefreshCw size={19} className="animate-spin" />
                  {waitingForNetwork ? "بانتظار عودة الاتصال..." : "جارٍ إرسال الإعلان..."}
                </>
              ) : (
                <>
                  <CheckCircle2 size={19} />
                  {listingType === "donation"
                    ? "ط¥ط±ط³ط§ظ„ ط§ظ„طھط¨ط±ط¹ ظ„ظ„ظ…ط±ط§ط¬ط¹ط©"
                    : "ط¥ط±ط³ط§ظ„ ط§ظ„ط¥ط¹ظ„ط§ظ† ظ„ظ„ظ…ط±ط§ط¬ط¹ط©"}
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs leading-6 text-slate-400">
              ط³ظٹطھظ… ظ…ط±ط§ط¬ط¹ط© ط§ظ„ط¥ط¹ظ„ط§ظ† ظ…ظ† ط§ظ„ط¥ط¯ط§ط±ط© ظ‚ط¨ظ„ ط¸ظ‡ظˆط±ظ‡ ظ„ظ„ط²ظˆط§ط±.
            </p>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          ط´ظƒط±ط§ظ‹ ظ„ط§ط³طھط®ط¯ط§ظ…ظƒ Sooq.sy â‌¤ï¸ڈ
        </p>
      </div>
    </main>
  );
}

