
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ArrowRight, ShieldCheck } from "lucide-react";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string;
};

export default function AdminConversation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReview() {
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

        const { data: isAdmin, error: adminError } =
          await supabase.rpc("is_admin");

        if (adminError) throw adminError;

        if (!isAdmin) {
          setError("ليس لديك صلاحية الوصول إلى هذه الصفحة.");
          return;
        }

        if (!id) {
          setError("رقم المحادثة غير صالح.");
          return;
        }

        const { data: conversation, error: conversationError } =
          await supabase
            .from("conversations")
            .select("id, buyer_id, seller_id")
            .eq("id", id)
            .maybeSingle();

        if (conversationError) throw conversationError;

        if (!conversation) {
          setError("المحادثة غير موجودة.");
          return;
        }

        const participantIds = [
          conversation.buyer_id,
          conversation.seller_id,
        ];

        const [profilesResult, messagesResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", participantIds),

          supabase
            .from("messages")
            .select("id, sender_id, body, created_at")
            .eq("conversation_id", id)
            .order("created_at", { ascending: true }),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (messagesResult.error) throw messagesResult.error;

        setProfiles(profilesResult.data || []);
        setMessages(messagesResult.data || []);
      } catch (err) {
        console.error("خطأ مراجعة المحادثة:", err);
        setError("تعذر تحميل المحادثة.");
      } finally {
        setLoading(false);
      }
    }

    loadReview();
  }, [id, navigate]);

  const getSenderName = (senderId: string) => {
    return (
      profiles.find((profile) => profile.id === senderId)?.display_name ||
      "مستخدم"
    );
  };

  if (loading) {
    return <div className="p-10 text-center">جارٍ تحميل المحادثة...</div>;
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8 text-center">
        <p className="mb-5 font-bold text-red-600">{error}</p>
        <Link to="/admin" className="font-bold text-emerald-700">
          العودة إلى لوحة الإدارة
        </Link>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black text-slate-800">
              <ShieldCheck className="text-emerald-600" />
              مراجعة المحادثة
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              عرض إداري للرسائل دون إمكانية إرسال رسائل.
            </p>
          </div>

          <Link
            to="/admin"
            className="flex items-center gap-2 rounded-lg border px-4 py-2 font-bold text-slate-600"
          >
            <ArrowRight size={18} />
            لوحة الإدارة
          </Link>
        </header>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-slate-400">
              لا توجد رسائل في هذه المحادثة.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-emerald-700">
                    {getSenderName(message.sender_id)}
                  </strong>

                  <time className="text-xs text-slate-400">
                    {new Date(message.created_at).toLocaleString("ar-SY")}
                  </time>
                </div>

                <p className="whitespace-pre-wrap break-words leading-7 text-slate-800">
                  {message.body}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
