
import { useEffect, useState } from "react";
import {
  Gift,
  RefreshCw,
  LoaderCircle,
  MapPin,
  CalendarDays,
  UserRound,
  Eye,
  X,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";

import { supabase } from "./lib/supabase";

type Donation = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  city_id: number;
  user_id: string;
  status: string;
  profiles: {
    display_name: string;
  } | null;
  cities: {
    name_ar: string;
  } | null;
};

export default function Donations() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] =
    useState<Donation | null>(null);

  async function loadDonations() {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("ads")
        .select(`
          id,
          title,
          description,
          created_at,
          city_id,
          user_id,
          status,
          profiles(display_name),
          cities(name_ar)
        `)
        .eq("listing_type", "donation")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDonations((data ?? []) as unknown as Donation[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر تحميل التبرعات."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDonations();
  }, []);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("ar-SY", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function statusText(status: string) {
    if (status === "approved") return "منشور";
    if (status === "pending") return "قيد المراجعة";
    if (status === "rejected") return "مرفوض";
    return status;
  }

  async function changeStatus(
    donation: Donation,
    newStatus: "approved" | "rejected"
  ) {
    setActionLoading(donation.id);
    setError("");

    try {
      const { error } = await supabase
        .from("ads")
        .update({ status: newStatus })
        .eq("id", donation.id);

      if (error) throw error;

      const updatedDonation = {
        ...donation,
        status: newStatus,
      };

      setDonations((current) =>
        current.map((item) =>
          item.id === donation.id ? updatedDonation : item
        )
      );

      setSelectedDonation((current) =>
        current?.id === donation.id ? updatedDonation : current
      );
    } catch (err: any) {
      console.error("Donation update error:", err);
      setError(
        err?.message ||
        err?.details ||
        err?.hint ||
        "تعذر تحديث حالة التبرع."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteDonation(donation: Donation) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف التبرع "${donation.title}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
    );

    if (!confirmed) return;

    setActionLoading(donation.id);
    setError("");

    try {
      const { error } = await supabase
        .from("ads")
        .delete()
        .eq("id", donation.id)
        .eq("listing_type", "donation")
        .select("id");

      if (error) throw error;

      setDonations((current) =>
        current.filter((item) => item.id !== donation.id)
      );

      setSelectedDonation((current) =>
        current?.id === donation.id ? null : current
      );
    } catch (err: any) {
      console.error("Donation delete error:", err);
      setError(
        err?.message ||
        err?.details ||
        err?.hint ||
        "تعذر حذف التبرع."
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="donations-section" dir="rtl">
      <div className="section-heading">
        <div>
          <h2>إدارة التبرعات</h2>
          <p>جميع الإعلانات المعروضة للتبرع مجاناً</p>
        </div>

        <button
          className="refresh-button"
          onClick={loadDonations}
          disabled={loading}
        >
          <RefreshCw size={17} />
          تحديث
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon approved">
            <Gift size={23} />
          </div>
          <span>إجمالي التبرعات</span>
          <strong>{donations.length}</strong>
        </div>
      </div>

      {error && <div className="data-error">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <LoaderCircle className="spin" size={28} />
          <p>جارٍ تحميل التبرعات...</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="empty-state">
          <Gift size={30} />
          <h3>لا توجد تبرعات حالياً</h3>
          <p>ستظهر هنا جميع إعلانات التبرع المجاني.</p>
        </div>
      ) : (
        <div className="users-list">
          {donations.map((donation) => (
            <article className="user-card" key={donation.id}>
              <div className="user-avatar">
                <Gift size={24} />
              </div>

              <div className="user-info">
                <h3>{donation.title}</h3>
                <p>{donation.description || "لا يوجد وصف"}</p>

                <span>
                  <UserRound size={14} />
                  {donation.profiles?.display_name || "مستخدم"}
                </span>

                <span>
                  <MapPin size={14} />
                  {donation.cities?.name_ar || "غير محددة"}
                </span>

                <span>
                  <CalendarDays size={14} />
                  {formatDate(donation.created_at)}
                </span>
              </div>

              <span className="category-active">
                {statusText(donation.status)}
              </span>

              <button
                className="refresh-button"
                onClick={() => setSelectedDonation(donation)}
              >
                <Eye size={17} />
                التفاصيل
              </button>

              {donation.status === "pending" && (
                <>
                  <button
                    className="refresh-button"
                    disabled={actionLoading === donation.id}
                    onClick={() => changeStatus(donation, "approved")}
                  >
                    <CheckCircle size={17} />
                    قبول ونشر
                  </button>

                  <button
                    className="refresh-button"
                    disabled={actionLoading === donation.id}
                    onClick={() => changeStatus(donation, "rejected")}
                  >
                    <XCircle size={17} />
                    رفض
                  </button>
                </>
              )}

              {donation.status === "approved" && (
                <button
                  className="refresh-button"
                  disabled={actionLoading === donation.id}
                  onClick={() => changeStatus(donation, "rejected")}
                >
                  <XCircle size={17} />
                  رفض التبرع
                </button>
              )}

              {donation.status === "rejected" && (
                <button
                  className="refresh-button"
                  disabled={actionLoading === donation.id}
                  onClick={() => changeStatus(donation, "approved")}
                >
                  <CheckCircle size={17} />
                  إعادة النشر
                </button>
              )}

              <button
                className="refresh-button"
                disabled={actionLoading === donation.id}
                onClick={() => deleteDonation(donation)}
              >
                {actionLoading === donation.id ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Trash2 size={17} />
                )}
                حذف نهائي
              </button>
            </article>
          ))}
        </div>
      )}

      {selectedDonation && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedDonation(null)}
        >
          <div
            className="modal-content"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>تفاصيل التبرع</h2>

              <button
                className="refresh-button"
                onClick={() => setSelectedDonation(null)}
              >
                <X size={20} />
              </button>
            </div>

            <h3>{selectedDonation.title}</h3>

            <p>
              {selectedDonation.description || "لا يوجد وصف"}
            </p>

            <hr />

            <p>
              <UserRound size={16} />
              صاحب التبرع:{" "}
              {selectedDonation.profiles?.display_name || "مستخدم"}
            </p>

            <p>
              <MapPin size={16} />
              المدينة:{" "}
              {selectedDonation.cities?.name_ar || "غير محددة"}
            </p>

            <p>
              <CalendarDays size={16} />
              تاريخ النشر: {formatDate(selectedDonation.created_at)}
            </p>

            <p>الحالة: {statusText(selectedDonation.status)}</p>

            {selectedDonation.status === "pending" && (
              <>
                <button
                  className="refresh-button"
                  disabled={actionLoading === selectedDonation.id}
                  onClick={() => changeStatus(selectedDonation, "approved")}
                >
                  <CheckCircle size={17} />
                  قبول ونشر التبرع
                </button>

                <button
                  className="refresh-button"
                  disabled={actionLoading === selectedDonation.id}
                  onClick={() => changeStatus(selectedDonation, "rejected")}
                >
                  <XCircle size={17} />
                  رفض التبرع
                </button>
              </>
            )}

            {selectedDonation.status === "approved" && (
              <button
                className="refresh-button"
                disabled={actionLoading === selectedDonation.id}
                onClick={() => changeStatus(selectedDonation, "rejected")}
              >
                <XCircle size={17} />
                رفض التبرع
              </button>
            )}

            {selectedDonation.status === "rejected" && (
              <button
                className="refresh-button"
                disabled={actionLoading === selectedDonation.id}
                onClick={() => changeStatus(selectedDonation, "approved")}
              >
                <CheckCircle size={17} />
                إعادة النشر
              </button>
            )}

            <button
              className="refresh-button"
              disabled={actionLoading === selectedDonation.id}
              onClick={() => deleteDonation(selectedDonation)}
            >
              <Trash2 size={17} />
              حذف نهائي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
