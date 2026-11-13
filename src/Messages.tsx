
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, Send } from "lucide-react";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function Messages() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
const [reportDetails, setReportDetails] = useState("");
const [reporting, setReporting] = useState(false);
const [blocking, setBlocking] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadConversation() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          navigate("/auth");
          return;
        }

        if (!id) {
  
const { data: conversationsData, error: conversationsError } =
  await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, ad_id, created_at")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

if (conversationsError) throw conversationsError;

const conversationIds = (conversationsData || []).map((item) => item.id);
const adIds = [...new Set((conversationsData || []).map((item) => item.ad_id))];
const participantIds = [
  ...new Set(
    (conversationsData || []).flatMap((item) => [
      item.buyer_id,
      item.seller_id,
    ])
  ),
];


const [
  profilesResult,
  adsResult,
  messagesResult,
  unreadMessagesResult,
] = await Promise.all([
  supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", participantIds),

  supabase
    .from("ads")
    .select("id, title")
    .in("id", adIds),

  supabase
    .from("messages")
    .select("conversation_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false }),

  supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", user.id),
]);


if (profilesResult.error) throw profilesResult.error;
if (adsResult.error) throw adsResult.error;
if (messagesResult.error) throw messagesResult.error;


if (unreadMessagesResult.error) throw unreadMessagesResult.error;

const enrichedConversations = (conversationsData || []).map((item) => {
  const otherUserId =
    item.buyer_id === user.id ? item.seller_id : item.buyer_id;

  const unreadCount = (unreadMessagesResult.data || []).filter(
    (message) => message.conversation_id === item.id
  ).length;

  return {
    ...item,
    other_user: profilesResult.data?.find(
      (profile) => profile.id === otherUserId
    ),
    ad_title: adsResult.data?.find(
      (ad) => ad.id === item.ad_id
    )?.title,
    last_message: messagesResult.data?.find(
      (message) => message.conversation_id === item.id
    ),
    unread_count: unreadCount,
  };
});

setConversations(enrichedConversations);


  return;
}

        setUserId(user.id);

        const { data: conversationData, error: conversationError } =
          await supabase
            .from("conversations")
            .select("id, buyer_id, seller_id, ad_id")
            .eq("id", id)
            .maybeSingle();

        if (conversationError) throw conversationError;

        if (!conversationData) {
          setError("المحادثة غير موجودة أو لا يمكنك الوصول إليها.");
          return;
        }

        setConversation(conversationData);
const otherUserId =
  conversationData.buyer_id === user.id
    ? conversationData.seller_id
    : conversationData.buyer_id;

// جلب بيانات الطرف الآخر وحالة الحظر
const [profileResult, myBlockResult, theirBlockResult] =
  await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", otherUserId)
      .single(),

    supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", otherUserId)
      .maybeSingle(),

    supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", otherUserId)
      .eq("blocked_id", user.id)
      .maybeSingle(),
  ]);

if (profileResult.error) throw profileResult.error;
if (myBlockResult.error) throw myBlockResult.error;
if (theirBlockResult.error) throw theirBlockResult.error;

setOtherUser(profileResult.data);
setBlockedByMe(!!myBlockResult.data);
setBlockedMe(!!theirBlockResult.data);
        const { data: messagesData, error: messagesError } =
          await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", id)
            .order("created_at", { ascending: true });

        if (messagesError) throw messagesError;

        
setMessages(messagesData || []);

const { error: readError } = await supabase.rpc(
  "mark_conversation_messages_read",
  {
    p_conversation_id: id,
  }
);

if (readError) {
  console.error("خطأ تحديث حالة القراءة:", readError);
}

      } catch (err) {
        console.error("خطأ تحميل المحادثة:", err);
        setError("تعذر تحميل المحادثة.");
      } finally {
        setLoading(false);
      }
    }

    loadConversation();
  }, [id, navigate]);


useEffect(() => {
  if (!id) return;

  const channel = supabase
    .channel(`conversation-${id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${id}`,
      },
      (payload) => {
        const incomingMessage = payload.new as Message;

        setMessages((previous) => {
          if (previous.some((message) => message.id === incomingMessage.id)) {
            return previous;
          }

          return [...previous, incomingMessage];
        });
      }
    )
.subscribe((status, err) => {
  console.log("حالة اتصال الرسائل:", status);

  if (err) {
    console.error("خطأ اتصال الرسائل:", err);
  }
});


  return () => {
    void supabase.removeChannel(channel);
  };
}, [id]);

