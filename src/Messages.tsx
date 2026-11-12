
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


  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();

    const body = messageText.trim();

    if (!body || !conversation || sending) return;

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
    <main dir="rtl" className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white px-4 py-4">
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

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4">
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <h1 className="text-xl font-black text-slate-800">
            المحادثة
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            تواصل مع الطرف الآخر بشأن الإعلان
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 shadow-sm">
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

        <form
          onSubmit={sendMessage}
          className="mt-4 flex gap-2 rounded-xl bg-white p-3 shadow-sm"
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
      </section>
    </main>
  );
}
