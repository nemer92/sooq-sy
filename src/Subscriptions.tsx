
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight } from "lucide-react";

type Package = {
  number: number;
  name: string;
  price: number;
  duration_months: number;
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

      if (!enabled) {
        return;
      }

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
          .select("id, name, price_usd, duration_months")
          .eq("is_active", true)
          .order("id"),
      ]);

      if (profileError) throw profileError;
      if (plansError) throw plansError;

      if (!profileData.phone || !/^09[0-9]{8}$/.test(profileData.phone)) {
        throw new Error("رقم الهاتف المسجل في حسابك غير صالح.");
      }

      setPhone(profileData.phone);
      setQrUrl(settingsData.sham_cash_qr_url ?? "");
      setExchangeRate(Number(settingsData.usd_syp_rate ?? 0));

      setPackages(
        (plansData ?? []).map((plan) => ({
          number: plan.id,
          name: plan.name,
          price: Number(plan.price_usd),
          duration_months: plan.duration_months,
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
  {!subscriptionsEnabled ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-800">
      <h2 className="font-bold">الاشتراكات غير متاحة حالياً</h2>
      <p className="mt-2 text-sm leading-7">
        سيتم فتح الاشتراكات بعد تفعيلها من الإدارة.
      </p>
    </div>
  ) : (
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {packages.map((item) => (
              <button
                key={item.number}
                type="button"
                onClick={() => setSelectedPackage(item)}
                className="rounded-xl border p-4 text-right"
              >
                <span className="font-bold">{item.name}</span>

                <p className="mt-2 text-sm text-slate-500">
                  مدة الاشتراك: {item.duration_months} شهر
                </p>

                <p className="mt-3 text-2xl font-black text-emerald-700">
                  ${item.price}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
      {selectedPackage && (
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold">تفاصيل المبلغ</h2>

          <p className="mt-3">{selectedPackage.name}</p>

          <p className="mt-2 text-sm text-slate-500">
            مدة الاشتراك: {selectedPackage.duration_months} شهر
          </p>

          <p className="mt-3">${selectedPackage.price}</p>

          <p>{amountSyp.toLocaleString("en-US")} ل.س</p>
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

        <p className="mt-3 text-sm leading-7">
          حوّل المبلغ الموضح أعلاه، واكتب رقم هاتفك المسجل في Sooq.Sy فقط ضمن ملاحظة الحوالة.
        </p>

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
              disabled={!selectedPackage || submitting}
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
  )}
</div>
    </main>
  );
}
