
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/";
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: name.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          navigate(redirectTo, { replace: true });
        } else {
          setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد التسجيل.");
        }
      } else {
const { error } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

if (error) {
  if (error.message.toLowerCase().includes("banned")) {
    throw new Error("هذا الحساب محظور حالياً، يرجى التواصل مع الإدارة.");
  }

  throw error;
}

// التحقق من حالة الحظر
const { data: isBanned, error: banCheckError } =
  await supabase.rpc("is_current_user_banned");

if (banCheckError) {
  await supabase.auth.signOut();
  throw new Error("تعذر التحقق من حالة الحساب. حاول مرة أخرى.");
}

if (isBanned) {
  await supabase.auth.signOut();
  throw new Error("هذا الحساب محظور حالياً، يرجى التواصل مع الإدارة.");
}

navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ، حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
        <Link to="/" className="mb-8 block text-center text-3xl font-black text-emerald-700">
          Sooq.sy
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
              البريد الإلكتروني
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              كلمة المرور
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ستة أحرف على الأقل"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

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
            }}
            className="mr-2 font-bold text-emerald-700 hover:underline"
          >
            {isRegister ? "تسجيل الدخول" : "إنشاء حساب"}
          </button>
        </div>

        <Link to="/" className="mt-6 block text-center text-sm text-slate-400 hover:text-emerald-700">
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </main>
  );
}
