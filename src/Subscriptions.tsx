
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  Store,
  Wallet,
} from "lucide-react";

type Package = {
  number: number;
  name: string;
  price: number;
  duration_months: number;
  ordinary_ads_limit: number;
  featured_ads_limit: number;
};

const pointsFor = (price: number) => Math.round(price * 10);

export default function Subscriptions() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    async function loadSubscriptionData() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth", { state: { from: "/subscriptions" } });
          return;
        }

        const [
          { data: settingsData, error: settingsError },
          { data: plansData, error: plansError },
          { data: walletData, error: walletError },
        ] = await Promise.all([
          supabase
            .from("site_settings")
            .select("subscriptions_enabled")
            .eq("id", 1)
            .single(),
          supabase
            .from("subscription_plans")
            .select(
              "id, name, price_usd, duration_months, ordinary_ads_limit, featured_ads_limit"
            )
            .eq("is_active", true)
            .order("id"),
          supabase
            .from("user_points")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (settingsError) throw settingsError;
        if (plansError) throw plansError;
        if (walletError) throw walletError;

        setSubscriptionsEnabled(Boolean(settingsData.subscriptions_enabled));
        setPointsBalance(Number(walletData?.balance ?? 0));

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
          err instanceof Error ? err.message : "تعذر تحميل بيانات الاشتراك."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSubscriptionData();
  }, [navigate]);

  const submitSubscriptionRequest = async () => {
    if (!selectedPackage || submitting || requestSent) return;

    const requiredPoints = pointsFor(selectedPackage.price);

    if (pointsBalance < requiredPoints) {
      setRequestError(
        `رصيدك غير كافٍ. تحتاج إلى ${requiredPoints} نقطة، ورصيدك الحالي ${pointsBalance} نقطة.`
      );
      return;
    }

    setSubmitting(true);
    setRequestError("");

    try {
      const { data, error } = await supabase.rpc(
        "create_subscription_points_request",
        { p_plan_id: selectedPackage.number }
      );

      if (error) throw error;
      if (!data) throw new Error("لم يتم استلام رقم طلب الاشتراك.");

      setRequestSent(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (user) {
        const { data: walletData } = await supabase
          .from("user_points")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (walletData) setPointsBalance(Number(walletData.balance ?? 0));
      }
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "تعذر إرسال طلب الاشتراك."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-500">
          جارٍ تحميل بيانات الاشتراك...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-5">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white"
          >
            العودة للرئيسية
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f9f8] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="رجوع"
          >
            <ArrowRight size={19} />
          </button>
          <div>
            <h1 className="text-base font-black">باقات الاشتراك</h1>
            <p className="text-[11px] text-slate-500">
              اختر الباقة المناسبة لنشاطك
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-3 py-5 sm:px-5">
        {!subscriptionsEnabled && (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <h2 className="text-sm font-black text-emerald-800">
              أهلاً بكم في Sooq.Sy 🌿
            </h2>
            <p className="mt-1.5 text-xs leading-6 text-slate-600">
              جميع خدمات الموقع متاحة حالياً بشكل مجاني. نعمل على تجهيز باقات
              الاشتراك بمزايا إضافية، وسيتم تفعيلها قريباً بإذن الله.
            </p>
          </section>
        )}

        {/* رصيد النقاط */}
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white p-3.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Wallet size={21} />
            </div>
            <div>
              <p className="text-xs text-slate-500">رصيدك المتاح</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <strong className="text-xl font-black tabular-nums text-slate-800">
                  {pointsBalance.toLocaleString("en-US")}
                </strong>
                <span className="text-xs font-bold text-amber-600">نقطة</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="shrink-0 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
          >
            <Coins size={14} className="ml-1 inline" />
            شحن النقاط
          </button>
        </section>

        {/* الباقات الشخصية */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black">باقات الاشتراك</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                الأسعار محسوبة بالنقاط
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              10 نقاط = 1$
            </span>
          </div>

          {packages.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
              لا توجد باقات متاحة حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {packages.map((item) => {
                const name = item.name.trim();
                const isGold =
                  name.includes("احترافية") || name.includes("احتراف");
                const isSilver =
                  name.includes("متقدمة") || name.includes("متقدم");
                const isSelected = selectedPackage?.number === item.number;

                const style = isGold
                  ? {
                      border: "border-amber-300",
                      background: "bg-amber-50/60",
                      accent: "text-amber-700",
                      icon: "👑",
                      label: "الأكثر تميزاً",
                    }
                  : isSilver
                    ? {
                        border: "border-slate-300",
                        background: "bg-slate-50",
                        accent: "text-slate-700",
                        icon: "✦",
                        label: "اختيار متقدم",
                      }
                    : {
                        border: "border-emerald-200",
                        background: "bg-emerald-50/40",
                        accent: "text-emerald-700",
                        icon: "✓",
                        label: "للبداية",
                      };

                return (
                  <button
                    key={item.number}
                    type="button"
                    onClick={() => {
                      setSelectedPackage(item);
                      setRequestError("");
                      setRequestSent(false);
                    }}
                    className={`relative rounded-xl border p-3 text-right transition ${
                      isSelected
                        ? `${style.border} ${style.background} ring-2 ring-emerald-500/30 shadow-sm`
                        : "border-slate-200 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg">{style.icon}</span>
                      <span className="text-[10px] text-slate-400">
                        {style.label}
                      </span>
                    </div>

                    <h3 className={`mt-1.5 text-sm font-black ${style.accent}`}>
                      {isGold
                        ? "الباقة الذهبية"
                        : isSilver
                          ? "الباقة الفضية"
                          : "الباقة العادية"}
                    </h3>

                    <div className="mt-2 flex items-baseline gap-1">
                      <strong className={`text-xl font-black ${style.accent}`}>
                        {pointsFor(item.price).toLocaleString("en-US")}
                      </strong>
                      <span className="text-[10px] font-bold text-slate-500">
                        نقطة
                      </span>
                    </div>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      ${item.price} · {item.duration_months} شهر
                    </p>

                    <div className="mt-2.5 space-y-1 border-t border-slate-200/70 pt-2 text-[11px] text-slate-600">
                      <div className="flex justify-between gap-2">
                        <span>إعلانات عادية</span>
                        <strong>{item.ordinary_ads_limit}</strong>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>إعلانات مميزة</span>
                        <strong>{item.featured_ads_limit}</strong>
                      </div>
                    </div>

                    <div
                      className={`mt-2.5 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold ${
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                      {isSelected ? "تم الاختيار" : "اختيار الباقة"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* تفاصيل الباقة المختارة */}
        {selectedPackage && (
          <section className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] text-emerald-700">الباقة المختارة</p>
                <h2 className="mt-0.5 text-base font-black">
                  {selectedPackage.name}
                </h2>
              </div>
              <div className="text-left">
                <strong className="block text-xl font-black text-emerald-700">
                  {pointsFor(selectedPackage.price).toLocaleString("en-US")}
                </strong>
                <span className="text-[10px] text-slate-500">نقطة</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-[10px] text-slate-500">مدة الاشتراك</p>
                <strong className="mt-1 block text-sm">
                  {selectedPackage.duration_months} شهر
                </strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-[10px] text-slate-500">القيمة بالدولار</p>
                <strong className="mt-1 block text-sm">
                  ${selectedPackage.price}
                </strong>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-black">مزايا اشتراكك</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  `نشر حتى ${selectedPackage.ordinary_ads_limit} إعلان عادي`,
                  `تمييز حتى ${selectedPackage.featured_ads_limit} إعلان`,
                  "إدارة إعلاناتك طوال مدة الاشتراك",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 rounded-lg bg-emerald-50/70 p-2.5 text-[11px] text-slate-700"
                  >
                    <CheckCircle2
                      size={15}
                      className="shrink-0 text-emerald-600"
                    />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <h3 className="text-xs font-black text-amber-900">
                تنويه حول خدمات التمييز
              </h3>
              <p className="mt-1 text-[11px] leading-6 text-amber-900/80">
                حملات التمييز الموجهة للمحافظات خدمة مستقلة عن رصيد تمييز
                الاشتراك، وتُطلب بشكل منفصل وتستمر لمدة 10 أيام مع إمكانية
                استهداف المحافظات وإرسال الإشعارات.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <h3 className="mb-2 text-xs font-black">ملخص النقاط</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">النقاط المطلوبة</span>
                  <strong>
                    {pointsFor(selectedPackage.price).toLocaleString("en-US")}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">رصيدك الحالي</span>
                  <strong>{pointsBalance.toLocaleString("en-US")}</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-bold text-slate-700">
                    الرصيد بعد الطلب
                  </span>
                  <strong className="text-emerald-700">
                    {Math.max(
                      0,
                      pointsBalance - pointsFor(selectedPackage.price)
                    ).toLocaleString("en-US")}
                  </strong>
                </div>
              </div>

              {pointsBalance < pointsFor(selectedPackage.price) && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-bold text-red-700">
                  رصيدك لا يكفي لهذه الباقة. يرجى شحن النقاط أولاً.
                </p>
              )}
            </div>

            <div className="space-y-1 text-[10px] leading-5 text-slate-500">
              <p>• يتم خصم النقاط عند إرسال الطلب.</p>
              <p>• يبدأ الاشتراك بعد موافقة الإدارة.</p>
              <p>• عند رفض الطلب، تتم إعادة النقاط إلى رصيدك.</p>
              <p>• الإعلانات المميزة تُحتسب من رصيد الإعلانات الإجمالي.</p>
              <p>• حذف إعلان تمت الموافقة عليه لا يعيد الرصيد المستهلك.</p>
            </div>
          </section>
        )}

        {/* اشتراك المتاجر */}
        <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 bg-gradient-to-l from-emerald-800 to-emerald-700 px-4 py-3.5 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Store size={22} />
            </div>
            <div>
              <h2 className="text-sm font-black">اشتراك المتاجر</h2>
              <p className="mt-0.5 text-[10px] text-emerald-100">
                باقة متكاملة لأصحاب المتاجر
              </p>
            </div>
            <div className="mr-auto text-left">
              <strong className="block text-xl font-black">200</strong>
              <span className="text-[10px] text-emerald-100">نقطة</span>
            </div>
          </div>

          <div className="p-3.5">
            <p className="text-xs leading-6 text-slate-600">
              افتح متجرك الخاص على Sooq.Sy واعرض منتجاتك في صفحة متجرك وفي
              الأقسام الرئيسية للسوق أيضاً.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <strong className="block text-xl font-black text-emerald-700">
                  100
                </strong>
                <span className="text-[10px] text-slate-500">إعلان عادي</span>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <strong className="block text-xl font-black text-amber-700">
                  20
                </strong>
                <span className="text-[10px] text-slate-500">إعلان مميز</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-xs font-bold">مدة الاشتراك</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  شهر واحد · ما يعادل 20$
                </p>
              </div>
              <div className="text-left">
                <strong className="text-lg font-black text-emerald-700">
                  200
                </strong>
                <p className="text-[10px] text-slate-500">نقطة</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/store-subscription")}
              className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
            >
              الانتقال إلى اشتراك المتاجر
              <ArrowRight size={15} className="mr-1.5 inline rotate-180" />
            </button>
          </div>
        </section>

        {/* خدمة تمييز إعلان */}
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white p-3.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Crown size={19} />
          </div>
          <div>
            <h2 className="text-xs font-black">تمييز إعلان واحد لمدة 10 أيام</h2>
            <p className="mt-1 text-[11px] leading-6 text-slate-500">
              خدمة مستقلة لا تتطلب الاشتراك بباقة. يمكنك طلبها من قسم إعلاناتي
              عبر زر التمييز الموجود بجانب الإعلان.
            </p>
          </div>
        </section>

        {/* تأكيد الاشتراك */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2">
            <Coins size={19} className="text-amber-500" />
            <h2 className="text-sm font-black">تأكيد الاشتراك</h2>
          </div>

          {requestSent ? (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
              <CheckCircle2
                size={27}
                className="mx-auto text-emerald-600"
              />
              <p className="mt-1.5 text-sm font-black text-emerald-800">
                تم إرسال طلب الاشتراك بنجاح
              </p>
              <p className="mt-1 text-[11px] leading-6 text-emerald-700">
                تم خصم النقاط، والطلب بانتظار موافقة الإدارة. سيبدأ اشتراكك
                بعد الموافقة، وستُعاد النقاط إلى رصيدك في حال رفض الطلب.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1.5 text-[11px] leading-6 text-slate-500">
                اختر إحدى الباقات أعلاه ثم أكد طلبك. سيتم خصم النقاط المطلوبة
                مباشرة من رصيدك.
              </p>

              {requestError && (
                <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">
                  {requestError}
                </p>
              )}

              <button
                type="button"
                onClick={submitSubscriptionRequest}
                disabled={
                  !selectedPackage ||
                  submitting ||
                  !subscriptionsEnabled ||
                  pointsBalance <
                    (selectedPackage ? pointsFor(selectedPackage.price) : 0)
                }
                className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? "جارٍ إرسال الطلب..."
                  : !selectedPackage
                    ? "اختر باقة أولاً"
                    : "تأكيد الاشتراك وخصم النقاط"}
              </button>

              {!subscriptionsEnabled && (
                <p className="mt-2 text-center text-[11px] text-amber-700">
                  الاشتراكات غير متاحة حالياً.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
