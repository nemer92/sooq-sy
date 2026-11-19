
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Store,
  MapPin,
  RefreshCw,
  Plus,
  ExternalLink,
  Package,
  Star,
} from "lucide-react";
import { supabase } from "./lib/supabase";

type StoreRow = {
  id: string;
  name: string;
  business_type: string | null;
  description: string | null;
  governorate: string;
  city: string;
  logo_url: string | null;
  cover_url: string | null;
  status: string;
};

type SubscriptionRow = {
  id: string;
  store_id: string;
  status: string;
  start_at: string;
  end_at: string;
  ordinary_ads_limit: number;
  featured_ads_limit: number;
};

type UsageRow = {
  subscription_id: string;
  ad_type: string;
};

type StoreInfo = StoreRow & {
  subscription: SubscriptionRow | null;
  ordinaryUsed: number;
  featuredUsed: number;
};

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "نشط";
    case "pending":
      return "بانتظار المراجعة";
    case "rejected":
      return "مرفوض";
    case "suspended":
      return "موقوف";
    default:
      return status || "غير معروف";
  }
}

export default function MyStores() {
  const navigate = useNavigate();

  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStores() {
      setLoading(true);
      setError("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          navigate("/auth", {
            state: { from: "/my-stores" },
          });
          return;
        }

        const { data: storesData, error: storesError } =
          await supabase
            .from("stores")
            .select(
              "id,name,business_type,description,governorate,city,logo_url,cover_url,status"
            )
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });

        if (storesError) throw storesError;

        const storeRows = (storesData ?? []) as StoreRow[];

        if (storeRows.length === 0) {
          if (active) setStores([]);
          return;
        }

        const storeIds = storeRows.map((store) => store.id);

        const { data: subscriptionsData, error: subscriptionsError } =
          await supabase
            .from("store_subscriptions")
            .select(
              "id,store_id,status,start_at,end_at,ordinary_ads_limit,featured_ads_limit"
            )
            .in("store_id", storeIds)
            .in("status", ["active", "scheduled"])
            .order("start_at", { ascending: false });

        if (subscriptionsError) throw subscriptionsError;

        const subscriptions =
          (subscriptionsData ?? []) as SubscriptionRow[];

        const now = Date.now();

        const currentSubscriptions = new Map<string, SubscriptionRow>();

        for (const subscription of subscriptions) {
          const startsAt = new Date(subscription.start_at).getTime();
          const endsAt = new Date(subscription.end_at).getTime();

          if (startsAt <= now && endsAt > now) {
            const existing = currentSubscriptions.get(subscription.store_id);

            if (
              !existing ||
              new Date(subscription.end_at).getTime() >
                new Date(existing.end_at).getTime()
            ) {
              currentSubscriptions.set(subscription.store_id, subscription);
            }
          }
        }

        const subscriptionIds = Array.from(currentSubscriptions.values()).map(
          (subscription) => subscription.id
        );

        let usageRows: UsageRow[] = [];

        if (subscriptionIds.length > 0) {
          const { data: usageData, error: usageError } = await supabase
            .from("store_ad_usage")
            .select("subscription_id,ad_type")
            .in("subscription_id", subscriptionIds);

          if (usageError) throw usageError;

          usageRows = (usageData ?? []) as UsageRow[];
        }

        const usageBySubscription = new Map<
          string,
          { ordinary: number; featured: number }
        >();

        for (const usage of usageRows) {
          const current = usageBySubscription.get(usage.subscription_id) ?? {
            ordinary: 0,
            featured: 0,
          };

          if (usage.ad_type === "ordinary") current.ordinary += 1;
          if (usage.ad_type === "featured") current.featured += 1;

          usageBySubscription.set(usage.subscription_id, current);
        }

        const result: StoreInfo[] = storeRows.map((store) => {
          const subscription = currentSubscriptions.get(store.id) ?? null;
          const usage = subscription
            ? usageBySubscription.get(subscription.id)
            : undefined;

          return {
            ...store,
            subscription,
            ordinaryUsed: usage?.ordinary ?? 0,
            featuredUsed: usage?.featured ?? 0,
          };
        });

        if (active) setStores(result);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "تعذر تحميل متاجرك حالياً."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-7 flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-700"
            >
              <ArrowRight size={17} />
              رجوع
            </button>

            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
              متاجري
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة متاجرك ومتابعة اشتراكاتها وأرصدة الإعلانات
            </p>
          </div>

          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Store size={29} />
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div>
            <p className="font-black text-slate-800">
              تريد إنشاء متجر جديد؟
            </p>
            <p className="mt-1 text-sm text-slate-500">
              يمكنك امتلاك أكثر من متجر ضمن حسابك.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/subscriptions")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            إنشاء متجر
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <RefreshCw className="animate-spin" size={19} />
            جارٍ تحميل متاجرك...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mx-auto mt-4 block rounded-xl bg-red-600 px-5 py-2 font-bold text-white"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : stores.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <Store className="mx-auto text-slate-300" size={45} />
            <h2 className="mt-4 text-lg font-black text-slate-800">
              لا تملك متاجر حتى الآن
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              يمكنك إنشاء متجرك وإرسال طلب الاشتراك للإدارة.
            </p>
            <button
              type="button"
              onClick={() => navigate("/subscriptions")}
              className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
            >
              إنشاء أول متجر
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {stores.map((store) => {
              const subscription = store.subscription;

              const ordinaryLimit =
                subscription?.ordinary_ads_limit ?? 0;
              const featuredLimit =
                subscription?.featured_ads_limit ?? 0;

              const ordinaryRemaining = Math.max(
                0,
                ordinaryLimit - store.ordinaryUsed
              );
              const featuredRemaining = Math.max(
                0,
                featuredLimit - store.featuredUsed
              );

              const ordinaryPercent =
                ordinaryLimit > 0
                  ? Math.min(100, (store.ordinaryUsed / ordinaryLimit) * 100)
                  : 0;

              const featuredPercent =
                featuredLimit > 0
                  ? Math.min(100, (store.featuredUsed / featuredLimit) * 100)
                  : 0;

              return (
                <article
                  key={store.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div
                    className="h-32 bg-gradient-to-l from-emerald-100 to-slate-100"
                    style={
                      store.cover_url
                        ? {
                            backgroundImage: `url(${store.cover_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  />

                  <div className="px-4 pb-5 sm:px-5">
                    <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
                      <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow">
                        {store.logo_url ? (
                          <img
                            src={store.logo_url}
                            alt={store.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Store size={32} className="text-emerald-600" />
                        )}
                      </div>

                      <span
                        className={`mb-1 rounded-full px-3 py-1.5 text-xs font-black ${
                          store.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : store.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : store.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel(store.status)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-black text-slate-900">
                      {store.name}
                    </h2>

                    {store.business_type && (
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {store.business_type}
                      </p>
                    )}

                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={14} />
                      {[store.governorate, store.city]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>

                    {store.description && (
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {store.description}
                      </p>
                    )}

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-black text-slate-800">
                          حالة الاشتراك
                        </h3>

                        {subscription ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                            اشتراك فعّال
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            لا يوجد اشتراك فعّال حالياً
                          </span>
                        )}
                      </div>

                      {subscription ? (
                        <>
                          <p className="mt-2 text-xs text-slate-500">
                            ينتهي في:{" "}
                            {new Date(subscription.end_at).toLocaleDateString(
                              "ar-SY"
                            )}
                          </p>

                          <div className="mt-5 space-y-4">
                            <div>
                              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                                <span className="flex items-center gap-2 font-bold text-slate-700">
                                  <Package
                                    size={17}
                                    className="text-emerald-600"
                                  />
                                  الإعلانات العادية
                                </span>
                                <strong className="text-slate-800">
                                  {store.ordinaryUsed} / {ordinaryLimit}
                                </strong>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${ordinaryPercent}%` }}
                                />
                              </div>

                              <p className="mt-1 text-xs text-slate-500">
                                المتبقي: {ordinaryRemaining} إعلان
                              </p>
                            </div>

                            <div>
                              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                                <span className="flex items-center gap-2 font-bold text-slate-700">
                                  <Star
                                    size={17}
                                    className="text-amber-500"
                                  />
                                  الإعلانات المميزة
                                </span>
                                <strong className="text-slate-800">
                                  {store.featuredUsed} / {featuredLimit}
                                </strong>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-amber-400 transition-all"
                                  style={{ width: `${featuredPercent}%` }}
                                />
                              </div>

                              <p className="mt-1 text-xs text-slate-500">
                                المتبقي: {featuredRemaining} إعلان
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {store.status === "pending"
                            ? "المتجر بانتظار مراجعة الإدارة. سيظهر رصيد الاشتراك بعد تفعيله."
                            : "يمكنك تقديم طلب اشتراك أو تجديد الاشتراك من صفحة الاشتراكات."}
                        </p>
                      )}
                    </div>
<button
  type="button"
  onClick={() => navigate(`/manage-store/${store.id}`)}
  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
>
  تعديل بيانات المتجر
</button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {store.status === "active" && (
                        
                        <button
                          type="button"
                          onClick={() => navigate(`/store/${store.id}`)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          <ExternalLink size={17} />
                          عرض المتجر
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate("/subscriptions")}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                      >
                        {subscription ? "الاشتراكات والتجديد" : "طلب اشتراك"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
