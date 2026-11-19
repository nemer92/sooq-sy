
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type Package = {
  number: number;
  name: string;
  price: number;
  duration_months: number;
  ordinary_ads_limit: number;
  featured_ads_limit: number;
};

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

export default function Subscriptions() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);

  const [phone, setPhone] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [exchangeRate, setExchangeRate] = useState(0);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [requestSent, setRequestSent] = useState(false);
const [requestError, setRequestError] = useState("");
const [stores, setStores] = useState<Store[]>([]);
const [selectedStoreId, setSelectedStoreId] = useState("");
const [storeName, setStoreName] = useState("");
const [businessType, setBusinessType] = useState("");
const [storeDescription, setStoreDescription] = useState("");
const [storePhone, setStorePhone] = useState("");
const [storeWhatsapp, setStoreWhatsapp] = useState("");
const [storeSubmitting, setStoreSubmitting] = useState(false);
const [storeRequestSent, setStoreRequestSent] = useState(false);
const [storeRequestError, setStoreRequestError] = useState("");
const [governorates, setGovernorates] = useState<Governorate[]>([]);
const [cities, setCities] = useState<City[]>([]);
const [selectedGovernorate, setSelectedGovernorate] = useState("");
const [selectedCity, setSelectedCity] = useState("");

useEffect(() => {
  async function loadPaymentData() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        navigate("/auth", {
          state: { from: "/subscriptions" },
        });
        return;
      }

      const { data: settingsData, error: settingsError } =
        await supabase
          .from("site_settings")
          .select("sham_cash_qr_url, usd_syp_rate, subscriptions_enabled")
          .eq("id", 1)
          .single();

      if (settingsError) throw settingsError;

      const enabled = Boolean(settingsData.subscriptions_enabled);

      setSubscriptionsEnabled(enabled);



      const [
        { data: profileData, error: profileError },
        { data: plansData, error: plansError },
      ] = await Promise.all([
        supabase
          .from("private_profiles")
          .select("phone")
          .eq("user_id", user.id)
          .single(),

        supabase
          .from("subscription_plans")
          .select("id, name, price_usd, duration_months, ordinary_ads_limit, featured_ads_limit")

          .order("id"),
      ]);

      if (profileError) throw profileError;
      if (plansError) throw plansError;

      if (!profileData.phone || !/^09[0-9]{8}$/.test(profileData.phone)) {
        throw new Error("رقم الهاتف المسجل في حسابك غير صالح.");
      }

      const { data: storesData, error: storesError } = await supabase
  .from("stores")
  .select("id, name, status")
  .eq("owner_id", user.id)
  .order("created_at", { ascending: false });

if (storesError) throw storesError;

setStores((storesData ?? []) as Store[]);
const [
  { data: governoratesData, error: governoratesError },
  { data: citiesData, error: citiesError },
] = await Promise.all([
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

if (governoratesError) throw governoratesError;
if (citiesError) throw citiesError;

setGovernorates(governoratesData ?? []);
setCities(citiesData ?? []);
setStorePhone(profileData.phone);

      setPhone(profileData.phone);
      setQrUrl(settingsData.sham_cash_qr_url ?? "");
      setExchangeRate(Number(settingsData.usd_syp_rate ?? 0));

      setPackages(
        (plansData ?? []).map((plan) => ({
          number: plan.id,
          name: plan.name,
          price: Number(plan.price_usd),
          duration_months: plan.duration_months,
          ordinary_ads_limit: plan.ordinary_ads_limit,
featured_ads_limit: plan.featured_ads_limit,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحميل بيانات الاشتراك."
      );
    } finally {
      setLoading(false);
    }
  }

  loadPaymentData();
}, [navigate]);

const submitSubscriptionRequest = async () => {
  if (!selectedPackage || submitting || requestSent) return;

  setSubmitting(true);
  setRequestError("");

  try {
    const { data, error } = await supabase.rpc(
      "create_subscription_payment_request",
      {
        p_package_number: selectedPackage.number,
      }
    );

    if (error) throw error;

    if (!data) {
      throw new Error("لم يتم استلام رقم طلب الاشتراك.");
    }

    setRequestSent(true);
  } catch (err) {
    setRequestError(
      err instanceof Error
        ? err.message
        : "تعذر إرسال طلب الاشتراك."
    );
  } finally {
    setSubmitting(false);
  }
};

const submitStoreSubscriptionRequest = async () => {
  if (storeSubmitting || storeRequestSent || !subscriptionsEnabled) return;

  setStoreRequestError("");

  if (!selectedStoreId && !storeName.trim()) {
    setStoreRequestError("يرجى إدخال اسم المتجر.");
    return;
  }

  setStoreSubmitting(true);

  try {
    let storeId = selectedStoreId;

    // إنشاء متجر جديد عند عدم اختيار متجر موجود
    if (!storeId) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        navigate("/auth", {
          state: { from: "/subscriptions" },
        });
        return;
      }

      const { data: newStore, error: createError } = await supabase
        .from("stores")
        .insert({
          owner_id: user.id,
          name: storeName.trim(),
          business_type: businessType.trim() || null,
          description: storeDescription.trim() || null,
          governorate:
            governorates.find(
              (g) => g.id === Number(selectedGovernorate)
            )?.name_ar ?? "",
          city:
            cities.find(
              (c) => c.id === Number(selectedCity)
            )?.name_ar ?? "",
          phone: storePhone.trim(),
          whatsapp: storeWhatsapp.trim() || null,
          status: "pending",
        })
        .select("id, name, status")
        .single();
      if (createError) throw createError;

      storeId = newStore.id;

      setStores((previous) => [
        newStore as Store,
        ...previous,
      ]);

      setSelectedStoreId(storeId);
    }

    // إرسال طلب الاشتراك إلى الإدارة
    const { data, error } = await supabase.rpc(
      "create_store_subscription_request",
      {
        p_store_id: storeId,
      }
    );

    if (error) throw error;

    if (!data) {
      throw new Error("لم يتم استلام رقم طلب الاشتراك.");
    }

    setStoreRequestSent(true);
  } catch (err) {
    setStoreRequestError(
      err instanceof Error
        ? err.message
        : "تعذر إرسال طلب اشتراك المتجر."
    );
  } finally {
    setStoreSubmitting(false);
  }
};

  const amountSyp = selectedPackage
    ? Math.floor(selectedPackage.price * exchangeRate)
    : 0;

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8">
        <p className="text-center text-slate-500">
          جارٍ تحميل بيانات الاشتراك...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-5">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"
          >
            العودة للرئيسية
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-emerald-700"
          >
            <ArrowRight size={22} />
          </button>
          <h1 className="text-xl font-black text-slate-800">
            باقات الاشتراك
          </h1>
        </div>
      </header>

