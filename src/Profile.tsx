
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
} from "lucide-react";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [governorates, setGovernorates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);
    const [selectedGovernorate, setSelectedGovernorate] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [savingLocation, setSavingLocation] = useState(false);

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

      setName(profile.display_name || "");
      setPhone(privateProfile.phone || "");
      await loadLocations(profile.city_id ?? null);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-8"
    >
      <div className="mx-auto max-w-2xl">

        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 font-bold text-slate-600 hover:text-emerald-700"
        >
          <ArrowRight size={20} />
          العودة إلى السوق
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-800">
            الملف الشخصي
          </h1>
          <p className="mt-2 text-slate-500">
            إدارة بيانات حسابك وإعدادات الأمان.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-5">

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <UserRound className="text-emerald-600" size={23} />
              <h2 className="text-xl font-bold text-slate-800">
                المعلومات الشخصية
              </h2>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-600">
              الاسم
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              placeholder="اسم المستخدم"
            />

            <button
              type="button"
              onClick={saveName}
              disabled={savingName}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={18} />
              {savingName ? "جارٍ الحفظ..." : "حفظ الاسم"}
            </button>
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-800">
                المحافظة والمدينة
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                حدد مكان إقامتك لعرض الإعلانات المناسبة لمنطقتك.
              </p>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-600">
              المحافظة
            </label>

            <select
              value={selectedGovernorate}
              onChange={(e) => {
                setSelectedGovernorate(e.target.value);
                setSelectedCity("");
              }}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
            >
              <option value="">اختر المحافظة</option>
              {governorates.map((governorate) => (
                <option key={governorate.id} value={String(governorate.id)}>
                  {governorate.name_ar}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-semibold text-slate-600">
              المدينة
            </label>

            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedGovernorate}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 disabled:bg-slate-100"
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
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={18} />
              {savingLocation ? "جارٍ الحفظ..." : "حفظ الموقع"}
            </button>
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <Phone className="text-emerald-600" size={23} />
              <h2 className="text-xl font-bold text-slate-800">
                رقم الموبايل
              </h2>
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
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-emerald-500"
              placeholder="09XXXXXXXX"
            />

            <p className="mt-2 text-xs text-slate-400">
              تغيير الرقم سيغيّر أيضاً الرقم المستخدم لتسجيل الدخول.
            </p>

            <button
              type="button"
              onClick={savePhone}
              disabled={savingPhone}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={18} />
              {savingPhone ? "جارٍ التحديث..." : "تحديث رقم الموبايل"}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <LockKeyhole className="text-emerald-600" size={23} />
              <h2 className="text-xl font-bold text-slate-800">
                تغيير كلمة المرور
              </h2>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-600">
              كلمة المرور الجديدة
            </label>

            <input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              placeholder="أدخل كلمة المرور الجديدة"
            />

            <label className="mb-2 block text-sm font-semibold text-slate-600">
              تأكيد كلمة المرور
            </label>

            <input
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              placeholder="أعد إدخال كلمة المرور"
            />

            <button
              type="button"
              onClick={savePassword}
              disabled={savingPassword}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={18} />
              {savingPassword ? "جارٍ التحديث..." : "تغيير كلمة المرور"}
            </button>
          </section>

        </div>
      </div>
    </main>
  );
}
