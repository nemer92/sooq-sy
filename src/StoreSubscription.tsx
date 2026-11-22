
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Wallet,
  Store as StoreIcon,
  AlertCircle,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

type Store = {
  id: string;
  name: string;
  status: "pending" | "active" | "rejected" | "suspended";
};

type Governorate = {
  id: number;
  name_ar: string;
};

type City = {
  id: number;
  governorate_id: number;
  name_ar: string;
};

const SUBSCRIPTION_POINTS = 200;

export default function StoreSubscription() {
  const navigate = useNavigate();
  const { id: routeStoreId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);

  const [pointsBalance, setPointsBalance] = useState(0);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(routeStoreId ?? "");

  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeWhatsapp, setStoreWhatsapp] = useState("");

  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    async function loadPageData() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth", {
            state: {
              from: routeStoreId
                ? `/store-subscription/${routeStoreId}`
                : "/store-subscription",
            },
          });
          return;
        }

        const [
          { data: settingsData, error: settingsError },
          { data: profileData, error: profileError },
          { data: pointsData, error: pointsError },
          { data: storesData, error: storesError },
          { data: governoratesData, error: governoratesError },
          { data: citiesData, error: citiesError },
        ] = await Promise.all([
          supabase
            .from("site_settings")
            .select("subscriptions_enabled")
            .eq("id", 1)
            .single(),

          supabase
            .from("private_profiles")
            .select("phone")
            .eq("user_id", user.id)
            .single(),

          supabase
            .from("user_points")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("stores")
            .select("id, name, status")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("governorates")
            .select("id,name_ar")
            .eq("is_active", true)
            .order("name_ar"),

          supabase
            .from("cities")
            .select("id,governorate_id,name_ar")
            .eq("is_active", true)
            .order("name_ar"),
        ]);

        if (settingsError) throw settingsError;
        if (profileError) throw profileError;
        if (pointsError) throw pointsError;
        if (storesError) throw storesError;
        if (governoratesError) throw governoratesError;
        if (citiesError) throw citiesError;

        if (!profileData?.phone || !/^09[0-9]{8}$/.test(profileData.phone)) {
          throw new Error(
            "رقم الهاتف المسجل في حسابك غير صالح. يرجى تحديث رقم هاتفك أولاً."
          );
        }

        const ownedStores = (storesData ?? []) as Store[];

        if (
          routeStoreId &&
          !ownedStores.some((store) => store.id === routeStoreId)
        ) {
          throw new Error("المتجر المطلوب غير موجود ضمن متاجرك.");
        }

        setSubscriptionsEnabled(Boolean(settingsData.subscriptions_enabled));
        setStorePhone(profileData.phone);
        setPointsBalance(Number(pointsData?.balance ?? 0));

        setStores(ownedStores);
        setSelectedStoreId(routeStoreId ?? "");

        setGovernorates(governoratesData ?? []);
        setCities(citiesData ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "تعذر تحميل بيانات اشتراك المتجر."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPageData();
  }, [navigate, routeStoreId]);

  const hasEnoughPoints = pointsBalance >= SUBSCRIPTION_POINTS;
  const remainingPoints = pointsBalance - SUBSCRIPTION_POINTS;

  const submitStoreSubscriptionRequest = async () => {
    if (submitting || requestSent || !subscriptionsEnabled) return;

    setRequestError("");

    // فحص الرصيد قبل أي عملية إنشاء أو إرسال
    if (pointsBalance < SUBSCRIPTION_POINTS) {
      setRequestError(
        `رصيدك غير كافٍ. تحتاج إلى ${SUBSCRIPTION_POINTS} نقطة، ورصيدك الحالي ${pointsBalance} نقطة.`
      );
      return;
    }

    // التحقق من معلومات المتجر الجديد
    if (!selectedStoreId) {
      if (!storeName.trim()) {
        setRequestError("يرجى إدخال اسم المتجر.");
        return;
      }

      if (!selectedGovernorate || !selectedCity) {
        setRequestError("يرجى اختيار المحافظة والمدينة.");
        return;
      }

      if (!/^09[0-9]{8}$/.test(storePhone.trim())) {
        setRequestError(
          "يرجى إدخال رقم هاتف متجر صحيح يبدأ بـ 09 ويتكون من 10 أرقام."
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      let storeId = selectedStoreId;

      if (!storeId) {
        // إنشاء متجر جديد وطلب اشتراك ضمن عملية واحدة في قاعدة البيانات
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth", {
            state: { from: "/store-subscription" },
          });
          return;
        }

        const governorateName = governorates.find(
          (item) => item.id === Number(selectedGovernorate)
        )?.name_ar;

        const cityName = cities.find(
          (item) => item.id === Number(selectedCity)
        )?.name_ar;

        const { data: result, error: createError } = await supabase.rpc(
          "create_store_and_subscription_request",
          {
            p_name: storeName.trim(),
            p_business_type: businessType.trim() || null,
            p_description: storeDescription.trim() || null,
            p_governorate: governorateName ?? "",
            p_city: cityName ?? "",
            p_phone: storePhone.trim(),
            p_whatsapp: storeWhatsapp.trim() || null,
          }
        );

        if (createError) throw createError;

        const created = Array.isArray(result) ? result[0] : result;

        if (!created?.store_id || !created?.request_id) {
          throw new Error(
            "لم يتم استلام تأكيد إنشاء المتجر وطلب الاشتراك."
          );
        }

        storeId = created.store_id;

        setStores((previous) => [
          {
            id: created.store_id,
            name: storeName.trim(),
            status: "pending",
          },
          ...previous,
        ]);

        setSelectedStoreId(storeId);

        // الطلب أُنشئ بالفعل ضمن الدالة الجديدة، فلا نستدعي الدالة القديمة مرة ثانية
        setRequestSent(true);
        return;
      } else {
        // التحقق من ملكية المتجر الموجود
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth", {
            state: {
              from: `/store-subscription/${storeId}`,
            },
          });
          return;
        }

        const { data: existingStore, error: storeError } = await supabase
          .from("stores")
          .select("id")
          .eq("id", storeId)
          .eq("owner_id", user.id)
          .maybeSingle();

        if (storeError) throw storeError;

        if (!existingStore) {
          throw new Error("لا يمكنك طلب اشتراك لمتجر لا تملكه.");
        }
      }

      // طلب اشتراك لمتجر موجود مسبقاً
      const { data, error: requestErrorFromServer } = await supabase.rpc(
        "create_store_subscription_request",
        {
          p_store_id: storeId,
        }
      );

      if (requestErrorFromServer) throw requestErrorFromServer;

      if (!data) {
        throw new Error("لم يتم استلام رقم طلب الاشتراك.");
      }

      setRequestSent(true);
    } catch (err: unknown) {
      const errorMessage =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "تعذر إرسال طلب اشتراك المتجر.";

      setRequestError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 p-6"
      >
        <div className="rounded-2xl border border-slate-100 bg-white px-8 py-7 text-center shadow-sm">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="text-sm font-medium text-slate-500">
            جارٍ تحميل بيانات اشتراك المتجر...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 p-5"
      >
        <div className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={28} />
          </div>

          <p className="mt-4 font-bold leading-7 text-slate-700">{error}</p>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-700"
          >
            العودة للرئيسية
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f9f8] pb-10">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="رجوع"
          >
            <ArrowRight size={21} />
          </button>

          <div>
            <h1 className="text-lg font-black text-slate-800">
              اشتراك المتاجر
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              إدارة متجرك وتنمية أعمالك على سوق سوريا
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {!subscriptionsEnabled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-amber-600" size={22} />
              <h2 className="font-black text-amber-900">
                الاشتراكات غير متاحة حالياً
              </h2>
            </div>
            <p className="mt-2 text-sm leading-7 text-amber-800">
              خدمات الاشتراك متوقفة مؤقتاً. يمكنك تصفح الموقع واستخدام
              الخدمات المتاحة، وسيتم الإعلان عن تفعيل الاشتراكات عند توفرها.
            </p>
          </div>
        )}

        {/* بطاقة التعريف */}
        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-bl from-emerald-900 via-emerald-800 to-emerald-600 p-6 text-white">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
            <div className="absolute -bottom-16 right-20 h-40 w-40 rounded-full bg-white/5" />

            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                <StoreIcon size={29} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Sparkles size={17} className="text-emerald-200" />
                <span className="text-xs font-bold text-emerald-100">
                  فرصتك لتوسيع أعمالك
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-black">
                افتح متجرك على Sooq.Sy
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50">
                أنشئ متجرك الخاص، واعرض منتجاتك ضمن صفحة متجرك وأقسام السوق،
                واستفد من مساحة أكبر لعرض إعلاناتك.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            {/* مميزات الاشتراك */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-center">
                <span className="block text-3xl font-black text-emerald-700">
                  100
                </span>
                <span className="mt-1 block text-sm font-semibold text-slate-600">
                  إعلان عادي
                </span>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-center">
                <span className="block text-3xl font-black text-amber-700">
                  20
                </span>
                <span className="mt-1 block text-sm font-semibold text-slate-600">
                  إعلان مميز
                </span>
              </div>
            </div>

            {/* تفاصيل الاشتراك */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">
                    الاشتراك الشهري
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    مدة الاشتراك شهر واحد
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm">
                  <Coins size={21} className="text-amber-500" />
                  <span className="text-2xl font-black text-emerald-700">
                    200
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    نقطة
                  </span>
                </div>
              </div>
            </div>

            {/* رصيد المستخدم */}
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50 to-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Wallet size={23} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      رصيد نقاطك الحالي
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      النقاط المتوفرة في محفظتك
                    </p>
                  </div>
                </div>

                <div className="text-left">
                  <strong className="block text-2xl font-black text-sky-700">
                    {pointsBalance.toLocaleString("en-US")}
                  </strong>
                  <span className="text-xs font-semibold text-slate-500">
                    نقطة
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-sky-100 pt-3">
                {hasEnoughPoints ? (
                  <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    رصيدك كافٍ للاشتراك، وسيتبقى لديك{" "}
                    {remainingPoints.toLocaleString("en-US")} نقطة بعد
                    الموافقة.
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-xs font-semibold leading-6 text-amber-700">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    تحتاج إلى{" "}
                    {(SUBSCRIPTION_POINTS - pointsBalance).toLocaleString(
                      "en-US"
                    )}{" "}
                    نقطة إضافية لإكمال تكلفة الاشتراك. لا يمكنك إرسال طلب
                    إنشاء المتجر أو الاشتراك قبل توفر الرصيد المطلوب.
                  </p>
                )}
              </div>
            </div>

            {/* اختيار المتجر */}
            {stores.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  اختر المتجر المراد اشتراكه
                </label>

                <select
                  value={selectedStoreId}
                  onChange={(event) => {
                    setSelectedStoreId(event.target.value);
                    setRequestSent(false);
                    setRequestError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">إنشاء متجر جديد</option>

                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                      {store.status === "active"
                        ? " - نشط"
                        : store.status === "pending"
                          ? " - بانتظار المراجعة"
                          : store.status === "rejected"
                            ? " - مرفوض"
                            : " - موقوف"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* نموذج المتجر الجديد */}
            {!selectedStoreId && (
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <h3 className="font-black text-slate-800">
                    معلومات المتجر الجديد
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    أدخل المعلومات الأساسية لإنشاء متجرك
                  </p>
                </div>

                <input
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="اسم المتجر *"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  maxLength={100}
                />

                <input
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  placeholder="اختصاص المتجر، مثال: ألبسة أو إلكترونيات"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  maxLength={100}
                />

                <textarea
                  value={storeDescription}
                  onChange={(event) =>
                    setStoreDescription(event.target.value)
                  }
                  placeholder="وصف مختصر عن المتجر (اختياري)"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  rows={3}
                  maxLength={500}
                />

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    المحافظة *
                  </label>

                  <select
                    value={selectedGovernorate}
                    onChange={(event) => {
                      setSelectedGovernorate(event.target.value);
                      setSelectedCity("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">اختر المحافظة</option>

                    {governorates.map((governorate) => (
                      <option
                        key={governorate.id}
                        value={String(governorate.id)}
                      >
                        {governorate.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    المدينة *
                  </label>

                  <select
                    value={selectedCity}
                    onChange={(event) => setSelectedCity(event.target.value)}
                    disabled={!selectedGovernorate}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">اختر المدينة</option>

                    {cities
                      .filter(
                        (city) =>
                          city.governorate_id === Number(selectedGovernorate)
                      )
                      .map((city) => (
                        <option key={city.id} value={String(city.id)}>
                          {city.name_ar}
                        </option>
                      ))}
                  </select>
                </div>

                <input
                  value={storePhone}
                  onChange={(event) => setStorePhone(event.target.value)}
                  placeholder="رقم هاتف المتجر *"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left text-sm outline-none transition placeholder:text-right placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <input
                  value={storeWhatsapp}
                  onChange={(event) => setStoreWhatsapp(event.target.value)}
                  placeholder="رقم واتساب (اختياري)"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left text-sm outline-none transition placeholder:text-right placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            )}

            {/* آلية التفعيل */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-700" />
                <h3 className="font-bold text-emerald-900">
                  كيف يتم تفعيل الاشتراك؟
                </h3>
              </div>

              <div className="mt-3 space-y-2 text-sm leading-7 text-emerald-900">
                <p>1. أرسل طلب الاشتراك من خلال هذه الصفحة.</p>
                <p>2. تقوم الإدارة بمراجعة طلبك.</p>
                <p>
                  3. عند الموافقة، يتم خصم 200 نقطة من رصيدك وتفعيل الاشتراك.
                </p>
                <p>
                  4. يصبح بإمكانك الاستفادة من مميزات المتجر طوال مدة الاشتراك.
                </p>
              </div>

              <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs font-semibold leading-6 text-emerald-800">
                ملاحظة: لن يتم خصم أي نقاط عند إرسال الطلب. الخصم يتم حصراً
                بعد موافقة الإدارة.
              </p>
            </div>
          </div>
        </section>

        {/* تأكيد الطلب */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-800">
                ملخص الاشتراك
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                راجع تفاصيل طلبك قبل الإرسال
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Coins size={23} />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">مدة الاشتراك</span>
              <strong className="text-slate-800">شهر واحد</strong>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">عدد الإعلانات العادية</span>
              <strong className="text-slate-800">100 إعلان</strong>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">عدد الإعلانات المميزة</span>
              <strong className="text-slate-800">20 إعلان</strong>
            </div>

            <div className="my-2 border-t border-dashed border-slate-200" />

            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">
                تكلفة الاشتراك
              </span>

              <div className="flex items-center gap-2">
                <strong className="text-2xl font-black text-emerald-700">
                  {SUBSCRIPTION_POINTS}
                </strong>
                <span className="text-sm font-bold text-slate-500">
                  نقطة
                </span>
              </div>
            </div>
          </div>

          {requestSent ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={30} />
              </div>

              <h3 className="mt-3 font-black text-emerald-800">
                تم إرسال طلبك بنجاح!
              </h3>

              <p className="mt-2 text-sm leading-7 text-emerald-700">
                طلب اشتراك متجرك أصبح بانتظار مراجعة الإدارة. لن يتم خصم
                النقاط إلا بعد الموافقة على الطلب.
              </p>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
              >
                العودة للرئيسية
              </button>
            </div>
          ) : (
            <>
              {requestError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{requestError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={submitStoreSubscriptionRequest}
                disabled={
                  !subscriptionsEnabled ||
                  submitting ||
                  pointsBalance < SUBSCRIPTION_POINTS
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-700 to-emerald-600 px-5 py-4 font-black text-white shadow-md shadow-emerald-100 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {submitting ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    جارٍ إرسال الطلب...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    إرسال طلب اشتراك المتجر
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-xs leading-6 text-slate-400">
                إرسال الطلب لا يخصم النقاط من رصيدك. يتم الخصم بعد موافقة
                الإدارة فقط.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