<div className="mx-auto max-w-3xl space-y-5 px-4 py-7">
{!subscriptionsEnabled && (
  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5 text-center">
    <h2 className="text-lg font-black text-emerald-800">
      أهلاً وسهلاً بكم في Sooq.Sy 🌿
    </h2>
    <p className="mt-3 text-sm leading-8 text-slate-700">
      جميع خدمات الموقع متاحة حالياً بشكل مجاني، ويمكنكم نشر إعلاناتكم والاستفادة من خدماتنا دون الحاجة إلى الاشتراك.
      نعمل على تجهيز باقات الاشتراك بمزايا إضافية، وسيتم تفعيلها قريباً بإذن الله.
      شكراً لثقتكم، ونتمنى لكم تجربة ممتعة ومفيدة معنا.
    </p>
  </div>
)}

<>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold text-slate-800">
          اختر الباقة المناسبة
        </h2>

        {packages.length === 0 ? (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-800">
            لا توجد باقات اشتراك متاحة حالياً.
          </p>
        ) : (
<div className="mt-5 grid gap-4 sm:grid-cols-3">
  {packages.map((item) => {
const packageName = item.name.trim();

const isGold = packageName.includes("احترافية") ||
               packageName.includes("احتراف");

const isSilver = packageName.includes("متقدمة") ||
                 packageName.includes("متقدم");

const isSelected = selectedPackage?.number === item.number;

const displayedName = isGold
  ? "الباقة الذهبية"
  : isSilver
  ? "الباقة الفضية"
  : "الباقة العادية";

const theme = isGold
  ? {
      border: "border-amber-400",
      selected: "ring-2 ring-amber-400 shadow-xl",
      background: "bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-200",
      accent: "bg-gradient-to-l from-yellow-500 via-amber-300 to-yellow-600",
      badge: "bg-amber-200 text-amber-950",
      price: "text-amber-800",
      title: "text-amber-950",
      icon: "👑",
      label: "الأعلى تميزاً",
      details: "bg-yellow-50/90 border border-amber-200",
      button: "bg-amber-500 text-white",
    }
  : isSilver
  ? {
      border: "border-slate-400",
      selected: "ring-2 ring-slate-400 shadow-xl",
      background: "bg-gradient-to-br from-slate-100 via-white to-slate-300",
      accent: "bg-gradient-to-l from-slate-400 via-slate-200 to-slate-500",
      badge: "bg-slate-300 text-slate-800",
      price: "text-slate-700",
      title: "text-slate-800",
      icon: "🥈",
      label: "اختيار مميز",
      details: "bg-white/90 border border-slate-300",
      button: "bg-slate-600 text-white",
    }
  : {
      border: "border-gray-300",
      selected: "ring-2 ring-gray-400 shadow-lg",
      background: "bg-gradient-to-br from-gray-50 via-white to-gray-100",
      accent: "bg-gray-400",
      badge: "bg-gray-200 text-gray-700",
      price: "text-gray-700",
      title: "text-gray-800",
      icon: "✓",
      label: "البداية المناسبة",
      details: "bg-white/90 border border-gray-200",
      button: "bg-gray-600 text-white",
    };

    return (
      <button
        key={item.number}
        type="button"
        onClick={() => setSelectedPackage(item)}
        className={`relative overflow-hidden rounded-2xl border-2 ${theme.border} ${theme.background} p-4 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
          isSelected ? theme.selected : "shadow-sm"
        }`}
      >
        <div className={`absolute inset-x-0 top-0 h-2 ${theme.accent}`} />

        <div className="pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xl" aria-hidden="true">
              {theme.icon}
            </span>

            <span className={`rounded-full px-3 py-1 text-xs font-black ${theme.badge}`}>
              {theme.label}
            </span>
          </div>

          <h3 className={`mt-3 text-xl font-black ${theme.title}`}>
            {displayedName}
          </h3>

          <p className="mt-2 text-sm font-medium text-slate-600">
            مدة الاشتراك: {item.duration_months} شهر
          </p>
        </div>

        <div className={`my-5 space-y-3 rounded-xl p-3 text-sm ${theme.details}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-600">الإعلانات العادية</span>
            <strong className={theme.title}>
              {item.ordinary_ads_limit} إعلان
            </strong>
          </div>

          <div className="h-px bg-slate-300/50" />

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-600">الإعلانات المميزة</span>
            <strong className={theme.title}>
              {item.featured_ads_limit} إعلان
            </strong>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <span className={`text-3xl font-black ${theme.price}`}>
            ${item.price}
          </span>

          <span className="text-xs font-medium text-slate-500">
            سعر الاشتراك
          </span>
        </div>

        <div
          className={`mt-5 rounded-xl px-3 py-3 text-center text-sm font-black transition-all ${
            isSelected
              ? theme.button
              : "border border-slate-300 bg-white/80 text-slate-700"
          }`}
        >
          {isSelected ? (
            <>
              <CheckCircle2 size={17} className="ml-1 inline" />
              تم اختيار هذه الباقة
            </>
          ) : (
            "اختيار هذه الباقة"
          )}
        </div>
      </button>
    );
  })}
</div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 via-white to-orange-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <CheckCircle2 size={25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-800">
                تمييز إعلان واحد لمدة 10 أيام
              </h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                خدمة مستقلة
              </span>
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              يمكنك تمييز إعلان واحد من إعلاناتك ليظهر بشكل بارز لمدة 10 أيام، دون الحاجة إلى الاشتراك بإحدى الباقات.
              لطلب هذه الخدمة، انتقل إلى قسم «إعلاناتي» واضغط على زر التمييز الموجود بجانب الإعلان المطلوب.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
  <div className="bg-gradient-to-l from-emerald-800 to-emerald-600 p-5 text-white">
    <span className="text-3xl">🏪</span>

    <h2 className="mt-2 text-xl font-black">
      اشتراك المتاجر
    </h2>

    <p className="mt-2 text-sm leading-7 text-emerald-50">
      افتح متجرك الخاص على Sooq.Sy واعرض منتجاتك في صفحة متجرك
      وفي الأقسام الرئيسية للسوق أيضاً.
    </p>
  </div>

  <div className="space-y-5 p-5">
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-emerald-50 p-4 text-center">
        <strong className="block text-2xl font-black text-emerald-700">
          100
        </strong>
        <span className="text-sm text-slate-600">إعلان عادي</span>
      </div>

      <div className="rounded-xl bg-amber-50 p-4 text-center">
        <strong className="block text-2xl font-black text-amber-700">
          20
        </strong>
        <span className="text-sm text-slate-600">إعلان مميز</span>
      </div>
    </div>

    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
      <div>
        <p className="font-bold text-slate-800">مدة الاشتراك</p>
        <p className="mt-1 text-sm text-slate-500">شهر واحد</p>
      </div>

      <strong className="text-3xl font-black text-emerald-700">
        $20
      </strong>
    </div>

    {stores.length > 0 && (
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          اختر متجراً موجوداً أو أنشئ متجراً جديداً
        </label>

        <select
          value={selectedStoreId}
          onChange={(e) => {
            setSelectedStoreId(e.target.value);
            setStoreRequestSent(false);
            setStoreRequestError("");
          }}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
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

    {!selectedStoreId && (
      <div className="space-y-3">
        <h3 className="font-bold text-slate-800">
          معلومات المتجر الجديد
        </h3>

        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="اسم المتجر *"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm"
          maxLength={100}
        />

        <input
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="اختصاص المتجر، مثال: ألبسة أو إلكترونيات"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm"
          maxLength={100}
        />

        <textarea
          value={storeDescription}
          onChange={(e) => setStoreDescription(e.target.value)}
          placeholder="وصف مختصر عن المتجر"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm"
          rows={3}
          maxLength={500}
        />

<div>
  <label className="mb-2 block text-sm font-bold text-slate-700">
    المحافظة *
  </label>
  <select
    value={selectedGovernorate}
    onChange={(e) => {
      setSelectedGovernorate(e.target.value);
      setSelectedCity("");
    }}
    required
    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
  >
    <option value="">اختر المحافظة</option>
    {governorates.map((governorate) => (
      <option key={governorate.id} value={String(governorate.id)}>
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
    onChange={(e) => setSelectedCity(e.target.value)}
    required
    disabled={!selectedGovernorate}
    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
  >
    <option value="">اختر المدينة</option>
    {cities
      .filter(
        (city) => city.governorate_id === Number(selectedGovernorate)
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
          onChange={(e) => setStorePhone(e.target.value)}
          placeholder="رقم هاتف المتجر"
          dir="ltr"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        />

        <input
          value={storeWhatsapp}
          onChange={(e) => setStoreWhatsapp(e.target.value)}
          placeholder="رقم واتساب (اختياري)"
          dir="ltr"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        />
      </div>
    )}

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">
        آلية تفعيل المتجر
      </p>

      <p className="mt-2 text-sm leading-7 text-amber-900">
        بعد إرسال الطلب وتحويل قيمة الاشتراك، ستقوم الإدارة بمراجعة
        الطلب وتفعيله بعد التأكد من الحوالة. يمكنك امتلاك أكثر من متجر
        ضمن حسابك.
      </p>
    </div>

    {storeRequestSent ? (
      <div className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
        تم إرسال طلب اشتراك المتجر بنجاح، وهو الآن بانتظار مراجعة الإدارة.
      </div>
    ) : (
      <>
        {storeRequestError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {storeRequestError}
          </p>
        )}

        <button
          type="button"
          onClick={submitStoreSubscriptionRequest}
          disabled={!subscriptionsEnabled || storeSubmitting}
          className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {storeSubmitting
            ? "جارٍ إرسال الطلب..."
            : "إرسال طلب اشتراك المتجر"}
        </button>
      </>
    )}
  </div>
</section>

{selectedPackage && (
  <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
    <div className="border-b border-slate-100 pb-4">
      <p className="text-sm font-medium text-emerald-700">
        تفاصيل الباقة المختارة
      </p>

      <h2 className="mt-2 text-xl font-black text-slate-800">
        {selectedPackage.name}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-3xl font-black text-emerald-700">
          ${selectedPackage.price}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          {selectedPackage.duration_months} شهر
        </span>
      </div>
    </div>

    <div className="mt-5">
      <h3 className="font-bold text-slate-800">
        ماذا ستحصل عند الاشتراك؟
      </h3>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-bold text-slate-800">
              نشر الإعلانات
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              إمكانية نشر حتى {selectedPackage.ordinary_ads_limit} إعلان بيع خلال مدة الاشتراك، لتعرض منتجاتك وخدماتك على زوار الموقع.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-bold text-slate-800">
              تمييز الإعلانات
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              {selectedPackage.featured_ads_limit > 0
                ? `إمكانية تمييز حتى ${selectedPackage.featured_ads_limit} إعلاناً من رصيد الباقة، لتظهر إعلاناتك بشكل مميز داخل الموقع.`
                : "هذه الباقة لا تتضمن رصيداً لتمييز الإعلانات. يمكنك اختيار باقة أعلى للاستفادة من هذه الميزة."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-bold text-slate-800">
              إدارة إعلاناتك
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              يمكنك متابعة إعلاناتك وإدارتها من حسابك، والاستفادة من رصيد الباقة طوال فترة الاشتراك.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-bold text-amber-900">
        حملات التمييز والإشعارات للمحافظات
      </h3>
      <p className="mt-2 text-sm leading-7 text-amber-900">
        تمييز الإعلانات الممنوح ضمن الاشتراك يختلف عن الحملات الترويجية المدفوعة.
        يمكنك طلب حملة مستقلة، واختيار المحافظات التي تريد استهدافها،
        لتصل إشعارات الحملة إلى المستخدمين المستهدفين، وتستمر الحملة لمدة 10 أيام.
        هذه الخدمة ليست ضمن رصيد تمييز الاشتراك، وتُطلب بشكل منفصل.
      </p>
    </div>

    <div className="mt-5 rounded-xl bg-slate-50 p-4">
      <h3 className="font-bold text-slate-800">
        المبلغ المطلوب للتحويل
      </h3>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-slate-600">قيمة الاشتراك</span>
        <strong className="text-lg">${selectedPackage.price}</strong>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-slate-600">المبلغ بالليرة السورية</span>
        <strong className="text-lg text-emerald-700">
          {amountSyp.toLocaleString("en-US")} ل.س
        </strong>
      </div>
    </div>

    <div className="mt-4 text-xs leading-7 text-slate-500">
      <p>• الإعلانات تُخصم من الرصيد بعد موافقة الإدارة.</p>
      <p>• الإعلانات المميزة تُحتسب من رصيد الإعلانات الإجمالي، وليست رصيداً إضافياً فوقه.</p>
      <p>• التبرعات لا تُحتسب من رصيد إعلانات البيع.</p>
      <p>• حذف إعلان تمت الموافقة عليه لا يعيد الرصيد المستهلك.</p>
    </div>
  </section>
)}


      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold">الدفع عبر شام كاش</h2>

        {qrUrl && (
          <img
            src={qrUrl}
            alt="رمز الدفع عبر شام كاش"
            className="mx-auto mt-4 max-h-64"
          />
        )}

        <p className="mt-4" dir="ltr">
          {phone}
        </p>

        <div className="mt-4 rounded-xl border-2 border-red-500 bg-yellow-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <CheckCircle2 size={21} />
            </span>

            <h3 className="text-base font-black text-red-700">
              تنبيه مهم جداً عند تحويل مبلغ الاشتراك
            </h3>
          </div>

          <p className="mt-3 text-sm font-medium leading-7 text-slate-800">
            عند إجراء التحويل عبر شام كاش، يجب كتابة رقم الهاتف المسجل في حسابك على Sooq.Sy ضمن خانة الملاحظات أو وصف الحوالة، حتى تتمكن الإدارة من مطابقة الحوالة مع طلب الاشتراك وتأكيد الدفع.
          </p>

          <p className="mt-3 rounded-lg border border-red-200 bg-red-100 p-3 text-center text-sm font-black text-red-700">
            لا تنسَ كتابة رقم هاتفك في ملاحظات الحوالة.
          </p>
        </div>

        {requestSent ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-center text-emerald-700">
            تم إرسال طلبك بنجاح، وهو الآن بانتظار مراجعة الإدارة.
          </p>
        ) : (
          <>
            {requestError && (
              <p className="mt-3 text-sm text-red-600">
                {requestError}
              </p>
            )}

            <button
              type="button"
              onClick={submitSubscriptionRequest}
              disabled={!selectedPackage || submitting || !subscriptionsEnabled}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "جارٍ إرسال الطلب..."
                : "أتممت التحويل، أرسل طلب المراجعة"}
            </button>
          </>
        )}
      </section>
    </>

</div>
    </main>
  );
}
