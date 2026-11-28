
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  Send,
  ShieldAlert,
  Ban,
  MessageCircle,
  ArrowLeft,
  UserRound,
  Clock3,
  X,
  MessagesSquare,
} from "lucide-react";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  is_read: boolean;
  delivered_at: string | null;
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, id]);

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

          const conversationIds = (conversationsData || []).map(
            (item) => item.id
          );

          const adIds = [
            ...new Set((conversationsData || []).map((item) => item.ad_id)),
          ];

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

          const enrichedConversations = (conversationsData || []).map(
            (item) => {
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
            }
          );

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
    if (!id || !userId) return;

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
        async (payload) => {
          const incomingMessage = payload.new as Message;

          setMessages((previous) => {
            if (previous.some((message) => message.id === incomingMessage.id)) {
              return previous;
            }

            return [...previous, incomingMessage];
          });

          if (incomingMessage.sender_id !== userId) {
            const { error: readError } = await supabase.rpc(
              "mark_conversation_messages_read",
              { p_conversation_id: id }
            );

            if (readError) {
              console.error("خطأ تحديث قراءة الرسالة:", readError);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === updatedMessage.id
                ? { ...message, ...updatedMessage }
                : message
            )
          );
        }
      )
      .subscribe(async (status, err) => {
      console.log("Messages realtime status:", status);

      if (status === "SUBSCRIBED") {
        const { error: readError } = await supabase.rpc(
          "mark_conversation_messages_read",
          { p_conversation_id: id }
        );

        if (readError) {
          console.error("Read status update failed:", readError);
        } else {
          console.log("Conversation messages marked as read.");
        }
      }

      if (err) {
        console.error("Messages realtime error:", err);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, userId]);

  async function toggleBlock() {
    if (!otherUser || !userId || blocking) return;

    const action = blockedByMe ? "إلغاء الحظر" : "حظر هذا المستخدم";

    const confirmed = await window.sooqConfirm(
      `هل أنت متأكد من ${action}؟`
    );

    if (!confirmed) return;

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

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();

    if (
      !conversation ||
      !otherUser ||
      !userId ||
      !reportReason ||
      reporting
    ) {
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

      alert(
        "تم إرسال البلاغ إلى الإدارة بنجاح. شكراً لمساعدتنا في حماية المستخدمين."
      );
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

      setMessages((previous) => {
        if (previous.some((message) => message.id === data.id)) {
          return previous;
        }

        return [...previous, data];
      });

      setMessageText("");
    } catch (err) {
      console.error("خطأ إرسال الرسالة:", err);
      alert("تعذر إرسال الرسالة. حاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  }

  const formatMessageDate = (date: string) =>
    new Date(date).toLocaleString("ar-SY", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-dvh items-center justify-center bg-slate-50 p-6"
      >
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-10 py-9 shadow-sm">
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="text-sm font-bold text-slate-600">
            جارٍ تحميل المحادثة...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-center"
      >
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <MessageCircle size={30} />
          </div>

          <p className="mb-6 font-bold text-red-600">{error}</p>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-700"
          >
            العودة للرئيسية
            <ArrowLeft size={18} />
          </Link>
        </div>
      </main>
    );
  }

  if (!id) {
    return (
      <main
        dir="rtl"
        className="min-h-dvh bg-gradient-to-b from-emerald-50/70 via-slate-50 to-slate-50 px-4 py-6 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          <header className="mb-7 flex items-center justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-700">
                <MessagesSquare size={18} />
                مركز الرسائل
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                رسائلي
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                جميع محادثاتك مع مستخدمي Sooq.Sy
              </p>
            </div>

            <button
              onClick={() => navigate("/")}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
            >
              <ArrowRight size={17} />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          </header>

          {conversations.length === 0 ? (
            <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                <MessagesSquare size={38} />
              </div>

              <h2 className="text-lg font-black text-slate-800">
                لا توجد محادثات حتى الآن
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                عندما تتواصل مع أحد البائعين ستظهر محادثاتك هنا.
              </p>

              <Link
                to="/"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                تصفح الإعلانات
                <ArrowLeft size={17} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((item) => (
                <Link
                  key={item.id}
                  to={`/messages/${item.id}`}
                  className="group block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={
                          item.other_user?.avatar_url ||
                          "/default-avatar.png"
                        }
                        alt=""
                        className="h-14 w-14 rounded-2xl border border-slate-100 bg-slate-50 object-cover"
                      />

                      <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                        <MessageCircle
                          size={10}
                          className="text-white"
                        />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-black text-slate-800 transition group-hover:text-emerald-700">
                          {item.other_user?.display_name || "مستخدم"}
                        </p>

                        {item.unread_count > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-black text-white">
                            {item.unread_count}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        {item.ad_title || "إعلان محذوف"}
                      </p>

                      {item.last_message && (
                        <p className="mt-2 truncate text-sm text-slate-600">
                          {item.last_message.body}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-3">
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString(
                          "ar-SY"
                        )}
                      </span>

                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-emerald-600 group-hover:text-white">
                        <ArrowLeft size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f8f7]"
    >
      {/* رأس الصفحة */}
      <header className="z-10 shrink-0 border-b border-slate-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[62px] w-full max-w-5xl items-center justify-between px-4 sm:h-[70px] sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            <ArrowRight size={20} />
            <span className="hidden sm:inline">الرئيسية</span>
          </Link>

          <Link
            to="/"
            className="text-xl font-black tracking-tight text-emerald-700"
          >
            Sooq<span className="text-slate-800">.sy</span>
          </Link>

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <MessageCircle size={19} />
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-5">
        {/* بطاقة معلومات الطرف الآخر */}
        <div className="mb-3 shrink-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:mb-4 sm:p-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => otherUser?.id && navigate(`/user/${otherUser.id}`)} className="relative shrink-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              {otherUser?.avatar_url ? (
                <img
                  src={otherUser.avatar_url}
                  alt=""
                  className="h-12 w-12 rounded-2xl border border-slate-100 bg-slate-50 object-cover sm:h-14 sm:w-14"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 sm:h-14 sm:w-14">
                  <UserRound size={25} />
                </div>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => otherUser?.id && navigate(`/user/${otherUser.id}`)} className="truncate text-base font-black text-slate-900 sm:text-lg text-right">
                {otherUser?.display_name || "المستخدم"}
              </button>

              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
                <ShieldAlert size={13} className="text-emerald-600" />
                محادثة خاصة بشأن الإعلان
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setShowReport(true)}
                title="الإبلاغ عن المستخدم"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600 transition hover:bg-amber-100 sm:h-10 sm:w-10"
              >
                <ShieldAlert size={18} />
              </button>

              <button
                onClick={toggleBlock}
                disabled={blocking}
                title={blockedByMe ? "إلغاء الحظر" : "حظر المستخدم"}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-50 sm:h-10 sm:w-10 ${
                  blockedByMe
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                }`}
              >
                <Ban size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* مساحة الرسائل */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#f8faf9] px-3 py-4 sm:px-5">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                  <MessageCircle size={36} />
                </div>

                <h2 className="text-base font-black text-slate-800">
                  ابدأ محادثتك الآن
                </h2>

                <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                  أرسل رسالتك الأولى وتواصل مع الطرف الآخر بكل سهولة.
                </p>
              </div>
            ) : (
              <div className="my-auto space-y-4">
                {messages.map((message, index) => {
                  const isMine = message.sender_id === userId;
                  const previousMessage = messages[index - 1];

                  const showDate =
                    !previousMessage ||
                    new Date(message.created_at).toDateString() !==
                      new Date(previousMessage.created_at).toDateString();

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="my-5 flex items-center justify-center">
                          <span className="rounded-full border border-slate-100 bg-white px-4 py-1.5 text-[10px] font-bold text-slate-400 shadow-sm">
                            {new Date(message.created_at).toLocaleDateString(
                              "ar-SY",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex ${
                          isMine ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[88%] sm:max-w-[75%] ${
                            isMine ? "items-start" : "items-end"
                          } flex flex-col`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-3 shadow-sm sm:px-5 ${
                              isMine
                                ? "rounded-tr-md bg-emerald-600 text-white"
                                : "rounded-tl-md border border-slate-100 bg-white text-slate-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-[14px] leading-7 sm:text-[15px]">
                              {message.body
                                .split(
                                  /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s]+)/g
                                )
                                .map((part, partIndex) => {
                                  const markdownMatch = part.match(
                                    /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/
                                  );

                                  const plainMatch = part.match(
                                    /^https?:\/\/[^\s]+$/
                                  );

                                  const rawUrl =
                                    markdownMatch?.[2] || plainMatch?.[0];

                                  if (!rawUrl) {
                                    return (
                                      <span key={partIndex}>{part}</span>
                                    );
                                  }

                                  return (
                                    <a
                                      key={partIndex}
                                      href={rawUrl}
                                      onClick={(event) => {
                                        try {
                                          const url = new URL(rawUrl);

                                          if (
                                            url.hostname === "nemer92.github.io"
                                          ) {
                                            event.preventDefault();
                                            navigate(
                                              url.pathname.replace(
                                                "/sooq-sy",
                                                ""
                                              ) + url.search
                                            );
                                          }
                                        } catch {
                                          // تجاهل الرابط غير الصالح
                                        }
                                      }}
                                      className="break-all font-bold underline underline-offset-4"
                                    >
                                      {markdownMatch?.[1] || rawUrl}
                                    </a>
                                  );
                                })}
                            </p>
                          </div>

                          <span
                            className={`mt-1.5 flex items-center gap-1 px-1 text-[10px] ${
                              isMine
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }`}
                          >
                            {isMine && (
                              <span
                                className={`text-[13px] font-bold leading-none ${
                                  message.is_read
                                    ? "text-sky-500"
                                    : "text-slate-400"
                                }`}
                                title={
                                  message.is_read
                                    ? "مقروءة"
                                    : message.delivered_at
                                      ? "تم التسليم"
                                      : "تم الإرسال"
                                }
                              >
                                {message.is_read
                                  ? "✓✓"
                                  : message.delivered_at
                                    ? "✓✓"
                                    : "✓"}
                              </span>
                            )}
                            <Clock3 size={10} />
                            {formatMessageDate(message.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* حالة الحظر */}
          {blockedByMe || blockedMe ? (
            <div className="shrink-0 border-t border-red-100 bg-red-50 p-4 sm:p-5">
              <div className="flex items-center justify-center gap-3 text-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Ban size={20} />
                </div>

                <p className="text-sm font-bold leading-6 text-red-700">
                  {blockedMe
                    ? "قام هذا المستخدم بحظرك، لذلك لا يمكنك إرسال رسائل إليه."
                    : "لقد حظرت هذا المستخدم، ولن تتمكنوا من تبادل الرسائل."}
                </p>
              </div>
            </div>
          ) : (
            /* صندوق إرسال الرسالة */
            <form
              onSubmit={sendMessage}
              className="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-50">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();

                      if (messageText.trim() && !sending) {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder="اكتب رسالتك هنا..."
                  rows={1}
                  maxLength={5000}
                  className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={17} />
                  <span className="hidden sm:inline">
                    {sending ? "إرسال..." : "إرسال"}
                  </span>
                </button>
              </div>

              <p className="mt-2 px-2 text-[10px] text-slate-400">
                اضغط Enter للإرسال، أو Shift + Enter لإضافة سطر جديد
              </p>
            </form>
          )}
        </div>
      </section>

      {/* نافذة الإبلاغ */}
      {showReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !reporting) {
              setShowReport(false);
            }
          }}
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/50 bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <ShieldAlert size={23} />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    الإبلاغ عن المستخدم
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    ساعدنا في الحفاظ على أمان المجتمع
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReport(false)}
                disabled={reporting}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitReport}>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                سبب الإبلاغ
              </label>

              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                required
                className="mb-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              >
                <option value="">اختر سبب الإبلاغ</option>
                <option value="رسائل مزعجة أو متكررة">
                  رسائل مزعجة أو متكررة
                </option>
                <option value="إساءة أو ألفاظ غير لائقة">
                  إساءة أو ألفاظ غير لائقة
                </option>
                <option value="احتيال أو محاولة نصب">
                  احتيال أو محاولة نصب
                </option>
                <option value="تهديد أو ابتزاز">تهديد أو ابتزاز</option>
                <option value="محتوى غير مناسب">محتوى غير مناسب</option>
                <option value="سبب آخر">سبب آخر</option>
              </select>

              <label className="mb-2 block text-sm font-bold text-slate-700">
                تفاصيل إضافية
                <span className="mr-1 text-xs font-normal text-slate-400">
                  (اختياري)
                </span>
              </label>

              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="اشرح لنا المشكلة إن أردت..."
                className="mb-5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-7 text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!reportReason || reporting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {reporting ? "جارٍ إرسال البلاغ..." : "إرسال البلاغ"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowReport(false)}
                  disabled={reporting}
                  className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
