
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/";

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [governorates, setGovernorates] = useState<any[]>([]);
const [cities, setCities] = useState<any[]>([]);
const [selectedGovernorate, setSelectedGovernorate] = useState("");
const [selectedCity, setSelectedCity] = useState("");
const [locationsLoading, setLocationsLoading] = useState(false);
const [referralCode, setReferralCode] = useState("");

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const ref = params.get("ref");

  if (ref) {
    setReferralCode(ref.toUpperCase().trim());
    setIsRegister(true);
  }
}, [location.search]);

useEffect(() => {
  if (!isRegister) return;

  async function loadLocations() {
    setLocationsLoading(true);

    try {
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
    } catch (err) {
      setError("تعذر تحميل المحافظات والمدن. حاول مرة أخرى.");
    } finally {
      setLocationsLoading(false);
    }
  }



  loadLocations();
}, [isRegister]);

  // تحويل رقم الموبايل إلى بريد داخلي ثابت لا يظهر للمستخدم
  function getInternalEmail(cleanPhone: string) {
    return `phone.${cleanPhone}@login.sooq.sy`;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const cleanPhone = phone.trim();
      const internalEmail = getInternalEmail(cleanPhone);
      if (!/^09\d{8}$/.test(cleanPhone)) {
        throw new Error(
          "رقم الموبايل يجب أن يبدأ بـ 09 ويتكون من 10 أرقام."
        );
      }

      if (password.length < 6) {
        throw new Error("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
      }

if (isRegister) {
  if (!name.trim()) {
    throw new Error("يرجى إدخال الاسم.");
  }

  if (!selectedGovernorate || !selectedCity) {
    throw new Error("يرجى اختيار المحافظة والمدينة.");
  }

  const cityExists = cities.some(
    (city) =>
      String(city.id) === selectedCity &&
      String(city.governorate_id) === selectedGovernorate
  );

  if (!cityExists) {
    throw new Error("المدينة المختارة غير صحيحة.");
  }

  if (password !== confirmPassword) {
    throw new Error("كلمتا المرور غير متطابقتين.");
  }

  const cleanReferralCode = referralCode.trim().toUpperCase();

if (cleanReferralCode) {
  const { data: isReferralValid, error: referralError } =
    await supabase.rpc("validate_referral_code", {
      p_code: cleanReferralCode,
    });

  if (referralError) {
    throw new Error("تعذر التحقق من رمز الإحالة. حاول مرة أخرى.");
  }

  if (!isReferralValid) {
    throw new Error("رمز الإحالة غير صحيح، يرجى التأكد منه.");
  }
}

        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
data: {
  display_name: name.trim(),
  phone: cleanPhone,
  city_id: selectedCity,
  referral_code: referralCode.trim().toUpperCase(),
},
          },
        });

        if (error) {
          if (
            error.message.toLowerCase().includes("duplicate") ||
            error.message.toLowerCase().includes("unique")
          ) {
            throw new Error("رقم الموبايل مستخدم مسبقاً.");
          }

          throw error;
        }

        if (data.session) {
          navigate("/", { replace: true });
        } else {
          setMessage(
            "تم إرسال طلب إنشاء الحساب. تحقق من إعدادات Supabase إذا لم يتم تسجيل الدخول تلقائياً."
          );
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: internalEmail,
            password,
          });

        if (error || !data.user) {
          throw new Error("رقم الموبايل أو كلمة المرور غير صحيحة.");
        }

        // التحقق من حالة الحظر
        const { data: isBanned, error: banCheckError } =
          await supabase.rpc("is_current_user_banned");

        if (banCheckError) {
          await supabase.auth.signOut();
          throw new Error(
            "تعذر التحقق من حالة الحساب. حاول مرة أخرى."
          );
        }

        if (isBanned) {
          await supabase.auth.signOut();
          throw new Error(
            "هذا الحساب محظور حالياً، يرجى التواصل مع الإدارة."
          );
        }

        // التحقق من صلاحية المدير
        const { data: isAdmin, error: adminCheckError } =
          await supabase.rpc("is_admin");

        if (adminCheckError) {
          await supabase.auth.signOut();
          throw new Error(
            "تعذر التحقق من صلاحيات الحساب. حاول مرة أخرى."
          );
        }

        // المدير ينتقل دائماً إلى لوحة الإدارة
        if (isAdmin) {
          navigate("/admin", { replace: true });
        } else {
          navigate(redirectTo, { replace: true });
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ، حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }


