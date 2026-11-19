
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  PackageCheck,
  Star,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

type SaleRequest = {
  id: string;
  ad_id: string;
  buyer_id: string;
  seller_id: string;
  conversation_id: string | null;
  ad_title: string;
  agreed_price: number;
  currency: string;
  status: string;
  buyer_note: string | null;
  seller_note: string | null;
  created_at: string;
  completed_at: string | null;
  public_code?: number | null;
  other_name?: string;
  other_avatar?: string | null;
  already_reviewed?: boolean;
};

export default function MySales() {
  const [searchParams] = useSearchParams();
  const targetRequestId = searchParams.get("request_id");

  const [requests, setRequests] = useState<SaleRequest[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
  const [message, setMessage] = useState("");
  const [reviewRequest, setReviewRequest] = useState<SaleRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [credibilityRating, setCredibilityRating] = useState(5);
  const [descriptionRating, setDescriptionRating] = useState(5);
  const [behaviorRating, setBehaviorRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setUserId("");
        setRequests([]);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("sale_requests")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as SaleRequest[];

      const otherIds = [
        ...new Set(
          rows.map((request) =>
            request.buyer_id === user.id
              ? request.seller_id
              : request.buyer_id
          )
        ),
      ];

      const adIds = [...new Set(rows.map((request) => request.ad_id))];

      const [profilesResult, adsResult, reviewsResult] = await Promise.all([
        otherIds.length
          ? supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .in("id", otherIds)
          : Promise.resolve({ data: [], error: null } as any),

        adIds.length
          ? supabase
              .from("ads")
              .select("id, public_code")
              .in("id", adIds)
          : Promise.resolve({ data: [], error: null } as any),

        supabase
          .from("seller_reviews")
          .select("sale_request_id")
          .eq("reviewer_id", user.id),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (adsResult.error) throw adsResult.error;
      if (reviewsResult.error) throw reviewsResult.error;

      const profileMap = new Map(
        (profilesResult.data || []).map((profile: any) => [
          profile.id,
          profile,
        ])
      );

      const adMap = new Map<string, number | null>(
        (adsResult.data || []).map((ad: any) => [
          ad.id,
          ad.public_code == null ? null : Number(ad.public_code),
        ])
      );

      const reviewedIds = new Set(
        (reviewsResult.data || []).map(
          (review: any) => review.sale_request_id
        )
      );

      const enriched = rows.map((request) => {
        const otherId =
          request.buyer_id === user.id
            ? request.seller_id
            : request.buyer_id;

        const profile: any = profileMap.get(otherId);

        return {
          ...request,
          other_name: profile?.display_name || "مستخدم Sooq.sy",
          other_avatar: profile?.avatar_url || null,
          public_code: adMap.get(request.ad_id) ?? null,
          already_reviewed: reviewedIds.has(request.id),
        };
      });

      setRequests(enriched);
    } catch (error: any) {
      console.error("خطأ تحميل طلبات البيع والشراء:", error);
      setMessage(error?.message || "تعذر تحميل الطلبات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // اختيار تبويب المشتري أو البائع حسب الطلب المستهدف
  useEffect(() => {
    if (!targetRequestId || !userId || requests.length === 0) return;

    const target = requests.find(
      (request) => request.id === targetRequestId
    );

    if (!target) return;

    setActiveTab(
      target.seller_id === userId ? "incoming" : "outgoing"
    );
  }, [targetRequestId, userId, requests]);

  // الانتقال إلى بطاقة الطلب وتمييزها
  useEffect(() => {
    if (!targetRequestId || !userId || requests.length === 0) return;

    const target = requests.find(
      (request) => request.id === targetRequestId
    );

    if (!target) return;

    const correctTab =
      target.seller_id === userId ? "incoming" : "outgoing";

    if (activeTab !== correctTab) return;

    const timer = window.setTimeout(() => {
      const card = document.getElementById(
        `sale-request-${targetRequestId}`
      );

      card?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [targetRequestId, requests, activeTab, userId]);

  async function runAction(
    requestId: string,
    action: "accept" | "reject" | "delivered" | "received"
  ) {
    const confirmationMessages = {
      accept: "هل تريد قبول طلب الشراء؟",
      reject: "هل تريد رفض طلب الشراء؟",
      delivered: "هل تؤكد أنك سلّمت السلعة للمشتري؟",
      received: "هل تؤكد أنك استلمت السلعة؟ سيتم إغلاق الإعلان كمباع.",
    };

    const confirmed = await window.sooqConfirm(
      confirmationMessages[action]
    );

    if (!confirmed) return;

    setActionLoading(requestId);
    setMessage("");

    try {
      let result;

      if (action === "accept" || action === "reject") {
        result = await supabase.rpc("respond_sale_request", {
          p_request_id: requestId,
          p_action: action,
          p_note: null,
        });
      } else if (action === "delivered") {
        result = await supabase.rpc("mark_sale_delivered", {
          p_request_id: requestId,
        });
      } else {
        result = await supabase.rpc("confirm_sale_received", {
          p_request_id: requestId,
        });
      }

      if (result.error) throw result.error;

      await window.alert("تم تنفيذ العملية بنجاح.");
      await loadRequests();
    } catch (error: any) {
      console.error("خطأ تنفيذ طلب البيع:", error);
      setMessage(error?.message || "تعذر تنفيذ العملية.");
    } finally {
      setActionLoading("");
    }
  }

  async function submitReview() {
    if (!reviewRequest) return;

    setActionLoading(reviewRequest.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("create_seller_review", {
        p_sale_request_id: reviewRequest.id,
        p_rating: rating,
        p_communication_rating: communicationRating,
        p_credibility_rating: credibilityRating,
        p_description_rating: descriptionRating,
        p_behavior_rating: behaviorRating,
        p_comment: reviewComment.trim() || null,
      });

      if (error) throw error;

      setReviewRequest(null);
      setReviewComment("");
      await window.alert("شكراً لك، تم إرسال تقييمك بنجاح.");
      await loadRequests();
    } catch (error: any) {
      console.error("خطأ إرسال التقييم:", error);
      setMessage(error?.message || "تعذر إرسال التقييم.");
    } finally {
      setActionLoading("");
    }
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      pending: "بانتظار رد البائع",
      accepted: "تم قبول الطلب",
      rejected: "تم رفض الطلب",
      seller_marked_sold: "بانتظار تأكيد المشتري",
      completed: "تم البيع بنجاح",
      cancelled: "ملغي",
    };

    return labels[status] || status;
  }

  function statusColor(status: string) {
    if (status === "completed") return "bg-emerald-100 text-emerald-700";
    if (status === "rejected" || status === "cancelled")
      return "bg-red-100 text-red-700";
    if (status === "pending") return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  }

  function renderStars(
    value: number,
    onChange: (value: number) => void
  ) {
    return (
      <div className="flex flex-row-reverse justify-end gap-2">
        {[1, 2, 3, 4, 5].map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            className="text-2xl"
            aria-label={`${number} نجوم`}
          >
            <Star
              size={25}
              fill={number <= value ? "currentColor" : "none"}
              className={
                number <= value ? "text-amber-400" : "text-slate-300"
              }
            />
          </button>
        ))}
      </div>
    );
  }

  const visibleRequests = requests.filter((request) =>
    activeTab === "incoming"
      ? request.seller_id === userId
      : request.buyer_id === userId
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="font-bold text-slate-500">
          جارٍ تحميل طلبات البيع والشراء...
        </p>
      </div>
    );
  }

  if (!userId) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-6 text-center">
        <p className="mb-4 font-bold">يرجى تسجيل الدخول لعرض طلباتك.</p>
        <Link to="/auth" className="font-bold text-emerald-700">
          تسجيل الدخول
        </Link>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link
            to="/profile"
            className="flex items-center gap-2 font-bold text-emerald-700"
          >
            <ArrowRight size={20} />
            الملف الشخصي
          </Link>

          <h1 className="mr-auto text-lg font-black text-slate-800">
            طلبات البيع والشراء
          </h1>

          <button
            onClick={loadRequests}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="تحديث الطلبات"
          >
            <RefreshCw size={19} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 p-4 py-7">
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-2 shadow-sm">
          <button
            onClick={() => setActiveTab("incoming")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-bold ${
              activeTab === "incoming"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ShoppingBag size={18} />
            طلبات واردة
          </button>

          <button
            onClick={() => setActiveTab("outgoing")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-bold ${
              activeTab === "outgoing"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Clock size={18} />
            طلباتي
          </button>
        </div>

        {message && (
          <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {message}
          </div>
        )}

        {visibleRequests.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <ShoppingBag
              size={42}
              className="mx-auto mb-4 text-slate-300"
            />
            <p className="font-bold text-slate-600">
              لا توجد طلبات في هذا القسم حالياً.
            </p>
          </div>
        ) : (
          visibleRequests.map((request) => {
            const isSeller = request.seller_id === userId;
            const alreadyReviewed = request.already_reviewed;

            return (
              <article
                id={`sale-request-${request.id}`}
                key={request.id}
                className={`space-y-4 rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                  targetRequestId === request.id
                    ? "border-emerald-500 ring-2 ring-emerald-200"
                    : "border-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-black text-slate-800">
                      {request.ad_title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {isSeller ? "المشتري: " : "البائع: "}
                      {request.other_name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(request.created_at).toLocaleDateString("ar-SY")}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusColor(
                      request.status
                    )}`}
                  >
                    {statusLabel(request.status)}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-500">السعر المسجل للطلب</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">
                    {Number(request.agreed_price).toLocaleString("en-US")}{" "}
                    {request.currency === "USD" ? "دولار" : "ليرة سورية"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {request.public_code && (
                    <Link
                      to={`/ad/${request.public_code}`}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
                    >
                      عرض الإعلان
                    </Link>
                  )}

                  {request.conversation_id && (
                    <Link
                      to={`/messages/${request.conversation_id}`}
                      className="flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700"
                    >
                      <MessageCircle size={16} />
                      المحادثة
                    </Link>
                  )}
                </div>

                {isSeller && request.status === "pending" && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => runAction(request.id, "accept")}
                      disabled={actionLoading === request.id}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 font-bold text-white disabled:opacity-50"
                    >
                      <CheckCircle size={18} />
                      قبول الطلب
                    </button>

                    <button
                      onClick={() => runAction(request.id, "reject")}
                      disabled={actionLoading === request.id}
                      className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-3 font-bold text-white disabled:opacity-50"
                    >
                      <XCircle size={18} />
                      رفض الطلب
                    </button>
                  </div>
                )}

                {isSeller && request.status === "accepted" && (
                  <button
                    onClick={() => runAction(request.id, "delivered")}
                    disabled={actionLoading === request.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
                    <PackageCheck size={19} />
                    تم تسليم السلعة للمشتري
                  </button>
                )}

                {!isSeller && request.status === "seller_marked_sold" && (
                  <button
                    onClick={() => runAction(request.id, "received")}
                    disabled={actionLoading === request.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle size={19} />
                    أؤكد استلام السلعة
                  </button>
                )}

                {!isSeller &&
                  request.status === "completed" &&
                  !alreadyReviewed && (
                    <button
                      onClick={() => setReviewRequest(request)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-bold text-white hover:bg-amber-600"
                    >
                      <Star size={19} />
                      قيّم البائع
                    </button>
                  )}

                {!isSeller &&
                  request.status === "completed" &&
                  alreadyReviewed && (
                    <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                      <CheckCircle size={18} />
                      تم إرسال تقييمك لهذا البيع
                    </p>
                  )}
              </article>
            );
          })
        )}
      </div>

      {reviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg space-y-5 rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">
                تقييم البائع
              </h2>

              <button
                onClick={() => setReviewRequest(null)}
                className="text-slate-500"
              >
                <XCircle size={23} />
              </button>
            </div>

            <div>
              <p className="mb-2 font-bold">التقييم العام</p>
              {renderStars(rating, setRating)}
            </div>

            <div>
              <p className="mb-2 font-bold">التواصل</p>
              {renderStars(communicationRating, setCommunicationRating)}
            </div>

            <div>
              <p className="mb-2 font-bold">مصداقية البائع</p>
              {renderStars(credibilityRating, setCredibilityRating)}
            </div>

            <div>
              <p className="mb-2 font-bold">مطابقة السلعة للوصف</p>
              {renderStars(descriptionRating, setDescriptionRating)}
            </div>

            <div>
              <p className="mb-2 font-bold">التعامل والسلوك</p>
              {renderStars(behaviorRating, setBehaviorRating)}
            </div>

            <div>
              <label className="mb-2 block font-bold">
                تعليقك (اختياري)
              </label>

              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="شارك تجربتك مع البائع..."
                className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={submitReview}
              disabled={actionLoading === reviewRequest.id}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {actionLoading === reviewRequest.id
                ? "جارٍ إرسال التقييم..."
                : "إرسال التقييم"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
