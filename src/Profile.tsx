
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  UserRound,
  Phone,
  LockKeyhole,
  Save,
  ArrowRight,
  LoaderCircle,
  Store,
  MapPin,
  Gift,
  Copy,
  Crown,
  Megaphone,
  Star,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const [userId, setUserId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [pointsBalance, setPointsBalance] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [governorates, setGovernorates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState({
    ordinary: 0,
    featured: 0,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadLocations(cityId: number | null) {
    const { data: governoratesData, error: governoratesError } =
      await supabase
        .from("governorates")
        .select("id, name_ar")
        .eq("is_active", true)
        .order("name_ar");

    if (governoratesError) throw governoratesError;

    const { data: citiesData, error: citiesError } =
      await supabase
        .from("cities")
        .select("id, governorate_id, name_ar")
        .eq("is_active", true)
        .order("name_ar");

    if (citiesError) throw citiesError;

    setGovernorates(governoratesData || []);
    setCities(citiesData || []);

    if (cityId) {
      const currentCity = (citiesData || []).find(
        (city) => city.id === cityId
      );

      if (currentCity) {
        setSelectedGovernorate(String(currentCity.governorate_id));
        setSelectedCity(String(currentCity.id));
      }
    }
  }

  async function loadSubscription(id: string) {
    const { data: subscriptions, error: subscriptionError } =
      await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

    if (subscriptionError) throw subscriptionError;

    const now = new Date();

    const activeSubscription = (subscriptions || []).find(
      (item) =>
        item.status === "active" &&
        item.end_at &&
        new Date(item.end_at) > now
    );

    const currentSubscription =
      activeSubscription || (subscriptions || [])[0] || null;

    setSubscription(null);
    setSubscriptionUsage({ ordinary: 0, featured: 0 });

    if (currentSubscription) {
      const { data: plan, error: planError } = await supabase
        .from("subscription_plans")
        .select(
          "name, price_usd, ordinary_ads_limit, featured_ads_limit, duration_months"
        )
        .eq("id", currentSubscription.plan_id)
        .maybeSingle();

      if (planError) throw planError;

      const { data: usage, error: usageError } = await supabase
        .from("subscription_ad_usage")
        .select("ad_type")
        .eq("subscription_id", currentSubscription.id);

      if (usageError) throw usageError;

      const ordinary = (usage || []).filter((item) =>
        ["ordinary", "regular", "normal"].includes(
          String(item.ad_type).toLowerCase()
        )
      ).length;

      const featured = (usage || []).filter((item) =>
        ["featured", "premium"].includes(
          String(item.ad_type).toLowerCase()
        )
      ).length;

      setSubscription({
        ...currentSubscription,
        plan,
      });

      setSubscriptionUsage({ ordinary, featured });
    }
  }

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("يرجى تسجيل الدخول أولاً.");
      }

      const id = authData.user.id;
      setUserId(id);

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("display_name, city_id")
          .eq("id", id)
          .single();

      if (profileError) throw profileError;

      const { data: privateProfile, error: phoneError } =
        await supabase
          .from("private_profiles")
          .select("phone")
          .eq("user_id", id)
          .single();

      if (phoneError) throw phoneError;

      const { data: referralData, error: referralError } =
        await supabase
          .from("referral_codes")
          .select("code")
          .eq("user_id", id)
          .single();

      if (referralError) throw referralError;

      const { data: pointsData, error: pointsError } =
        await supabase
          .from("user_points")
          .select("balance")
          .eq("user_id", id)
          .single();

      if (pointsError) throw pointsError;

      setReferralCode(referralData.code);
      setPointsBalance(pointsData.balance);

      setName(profile.display_name || "");
      setPhone(privateProfile.phone || "");

      await loadLocations(profile.city_id ?? null);
      await loadSubscription(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحميل بيانات الحساب."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveLocation() {
    setError("");
    setMessage("");

    if (!selectedGovernorate || !selectedCity) {
      setError("يرجى اختيار المحافظة والمدينة.");
      return;
    }

    setSavingLocation(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ city_id: Number(selectedCity) })
        .eq("id", userId);

      if (error) throw error;

      setMessage("تم تحديث المحافظة والمدينة بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحديث المحافظة والمدينة."
      );
    } finally {
      setSavingLocation(false);
    }
  }

  async function saveName() {
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("يرجى إدخال الاسم.");
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", userId);

      if (error) throw error;

      setMessage("تم تحديث الاسم بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحديث الاسم."
      );
    } finally {
      setSavingName(false);
    }
  }

  async function savePhone() {
    setError("");
    setMessage("");

    if (!/^09[0-9]{8}$/.test(phone.trim())) {
      setError("يرجى إدخال رقم موبايل سوري صحيح يبدأ بـ 09.");
      return;
    }

    setSavingPhone(true);

    try {
      const { data, error } =
        await supabase.functions.invoke("update-user-phone", {
          body: { phone: phone.trim() },
        });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(
          data?.error || "تعذر تحديث رقم الموبايل."
        );
      }

      setMessage(data.message || "تم تحديث رقم الموبايل بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحديث رقم الموبايل."
      );
    } finally {
      setSavingPhone(false);
    }
  }

  async function savePassword() {
    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setMessage("تم تغيير كلمة المرور بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تغيير كلمة المرور."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function copyReferralLink() {
    const basePath = window.location.pathname.startsWith("/sooq-sy")
      ? "/sooq-sy"
      : "";

    const link = `${window.location.origin}${basePath}/auth?ref=${referralCode}`;

    try {
      await navigator.clipboard.writeText(link);
      setMessage("تم نسخ رابط الدعوة بنجاح.");
      setError("");
    } catch {
      setError("تعذر نسخ الرابط.");
      setMessage("");
    }
  }

  const subscriptionIsActive =
    subscription?.status === "active" &&
    subscription?.end_at &&
    new Date(subscription.end_at) > new Date();

  const ordinaryLimit = Number(
    subscription?.plan?.ordinary_ads_limit || 0
  );

  const featuredLimit = Number(
    subscription?.plan?.featured_ads_limit || 0
  );

  const ordinaryRemaining = Math.max(
    0,
    ordinaryLimit - subscriptionUsage.ordinary
  );

  const featuredRemaining = Math.max(
    0,
    featuredLimit - subscriptionUsage.featured
  );

  const inputClass =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";

  const buttonClass =
    "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

  const sectionClass =
    "overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6";

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50"
      >
        <LoaderCircle className="animate-spin text-emerald-600" size={38} />
        <p className="text-sm font-medium text-slate-500">
          جارٍ تحميل بيانات حسابك...
        </p>
      </div>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f7f6] px-3 pb-10 pt-4 sm:px-5 sm:py-8"
    >
      <div className="mx-auto max-w-2xl">

        {/* شريط العودة */}
        <Link
          to="/"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:text-emerald-700"
        >
          <ArrowRight size={18} />
          العودة إلى السوق
        </Link>

        {/* رأس الصفحة */}
        <div className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner">
              <UserRound size={34} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-50">
                أهلاً بك في Sooq.Sy
              </p>
              <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">
                {name || "الملف الشخصي"}
              </h1>
              <p className="mt-1 text-xs text-emerald-50/90">
                إدارة حسابك ومعلوماتك الشخصية
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs text-white/95">
            <ShieldCheck size={17} />
            بيانات حسابك وإعدادات الأمان
          </div>
        </div>

        {/* رسائل النجاح والخطأ */}
        {message && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* إدارة المتاجر */}
        <Link
          to="/my-stores"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Store size={25} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-base font-black text-slate-800">
              إدارة متاجري
            </strong>
            <span className="mt-1 block text-xs text-slate-500">
              عرض المتاجر والاشتراكات وأرصدة الإعلانات
            </span>
          </div>
          <ArrowRight className="shrink-0 text-emerald-600" size={21} />
        </Link>

        {/* الاشتراك الإعلاني */}
        {subscriptionIsActive && subscription?.plan && (
          <section className="mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="bg-gradient-to-l from-blue-700 to-indigo-600 p-4 text-white sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                    <Crown size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">
                      اشتراكي الإعلاني
                    </h2>
                    <p className="mt-1 text-xs text-blue-100">
                      {subscription.plan.name}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-400/20 px-3 py-1.5 text-xs font-bold text-white">
                  نشط
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-4 rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-600">
                  قيمة الاشتراك
                </p>
                <p className="mt-1 text-2xl font-black text-blue-900">
                  ${subscription.plan.price_usd}
                  <span className="mr-1 text-sm font-medium text-blue-600">
                    / شهرياً
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Megaphone size={17} />
                    <span className="text-xs font-semibold">
                      الإعلانات العادية
                    </span>
                  </div>
                  <p className="text-xl font-black text-slate-800">
                    {subscriptionUsage.ordinary}
                    <span className="text-sm font-medium text-slate-400">
                      {" "}/ {ordinaryLimit}
                    </span>
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${ordinaryLimit > 0 ? Math.min(100, (subscriptionUsage.ordinary / ordinaryLimit) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-emerald-700">
                    المتبقي {ordinaryRemaining}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Star size={17} />
                    <span className="text-xs font-semibold">
                      الإعلانات المميزة
                    </span>
                  </div>
                  <p className="text-xl font-black text-slate-800">
                    {subscriptionUsage.featured}
                    <span className="text-sm font-medium text-slate-400">
                      {" "}/ {featuredLimit}
                    </span>
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{
                        width: `${featuredLimit > 0 ? Math.min(100, (subscriptionUsage.featured / featuredLimit) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-emerald-700">
                    المتبقي {featuredRemaining}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <CalendarDays className="shrink-0 text-blue-600" size={19} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">تاريخ البداية</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-800">
                      {subscription.start_at
                        ? new Date(subscription.start_at).toLocaleDateString("ar-SY")
                        : "غير محدد"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <CalendarDays className="shrink-0 text-red-500" size={19} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">تاريخ الانتهاء</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-800">
                      {subscription.end_at
                        ? new Date(subscription.end_at).toLocaleDateString("ar-SY")
                        : "غير محدد"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* المعلومات الشخصية */}
        <section className={`${sectionClass} mb-4`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserRound size={21} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                المعلومات الشخصية
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                الاسم الظاهر في حسابك
              </p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-bold text-slate-600">
            الاسم
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="اسم المستخدم"
          />

          <button
            type="button"
            onClick={saveName}
            disabled={savingName}
            className={`${buttonClass} mt-4`}
          >
            <Save size={18} />
            {savingName ? "جارٍ الحفظ..." : "حفظ الاسم"}
          </button>
        </section>

        {/* النقاط ودعوة الأصدقاء */}
        <section className={`${sectionClass} mb-4`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Gift size={22} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                نقاطي ودعوة الأصدقاء
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                اجمع النقاط وشارك رابط دعوتك
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-500 p-5 text-white">
            <p className="text-sm font-medium text-emerald-50">
              رصيد نقاطك الحالي
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black tabular-nums">
                {pointsBalance}
              </span>
              <span className="mb-1 text-sm font-bold text-emerald-50">
                نقطة
              </span>
            </div>
            <p className="mt-2 text-xs text-emerald-50">
              يمكنك جمع النقاط من مشاركة الإعلانات ودعوة الأصدقاء.
            </p>
          </div>

          <label className="mb-2 mt-5 block text-sm font-bold text-slate-600">
            رمز الإحالة الخاص بك
          </label>

          <div className="flex min-w-0 gap-2">
            <input
              type="text"
              readOnly
              value={referralCode}
              dir="ltr"
              className={`${inputClass} text-center font-bold tracking-widest`}
            />
            <button
              type="button"
              onClick={copyReferralLink}
              className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95"
            >
              <Copy size={17} />
              نسخ
            </button>
          </div>

          <p className="mt-3 text-xs leading-6 text-slate-500">
            ادعُ أصدقاءك للتسجيل باستخدام رابطك، واحصل على 20 نقطة عند إنشاء كل صديق لحسابه بنجاح.
          </p>
        </section>

        {/* المحافظة والمدينة */}
        <section className={`${sectionClass} mb-4`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <MapPin size={21} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                المحافظة والمدينة
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                حدد موقعك لعرض الإعلانات المناسبة
              </p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-bold text-slate-600">
            المحافظة
          </label>
          <select
            value={selectedGovernorate}
            onChange={(e) => {
              setSelectedGovernorate(e.target.value);
              setSelectedCity("");
            }}
            className={`${inputClass} mb-4`}
          >
            <option value="">اختر المحافظة</option>
            {governorates.map((governorate) => (
              <option key={governorate.id} value={String(governorate.id)}>
                {governorate.name_ar}
              </option>
            ))}
          </select>

          <label className="mb-2 block text-sm font-bold text-slate-600">
            المدينة
          </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            disabled={!selectedGovernorate}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <option value="">اختر المدينة</option>
            {cities
              .filter(
                (city) =>
                  String(city.governorate_id) === selectedGovernorate
              )
              .map((city) => (
                <option key={city.id} value={String(city.id)}>
                  {city.name_ar}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={saveLocation}
            disabled={savingLocation}
            className={`${buttonClass} mt-4`}
          >
            <Save size={18} />
            {savingLocation ? "جارٍ الحفظ..." : "حفظ الموقع"}
          </button>
        </section>

        {/* رقم الموبايل */}
        <section className={`${sectionClass} mb-4`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Phone size={21} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                رقم الموبايل
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                رقم الهاتف المرتبط بتسجيل الدخول
              </p>
            </div>
          </div>

          <input
            type="tel"
            dir="ltr"
            maxLength={10}
            inputMode="numeric"
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/\D/g, "").slice(0, 10)
              )
            }
            className={`${inputClass} text-left`}
            placeholder="09XXXXXXXX"
          />

          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">
            تغيير الرقم سيغيّر أيضاً الرقم المستخدم لتسجيل الدخول.
          </div>

          <button
            type="button"
            onClick={savePhone}
            disabled={savingPhone}
            className={`${buttonClass} mt-4`}
          >
            <Save size={18} />
            {savingPhone ? "جارٍ التحديث..." : "تحديث رقم الموبايل"}
          </button>
        </section>

        {/* تغيير كلمة المرور */}
        <section className={sectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <LockKeyhole size={21} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                تغيير كلمة المرور
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                حافظ على أمان حسابك
              </p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-bold text-slate-600">
            كلمة المرور الجديدة
          </label>
          <input
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputClass} mb-4`}
            placeholder="أدخل كلمة المرور الجديدة"
          />

          <label className="mb-2 block text-sm font-bold text-slate-600">
            تأكيد كلمة المرور
          </label>
          <input
            type="password"
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            placeholder="أعد إدخال كلمة المرور"
          />

          <button
            type="button"
            onClick={savePassword}
            disabled={savingPassword}
            className={`${buttonClass} mt-4`}
          >
            <LockKeyhole size={18} />
            {savingPassword ? "جارٍ التحديث..." : "تغيير كلمة المرور"}
          </button>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          سوق سوريا · حسابك بأمان
        </p>
      </div>
    </main>
  );
}
