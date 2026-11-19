
import { useEffect, useState, type ChangeEvent } from "react";
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
  Camera,
  BadgeCheck,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingProfileDetails, setSavingProfileDetails] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [userId, setUserId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [pointsBalance, setPointsBalance] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [showPhone, setShowPhone] = useState(false);

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
          .select("display_name, city_id, avatar_url, bio, show_phone")
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
      setAvatarUrl(profile.avatar_url || "");
      setBio(profile.bio || "");
      setShowPhone(profile.show_phone ?? false);

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

  async function saveProfileDetails() {
    setError("");
    setMessage("");

    if (bio.length > 300) {
      setError("النبذة يجب ألا تتجاوز 300 حرف.");
      return;
    }

    setSavingProfileDetails(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          bio: bio.trim(),
          show_phone: showPhone,
        })
        .eq("id", userId);

      if (error) throw error;

      setMessage("تم حفظ معلومات البروفايل بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر حفظ معلومات البروفايل."
      );
    } finally {
      setSavingProfileDetails(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP.");
      setMessage("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.");
      setMessage("");
      return;
    }

    setError("");
    setMessage("");
    setUploadingAvatar(true);

    try {
      const extension = file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

      const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      const newAvatarUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", userId);

      if (updateError) {
        await supabase.storage
          .from("profile-images")
          .remove([filePath]);

        throw updateError;
      }

      setAvatarUrl(newAvatarUrl);
      setMessage("تم تحديث الصورة الشخصية بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر رفع الصورة الشخصية."
      );
    } finally {
      setUploadingAvatar(false);
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

        {/* رأس الصفحة والصورة الشخصية */}
        <div className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-24 bg-gradient-to-l from-emerald-900 via-emerald-700 to-teal-500 sm:h-32" />

          <div className="px-5 pb-5 sm:px-7">
            <div className="-mt-12 flex flex-wrap items-end gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-emerald-50 shadow-md">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="الصورة الشخصية"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-emerald-700">
                    <UserRound size={42} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-semibold text-emerald-700">
                  أهلاً بك في Sooq.Sy
                </p>
                <h1 className="mt-1 truncate text-xl font-black text-slate-900 sm:text-2xl">
                  {name || "الملف الشخصي"}
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  إدارة معلوماتك الشخصية وإعدادات حسابك
                </p>
              </div>
            </div>

            <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100">
              <Camera size={18} />
              {uploadingAvatar ? "جارٍ رفع الصورة..." : "تغيير الصورة الشخصية"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={uploadAvatar}
              />
            </label>

            <p className="mt-2 text-[11px] text-slate-400">
              الصورة اختيارية، ويمكنك استخدام الحساب دون صورة شخصية.
            </p>
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

                {/* المبيعات وطلبات الشراء */}
        <Link
          to="/my-sales"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Gift size={25} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-base font-black text-slate-800">
              مبيعاتي وطلبات الشراء
            </strong>
            <span className="mt-1 block text-xs text-slate-500">
              متابعة طلبات الشراء والمبيعات وتأكيد إتمام الصفقات والتقييمات
            </span>
          </div>
          <ArrowRight className="shrink-0 text-blue-600" size={21} />
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

        {/* النبذة والخصوصية والتوثيق */}
        <section className={`${sectionClass} mb-4`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <UserRound size={21} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                معلومات البروفايل
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                المعلومات التي يمكن أن تظهر للزوار
              </p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-bold text-slate-600">
            نبذة عنك
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={4}
            className={`${inputClass} resize-y`}
            placeholder="اكتب نبذة مختصرة عنك..."
          />

          <p className="mt-1 text-left text-xs text-slate-400">
            {bio.length}/300
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              {showPhone ? (
                <Eye size={19} className="text-emerald-600" />
              ) : (
                <EyeOff size={19} className="text-slate-500" />
              )}
              <div>
                <p className="text-sm font-bold text-slate-800">
                  إظهار رقم الهاتف في البروفايل
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  يمكنك تغيير هذا الخيار في أي وقت
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPhone(!showPhone)}
              role="switch"
              aria-checked={showPhone}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                showPhone ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  showPhone ? "right-1" : "right-6"
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={saveProfileDetails}
            disabled={savingProfileDetails}
            className={`${buttonClass} mt-4`}
          >
            <Save size={18} />
            {savingProfileDetails
              ? "جارٍ الحفظ..."
              : "حفظ معلومات البروفايل"}
          </button>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <BadgeCheck size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-slate-800">
                  توثيق الحساب
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  وثّق حسابك لتحصل على شارة التوثيق بعد مراجعة الإدارة.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMessage(
                  "خدمة توثيق الحساب قيد التجهيز، وستتوفر قريباً."
                );
                setError("");
              }}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
            >
              <ShieldCheck size={19} />
              توثيق الحساب
            </button>
          </div>
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
          Sooq Sy · حسابك بأمان
        </p>
      </div>
    </main>
  );
}
