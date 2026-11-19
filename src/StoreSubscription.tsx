
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, CheckCircle2 } from "lucide-react";

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

export default function StoreSubscription() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);

  const [phone, setPhone] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [exchangeRate, setExchangeRate] = useState(0);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

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
            state: { from: "/store-subscription" },
          });
          return;
        }

        const [
          { data: settingsData, error: settingsError },
          { data: profileData, error: profileError },
          { data: storesData, error: storesError },
          { data: governoratesData, error: governoratesError },
          { data: citiesData, error: citiesError },
        ] = await Promise.all([
          supabase
            .from("site_settings")
            .select("sham_cash_qr_url, usd_syp_rate, subscriptions_enabled")
            .eq("id", 1)
            .single(),

          supabase
            .from("private_profiles")
            .select("phone")
            .eq("user_id", user.id)
            .single(),

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
        if (storesError) throw storesError;
        if (governoratesError) throw governoratesError;
        if (citiesError) throw citiesError;

        if (!profileData.phone || !/^09[0-9]{8}$/.test(profileData.phone)) {
          throw new Error("رقم الهاتف المسجل في حسابك غير صالح.");
        }

        setSubscriptionsEnabled(Boolean(settingsData.subscriptions_enabled));
        setPhone(profileData.phone);
        setStorePhone(profileData.phone);
        setQrUrl(settingsData.sham_cash_qr_url ?? "");
        setExchangeRate(Number(settingsData.usd_syp_rate ?? 0));

        setStores((storesData ?? []) as Store[]);
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
  }, [navigate]);

  const amountSyp = Math.floor(20 * exchangeRate);

  const submitStoreSubscriptionRequest = async () => {
    if (submitting || requestSent || !subscriptionsEnabled) return;

    setRequestError("");

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
        setRequestError("يرجى إدخال رقم هاتف متجر صحيح يبدأ بـ 09 ويتكون من 10 أرقام.");
        return;
      }
    }

    setSubmitting(true);

    try {
      let storeId = selectedStoreId;

      if (!storeId) {
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

        const { data: newStore, error: createError } = await supabase
          .from("stores")
          .insert({
            owner_id: user.id,
            name: storeName.trim(),
            business_type: businessType.trim() || null,
            description: storeDescription.trim() || null,
            governorate: governorateName ?? "",
            city: cityName ?? "",
            phone: storePhone.trim(),
            whatsapp: storeWhatsapp.trim() || null,
            status: "pending",
          })
          .select("id, name, status")
          .single();

        if (createError) throw createError;

        storeId = newStore.id;
        setStores((previous) => [newStore as Store, ...previous]);
        setSelectedStoreId(storeId);
      }

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
    } catch (err) {
      setRequestError(
        err instanceof Error
          ? err.message
          : "تعذر إرسال طلب اشتراك المتجر."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8">
        <p className="text-center text-slate-500">
          جارٍ تحميل بيانات اشتراك المتجر...
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
            aria-label="رجوع"
          >
            <ArrowRight size={22} />
          </button>
          <h1 className="text-xl font-black text-slate-800">
            اشتراك المتاجر
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
              خدمات الاشتراك غير مفعّلة حالياً. يمكنك تصفح الموقع واستخدام
              الخدمات المتاحة مجاناً، وسيتم الإعلان عن تفعيل الاشتراكات عند
              توفرها.
            </p>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-emerald-800 to-emerald-600 p-5 text-white">
            <span className="text-3xl">🏪</span>
            <h2 className="mt-2 text-xl font-black">
              افتح متجرك على Sooq.Sy
            </h2>
            <p className="mt-2 text-sm leading-7 text-emerald-50">
              اعرض منتجاتك في صفحة متجرك وفي الأقسام الرئيسية للسوق أيضاً.
              ويمكنك امتلاك أكثر من متجر ضمن حسابك.
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
                  onChange={(event) => {
                    setSelectedStoreId(event.target.value);
                    setRequestSent(false);
                    setRequestError("");
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
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="اسم المتجر *"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  maxLength={100}
                />

                <input
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  placeholder="اختصاص المتجر، مثال: ألبسة أو إلكترونيات"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  maxLength={100}
                />

                <textarea
                  value={storeDescription}
                  onChange={(event) => setStoreDescription(event.target.value)}
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
                    onChange={(event) => {
                      setSelectedGovernorate(event.target.value);
                      setSelectedCity("");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
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
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />

                <input
                  value={storeWhatsapp}
                  onChange={(event) => setStoreWhatsapp(event.target.value)}
                  placeholder="رقم واتساب (اختياري)"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">
                آلية تفعيل المتجر
              </p>
              <p className="mt-2 text-sm leading-7 text-amber-900">
                بعد إرسال الطلب وتحويل قيمة الاشتراك، ستقوم الإدارة بمراجعة
                الطلب وتفعيله بعد التأكد من الحوالة. عند انتهاء الاشتراك،
                يمكنك تجديده للاستمرار في نشر منتجات جديدة من المتجر.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold text-slate-800">
            المبلغ المطلوب للتحويل
          </h2>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">قيمة اشتراك المتجر</span>
            <strong className="text-lg">$20</strong>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-slate-600">
              المبلغ بالليرة السورية
            </span>
            <strong className="text-lg text-emerald-700">
              {amountSyp.toLocaleString("en-US")} ل.س
            </strong>
          </div>
          {!exchangeRate && (
            <p className="mt-2 text-xs text-amber-700">
              سعر الصرف غير مضبوط حالياً؛ يرجى التأكد من المبلغ مع الإدارة.
            </p>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold">الدفع عبر شام كاش</h2>

          {qrUrl && (
            <img
              src={qrUrl}
              alt="رمز الدفع عبر شام كاش"
              className="mx-auto mt-4 max-h-64"
            />
          )}

          <p className="mt-4 text-center" dir="ltr">
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
              عند إجراء التحويل عبر شام كاش، يجب كتابة رقم الهاتف المسجل في
              حسابك على Sooq.Sy ضمن خانة الملاحظات أو وصف الحوالة، حتى تتمكن
              الإدارة من مطابقة الحوالة مع طلب الاشتراك وتأكيد الدفع.
            </p>

            <p className="mt-3 rounded-lg border border-red-200 bg-red-100 p-3 text-center text-sm font-black text-red-700">
              لا تنسَ كتابة رقم هاتفك في ملاحظات الحوالة.
            </p>
          </div>

          {requestSent ? (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
              تم إرسال طلب اشتراك المتجر بنجاح، وهو الآن بانتظار مراجعة الإدارة.
            </div>
          ) : (
            <>
              {requestError && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {requestError}
                </p>
              )}

              <button
                type="button"
                onClick={submitStoreSubscriptionRequest}
                disabled={!subscriptionsEnabled || submitting}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "جارٍ إرسال الطلب..."
                  : "أتممت التحويل، أرسل طلب اشتراك المتجر"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
