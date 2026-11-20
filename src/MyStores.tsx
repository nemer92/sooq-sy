
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
  Power,
  X,
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
  owner_disabled: boolean;
  admin_disabled: boolean;
  disabled_ads_mode: "hide" | "show";
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
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null);
  const [selectedEnableStore, setSelectedEnableStore] =
    useState<StoreInfo | null>(null);

  const [adsMode, setAdsMode] = useState<"hide" | "show">("hide");
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStores() {
      setLoading(true);
      setError("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getSession();

        if (authError) throw authError;

        const user = authData.session?.user;

        if (!user) {
          navigate("/auth", {
            state: { from: "/my-stores" },
            replace: true,
          });
          return;
        }

        const { data: storesData, error: storesError } =
          await supabase
            .from("stores")
            .select(
              "id,name,business_type,description,governorate,city,logo_url,cover_url,status,owner_disabled,admin_disabled,disabled_ads_mode"
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
  }, [navigate, refreshKey]);

  function openDisableDialog(store: StoreInfo) {
    setSelectedStore(store);
    setAdsMode(store.disabled_ads_mode || "hide");
    setActionMessage("");
    setActionError("");
  }

  async function disableStore() {
    if (!selectedStore) return;

    const store = selectedStore;

    setBusyStoreId(store.id);
    setActionError("");
    setActionMessage("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "owner_set_store_disabled",
        {
          p_store_id: store.id,
          p_disabled: true,
          p_ads_mode: adsMode,
        }
      );

      if (rpcError) throw rpcError;

      setSelectedStore(null);
      setActionMessage("تم إيقاف المتجر بنجاح.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "تعذر إيقاف المتجر."
      );
    } finally {
      setBusyStoreId(null);
    }
  }

  function enableStore(store: StoreInfo) {
    if (store.admin_disabled) return;

    setActionError("");
    setActionMessage("");
    setSelectedEnableStore(store);
  }

  async function confirmEnableStore() {
    if (!selectedEnableStore) return;

    const store = selectedEnableStore;

    setBusyStoreId(store.id);
    setActionError("");
    setActionMessage("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "owner_set_store_disabled",
        {
          p_store_id: store.id,
          p_disabled: false,
          p_ads_mode: store.disabled_ads_mode || "hide",
        }
      );

      if (rpcError) throw rpcError;

      setSelectedEnableStore(null);
      setActionMessage("تم إعادة تفعيل المتجر بنجاح.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "تعذرت إعادة تفعيل المتجر."
      );
    } finally {
      setBusyStoreId(null);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-7 flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
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

        {actionMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {actionMessage}
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {actionError}
          </div>
        )}

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
              onClick={() => setRefreshKey((value) => value + 1)}
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

              const isDisabled =
                store.owner_disabled || store.admin_disabled;

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

                    {isDisabled && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="font-black text-amber-800">
                          <Power size={16} className="ml-1 inline" />
                          المتجر متوقف حالياً
                        </p>

                        {store.admin_disabled ? (
                          <p className="mt-1 text-sm leading-6 text-amber-700">
                            تم إيقاف المتجر من الإدارة. لا يمكنك إعادة تفعيله؛
                            يمكن للإدارة وحدها رفع الإيقاف.
                          </p>
                        ) : (
                          <p className="mt-1 text-sm leading-6 text-amber-700">
                            قمت بإيقاف هذا المتجر. يمكنك إعادة تفعيله من حسابك.
                          </p>
                        )}

                        <p className="mt-1 text-xs text-amber-700">
                          {store.disabled_ads_mode === "show"
                            ? "إعلانات المتجر المعتمدة ما زالت ظاهرة في السوق العام."
                            : "إعلانات المتجر مخفية من السوق العام."}
                        </p>
                      </div>
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
                            : "يمكنك تقديم طلب اشتراك أو تجديد الاشتراك من صفحة اشتراكات المتاجر."}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/manage-store/${store.id}`)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      تعديل بيانات المتجر
                    </button>

                    {store.status === "active" && (
                      <div className="mt-3">
                        {store.admin_disabled ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-500">
                            المتجر موقوف من الإدارة
                          </div>
                        ) : store.owner_disabled ? (
                          <button
                            type="button"
                            disabled={busyStoreId === store.id}
                            onClick={() => enableStore(store)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {busyStoreId === store.id ? (
                              <RefreshCw size={17} className="animate-spin" />
                            ) : (
                              <Power size={17} />
                            )}
                            إعادة تفعيل المتجر
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openDisableDialog(store)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
                          >
                            <Power size={17} />
                            إيقاف المتجر
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {store.status === "active" && !isDisabled && (
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
                        onClick={() =>
                          navigate(`/store-subscription/${store.id}`)
                        }
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

      {/* مربع إيقاف المتجر */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            dir="rtl"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900">
                إيقاف المتجر
              </h2>

              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              اختر ماذا تريد أن يحدث لإعلانات متجر «{selectedStore.name}»
              المعتمدة عند إيقافه:
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  name="adsMode"
                  value="hide"
                  checked={adsMode === "hide"}
                  onChange={() => setAdsMode("hide")}
                  className="mt-1 accent-emerald-600"
                />
                <span>
                  <strong className="block text-sm text-slate-800">
                    إخفاء إعلانات المتجر
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    يختفي المتجر من الدليل وتختفي إعلاناته من السوق العام.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  name="adsMode"
                  value="show"
                  checked={adsMode === "show"}
                  onChange={() => setAdsMode("show")}
                  className="mt-1 accent-emerald-600"
                />
                <span>
                  <strong className="block text-sm text-slate-800">
                    إبقاء الإعلانات ظاهرة
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    يختفي المتجر من الدليل وتبقى إعلاناته المعتمدة ظاهرة في السوق
                    العام.
                  </span>
                </span>
              </label>
            </div>

            {actionError && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busyStoreId === selectedStore.id}
                onClick={disableStore}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busyStoreId === selectedStore.id
                  ? "جارٍ الإيقاف..."
                  : "تأكيد إيقاف المتجر"}
              </button>

              <button
                type="button"
                disabled={busyStoreId === selectedStore.id}
                onClick={() => setSelectedStore(null)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مربع إعادة تفعيل المتجر */}
      {selectedEnableStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            dir="rtl"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900">
                إعادة تفعيل المتجر
              </h2>

              <button
                type="button"
                onClick={() => setSelectedEnableStore(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-800">
                هل تريد إعادة تفعيل متجر «{selectedEnableStore.name}»؟
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                سيعود المتجر للظهور في دليل المتاجر، وستعود إعلاناته وفق حالتها
                الفردية.
              </p>
            </div>

            {actionError && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busyStoreId === selectedEnableStore.id}
                onClick={confirmEnableStore}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busyStoreId === selectedEnableStore.id
                  ? "جارٍ إعادة التفعيل..."
                  : "تأكيد إعادة التفعيل"}
              </button>

              <button
                type="button"
                disabled={busyStoreId === selectedEnableStore.id}
                onClick={() => setSelectedEnableStore(null)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
