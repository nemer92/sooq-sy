
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
  Sparkles,
  ShieldCheck,
  Zap,
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

function getPackageStyle(name: string) {
  const normalized = name.trim().toLowerCase();

  if (
    normalized.includes("احتراف") ||
    normalized.includes("pro") ||
    normalized.includes("premium")
  ) {
    return {
      label: "احترافية",
      icon: Crown,
      card: "border-violet-200 bg-gradient-to-br from-white via-violet-50/70 to-purple-100/70",
      selected: "border-violet-400 ring-violet-300 shadow-violet-100",
      iconBox: "bg-violet-100 text-violet-700",
      title: "text-violet-800",
      price: "text-violet-800",
      badge: "bg-violet-100 text-violet-800",
      feature: "bg-violet-50 text-violet-800",
      button: "bg-violet-700 hover:bg-violet-800",
      accent: "bg-violet-600",
      glow: "shadow-violet-100",
    };
  }

  if (
    normalized.includes("ذهب") ||
    normalized.includes("gold") ||
    normalized.includes("golden")
  ) {
    return {
      label: "ذهبية",
      icon: Crown,
      card: "border-amber-200 bg-gradient-to-br from-white via-amber-50/70 to-yellow-100/70",
      selected: "border-amber-400 ring-amber-300 shadow-amber-100",
      iconBox: "bg-amber-100 text-amber-700",
      title: "text-amber-800",
      price: "text-amber-800",
      badge: "bg-amber-100 text-amber-800",
      feature: "bg-amber-50 text-amber-800",
      button: "bg-amber-600 hover:bg-amber-700",
      accent: "bg-amber-500",
      glow: "shadow-amber-100",
    };
  }

  if (
    normalized.includes("فض") ||
    normalized.includes("silver") ||
    normalized.includes("advanced") ||
    normalized.includes("متقدم")
  ) {
    return {
      label: "فضية",
      icon: ShieldCheck,
      card: "border-slate-300 bg-gradient-to-br from-white via-slate-50 to-slate-200/80",
      selected: "border-slate-400 ring-slate-300 shadow-slate-100",
      iconBox: "bg-slate-200 text-slate-700",
      title: "text-slate-800",
      price: "text-slate-800",
      badge: "bg-slate-200 text-slate-700",
      feature: "bg-slate-100 text-slate-700",
      button: "bg-slate-700 hover:bg-slate-800",
      accent: "bg-slate-600",
      glow: "shadow-slate-100",
    };
  }

  return {
    label: "أساسية",
    icon: Zap,
    card: "border-emerald-200 bg-gradient-to-br from-white via-emerald-50/60 to-teal-100/70",
    selected: "border-emerald-400 ring-emerald-300 shadow-emerald-100",
    iconBox: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-800",
    price: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800",
    feature: "bg-emerald-50 text-emerald-800",
    button: "bg-emerald-700 hover:bg-emerald-800",
    accent: "bg-emerald-600",
    glow: "shadow-emerald-100",
  };
}

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

        if (walletData) {
          setPointsBalance(Number(walletData.balance ?? 0));
        }
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
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f9fc] p-6"
      >
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-100 bg-white px-10 py-9 shadow-sm">
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="text-sm font-bold text-slate-500">
            جارٍ تحميل بيانات الاشتراك...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 p-5"
      >
        <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            العودة للرئيسية
          </button>
        </div>
      </main>
    );
  }

  const selectedStyle = selectedPackage
    ? getPackageStyle(selectedPackage.name)
    : null;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f6f8fa] text-slate-800"
    >
      {/* رأس الصفحة */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="رجوع"
          >
            <ArrowRight size={19} />
          </button>

          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-900">
              باقات الاشتراك
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              اختر الباقة المناسبة لنشاطك
            </p>
          </div>

          <div className="mr-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Crown size={20} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-5 sm:py-7">
        {/* مقدمة */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-900 via-emerald-950 to-emerald-800 p-5 text-white shadow-lg sm:p-7">
          <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="absolute -bottom-20 right-1/3 h-48 w-48 rounded-full bg-teal-300/10 blur-2xl" />

          <div className="relative">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-200">
              <Sparkles size={23} />
            </div>

            <h2 className="text-xl font-black leading-relaxed sm:text-2xl">
              ارتقِ بتجربتك مع Sooq.Sy
            </h2>

            <p className="mt-2 max-w-xl text-xs leading-7 text-emerald-50/80 sm:text-sm">
              اختر الباقة التي تناسب احتياجاتك واستفد من مزايا إضافية لإدارة
              إعلاناتك وتوسيع نشاطك التجاري.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white">
                باقات متنوعة
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white">
                الدفع بالنقاط
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white">
                موافقة الإدارة
              </span>
            </div>
          </div>
        </section>

        {!subscriptionsEnabled && (
          <section className="rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-4">
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
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-600">
              <Wallet size={23} />
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                رصيدك المتاح
              </p>

              <div className="mt-0.5 flex items-center gap-1.5">
                <strong className="text-2xl font-black tabular-nums text-slate-900">
                  {pointsBalance.toLocaleString("en-US")}
                </strong>
                <span className="text-xs font-bold text-amber-600">
                  نقطة
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:brightness-105 active:scale-95"
          >
            <Coins size={15} />
            شحن النقاط
          </button>
        </section>

        {/* الباقات */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                اختر باقتك
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                باقات مصممة لتناسب مختلف الأنشطة
              </p>
            </div>

            <span className="shrink-0 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[10px] font-black text-emerald-700 shadow-sm">
              10 نقاط = 1$
            </span>
          </div>

          {packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              لا توجد باقات متاحة حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((item) => {
                const style = getPackageStyle(item.name);
                const Icon = style.icon;
                const isSelected =
                  selectedPackage?.number === item.number;

                return (
                  <button
                    key={item.number}
                    type="button"
                    onClick={() => {
                      setSelectedPackage(item);
                      setRequestError("");
                      setRequestSent(false);
                    }}
                    className={`group relative overflow-hidden rounded-2xl border p-3 text-right shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-3.5 ${
                      style.card
                    } ${
                      isSelected
                        ? `ring-2 ${style.selected} shadow-md`
                        : "hover:border-slate-300"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                        <Check size={13} />
                      </span>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.iconBox}`}
                      >
                        <Icon size={20} />
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-black ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </div>

                    <h3 className={`mt-3 text-base font-black ${style.title}`}>
                      {item.name}
                    </h3>

                    <div className="mt-2 flex items-baseline gap-1.5">
                      <strong
                        className={`text-2xl font-black tabular-nums ${style.price}`}
                      >
                        {pointsFor(item.price).toLocaleString("en-US")}
                      </strong>
                      <span className="text-[11px] font-bold text-slate-500">
                        نقطة
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-slate-500">
                      ما يعادل ${item.price}
                    </p>

                    <div className="my-3 h-px bg-slate-200/70" />

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          مدة الاشتراك
                        </span>
                        <strong className="text-[11px] text-slate-800">
                          {item.duration_months} شهر
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          الإعلانات العادية
                        </span>
                        <strong className="text-[11px] text-slate-800">
                          {item.ordinary_ads_limit}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          الإعلانات المميزة
                        </span>
                        <strong className="text-[11px] text-slate-800">
                          {item.featured_ads_limit}
                        </strong>
                      </div>
                    </div>

                    <div
                      className={`mt-4 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-black transition ${
                        isSelected
                          ? `${style.button} text-white shadow-sm`
                          : "border border-white/70 bg-white/80 text-slate-700 group-hover:bg-white"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 size={14} />
                          تم اختيار هذه الباقة
                        </>
                      ) : (
                        <>
                          اختيار الباقة
                          <ArrowRight size={13} />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* تفاصيل الباقة */}
        {selectedPackage && selectedStyle && (
          <section
            className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${selectedStyle.selected.split(" ")[0]}`}
          >
            <div
              className={`p-4 text-white sm:p-5 ${selectedStyle.accent}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-white/75">
                    تفاصيل اختيارك
                  </p>
                  <h2 className="mt-1 text-lg font-black">
                    {selectedPackage.name}
                  </h2>
                </div>

                <div className="rounded-2xl bg-white/15 p-3">
                  <Crown size={25} />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">
                    مدة الاشتراك
                  </p>
                  <strong className="mt-1 block text-lg font-black text-slate-800">
                    {selectedPackage.duration_months} شهر
                  </strong>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">
                    القيمة بالدولار
                  </p>
                  <strong className="mt-1 block text-lg font-black text-slate-800">
                    ${selectedPackage.price}
                  </strong>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-black text-slate-800">
                  مزايا اشتراكك
                </h3>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    `نشر حتى ${selectedPackage.ordinary_ads_limit} إعلان عادي`,
                    `تمييز حتى ${selectedPackage.featured_ads_limit} إعلان`,
                    "إدارة إعلاناتك طوال مدة الاشتراك",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${selectedStyle.feature}`}
                    >
                      <CheckCircle2 size={17} className="shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-gradient-to-l from-amber-50 to-white p-4">
                <h3 className="text-sm font-black text-amber-900">
                  تنويه حول خدمات التمييز
                </h3>
                <p className="mt-1.5 text-xs leading-7 text-amber-900/80">
                  حملات التمييز الموجهة للمحافظات خدمة مستقلة عن رصيد تمييز
                  الاشتراك، وتُطلب بشكل منفصل وتستمر لمدة 10 أيام مع إمكانية
                  استهداف المحافظات وإرسال الإشعارات.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="mb-3 text-sm font-black text-slate-800">
                  ملخص النقاط
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      النقاط المطلوبة
                    </span>
                    <strong>
                      {pointsFor(selectedPackage.price).toLocaleString(
                        "en-US"
                      )}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      رصيدك الحالي
                    </span>
                    <strong>
                      {pointsBalance.toLocaleString("en-US")}
                    </strong>
                  </div>

                  <div className="flex justify-between border-t border-slate-200 pt-3">
                    <span className="font-black text-slate-700">
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
                  <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold leading-6 text-red-700">
                    رصيدك لا يكفي لهذه الباقة. يرجى شحن النقاط أولاً.
                  </div>
                )}
              </div>

              <div className="space-y-2 text-[11px] leading-6 text-slate-500">
                <p>• يتم خصم النقاط عند إرسال الطلب.</p>
                <p>• يبدأ الاشتراك بعد موافقة الإدارة.</p>
                <p>• عند رفض الطلب، تتم إعادة النقاط إلى رصيدك.</p>
                <p>• الإعلانات المميزة تُحتسب من رصيد الإعلانات الإجمالي.</p>
                <p>• حذف إعلان تمت الموافقة عليه لا يعيد الرصيد المستهلك.</p>
              </div>
            </div>
          </section>
        )}

        {/* اشتراك المتاجر */}
        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-l from-emerald-950 via-emerald-800 to-teal-700 p-5 text-white">
            <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <Store size={25} />
              </div>

              <div>
                <h2 className="text-base font-black">اشتراك المتاجر</h2>
                <p className="mt-1 text-[11px] text-emerald-100">
                  باقة متكاملة لأصحاب المتاجر
                </p>
              </div>

              <div className="mr-auto text-left">
                <strong className="block text-2xl font-black">200</strong>
                <span className="text-[10px] text-emerald-100">
                  نقطة
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs leading-7 text-slate-600">
              افتح متجرك الخاص على Sooq.Sy واعرض منتجاتك في صفحة متجرك وفي
              الأقسام الرئيسية للسوق أيضاً.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-center">
                <strong className="block text-2xl font-black text-emerald-700">
                  100
                </strong>
                <span className="mt-1 block text-[11px] font-bold text-slate-600">
                  إعلان عادي
                </span>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-center">
                <strong className="block text-2xl font-black text-amber-700">
                  20
                </strong>
                <span className="mt-1 block text-[11px] font-bold text-slate-600">
                  إعلان مميز
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3.5">
              <div>
                <p className="text-xs font-black text-slate-800">
                  مدة الاشتراك
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  شهر واحد · ما يعادل 20$
                </p>
              </div>

              <div className="text-left">
                <strong className="text-xl font-black text-emerald-700">
                  200
                </strong>
                <p className="text-[10px] text-slate-500">نقطة</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/store-subscription")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-900 active:scale-[0.99]"
            >
              الانتقال إلى اشتراك المتاجر
              <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* تمييز إعلان */}
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-600">
            <Crown size={21} />
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-800">
              تمييز إعلان واحد لمدة 10 أيام
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              خدمة مستقلة لا تتطلب الاشتراك بباقة. يمكنك طلبها من قسم
              إعلاناتي عبر زر التمييز الموجود بجانب الإعلان.
            </p>
          </div>
        </section>

        {/* تأكيد الاشتراك */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Coins size={21} />
            </div>

            <div>
              <h2 className="text-sm font-black text-slate-900">
                تأكيد الاشتراك
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-500">
                راجع طلبك قبل الإرسال
              </p>
            </div>
          </div>

          <div className="p-4">
            {requestSent ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <CheckCircle2 size={31} />
                </div>

                <p className="mt-3 text-base font-black text-emerald-800">
                  تم إرسال طلب الاشتراك بنجاح
                </p>

                <p className="mt-2 text-xs leading-7 text-emerald-700">
                  تم خصم النقاط، والطلب بانتظار موافقة الإدارة. سيبدأ
                  اشتراكك بعد الموافقة، وستُعاد النقاط إلى رصيدك في حال
                  رفض الطلب.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs leading-7 text-slate-500">
                  اختر إحدى الباقات أعلاه ثم أكد طلبك. سيتم خصم النقاط
                  المطلوبة مباشرة من رصيدك.
                </p>

                {requestError && (
                  <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-700">
                    {requestError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitSubscriptionRequest}
                  disabled={
                    !selectedPackage ||
                    submitting ||
                    !subscriptionsEnabled ||
                    pointsBalance <
                      (selectedPackage
                        ? pointsFor(selectedPackage.price)
                        : 0)
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-700 to-emerald-600 px-4 py-4 text-sm font-black text-white shadow-md shadow-emerald-100 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      جارٍ إرسال الطلب...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      {!selectedPackage
                        ? "اختر باقة أولاً"
                        : "تأكيد الاشتراك وخصم النقاط"}
                    </>
                  )}
                </button>

                {!subscriptionsEnabled && (
                  <p className="mt-3 text-center text-[11px] font-bold text-amber-700">
                    الاشتراكات غير متاحة حالياً.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <p className="pb-3 text-center text-[10px] leading-6 text-slate-400">
          Sooq.Sy · جميع الحقوق محفوظة
        </p>
      </div>
    </main>
  );
}