return (
  <main
    dir="rtl"
    className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-slate-100 px-4 py-8 sm:py-12"
  >
    {/* خلفية جمالية */}
    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-200/30 blur-3xl" />

    <div className="relative w-full max-w-md">

      {/* الشعار */}
      <div className="mb-6 text-center">
        <Link
          to="/"
          className="inline-flex flex-col items-center"
        >
<div className="h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-lg shadow-emerald-600/20 ring-1 ring-emerald-100">
  <img
    src="/favicon.png"
    alt="شعار سوق سوريا"
    className="h-full w-full object-cover"
  />
</div>
          <span className="mt-3 text-2xl font-black tracking-wide text-emerald-800">
            Sooq.Sy
          </span>
        </Link>
        <p className="mt-1 text-xs font-medium text-slate-500">
          السوق السوري للإعلانات المبوبة
        </p>
      </div>

      {/* البطاقة الرئيسية */}
      <div className="rounded-[28px] border border-white bg-white/95 p-5 shadow-xl shadow-slate-200/60 sm:p-8">

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
            {isRegister ? "✨" : "👋"}
          </div>

          <h1 className="text-2xl font-black text-slate-800">
            {isRegister ? "إنشاء حساب جديد" : "أهلاً بعودتك"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {isRegister
              ? "أنشئ حسابك وابدأ رحلتك في سوق سوريا"
              : "سجّل دخولك وتابع إعلاناتك بسهولة"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {isRegister && (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                الاسم
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسمك"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
          )}

          {isRegister && (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                رمز الإحالة <span className="font-normal text-slate-400">(اختياري)</span>
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) =>
                  setReferralCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                }
                placeholder="أدخل رمز الدعوة"
                maxLength={8}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left uppercase outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                dir="ltr"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                إذا دعاك أحد أصدقائك، أدخل رمز الإحالة الخاص به.
              </p>
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  المحافظة
                </label>
                <select
                  required
                  value={selectedGovernorate}
                  onChange={(e) => {
                    setSelectedGovernorate(e.target.value);
                    setSelectedCity("");
                  }}
                  disabled={locationsLoading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100"
                >
                  <option value="">
                    {locationsLoading ? "جارٍ تحميل المحافظات..." : "اختر المحافظة"}
                  </option>
                  {governorates.map((governorate) => (
                    <option key={governorate.id} value={String(governorate.id)}>
                      {governorate.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  المدينة
                </label>
                <select
                  required
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={!selectedGovernorate || locationsLoading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100"
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
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              رقم الموبايل
            </label>
            <input
              type="tel"
              required
              maxLength={10}
              inputMode="numeric"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="09XXXXXXXX"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              dir="ltr"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              أدخل رقمك المؤلف من 10 أرقام ويبدأ بـ 09
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ستة أحرف على الأقل"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 pl-12 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-emerald-700"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 pl-12 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-emerald-700"
                  aria-label={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-l from-emerald-700 to-emerald-500 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "يرجى الانتظار..."
              : isRegister
                ? "إنشاء الحساب"
                : "تسجيل الدخول"}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
          {isRegister ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
              setMessage("");
              setPassword("");
              setConfirmPassword("");
            }}
            className="mr-2 font-black text-emerald-700 transition hover:text-emerald-900 hover:underline"
          >
            {isRegister ? "تسجيل الدخول" : "إنشاء حساب"}
          </button>
        </div>
      </div>

      <Link
        to="/"
        className="mt-6 block text-center text-sm font-semibold text-slate-400 transition hover:text-emerald-700"
      >
        ← العودة إلى الصفحة الرئيسية
      </Link>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} Sooq.Sy
      </p>
    </div>
  </main>
);

}
