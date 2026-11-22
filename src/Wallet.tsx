
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  Coins,
  LoaderCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Wallet,
  History,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

type PointPackage = {
  id: string;
  name: string;
  price_usd: number;
  points: number;
  sort_order: number;
};

type TopupRequest = {
  id: string;
  package_id: string;
  amount_usd: number;
  points: number;
  phone: string;
  exchange_rate: number;
  amount_syp: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
};

type PointTransaction = {
  id: string;
  points: number;
  transaction_type: string;
  description: string | null;
  related_ad_id: string | null;
  created_at: string;
};

const transactionLabels: Record<string, string> = {
  ad_share_reward: "مكافأة مشاركة إعلان",
  referral_reward: "مكافأة دعوة صديق",
  ad_feature_redemption: "تمييز إعلان",
  admin_adjustment: "تعديل من الإدارة",
  point_topup: "شحن رصيد النقاط",
  featured_campaign_purchase: "شراء حملة إعلانية مميزة",
  featured_campaign_refund: "استرداد حملة إعلانية",
  subscription_purchase: "شراء اشتراك",
  subscription_refund: "استرداد اشتراك",
};

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activityTab, setActivityTab] = useState<"requests" | "transactions">("requests");


  const [balance, setBalance] = useState(0);
  const [phone, setPhone] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [exchangeRate, setExchangeRate] = useState(0);

  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("يرجى تسجيل الدخول أولاً.");
      }

      const id = authData.user.id;

      const [
        { data: pointsData, error: pointsError },
        { data: packagesData, error: packagesError },
        { data: requestsData, error: requestsError },
        { data: transactionsData, error: transactionsError },
        { data: settingsData, error: settingsError },
        { data: privateData, error: privateError },
      ] = await Promise.all([
        supabase
          .from("user_points")
          .select("balance")
          .eq("user_id", id)
          .maybeSingle(),

        supabase
          .from("point_packages")
          .select("id, name, price_usd, points, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("point_topup_requests")
          .select(
            "id, package_id, amount_usd, points, phone, exchange_rate, amount_syp, status, admin_note, created_at"
          )
          .eq("user_id", id)
          .order("created_at", { ascending: false }),

        supabase
          .from("points_transactions")
          .select(
            "id, points, transaction_type, description, related_ad_id, created_at"
          )
          .eq("user_id", id)
          .order("created_at", { ascending: false }),

        supabase
          .from("site_settings")
          .select("sham_cash_qr_url, usd_syp_rate")
          .eq("id", 1)
          .maybeSingle(),

        supabase
          .from("private_profiles")
          .select("phone")
          .eq("user_id", id)
          .maybeSingle(),
      ]);

      if (pointsError) throw pointsError;
      if (packagesError) throw packagesError;
      if (requestsError) throw requestsError;
      if (transactionsError) throw transactionsError;
      if (settingsError) throw settingsError;
      if (privateError) throw privateError;

      setBalance(Number(pointsData?.balance || 0));
      setPackages((packagesData || []) as PointPackage[]);
      setRequests((requestsData || []) as TopupRequest[]);
      setTransactions((transactionsData || []) as PointTransaction[]);
      setQrUrl(settingsData?.sham_cash_qr_url || "");
      setExchangeRate(Number(settingsData?.usd_syp_rate || 0));
      setPhone(privateData?.phone || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحميل بيانات المحفظة."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function submitTopupRequest() {
    if (submitting) return;

    setError("");
    setMessage("");

    if (!selectedPackageId) {
      setError("يرجى اختيار باقة النقاط.");
      return;
    }

    if (!/^09[0-9]{8}$/.test(phone.trim())) {
      setError("رقم الهاتف المسجل في حسابك غير صحيح. يرجى تحديثه من الملف الشخصي.");
      return;
    }

    if (exchangeRate <= 0) {
      setError("سعر الصرف غير متوفر حالياً. يرجى المحاولة لاحقاً.");
      return;
    }

    const pendingRequest = requests.find(
      (request) => request.status === "pending"
    );

    if (pendingRequest) {
      setError(
        `لديك طلب شحن قيد المراجعة بالفعل. رقم الطلب: ${pendingRequest.id}`
      );
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: requestError } = await supabase.rpc(
        "create_point_topup_request",
        {
          p_package_id: selectedPackageId,
        }
      );

      if (requestError) throw requestError;

      if (!data) {
        throw new Error("لم يتم إنشاء طلب الشحن. حاول مرة أخرى.");
      }

      setSelectedPackageId("");
      await loadWallet(true);

      setMessage(
        "تم إرسال طلب شحن النقاط بنجاح. ستتم إضافة النقاط بعد مراجعة الإدارة."
      );
    } catch (err: any) {
      console.error("Point topup submission failed:", err);
      setError(
        err?.message ||
          err?.details ||
          "تعذر إرسال طلب الشحن. حاول مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPackage = packages.find(
    (pkg) => pkg.id === selectedPackageId
  );

  const amountSyp = selectedPackage
    ? Math.floor(Number(selectedPackage.price_usd) * exchangeRate)
    : 0;

  const hasPendingRequest = requests.some(
    (request) => request.status === "pending"
  );

  function formatDate(value: string) {
    return new Date(value).toLocaleString("ar-SY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusLabel(status: TopupRequest["status"]) {
    if (status === "approved") return "تمت الموافقة";
    if (status === "rejected") return "مرفوض";
    return "قيد المراجعة";
  }

  function transactionLabel(type: string) {
    return transactionLabels[type] || type;
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50"
      >
        <LoaderCircle
          className="animate-spin text-emerald-600"
          size={38}
        />
        <p className="text-sm font-medium text-slate-500">
          جارٍ تحميل المحفظة...
        </p>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f7f6] px-3 pb-10 pt-4 sm:px-5 sm:py-8"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            to="/profile"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:text-emerald-700"
          >
            <ArrowRight size={18} />
            الملف الشخصي
          </Link>

          <button
            type="button"
            onClick={() => loadWallet(true)}
            disabled={refreshing}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
            title="تحديث المحفظة"
          >
            <RefreshCw
              size={18}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-l from-emerald-900 via-emerald-700 to-teal-500 p-5 text-white shadow-lg sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Wallet size={27} />
            </div>
            <div>
              <h1 className="text-xl font-black">محفظتي</h1>
              <p className="mt-1 text-xs text-emerald-100">
                رصيد النقاط وحركات المحفظة
              </p>
            </div>
          </div>

          <div className="mt-7">
            <p className="text-sm font-medium text-emerald-100">
              رصيدك الحالي
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-black tabular-nums">
                {balance.toLocaleString("en-US")}
              </span>
              <span className="mb-1 text-sm font-bold text-emerald-100">
                نقطة
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-white/20 pt-4 text-xs text-emerald-50">
            <Coins size={17} />
            استخدم نقاطك لتفعيل الخدمات والباقات داخل Sooq.Sy
          </div>
        </div>

        {message && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mb-5 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Coins size={23} />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                شحن رصيد النقاط
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                اختر باقة واشحن عبر شام كاش
              </p>
            </div>
          </div>

          {hasPendingRequest && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              <Clock size={18} className="mt-1 shrink-0" />
              لديك طلب شحن قيد المراجعة. يمكنك إرسال طلب جديد بعد انتهاء مراجعة الطلب الحالي.
            </div>
          )}

          {packages.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
              لا توجد باقات شحن متاحة حالياً.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {packages.map((pkg) => {
                  const selected = selectedPackageId === pkg.id;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      disabled={hasPendingRequest}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`relative flex min-h-24 flex-col items-center justify-center rounded-xl border p-3 text-center transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10"
                          : "border-slate-200 bg-white hover:border-emerald-300"
                      }`}
                    >
                      {selected && (
                        <CheckCircle2
                          size={16}
                          className="absolute left-2 top-2 text-emerald-600"
                        />
                      )}
                      <span className="text-xs font-bold text-slate-600">
                        {pkg.name}
                      </span>
                      <strong className="mt-1 text-2xl font-black text-emerald-700">
                        {Number(pkg.points).toLocaleString("en-US")}
                      </strong>
                      <span className="mt-1 text-xs text-slate-500">
                        نقطة · ${Number(pkg.price_usd).toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedPackage && (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-black text-slate-800">
                    تفاصيل الباقة المختارة
                  </h3>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500">الباقة</span>
                    <strong>{selectedPackage.name}</strong>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500">النقاط</span>
                    <strong className="text-emerald-700">
                      {selectedPackage.points} نقطة
                    </strong>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500">السعر بالدولار</span>
                    <strong>
                      ${Number(selectedPackage.price_usd).toFixed(2)}
                    </strong>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500">المبلغ بالليرة</span>
                    <strong className="text-emerald-700">
                      {amountSyp.toLocaleString("en-US")} ل.س
                    </strong>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="mb-3 font-black text-slate-800">
                      الدفع عبر شام كاش
                    </h3>

                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt="رمز الدفع شام كاش"
                        className="mx-auto max-h-56 max-w-full rounded-xl bg-white object-contain p-2"
                      />
                    ) : (
                      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                        رمز شام كاش غير متوفر حالياً.
                      </p>
                    )}

                    <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">
                      بعد تحويل المبلغ، اكتب رقم الهاتف المسجل في حسابك ضمن ملاحظات حوالة شام كاش حتى تتمكن الإدارة من مطابقة التحويل.
                      لا تحتاج إلى رفع صورة إثبات الدفع.
                    </div>

                    <label className="mb-2 mt-4 block text-xs font-bold text-slate-600">
                      رقم الهاتف المسجل في حسابك
                    </label>

                    <input
                      type="tel"
                      value={phone}
                      readOnly
                      dir="ltr"
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-3 text-left text-sm font-bold text-slate-700"
                    />

                    {!phone && (
                      <p className="mt-2 text-xs text-red-600">
                        لا يوجد رقم هاتف مرتبط بحسابك. يرجى تحديثه من الملف الشخصي.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={submitTopupRequest}
                      disabled={submitting || hasPendingRequest || !phone}
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <LoaderCircle
                          size={19}
                          className="animate-spin"
                        />
                      ) : (
                        <Coins size={19} />
                      )}
                      {submitting
                        ? "جارٍ إرسال الطلب..."
                        : "تأكيد التحويل وإرسال طلب الشحن"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="text-emerald-700" size={21} />
              <h2 className="font-black text-slate-800">
                نشاط المحفظة
              </h2>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {activityTab === "requests"
                ? `${requests.length} طلب`
                : `${transactions.length} حركة`}
            </span>
          </div>

          <div
            className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"
            role="tablist"
            aria-label="أقسام نشاط المحفظة"
          >
            <button
              type="button"
              role="tab"
              id="wallet-requests-tab"
              aria-selected={activityTab === "requests"}
              aria-controls="wallet-requests-panel"
              onClick={() => setActivityTab("requests")}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-black transition sm:text-sm ${
                activityTab === "requests"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              طلبات شحن النقاط
            </button>
            <button
              type="button"
              role="tab"
              id="wallet-transactions-tab"
              aria-selected={activityTab === "transactions"}
              aria-controls="wallet-transactions-panel"
              onClick={() => setActivityTab("transactions")}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-black transition sm:text-sm ${
                activityTab === "transactions"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              سجل حركات المحفظة
            </button>
          </div>

          {activityTab === "requests" ? (
            <div
              id="wallet-requests-panel"
              role="tabpanel"
              aria-labelledby="wallet-requests-tab"
              className="min-h-[120px]"
            >
              {requests.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                  لم ترسل أي طلب شحن حتى الآن.
                </p>
              ) : (
                <div className="max-h-64 space-y-3 overflow-y-auto overscroll-contain pr-1 pl-2 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-slate-800">
                          {Number(request.points).toLocaleString("en-US")} نقطة
                        </strong>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            request.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : request.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {statusLabel(request.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {Number(request.amount_syp).toLocaleString("en-US")} ل.س
                        </span>
                        <span>{formatDate(request.created_at)}</span>
                      </div>
                      {request.admin_note && (
                        <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-6 text-slate-600">
                          ملاحظة الإدارة: {request.admin_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              id="wallet-transactions-panel"
              role="tabpanel"
              aria-labelledby="wallet-transactions-tab"
              className="min-h-[120px]"
            >
              {transactions.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                  لا توجد حركات في محفظتك حتى الآن.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1 pl-2 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                  {transactions.map((transaction) => {
                    const positive = Number(transaction.points) > 0;
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            positive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {positive ? (
                            <TrendingUp size={20} />
                          ) : (
                            <TrendingDown size={20} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-sm text-slate-800">
                            {transaction.description ||
                              transactionLabel(transaction.transaction_type)}
                          </strong>
                          <span className="mt-1 block text-[11px] text-slate-400">
                            {formatDate(transaction.created_at)}
                          </span>
                        </div>
                        <strong
                          className={`shrink-0 text-sm font-black ${
                            positive ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {Number(transaction.points).toLocaleString("en-US")}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Sooq Sy · محفظتك ونقاطك
        </p>
      </div>
    </main>
  );
}
