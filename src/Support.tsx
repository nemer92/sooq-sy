
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Headset,
  Send,
  RefreshCw,
  MessageCircle,
  CheckCheck,
} from "lucide-react";
import { supabase } from "./lib/supabase";

type SupportConversation = {
  id: string;
  status: "open" | "closed";
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  is_read: boolean;
  is_auto_reply: boolean;
  created_at: string;
};

export default function Support() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [conversation, setConversation] =
    useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const formatTime = (value: string) =>
    new Date(value).toLocaleString("ar-SY", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const loadMessages = useCallback(
    async (conversationId: string, currentUserId: string) => {
      const { data, error: messagesError } = await supabase
        .from("support_messages")
        .select(
          "id, conversation_id, sender_id, body, is_read, is_auto_reply, created_at"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("SUPPORT LOAD MESSAGES ERROR:", messagesError);
        setError("تعذر تحميل رسائل خدمة العملاء.");
        return;
      }

      const loadedMessages = (data ?? []) as SupportMessage[];
      setMessages(loadedMessages);

      // الرسائل الواردة، بما فيها الرد التلقائي، تُعلّم كمقروءة.
      const unreadIds = loadedMessages
        .filter(
          (message) =>
            message.sender_id !== currentUserId && !message.is_read
        )
        .map((message) => message.id);

      if (unreadIds.length > 0) {
        const { error: updateError } = await supabase
          .from("support_messages")
          .update({ is_read: true })
          .in("id", unreadIds);

        if (updateError) {
          console.error("SUPPORT MARK READ ERROR:", updateError);
        }
      }
    },
    []
  );

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    const user = authData?.user;

    if (authError || !user) {
      setLoading(false);
      navigate("/auth");
      return;
    }

    setUserId(user.id);

    let { data: existing, error: fetchError } = await supabase
      .from("support_conversations")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      setError("تعذر فتح محادثة خدمة العملاء.");
      setLoading(false);
      return;
    }

    if (!existing) {
      const { data: created, error: createError } = await supabase
        .from("support_conversations")
        .insert({ user_id: user.id })
        .select("id, status")
        .single();

      if (createError) {
        const retry = await supabase
          .from("support_conversations")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (retry.error || !retry.data) {
          setError("تعذر إنشاء محادثة الدعم. حاول مرة أخرى.");
          setLoading(false);
          return;
        }

        existing = retry.data;
      } else {
        existing = created;
      }
    }

    const activeConversation = existing as SupportConversation;

    setConversation(activeConversation);

    await loadMessages(activeConversation.id, user.id);

    setLoading(false);
  }, [loadMessages, navigate]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversation?.id || !userId) return;

    const channel = supabase
      .channel(`support-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          void loadMessages(conversation.id, userId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_conversations",
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as SupportConversation;

          setConversation((previous) =>
            previous
              ? { ...previous, status: updated.status }
              : previous
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation?.id, userId, loadMessages]);

  // تمرير داخل صندوق الرسائل فقط، وليس الصفحة كلها.
  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const sendMessage = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const body = draft.trim();

    if (!body || !conversation || !userId || sending) return;

    if (conversation.status === "closed") {
      setError(
        "هذه المحادثة مغلقة حالياً. يرجى انتظار إعادة فتحها من الإدارة."
      );
      return;
    }

    setSending(true);
    setError("");

    const { error: sendError } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: userId,
        body,
      });

    if (sendError) {
      console.error("SUPPORT SEND ERROR:", sendError);
      setError("لم يتم إرسال الرسالة. تحقق من اتصالك وحاول مرة أخرى.");
    } else {
      setDraft("");
      await loadMessages(conversation.id, userId);
      textareaRef.current?.focus();
    }

    setSending(false);
  };

  return (
    <main
      dir="rtl"
      className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100"
    >
      {/* رأس الصفحة */}
      <header className="z-20 shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-3 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
            aria-label="رجوع"
          >
            <ArrowRight size={20} />
          </button>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Headset size={23} />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-black text-slate-900">
              خدمة العملاء
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              فريق دعم Sooq.sy جاهز لمساعدتك
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadConversation()}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="تحديث المحادثة"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      {/* مساحة المحادثة */}
      <section className="mx-auto flex w-full max-w-4xl flex-1 min-h-0 flex-col px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* معلومات الدعم وحالة المحادثة */}
          <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <MessageCircle size={19} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-slate-800">
                    محادثة الدعم الفني
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    أرسل استفسارك وسنرد عليك هنا
                  </p>
                </div>
              </div>

              {!loading && conversation && (
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    conversation.status === "closed"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {conversation.status === "closed"
                    ? "مغلقة"
                    : "مفتوحة"}
                </span>
              )}
            </div>
          </div>

          {/* رسائل المحادثة */}
          <div
            ref={messagesContainerRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/70 px-3 py-4 sm:px-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {loading ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-slate-500">
                <RefreshCw size={25} className="animate-spin text-emerald-600" />
                <p className="text-sm font-semibold">
                  جارٍ تحميل محادثتك...
                </p>
              </div>
            ) : error && !conversation ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center px-4 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <MessageCircle size={25} />
                </div>

                <p className="text-sm font-bold text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => void loadConversation()}
                  className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center px-5 py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
                  <Headset size={30} />
                </div>

                <h3 className="text-base font-black text-slate-800">
                  أهلاً بك في خدمة العملاء
                </h3>

                <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                  نحن هنا لمساعدتك. اكتب رسالتك بالأسفل وسيقوم فريق الدعم بالرد عليك بأقرب وقت.
                </p>

                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-800">
                  يمكنك إرسال استفسار أو الإبلاغ عن مشكلة تواجهك في التطبيق.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="py-2 text-center">
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-400 shadow-sm">
                    بداية المحادثة
                  </span>
                </div>

                {messages.map((message) => {
                  const isMine =
                    !message.is_auto_reply &&
                    message.sender_id === userId;

                  const isSupportMessage =
                    message.is_auto_reply || !isMine;

                  return (
                    <div
                      key={message.id}
                      className={`flex w-full ${
                        isMine ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`flex max-w-[88%] flex-col sm:max-w-[75%] ${
                          isMine ? "items-start" : "items-end"
                        }`}
                      >
                        <div
                          className={`mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold ${
                            isMine
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          {isSupportMessage && (
                            <Headset size={12} />
                          )}

                          {message.is_auto_reply
                            ? "فريق خدمة العملاء"
                            : isMine
                              ? "أنت"
                              : "فريق خدمة العملاء"}
                        </div>

                        <div
                          className={`rounded-2xl px-4 py-3 shadow-sm ${
                            isMine
                              ? "rounded-tr-sm bg-emerald-600 text-white"
                              : "rounded-tl-sm border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-7">
                            {message.body}
                          </p>

                          <div
                            className={`mt-2 flex items-center justify-end gap-1.5 text-[10px] ${
                              isMine
                                ? "text-emerald-100"
                                : "text-slate-400"
                            }`}
                          >
                            <span>{formatTime(message.created_at)}</span>

                            {isMine && (
                              <CheckCheck size={13} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* رسائل الخطأ */}
          {error && conversation && (
            <div className="mx-3 mt-2 shrink-0 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-5">
              {error}
            </div>
          )}

          {/* منطقة كتابة الرسالة */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
            {conversation?.status === "closed" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-sm font-bold text-slate-700">
                  هذه المحادثة مغلقة
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  تم إغلاق المحادثة من الإدارة، ولا يمكنك إرسال رسائل جديدة حالياً.
                </p>
              </div>
            ) : (
              <form
                onSubmit={sendMessage}
                className="flex items-end gap-2"
              >
                <div className="min-w-0 flex-1">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="اكتب رسالتك هنا..."
                    rows={2}
                    maxLength={4000}
                    disabled={loading || sending || !conversation}
                    className="block max-h-32 min-h-12 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                  />

                  <p className="mt-1.5 px-1 text-[10px] text-slate-400">
                    اضغط Enter للإرسال، وShift + Enter لسطر جديد
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    !draft.trim() ||
                    sending ||
                    loading ||
                    !conversation
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="إرسال الرسالة"
                >
                  {sending ? (
                    <RefreshCw size={19} className="animate-spin" />
                  ) : (
                    <Send size={19} />
                  )}
                </button>
              </form>
            )}

            <p className="mt-2 text-center text-[10px] text-slate-400">
              خدمة العملاء - Sooq.sy
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
