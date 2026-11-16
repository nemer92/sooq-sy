
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type Package = {
  number: number;
  name: string;
  price: number;
  duration_months: number;
  ordinary_ads_limit: number;
  featured_ads_limit: number;
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
          .select("id, name, price_usd, duration_months, ordinary_ads_limit, featured_ads_limit")

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
          ordinary_ads_limit: plan.ordinary_ads_limit,
featured_ads_limit: plan.featured_ads_limit,
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
{!subscriptionsEnabled && (
  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5 text-center">
    <h2 className="text-lg font-black text-emerald-800">
      أهلاً وسهلاً بكم في Sooq.Sy 🌿
    </h2>
    <p className="mt-3 text-sm leading-8 text-slate-700">
      جميع خدمات الموقع متاحة حالياً بشكل مجاني، ويمكنكم نشر إعلاناتكم والاستفادة من خدماتنا دون الحاجة إلى الاشتراك.
      نعمل على تجهيز باقات الاشتراك بمزايا إضافية، وسيتم تفعيلها قريباً بإذن الله.
      شكراً لثقتكم، ونتمنى لكم تجربة ممتعة ومفيدة معنا.
    </p>
  </div>
)}

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
className={`rounded-2xl border-2 p-4 text-right transition-all ${
  selectedPackage?.number === item.number
    ? "border-emerald-600 bg-emerald-50 shadow-md"
    : "border-slate-200 bg-white hover:border-emerald-300"
}`}
>
  <span className="font-black text-slate-800">{item.name}</span>

  <p className="mt-2 text-sm text-slate-500">
    مدة الاشتراك: {item.duration_months} شهر
  </p>

  <div className="mt-4 space-y-2 text-sm">
    <p className="flex justify-between">
      <span>الإعلانات العادية</span>
      <strong>{item.ordinary_ads_limit} إعلان</strong>
    </p>

    <p className="flex justify-between">
      <span>الإعلانات المميزة</span>
      <strong className="text-amber-600">
        {item.featured_ads_limit} إعلان
      </strong>
    </p>
  </div>

  <p className="mt-4 text-2xl font-black text-emerald-700">
    ${item.price}
  </p>

  {selectedPackage?.number === item.number && (
    <p className="mt-2 text-center text-sm font-bold text-emerald-700">
      <CheckCircle2 size={16} className="inline ml-1" /> تم اختيار هذه الباقة
    </p>
  )}
              </button>
            ))}
          </div>
        )}
      </section>

{selectedPackage && (
  <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
    <div className="border-b border-slate-100 pb-4">
      <p className="text-sm font-medium text-emerald-700">
        تفاصيل الباقة المختارة
      </p>

      <h2 className="mt-2 text-xl font-black text-slate-800">
        {selectedPackage.name}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-3xl font-black text-emerald-700">
          ${selectedPackage.price}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          {selectedPackage.duration_months} شهر
        </span>
      </div>
    </div>

    <div className="mt-5">
      <h3 className="font-bold text-slate-800">
        ماذا ستحصل عند الاشتراك؟
      </h3>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-bold text-slate-800">
              نشر الإعلانات
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              إمكانية نشر حتى {selectedPackage.ordinary_ads_limit} إعلان بيع خلال مدة الاشتراك، لتعرض منتجاتك وخدماتك على زوار الموقع.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-bold text-slate-800">
              تمييز الإعلانات
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              {selectedPackage.featured_ads_limit > 0
                ? `إمكانية تمييز حتى ${selectedPackage.featured_ads_limit} إعلاناً من رصيد الباقة، لتظهر إعلاناتك بشكل مميز داخل الموقع.`
                : "هذه الباقة لا تتضمن رصيداً لتمييز الإعلانات. يمكنك اختيار باقة أعلى للاستفادة من هذه الميزة."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-bold text-slate-800">
              إدارة إعلاناتك
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              يمكنك متابعة إعلاناتك وإدارتها من حسابك، والاستفادة من رصيد الباقة طوال فترة الاشتراك.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-bold text-amber-900">
        حملات التمييز والإشعارات للمحافظات
      </h3>
      <p className="mt-2 text-sm leading-7 text-amber-900">
        تمييز الإعلانات الممنوح ضمن الاشتراك يختلف عن الحملات الترويجية المدفوعة.
        يمكنك طلب حملة مستقلة، واختيار المحافظات التي تريد استهدافها،
        لتصل إشعارات الحملة إلى المستخدمين المستهدفين، وتستمر الحملة لمدة 10 أيام.
        هذه الخدمة ليست ضمن رصيد تمييز الاشتراك، وتُطلب بشكل منفصل.
      </p>
    </div>

    <div className="mt-5 rounded-xl bg-slate-50 p-4">
      <h3 className="font-bold text-slate-800">
        المبلغ المطلوب للتحويل
      </h3>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-slate-600">قيمة الاشتراك</span>
        <strong className="text-lg">${selectedPackage.price}</strong>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-slate-600">المبلغ بالليرة السورية</span>
        <strong className="text-lg text-emerald-700">
          {amountSyp.toLocaleString("en-US")} ل.س
        </strong>
      </div>
    </div>

    <div className="mt-4 text-xs leading-7 text-slate-500">
      <p>• الإعلانات تُخصم من الرصيد بعد موافقة الإدارة.</p>
      <p>• الإعلانات المميزة تُحتسب من رصيد الإعلانات الإجمالي، وليست رصيداً إضافياً فوقه.</p>
      <p>• التبرعات لا تُحتسب من رصيد إعلانات البيع.</p>
      <p>• حذف إعلان تمت الموافقة عليه لا يعيد الرصيد المستهلك.</p>
    </div>
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
              disabled={!selectedPackage || submitting || !subscriptionsEnabled}
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

</div>
    </main>
  );
}
