
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, MapPin } from "lucide-react";

type Ad = {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
};

type Governorate = {
  id: number;
  name_ar: string;
};

const campaignPrices: Record<number, number> = {
  1: 3,
  2: 5,
  3: 7,
  4: 8,
  5: 9,
  6: 10,
  7: 11,
  8: 12,
  9: 13,
  10: 14,
  14: 15,
};

export default function FeaturedCampaign() {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ad, setAd] = useState<Ad | null>(null);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorates, setSelectedGovernorates] = useState<number[]>([]);

  const [phone, setPhone] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [exchangeRate, setExchangeRate] = useState(0);
  async function submitCampaignRequest() {
  if (!ad) return;

  if (
    selectedCount < 1 ||
    (selectedCount > 10 && selectedCount !== 14)
  ) {
    alert("اختر من محافظة واحدة إلى 10 محافظات، أو جميع المحافظات الـ14.");
    return;
  }

  if (!qrUrl) {
    alert("رمز الدفع غير متوفر حالياً. يرجى التواصل مع الإدارة.");
    return;
  }

  setSubmitting(true);

  try {
    const { data, error } = await supabase.rpc(
      "create_featured_campaign_request",
      {
        p_ad_id: ad.id,
        p_governorate_ids: selectedGovernorates,
      }
    );

    if (error) throw error;

    setRequestId(data || "");
    alert("تم إنشاء طلب الحملة بنجاح. يرجى انتظار مراجعة الإدارة.");

  } catch (err) {
    console.error("خطأ إنشاء طلب الحملة:", err);

    alert(
      err instanceof Error
        ? err.message
        : "تعذر إنشاء طلب الحملة. حاول مرة أخرى."
    );
  } finally {
    setSubmitting(false);
  }
}
const [submitting, setSubmitting] = useState(false);
const [requestId, setRequestId] = useState("");


  useEffect(() => {
    async function loadCampaignData() {
      setLoading(true);
      setError("");

      try {
        if (!adId) {
          throw new Error("معرّف الإعلان غير صالح.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth", {
            state: { from: `/featured-campaign/${adId}` },
          });
          return;
        }

        const { data: adData, error: adError } = await supabase
          .from("ads")
          .select("id, title, status, published_at")
          .eq("id", adId)
          .eq("user_id", user.id)
          .single();

        if (adError) throw adError;

        if (
          adData.status !== "approved" ||
          !adData.published_at
        ) {
          throw new Error("يمكن تمييز الإعلانات المقبولة والمنشورة فقط.");
        }

        const [
          { data: governoratesData, error: governoratesError },
          { data: profileData, error: profileError },
          { data: settingsData, error: settingsError },
        ] = await Promise.all([
          supabase
            .from("governorates")
            .select("id, name_ar")
            .eq("is_active", true)
            .order("id"),

          supabase
            .from("private_profiles")
            .select("phone")
            .eq("user_id", user.id)
            .single(),

          supabase
            .from("site_settings")
            .select("sham_cash_qr_url, usd_syp_rate")
            .eq("id", 1)
            .single(),
        ]);

        if (governoratesError) throw governoratesError;
        if (profileError) throw profileError;
        if (settingsError) throw settingsError;

        if (!profileData.phone || !/^09[0-9]{8}$/.test(profileData.phone)) {
          throw new Error("رقم الهاتف المسجل في حسابك غير صالح.");
        }

        if (!settingsData.usd_syp_rate || settingsData.usd_syp_rate <= 0) {
          throw new Error("سعر الصرف غير متوفر حالياً.");
        }

        setAd(adData);
        setGovernorates(governoratesData ?? []);
        setPhone(profileData.phone);
        setQrUrl(settingsData.sham_cash_qr_url ?? "");
        setExchangeRate(Number(settingsData.usd_syp_rate));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "تعذر تحميل بيانات الحملة."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCampaignData();
  }, [adId, navigate]);

function toggleGovernorate(id: number) {
  setSelectedGovernorates((previous) => {
    if (previous.includes(id)) {
      return previous.filter((item) => item !== id);
    }

    // السماح باختيار 10 محافظات كحد أقصى
    if (previous.length >= 10) {
      alert("يمكنك اختيار 10 محافظات كحد أقصى، أو تحديد المحافظات الـ14 جميعها.");
      return previous;
    }

    return [...previous, id];
  });
}
  const selectedCount = selectedGovernorates.length;
  const amountUsd = campaignPrices[selectedCount] ?? 0;
  const amountSyp = Math.floor(amountUsd * exchangeRate);

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8">
        <p className="text-center text-slate-500">
          جارٍ تحميل بيانات الحملة...
        </p>
      </main>
    );
  }

  if (error || !ad) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-5">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center">
          <p className="text-red-600">
            {error || "تعذر العثور على الإعلان."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/my-ads")}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"
          >
            العودة إلى إعلاناتي
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
            onClick={() => navigate("/my-ads")}
            className="text-emerald-700"
          >
            <ArrowRight size={22} />
          </button>

          <h1 className="text-xl font-black text-slate-800">
            تمييز الإعلان
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-7">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold text-slate-800">
            الإعلان المراد تمييزه
          </h2>

          <p className="mt-3 text-lg font-black text-emerald-700">
            {ad.title}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            مدة الحملة 10 أيام.
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <MapPin size={19} />
            اختر المحافظات المستهدفة
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            يمكنك اختيار محافظة واحدة إلى 10 محافظات، أو جميع المحافظات الـ14.
          </p>

          <button
  type="button"
  onClick={() => {
    if (selectedGovernorates.length === 14) {
      setSelectedGovernorates([]);
    } else {
      setSelectedGovernorates(governorates.map((item) => item.id));
    }
  }}
  className={`mb-3 w-full rounded-xl border p-3 text-sm font-bold ${
    selectedGovernorates.length === 14
      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
      : "border-slate-200 bg-slate-50 text-slate-700"
  }`}
>
  {selectedGovernorates.length === 14
    ? "إلغاء تحديد جميع المحافظات"
    : "تحديد جميع المحافظات الـ14 — 15 دولار"}
</button>

<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {governorates.map((governorate) => {
              const checked = selectedGovernorates.includes(governorate.id);

              return (
                <label
                  key={governorate.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium ${
                    checked
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGovernorate(governorate.id)}
                    className="h-4 w-4 accent-emerald-600"
                  />

                  {governorate.name_ar}
                </label>
              );
            })}
          </div>

          <p className="mt-4 text-sm text-slate-500">
            المحافظات المختارة: {selectedCount}
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold text-slate-800">
            ملخص تكلفة الحملة
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">عدد المحافظات</span>
              <strong>{selectedCount}</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">مدة الحملة</span>
              <strong>10 أيام</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">السعر بالدولار</span>
              <strong>{amountUsd ? `$${amountUsd}` : "—"}</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">السعر بالليرة السورية</span>
              <strong>
                {amountSyp
                  ? `${amountSyp.toLocaleString("en-US")} ل.س`
                  : "—"}
              </strong>
            </div>

            <p className="border-t pt-3 text-xs text-slate-400">
              سعر الصرف: {exchangeRate.toLocaleString("en-US")} ليرة لكل دولار
            </p>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold text-slate-800">
            بيانات الدفع عبر شام كاش
          </h2>

          {qrUrl ? (
            <img
              src={qrUrl}
              alt="رمز الدفع عبر شام كاش"
              className="mx-auto mt-4 max-h-64 max-w-full rounded-xl border p-2 object-contain"
            />
          ) : (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              رمز الدفع غير متوفر حالياً. يرجى التواصل مع الإدارة.
            </p>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              رقم الهاتف المسجل في حسابك
            </p>

            <p className="mt-1 text-lg font-black text-slate-800" dir="ltr">
              {phone}
            </p>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            عند تحويل المبلغ، اكتب رقم هاتفك
            المسجل في Sooq.Sy ضمن ملاحظة الحوالة، ثم اسم الحملة.
          </p>
          {requestId ? (
  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
    <p className="font-bold text-emerald-800">
      تم إرسال طلب الحملة بنجاح
    </p>
    <p className="mt-2 text-sm text-slate-600">
      رقم الطلب: 
    </p>
    <p className="mt-1 break-all text-xs text-slate-500" dir="ltr">
      {requestId}
    </p>
    <p className="mt-3 text-sm text-slate-600">
      طلبك بانتظار مراجعة الإدارة وتأكيد الدفع.
    </p>
  </div>
) : (
  <button
    type="button"
    onClick={submitCampaignRequest}
    disabled={
      submitting ||
      !amountUsd ||
      !qrUrl ||
      selectedCount === 0
    }
    className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {submitting ? "جارٍ إرسال الطلب..." : "أكملت التحويل، إرسال طلب الحملة"}
  </button>
)}
        </section>
      </div>
    </main>
  );
}
