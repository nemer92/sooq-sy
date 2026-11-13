
import { useState } from "react";
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

      if (!/^09\d{8}$/.test(cleanPhone)) {
        throw new Error(
          "رقم الموبايل يجب أن يبدأ بـ 09 ويتكون من 10 أرقام."
        );
      }

      if (password.length < 6) {
        throw new Error("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
      }

      const internalEmail = getInternalEmail(cleanPhone);

      if (isRegister) {
        if (!name.trim()) {
          throw new Error("يرجى إدخال الاسم.");
        }

        if (password !== confirmPassword) {
          throw new Error("كلمتا المرور غير متطابقتين.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            data: {
              display_name: name.trim(),
              phone: cleanPhone,
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
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
        <Link
          to="/"
          className="mb-8 block text-center text-3xl font-black text-emerald-700"
        >
          Sooq.Sy
        </Link>

        <h1 className="mb-2 text-center text-2xl font-black text-slate-800">
          {isRegister ? "إنشاء حساب جديد" : "تسجيل الدخول"}
        </h1>

        <p className="mb-7 text-center text-sm text-slate-500">
          {isRegister
            ? "أنشئ حسابك وابدأ بنشر إعلاناتك"
            : "سجّل دخولك للمتابعة إلى سوق سوريا"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                الاسم
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسمك"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
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
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-emerald-500"
              dir="ltr"
            />
            <p className="mt-1 text-xs text-slate-400">
              أدخل رقمك المؤلف من 10 أرقام ويبدأ بـ 09
            </p>
          </div>

<div>
  <label className="mb-2 block text-sm font-semibold text-slate-700">
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
      className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-12 outline-none focus:border-emerald-500"
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700"
      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
    >
      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>
</div>

          {isRegister && (
<div>
  <label className="mb-2 block text-sm font-semibold text-slate-700">
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
      className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-12 outline-none focus:border-emerald-500"
    />

    <button
      type="button"
      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700"
      aria-label={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
    >
      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>
</div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading
              ? "يرجى الانتظار..."
              : isRegister
                ? "إنشاء الحساب"
                : "تسجيل الدخول"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
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
            className="mr-2 font-bold text-emerald-700 hover:underline"
          >
            {isRegister ? "تسجيل الدخول" : "إنشاء حساب"}
          </button>
        </div>

        <Link
          to="/"
          className="mt-6 block text-center text-sm text-slate-400 hover:text-emerald-700"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </main>
  );
}
