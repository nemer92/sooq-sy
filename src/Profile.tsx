import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Coins,
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
  XCircle,
  RefreshCw,
  Users,
  UserCheck,
  Truck,
  X,
} from "lucide-react";

type VerificationRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  phone: string;
  payment_reference: string | null;
  admin_note: string | null;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
};

type FollowUser = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  followed_at: string;
};

type FollowListType = "followers" | "following";

export default function Profile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingProfileDetails, setSavingProfileDetails] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [userId, setUserId] = useState("");
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [pointsBalance, setPointsBalance] = useState(0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [avatarUrl, setAvatarUrl] = useState("");
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  // المتابعون ومن أتابع
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListType, setFollowListType] =
    useState<FollowListType | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const [governorates, setGovernorates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState({
    ordinary: 0,
    featured: 0,
  });

  const [verificationRequests, setVerificationRequests] = useState<
    VerificationRequest[]
  >([]);
  const [paymentReference, setPaymentReference] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [submittingDriverApplication, setSubmittingDriverApplication] = useState(false);
  const [driverApplicationSubmitted, setDriverApplicationSubmitted] = useState(false);
  const [deliveryDriverStatus, setDeliveryDriverStatus] = useState<string | null>(null);
  const [deliveryApplicationStatus, setDeliveryApplicationStatus] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadFollowCounts(id: string) {
    const { data, error } = await supabase.rpc(
      "get_user_follow_counts",
      {
        p_user_id: id,
      }
    );

    if (error) throw error;

    const counts = Array.isArray(data) ? data[0] : data;

    setFollowersCount(Number(counts?.followers_count || 0));
    setFollowingCount(Number(counts?.following_count || 0));
  }

  async function openFollowList(type: FollowListType) {
    if (!userId || followListLoading) return;

    setFollowListType(type);
    setFollowList([]);
    setFollowListLoading(true);

    try {
      const functionName =
        type === "followers"
          ? "get_public_followers"
          : "get_public_following";

      const { data, error } = await supabase.rpc(functionName, {
        p_user_id: userId,
      });

      if (error) throw error;

      setFollowList((data || []) as FollowUser[]);
    } catch (err) {
      console.error("Error loading follow list:", err);

      setFollowListType(null);

      window.alert("تعذر تحميل قائمة المتابعين. حاول مرة أخرى.");
    } finally {
      setFollowListLoading(false);
    }
  }

  async function loadLocations(cityId: number | null) {
    const { data: governoratesData, error: governoratesError } =
      await supabase
        .from("governorates")
        .select("id, name_ar")
        .eq("is_active", true)
        .order("name_ar");

    if (governoratesError) throw governoratesError;

    const { data: citiesData, error: citiesError } = await supabase
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

  async function loadVerificationData(id: string) {
    const { data, error: verificationError } = await supabase
      .from("account_verifications")
      .select(
        "id, status, phone, payment_reference, admin_note, start_at, end_at, created_at"
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (verificationError) throw verificationError;

    setVerificationRequests((data || []) as VerificationRequest[]);
  }

  async function refreshVerificationData() {
    if (!userId) return;

    const { data, error: verificationError } = await supabase
      .from("account_verifications")
      .select(
        "id, status, phone, payment_reference, admin_note, start_at, end_at, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (verificationError) throw verificationError;

    setVerificationRequests((data || []) as VerificationRequest[]);
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
      const { data: adminCheck } = await supabase.rpc("is_admin_profile", { p_user_id: id });
      setIsGeneralAdmin(adminCheck === true);

      // تحميل حالة حساب التوصيل والطلب الحالي للمستخدم
      const [
        { data: driverData, error: driverError },
        { data: applicationData, error: applicationError },
      ] = await Promise.all([
        supabase
          .from("delivery_drivers")
          .select("status, is_available")
          .eq("user_id", id)
          .maybeSingle(),
        supabase
          .from("delivery_applications")
          .select("status")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (driverError) {
        console.error("Error loading delivery driver status:", driverError);
      } else {
        setDeliveryDriverStatus(driverData?.status ?? null);
      }

      if (applicationError) {
        console.error("Error loading delivery application status:", applicationError);
      } else {
        const applicationStatus = applicationData?.status ?? null;
        setDeliveryApplicationStatus(applicationStatus);
        setDriverApplicationSubmitted(applicationStatus === "pending");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "display_name, city_id, avatar_url, bio, show_phone, last_seen_at"
        )
        .eq("id", id)
        .single();

      if (profileError) throw profileError;

      const { data: privateProfile, error: phoneError } = await supabase
        .from("private_profiles")
        .select("phone")
        .eq("user_id", id)
        .single();

      if (phoneError) throw phoneError;

      const { data: referralData, error: referralError } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", id)
        .single();

      if (referralError) throw referralError;

      const { data: pointsData, error: pointsError } = await supabase
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
      setLastSeenAt(profile.last_seen_at || null);
      setBio(profile.bio || "");
      setShowPhone(profile.show_phone ?? false);

      await Promise.all([
        loadLocations(profile.city_id ?? null),
        loadSubscription(id),
        loadVerificationData(id),
        loadFollowCounts(id).catch((followError) => {
          console.error("Error loading follow counts:", followError);
        }),
      ]);
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

  async function submitVerificationRequest() {
    setError("");
    setMessage("");

    if (submittingVerification) return;

    if (!/^09[0-9]{8}$/.test(phone.trim())) {
      setError("يرجى التأكد من رقم الهاتف المسجل في حسابك قبل طلب التوثيق.");
      return;
    }

    const pendingRequest = verificationRequests.find(
      (request) => request.status === "pending"
    );

    if (pendingRequest) {
      setError("لديك طلب توثيق قيد المراجعة بالفعل.");
      return;
    }

    setSubmittingVerification(true);

    try {
      const { data, error: submitError } = await supabase.rpc(
        "submit_account_verification",
        {
          p_phone: phone.trim(),
          p_payment_reference: paymentReference.trim() || null,
        }
      );

      if (submitError) throw submitError;

      if (!data) {
        throw new Error("لم يتم استلام رقم طلب التوثيق.");
      }

      setPaymentReference("");
      await refreshVerificationData();

      setMessage(
        "تم إرسال طلب توثيق الحساب بنجاح. سيبقى الطلب قيد المراجعة حتى موافقة الإدارة."
      );
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "تعذر إرسال طلب التوثيق. حاول مرة أخرى.";

      setError(errorMessage);
    } finally {
      setSubmittingVerification(false);
    }
  }

  async function submitDriverApplication() {
    if (submittingDriverApplication || driverApplicationSubmitted) return;

    setError("");
    setMessage("");
    setSubmittingDriverApplication(true);

    try {
      const { data, error: applicationError } = await supabase.rpc(
        "apply_to_be_delivery_driver",
        { p_applicant_note: null }
      );

      if (applicationError) throw applicationError;

      setDriverApplicationSubmitted(true);
      setDeliveryApplicationStatus("pending");
      setMessage(
        typeof data === "string" && data.trim()
          ? data
          : "تم إرسال طلب الانضمام كمندوب توصيل بنجاح. سيظهر حساب المندوب بعد مراجعة الإدارة والموافقة."
      );
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "تعذر إرسال طلب الانضمام كمندوب توصيل. حاول مرة أخرى.";

      setError(errorMessage);
    } finally {
      setSubmittingDriverApplication(false);
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
      const extension =
        file.type === "image/png"
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

  const latestVerification = verificationRequests[0] || null;

  const activeVerification = verificationRequests.find(
    (request) =>
      request.status === "approved" &&
      request.start_at &&
      request.end_at &&
      new Date(request.start_at) <= new Date() &&
      new Date(request.end_at) > new Date()
  );

  const verificationPending = verificationRequests.some(
    (request) => request.status === "pending"
  );

  const verificationDaysRemaining = activeVerification?.end_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeVerification.end_at).getTime() -
            Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const canRenewVerification =
    !verificationPending &&
    (!activeVerification || verificationDaysRemaining <= 30);

  const inputClass =
    "w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10";

  const buttonClass =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

  const sectionClass =
    "overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4";

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50"
      >
        <LoaderCircle className="animate-spin text-emerald-600" size={32} />
        <p className="text-xs font-medium text-slate-500">
          جارٍ تحميل بيانات حسابك...
        </p>
      </div>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f7f6] px-3 pb-6 pt-3 sm:px-5 sm:py-6"
    >
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-3 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:text-emerald-700"
        >
          <ArrowRight size={15} />
          العودة إلى السوق
        </Link>

        {/* بطاقة الملف الشخصي */}
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className={`relative h-20 sm:h-24 ${isGeneralAdmin ? "admin-gold-cover" : "bg-gradient-to-l from-emerald-900 via-emerald-700 to-teal-400"}`}>
            <div className="absolute left-3 top-3 z-10">
              <div className="flex items-center gap-2 rounded-lg border border-white/40 bg-white/95 px-2.5 py-1.5 shadow-sm">
                <Coins size={16} className="text-emerald-700" />
                <div>
                  <p className="text-[9px] font-semibold text-slate-500">
                    رصيد نقاطك
                  </p>
                  <p className="text-xs font-black text-emerald-900">
                    {pointsBalance.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 px-3 pb-3 sm:px-4">
            <div className="-mt-9 flex flex-wrap items-end gap-3">
              <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-[3px] bg-emerald-50 shadow-sm ${isGeneralAdmin ? "admin-gold-avatar" : "border-white"}`}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="الصورة الشخصية"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-emerald-700">
                    <UserRound size={34} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-extrabold text-emerald-800">
                  أهلاً بك في Sooq.Sy
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <h1 className={`truncate text-lg font-black text-slate-900 ${isGeneralAdmin ? "[-webkit-text-stroke:0.25px_#d4a017] [text-shadow:0_0_1px_#d4a017]" : ""}`}>
                    {name || "الملف الشخصي"}
                  </h1>

                  {isGeneralAdmin && <span className="admin-gold-label"><span className="text-base">♛</span> الأدمن العام</span>}
                  {activeVerification ? (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${isGeneralAdmin ? "border-amber-300 bg-amber-100" : "border-blue-200 bg-blue-50"}`}>
                      <span title="حساب موثّق" className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${isGeneralAdmin ? "bg-amber-500" : "bg-blue-500"}`}>
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor"><path d="M9.2 16.2 4.9 12l-1.4 1.4 5.7 5.7L21 7.3l-1.4-1.4z" /></svg>
                      </span>
                      <span className={`text-[9px] font-extrabold ${isGeneralAdmin ? "text-amber-800" : "text-blue-700"}`}>حساب موثّق</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
                      <ShieldCheck size={12} className="text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-500">حساب غير موثّق</span>
                    </span>
                  )}
                </div>

                <p className="mt-1 text-[11px] text-emerald-700">
                  {!lastSeenAt
                    ? "آخر ظهور غير متاح"
                    : (() => {
                        const diff = Math.max(
                          0,
                          Date.now() - new Date(lastSeenAt).getTime()
                        );
                        const minutes = Math.floor(diff / 60000);
                        const hours = Math.floor(diff / 3600000);
                        const days = Math.floor(diff / 86400000);

                        if (minutes < 2) return "متصل الآن";
                        if (minutes < 60)
                          return `آخر ظهور منذ ${minutes} دقيقة`;
                        if (hours < 24)
                          return `آخر ظهور منذ ${hours} ساعة`;
                        if (days < 30)
                          return `آخر ظهور منذ ${days} يوم`;

                        return `آخر ظهور بتاريخ ${new Date(
                          lastSeenAt
                        ).toLocaleDateString("ar-SY")}`;
                      })()}
                </p>
              </div>
            </div>

            <label className="mt-3 inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100">
              <Camera size={15} />
              {uploadingAvatar
                ? "جارٍ رفع الصورة..."
                : "تغيير الصورة الشخصية"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={uploadAvatar}
              />
            </label>

            {/* المتابعون ومن أتابع */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openFollowList("followers")}
                className="flex min-h-16 items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[0.98]"
              >
                <Users size={19} className="shrink-0 text-emerald-700" />
                <span className="text-right">
                  <strong className="block text-base font-black text-emerald-900">
                    {followersCount.toLocaleString("en-US")}
                  </strong>
                  <span className="block text-[10px] font-bold text-emerald-700">
                    المتابعون
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => openFollowList("following")}
                className="flex min-h-16 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 transition hover:border-blue-300 hover:bg-blue-100 active:scale-[0.98]"
              >
                <UserCheck size={19} className="shrink-0 text-blue-700" />
                <span className="text-right">
                  <strong className="block text-base font-black text-blue-900">
                    {followingCount.toLocaleString("en-US")}
                  </strong>
                  <span className="block text-[10px] font-bold text-blue-700">
                    أتابع
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* حساب مندوب التوصيل */}
        {deliveryDriverStatus === "active" ? (
          <section className="mb-3 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 bg-gradient-to-l from-emerald-800 to-teal-600 p-3 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black">حساب مندوب التوصيل</h2>
                <p className="mt-0.5 text-[10px] text-emerald-50">
                  حسابك مفعّل ويمكنك إدارة خدمات التوصيل
                </p>
              </div>
              <span className="mr-auto rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold">
                نشط
              </span>
            </div>
            <div className="space-y-2 p-3">
              <p className="text-[11px] leading-5 text-slate-600">
                تمت الموافقة على طلبك. انتقل إلى لوحة المندوب لإضافة مركبتك وتحديد مناطق التغطية وإدارة طلبات التوصيل.
              </p>
              <Link
                to="/delivery-driver"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98]"
              >
                <Truck size={15} />
                إدارة حساب المندوب
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        ) : deliveryApplicationStatus === "pending" || driverApplicationSubmitted ? (
          <section className="mb-3 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 bg-gradient-to-l from-amber-700 to-orange-500 p-3 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black">طلب الانضمام كمندوب توصيل</h2>
                <p className="mt-0.5 text-[10px] text-amber-50">
                  طلبك قيد مراجعة الإدارة
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 text-[11px] leading-5 text-amber-800">
              <LoaderCircle size={16} className="mt-0.5 shrink-0" />
              <p>تم استلام طلبك، وسيظهر رابط إدارة حساب المندوب بعد موافقة الإدارة.</p>
            </div>
          </section>
        ) : (
          <section className="mb-3 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 bg-gradient-to-l from-amber-700 to-orange-500 p-3 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black">الانضمام كمندوب توصيل</h2>
                <p className="mt-0.5 text-[10px] text-amber-50">
                  قدّم طلبك للعمل كمندوب بعد موافقة الإدارة
                </p>
              </div>
            </div>
            <div className="space-y-2 p-3">
              <p className="text-[11px] leading-5 text-slate-600">
                أرسل طلب الانضمام، وبعد مراجعة الإدارة والموافقة ستتمكن من إدارة
                مركبتك ومناطق التغطية وطلبات التوصيل من صفحة حساب المندوب.
              </p>
              <button
                type="button"
                onClick={submitDriverApplication}
                disabled={submittingDriverApplication}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingDriverApplication ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Truck size={15} />
                )}
                {submittingDriverApplication
                  ? "جارٍ إرسال الطلب..."
                  : "إرسال طلب الانضمام"}
              </button>
            </div>
          </section>
        )}

        {/* روابط سريعة */}
        <Link
          to="/my-stores"
          className="mb-2 flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Store size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-sm font-extrabold text-slate-800">
              إدارة متاجري
            </strong>
            <span className="mt-0.5 block text-[10px] text-slate-500">
              عرض المتاجر والاشتراكات وأرصدة الإعلانات
            </span>
          </div>
          <ArrowRight className="shrink-0 text-emerald-600" size={17} />
        </Link>

        <Link
          to="/my-sales"
          className="mb-2 flex items-center gap-2.5 rounded-xl border border-blue-100 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Gift size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-sm font-extrabold text-slate-800">
              مبيعاتي وطلبات الشراء
            </strong>
            <span className="mt-0.5 block text-[10px] text-slate-500">
              متابعة الطلبات والمبيعات وتأكيد الصفقات والتقييمات
            </span>
          </div>
          <ArrowRight className="shrink-0 text-blue-600" size={17} />
        </Link>

        <Link
          to="/wallet"
          className="mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-white p-3 text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Coins size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-sm font-extrabold">
              المحفظة وشحن النقاط
            </strong>
            <span className="mt-0.5 block text-[10px] text-emerald-700">
              شحن رصيدك ومتابعة عمليات النقاط
            </span>
          </div>
          <ArrowRight className="shrink-0" size={17} />
        </Link>

        {/* الاشتراك الإعلاني */}
        {subscriptionIsActive && subscription?.plan && (
          <section className="mb-3 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
            <div className="bg-gradient-to-l from-blue-800 to-indigo-600 p-3 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                    <Crown size={19} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black">اشتراكي الإعلاني</h2>
                    <p className="mt-0.5 text-[10px] text-blue-100">
                      {subscription.plan.name}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-bold text-white">
                  نشط
                </span>
              </div>
            </div>

            <div className="p-3">
              <div className="mb-3 rounded-lg bg-emerald-50 p-3">
                <p className="text-[10px] font-semibold text-emerald-700">
                  تكلفة الاشتراك بالنقاط
                </p>
                <p className="mt-0.5 text-xl font-black text-emerald-900">
                  {Math.round(Number(subscription.plan.price_usd) * 10)}
                  <span className="mr-1 text-xs font-medium text-emerald-700">
                    نقطة / شهرياً
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-500">
                    <Megaphone size={14} />
                    <span className="text-[10px] font-semibold">
                      الإعلانات العادية
                    </span>
                  </div>
                  <p className="text-lg font-black text-slate-800">
                    {subscriptionUsage.ordinary}
                    <span className="text-xs font-medium text-slate-400">
                      {" "}/ {ordinaryLimit}
                    </span>
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${
                          ordinaryLimit > 0
                            ? Math.min(
                                100,
                                (subscriptionUsage.ordinary / ordinaryLimit) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-bold text-emerald-700">
                    المتبقي {ordinaryRemaining}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-500">
                    <Star size={14} />
                    <span className="text-[10px] font-semibold">
                      الإعلانات المميزة
                    </span>
                  </div>
                  <p className="text-lg font-black text-slate-800">
                    {subscriptionUsage.featured}
                    <span className="text-xs font-medium text-slate-400">
                      {" "}/ {featuredLimit}
                    </span>
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{
                        width: `${
                          featuredLimit > 0
                            ? Math.min(
                                100,
                                (subscriptionUsage.featured / featuredLimit) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-bold text-emerald-700">
                    المتبقي {featuredRemaining}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                  <CalendarDays className="shrink-0 text-blue-600" size={16} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">تاريخ البداية</p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800">
                      {subscription.start_at
                        ? new Date(subscription.start_at).toLocaleDateString(
                            "ar-SY"
                          )
                        : "غير محدد"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                  <CalendarDays className="shrink-0 text-red-500" size={16} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">تاريخ الانتهاء</p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800">
                      {subscription.end_at
                        ? new Date(subscription.end_at).toLocaleDateString(
                            "ar-SY"
                          )
                        : "غير محدد"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* المعلومات الشخصية */}
        <section className={`${sectionClass} mb-2`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <UserRound size={17} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">
                المعلومات الشخصية
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
                الاسم الظاهر في حسابك
              </p>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
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
            className={`${buttonClass} mt-3`}
          >
            <Save size={14} />
            {savingName ? "جارٍ الحفظ..." : "حفظ الاسم"}
          </button>
        </section>

        {/* معلومات البروفايل */}
        <section className={`${sectionClass} mb-2`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <UserRound size={17} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">
                معلومات البروفايل
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
                المعلومات التي يمكن أن تظهر للزوار
              </p>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
            نبذة عنك
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="اكتب نبذة مختصرة عنك..."
          />

          <p className="mt-1 text-left text-[10px] text-slate-400">
            {bio.length}/300
          </p>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2.5">
            <div className="flex items-center gap-2">
              {showPhone ? (
                <Eye size={16} className="text-emerald-600" />
              ) : (
                <EyeOff size={16} className="text-slate-500" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-800">
                  إظهار رقم الهاتف في البروفايل
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  يمكنك تغيير هذا الخيار في أي وقت
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPhone(!showPhone)}
              role="switch"
              aria-checked={showPhone}
              className={`relative h-6 w-10 shrink-0 rounded-full transition ${
                showPhone ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  showPhone ? "right-0.5" : "right-[18px]"
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={saveProfileDetails}
            disabled={savingProfileDetails}
            className={`${buttonClass} mt-3`}
          >
            <Save size={14} />
            {savingProfileDetails
              ? "جارٍ الحفظ..."
              : "حفظ معلومات البروفايل"}
          </button>
        </section>

        {/* توثيق الحساب */}
        <section className="mb-2 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-blue-800 to-blue-600 p-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black">توثيق الحساب</h2>
                <p className="mt-0.5 text-[10px] text-blue-100">
                  شارة توثيق بعد مراجعة وموافقة الإدارة
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 p-3">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3">
              <div>
                <p className="text-xs font-bold text-slate-700">
                  تكلفة توثيق الحساب بالنقاط
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  صلاحية التوثيق 365 يوماً
                </p>
              </div>
              <strong className="shrink-0 text-xl font-black text-emerald-700">
                200 نقطة
              </strong>
            </div>

            {activeVerification && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <BadgeCheck size={18} />
                  <strong className="text-xs">حسابك موثّق حالياً</strong>
                </div>
                <p className="mt-1.5 text-xs text-blue-900">
                  متبقي {verificationDaysRemaining} يوم على انتهاء التوثيق.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-white p-2">
                    <span className="text-slate-500">بداية التوثيق</span>
                    <strong className="mt-1 block text-slate-800">
                      {activeVerification.start_at
                        ? new Date(
                            activeVerification.start_at
                          ).toLocaleDateString("ar-SY")
                        : "—"}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <span className="text-slate-500">انتهاء التوثيق</span>
                    <strong className="mt-1 block text-slate-800">
                      {activeVerification.end_at
                        ? new Date(
                            activeVerification.end_at
                          ).toLocaleDateString("ar-SY")
                        : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {latestVerification?.status === "rejected" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle size={17} />
                  <strong className="text-xs">
                    تم رفض طلب التوثيق السابق
                  </strong>
                </div>
                {latestVerification.admin_note && (
                  <p className="mt-1.5 text-xs leading-5 text-red-800">
                    سبب الرفض: {latestVerification.admin_note}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-red-700">
                  يمكنك إرسال طلب جديد بعد معالجة سبب الرفض.
                </p>
              </div>
            )}

            {verificationPending ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-800">
                <CalendarDays size={15} className="mt-0.5 shrink-0" />
                <span>
                  لديك طلب توثيق قيد المراجعة حالياً. سيظهر خيار الطلب مجدداً
                  بعد انتهاء المراجعة.
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    رقم الهاتف المسجل في الحساب
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    readOnly
                    dir="ltr"
                    className={`${inputClass} bg-slate-100 text-left`}
                  />
                </div>

                {activeVerification && verificationDaysRemaining > 30 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-5 text-amber-800">
                    يتاح تجديد التوثيق عند بقاء 30 يوماً أو أقل. المتبقي
                    حالياً {verificationDaysRemaining} يوماً.
                  </p>
                )}

                <button
                  type="button"
                  onClick={submitVerificationRequest}
                  disabled={submittingVerification || !canRenewVerification}
                  className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingVerification ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : activeVerification ||
                    latestVerification?.status === "approved" ? (
                    <RefreshCw size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}

                  {submittingVerification
                    ? "جارٍ إرسال الطلب..."
                    : activeVerification && verificationDaysRemaining > 30
                      ? "التجديد غير متاح حالياً"
                      : activeVerification ||
                          latestVerification?.status === "approved"
                        ? "طلب تجديد التوثيق"
                        : "إرسال طلب التوثيق"}
                </button>
              </div>
            )}

            <p className="text-center text-[10px] leading-5 text-slate-400">
              التوثيق هو شارة اعتماد داخل منصة Sooq.Sy بعد مراجعة الإدارة،
              ولا يُعد بحد ذاته إثباتاً قانونياً للهوية.
            </p>
          </div>
        </section>

        {/* دعوة الأصدقاء */}
        <section className={`${sectionClass} mb-2`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Gift size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">
                دعوة الأصدقاء
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
                شارك رابط دعوتك واكسب النقاط
              </p>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
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
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95"
            >
              <Copy size={14} />
              نسخ
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            ادعُ أصدقاءك للتسجيل باستخدام رابطك، واحصل على 10 نقاط عند إنشاء
            كل صديق لحسابه بنجاح.
          </p>
        </section>

        {/* المحافظة والمدينة */}
        <section className={`${sectionClass} mb-2`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <MapPin size={17} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">
                المحافظة والمدينة
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
                حدد موقعك لعرض الإعلانات المناسبة
              </p>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
            المحافظة
          </label>
          <select
            value={selectedGovernorate}
            onChange={(e) => {
              setSelectedGovernorate(e.target.value);
              setSelectedCity("");
            }}
            className={`${inputClass} mb-3`}
          >
            <option value="">اختر المحافظة</option>
            {governorates.map((governorate) => (
              <option key={governorate.id} value={String(governorate.id)}>
                {governorate.name_ar}
              </option>
            ))}
          </select>

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
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
            className={`${buttonClass} mt-3`}
          >
            <Save size={14} />
            {savingLocation ? "جارٍ الحفظ..." : "حفظ الموقع"}
          </button>
        </section>

        {/* رقم الموبايل */}
        <section className={`${sectionClass} mb-2`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Phone size={17} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">
                رقم الموبايل
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
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
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            className={`${inputClass} text-left`}
            placeholder="09XXXXXXXX"
          />

          <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-[10px] leading-5 text-amber-800">
            تغيير الرقم سيغيّر أيضاً الرقم المستخدم لتسجيل الدخول.
          </div>

          <button
            type="button"
            onClick={savePhone}
            disabled={savingPhone}
            className={`${buttonClass} mt-3`}
          >
            <Save size={14} />
            {savingPhone ? "جارٍ التحديث..." : "تحديث رقم الموبايل"}
          </button>
        </section>

        {/* تغيير كلمة المرور */}
        <section className={sectionClass}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <LockKeyhole size={17} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">
                تغيير كلمة المرور
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
                حافظ على أمان حسابك
              </p>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
            كلمة المرور الجديدة
          </label>
          <input
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputClass} mb-3`}
            placeholder="أدخل كلمة المرور الجديدة"
          />

          <label className="mb-1.5 block text-xs font-bold text-slate-600">
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
            className={`${buttonClass} mt-3`}
          >
            <LockKeyhole size={14} />
            {savingPassword ? "جارٍ التحديث..." : "تغيير كلمة المرور"}
          </button>
        </section>

        <p className="mt-4 text-center text-[10px] text-slate-400">
          Sooq Sy · حسابك بأمان
        </p>
      </div>

      {/* نافذة قائمة المتابعين ومن أتابع */}
      {followListType && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3"
          onClick={() => {
            if (!followListLoading) setFollowListType(null);
          }}
        >
          <div
            dir="rtl"
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                {followListType === "followers" ? (
                  <Users size={19} className="text-emerald-700" />
                ) : (
                  <UserCheck size={19} className="text-blue-700" />
                )}

                <h2 className="text-base font-black text-slate-800">
                  {followListType === "followers"
                    ? `المتابعون (${followersCount})`
                    : `أتابع (${followingCount})`}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setFollowListType(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {followListLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <LoaderCircle
                    size={28}
                    className="animate-spin text-emerald-600"
                  />
                  <p className="text-xs text-slate-500">
                    جارٍ تحميل القائمة...
                  </p>
                </div>
              ) : followList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                  {followListType === "followers" ? (
                    <Users size={34} />
                  ) : (
                    <UserCheck size={34} />
                  )}
                  <p className="text-sm font-bold">
                    {followListType === "followers"
                      ? "لا يوجد متابعون حتى الآن"
                      : "لا تتابع أي شخص حالياً"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {followList.map((person) => (
                    <button
                      key={person.user_id}
                      type="button"
                      onClick={() => {
                        setFollowListType(null);
                        navigate(`/user/${person.user_id}`);
                      }}
                      className="flex w-full items-center gap-3 p-3 text-right transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt={person.display_name || "مستخدم"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <UserRound size={22} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {person.display_name || "مستخدم"}
                        </p>
                        {person.followed_at && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            {followListType === "followers"
                              ? "يتابعك منذ "
                              : "تتابعه منذ "}
                            {new Date(
                              person.followed_at
                            ).toLocaleDateString("ar-SY")}
                          </p>
                        )}
                      </div>

                      <ArrowRight
                        size={16}
                        className="shrink-0 text-slate-400"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}