// حظر أو إلغاء حظر المستخدم
async function toggleBlock() {
  if (!otherUser || !userId || blocking) return;

  const action = blockedByMe ? "إلغاء الحظر" : "حظر هذا المستخدم";

  if (!window.confirm(`هل أنت متأكد من ${action}؟`)) return;

  setBlocking(true);

  try {
    if (blockedByMe) {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_id", otherUser.id);

      if (error) throw error;

      setBlockedByMe(false);
      alert("تم إلغاء الحظر بنجاح.");
    } else {
      const { error } = await supabase
        .from("user_blocks")
        .insert({
          blocker_id: userId,
          blocked_id: otherUser.id,
        });

      if (error) throw error;

      setBlockedByMe(true);
      alert("تم حظر المستخدم بنجاح.");
    }
  } catch (err) {
    console.error("خطأ في الحظر:", err);
    alert("تعذر تنفيذ العملية. حاول مرة أخرى.");
  } finally {
    setBlocking(false);
  }
}


// إرسال بلاغ عن المستخدم
async function submitReport(e: React.FormEvent) {
  e.preventDefault();

  if (!conversation || !otherUser || !userId || !reportReason || reporting) {
    return;
  }

  setReporting(true);

  try {
    const { error } = await supabase
      .from("user_reports")
      .insert({
        reporter_id: userId,
        reported_user_id: otherUser.id,
        conversation_id: conversation.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });

    if (error) throw error;

    setShowReport(false);
    setReportReason("");
    setReportDetails("");

    alert("تم إرسال البلاغ إلى الإدارة بنجاح. شكراً لمساعدتنا في حماية المستخدمين.");
  } catch (err) {
    console.error("خطأ إرسال البلاغ:", err);
    alert("تعذر إرسال البلاغ. حاول مرة أخرى.");
  } finally {
    setReporting(false);
  }
}
async function sendMessage(e: React.FormEvent) {
  e.preventDefault();

  const body = messageText.trim();

  if (!body || !conversation || sending) return;

  if (blockedByMe || blockedMe) {
    alert(
      blockedMe
        ? "قام هذا المستخدم بحظرك، لا يمكنك مراسلته."
        : "لقد حظرت هذا المستخدم، لا يمكنك مراسلته."
    );
    return;
  }

    setSending(true);

    try {
      const { data, error: sendError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          body,
        })
        .select()
        .single();

      if (sendError) throw sendError;

      setMessages((previous) => [...previous, data]);
      setMessageText("");
    } catch (err) {
      console.error("خطأ إرسال الرسالة:", err);
      alert("تعذر إرسال الرسالة. حاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-10 text-center">
        جارٍ تحميل المحادثة...
      </div>
    );
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8 text-center">
        <p className="mb-5 font-bold text-red-600">{error}</p>
        <Link to="/" className="font-bold text-emerald-700">
          العودة للرئيسية
        </Link>
      </main>
    );
  }
  if (!id) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-black text-slate-800">
              رسائلي
            </h1>

            <button
              onClick={() => navigate("/")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              العودة للرئيسية
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-slate-500">
              لا توجد محادثات حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((item) => (
                <Link
                  key={item.id}
                  to={`/messages/${item.id}`}
                  className="block rounded-xl bg-white p-4 shadow-sm transition hover:bg-emerald-50"
                >


<div className="flex items-center gap-3">
  <img
    src={item.other_user?.avatar_url || "/default-avatar.png"}
    alt=""
    className="h-12 w-12 shrink-0 rounded-full object-cover"
  />

  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <p className="font-bold text-slate-800">
        {item.other_user?.display_name || "مستخدم"}
      </p>

      {item.unread_count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
          {item.unread_count}
        </span>
      )}
    </div>

    <p className="mt-1 truncate text-sm text-slate-600">
      {item.ad_title || "إعلان محذوف"}
    </p>
  </div>
</div>



{item.last_message && (
  <p className="mt-2 truncate text-sm text-slate-500">
    {item.last_message.body}
  </p>
)}

                  <p className="mt-2 text-sm text-slate-500">
                    {new Date(item.created_at).toLocaleString("ar-SY")}
                  </p>

                  <p className="mt-2 text-sm font-bold text-emerald-700">
                    فتح المحادثة ←
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }
  return (
    <main dir="rtl" className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      <header className="shrink-0 border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-emerald-700"
          >
            <ArrowRight size={20} />
            العودة للرئيسية
          </Link>

          <span className="mr-auto text-xl font-black text-emerald-700">
            Sooq.sy
          </span>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden p-4">
<div className="mb-4 shrink-0 rounded-xl bg-white p-4 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 className="text-xl font-black text-slate-800">
        {otherUser?.display_name || "المستخدم"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        تواصل مع الطرف الآخر بشأن الإعلان
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setShowReport(true)}
        className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50"
      >
        الإبلاغ عن المستخدم
      </button>

      <button
        onClick={toggleBlock}
        disabled={blocking}
        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {blocking
          ? "جارٍ التنفيذ..."
          : blockedByMe
            ? "إلغاء الحظر"
            : "حظر المستخدم"}
      </button>
    </div>
  </div>
</div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-xl bg-white p-4 shadow-sm">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-slate-400">
              لا توجد رسائل بعد. ابدأ المحادثة الآن.
            </p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === userId;

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      isMine
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.body}
                    </p>

                    <p
                      className={`mt-2 text-left text-xs ${
                        isMine ? "text-emerald-100" : "text-slate-400"
                      }`}
                    >
                      {new Date(message.created_at).toLocaleString("ar-SY")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

{blockedByMe || blockedMe ? (
  <div className="mt-4 shrink-0 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
    <p className="font-bold text-red-700">
      {blockedMe
        ? "قام هذا المستخدم بحظرك، لذلك لا يمكنك إرسال رسائل إليه."
        : "لقد حظرت هذا المستخدم، ولن تتمكنوا من تبادل الرسائل."}
    </p>
  </div>
) : (
  <form
    onSubmit={sendMessage}
    className="mt-4 flex shrink-0 gap-2 rounded-xl bg-white p-3 shadow-sm"
  >
    <textarea
      value={messageText}
      onChange={(e) => setMessageText(e.target.value)}
      placeholder="اكتب رسالتك هنا..."
      rows={2}
      maxLength={5000}
      className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 p-3 outline-none focus:border-emerald-500"
    />

    <button
      type="submit"
      disabled={sending || !messageText.trim()}
      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <Send size={18} />
      إرسال
    </button>
  </form>
)}
        {showReport && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 className="mb-2 text-xl font-black text-slate-800">
        الإبلاغ عن المستخدم
      </h2>

      <p className="mb-4 text-sm text-slate-500">
        يرجى تحديد سبب الإبلاغ، وسيتم إرسال البلاغ إلى الإدارة لمراجعته.
      </p>

      <form onSubmit={submitReport}>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          سبب الإبلاغ
        </label>

        <select
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-emerald-500"
        >
          <option value="">اختر سبب الإبلاغ</option>
          <option value="رسائل مزعجة أو متكررة">رسائل مزعجة أو متكررة</option>
          <option value="إساءة أو ألفاظ غير لائقة">إساءة أو ألفاظ غير لائقة</option>
          <option value="احتيال أو محاولة نصب">احتيال أو محاولة نصب</option>
          <option value="تهديد أو ابتزاز">تهديد أو ابتزاز</option>
          <option value="محتوى غير مناسب">محتوى غير مناسب</option>
          <option value="سبب آخر">سبب آخر</option>
        </select>

        <label className="mb-2 block text-sm font-bold text-slate-700">
          تفاصيل إضافية (اختياري)
        </label>

        <textarea
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="اشرح لنا المشكلة إن أردت..."
          className="mb-5 w-full resize-none rounded-lg border border-slate-200 p-3 outline-none focus:border-emerald-500"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!reportReason || reporting}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {reporting ? "جارٍ إرسال البلاغ..." : "إرسال البلاغ"}
          </button>

          <button
            type="button"
            onClick={() => setShowReport(false)}
            disabled={reporting}
            className="rounded-lg border border-slate-200 px-4 py-3 font-bold text-slate-600"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      </section>
    </main>
  );
}
