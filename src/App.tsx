
import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import Donations from "./Donations";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  FolderOpen,
  Flag,
  Settings,
  LogOut,
  Bell,
   Gift,
  LockKeyhole,
  Mail,
  LoaderCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Pencil,
  Eye,
  X,
  CalendarDays,
  UserRound,
  MapPin,
  Tag,
  Plus,
  Image as ImageIcon,
  Hash,
} from "lucide-react";

import { supabase } from "./lib/supabase";
import "./App.css";

type AdminSession = {
  id: string;
  email?: string;
};

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  ads?: {
    count: number;
  }[];
};
type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  target_type: "all" | "governorate" | "city" | "category" | "favorites";
  target_id: number | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: "draft" | "scheduled" | "sent" | "failed";
  created_at: string;
};
type Category = {
  id: number;
  parent_id: number | null;
  name_ar: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};
type City = {
  id: number;
  name_ar: string;
  is_active: boolean;
};
type Governorate = {
  id: number;
  name_ar: string;
  is_active: boolean;
};
type UserAd = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};

type UserBan = {
  id: string;
  ban_type: "temporary" | "permanent";
  reason: string;
  banned_until: string | null;
  created_at: string;
  lifted_at: string | null;
};

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  conversation_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "rejected" | "actioned";
  created_at: string;
  reporter_name?: string;
  reported_user_name?: string;
  active_ban?: boolean;
};
type NamedItem = {
  name_ar: string;
};

type AdImage = {
  image_path: string;
  sort_order: number;
  signedUrl?: string | null;
};

type Related<T> = T | T[] | null;

type Ad = {
  id: string;
  user_id: string;
  title: string;
  listing_type: "sale" | "donation";
  description: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  created_at: string;
  category_id: number;
  city_id: number;
  is_featured: boolean;
  profiles: Related<Profile>;
  categories: Related<NamedItem>;
  cities: Related<NamedItem>;
  ad_images: AdImage[] | null;
};

function getOne<T>(value: Related<T>): T | null {
  if (!value) return null;

  return Array.isArray(value)
    ? value[0] ?? null
    : value as T;
}

function App() {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
const [phone, setPhone] = useState("");
const [password, setPassword] = useState("");

  const [admin, setAdmin] = useState<AdminSession | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationLink, setNotificationLink] = useState("");
  const [notificationTarget, setNotificationTarget] = useState("all");
  const [notificationTargetId, setNotificationTargetId] = useState("");
  const [notificationScheduledAt, setNotificationScheduledAt] = useState("");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const [error, setError] = useState("");
  const [dataError, setDataError] = useState("");
  const [siteName, setSiteName] = useState("Sooq.Sy");
  const [allowNewAds, setAllowNewAds] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [adminLoginUpdating, setAdminLoginUpdating] = useState(false);
const [adminLoginMessage, setAdminLoginMessage] = useState("");
const [adminLoginError, setAdminLoginError] = useState("");
  const [activeMenu, setActiveMenu] = useState("الرئيسية");

  const [stats, setStats] = useState({

    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportSaving, setReportSaving] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [approvedAds, setApprovedAds] = useState<Ad[]>([]);
  const [approvedAdsLoading, setApprovedAdsLoading] = useState(false);
  const [archivedAds, setArchivedAds] = useState<Ad[]>([]);
  const [archivedAdsLoading, setArchivedAdsLoading] = useState(false);
  const reportStats = {
  all: reports.length,
  pending: reports.filter((r) => r.status === "pending").length,
reviewed: reports.filter((r) => r.status === "reviewed").length,
actioned: reports.filter((r) => r.status === "actioned").length,
rejected: reports.filter((r) => r.status === "rejected").length,
};
  const [adsLoading, setAdsLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoriesSuccess, setCategoriesSuccess] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState("");
  const [citiesSuccess, setCitiesSuccess] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [citySaving, setCitySaving] = useState(false);
  const [showCityForm, setShowCityForm] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorateId, setSelectedGovernorateId] = useState<number | "">("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  
  

  const [userAds, setUserAds] = useState<UserAd[]>([]);  const [userAdsLoading, setUserAdsLoading] = useState(false);

  // التحقق من صلاحيات المدير
  async function verifyAdmin(userId: string, userEmail?: string) {
    const { data, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      await supabase.auth.signOut();

      throw new Error(
        "هذا الحساب ليس لديه صلاحية دخول لوحة الإدارة."
      );
    }

    setAdmin({
      id: userId,
      email: userEmail,
    });
  }

  // التحقق من الجلسة عند فتح لوحة الإدارة
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          await verifyAdmin(
            data.session.user.id,
            data.session.user.email
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "حدث خطأ أثناء التحقق."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

// تسجيل الدخول برقم الموبايل
async function handleLogin(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setError("");
  setSubmitting(true);

  try {
    const cleanPhone = phone.trim();

    if (!/^09[0-9]{8}$/.test(cleanPhone)) {
      throw new Error(
        "يرجى إدخال رقم موبايل سوري صحيح يبدأ بـ 09."
      );
    }

    const internalEmail =
      `phone.${cleanPhone}@login.sooq.sy`;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

    if (error) throw error;

    if (!data.user) {
      throw new Error("تعذر الحصول على بيانات الحساب.");
    }

    await verifyAdmin(
      data.user.id,
      data.user.email
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "تعذر تسجيل الدخول."
    );
  } finally {
    setSubmitting(false);
  }
}

  // تسجيل الخروج
  async function handleLogout() {
    await supabase.auth.signOut();

    setAdmin(null);
    setPassword("");
    setError("");
    setDataError("");
    setSelectedAd(null);
  }

  // تحميل بيانات لوحة الإدارة
  const loadDashboard = useCallback(async () => {
    setAdsLoading(true);
    setDataError("");

    try {
      // تحميل الإحصائيات
      const statuses = [
        "pending",
        "approved",
        "rejected",
      ];

      const results = await Promise.all(
        statuses.map((status) =>
          supabase
            .from("ads")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("status", status)
        )
      );

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }

      const pending = results[0].count ?? 0;
      const approved = results[1].count ?? 0;
      const rejected = results[2].count ?? 0;

      setStats({
        pending,
        approved,
        rejected,
        total: pending + approved + rejected,
      });

      // تحميل الإعلانات مع البيانات المرتبطة
      const { data, error } = await supabase
        .from("ads")
        .select(`
          id,
          user_id,
          title,
          listing_type,
          description,
          price,
          currency,
          condition,
          created_at,
          category_id,
          city_id,

          profiles (
            display_name,
            avatar_url
          ),

          categories (
            name_ar
          ),

          cities (
            name_ar
          ),

          ad_images (
            image_path,
            sort_order
          )
        `)
        .eq("status", "pending")
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (error) throw error;

      // إنشاء روابط مؤقتة للصور من المخزن الخاص
      const adsWithImages: Ad[] = await Promise.all(
        (data ?? []).map(async (rawAd) => {
          const ad = rawAd as unknown as Ad;

          const sortedImages = [...(ad.ad_images ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order
          );

          const imagesWithUrls = await Promise.all(
            sortedImages.map(async (image) => {
              try {
                const { data: imageData, error: imageError } =
                  await supabase.storage
                    .from("ad-images")
                    .createSignedUrl(image.image_path, 3600);

                if (imageError) {
                  console.error(
                    "تعذر إنشاء رابط الصورة:",
                    imageError
                  );

                  return {
                    ...image,
                    signedUrl: null,
                  };
                }

                return {
                  ...image,
                  signedUrl: imageData.signedUrl,
                };
              } catch (err) {
                console.error(
                  "حدث خطأ أثناء تحميل الصورة:",
                  err
                );

                return {
                  ...image,
                  signedUrl: null,
                };
              }
            })
          );

          return {
            ...ad,
            ad_images: imagesWithUrls,
          };
        })
      );

      setAds(adsWithImages);

      // تحديث الإعلان المفتوح إذا كان ما زال موجوداً
      setSelectedAd((current) => {
        if (!current) return null;

        return (
          adsWithImages.find(
            (ad) => ad.id === current.id
          ) ?? null
        );
      });
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : "تعذر تحميل بيانات الإعلانات."
      );
    } finally {
      setAdsLoading(false);
    }
  }, []);

const loadApprovedAds = useCallback(async () => {
  setApprovedAdsLoading(true);

  try {
    const { data, error } = await supabase
      .from("ads")
      .select(`
        id,
        user_id,
        title,
        listing_type,
        description,
        price,
        currency,
        condition,
        created_at,
        is_featured,
        category_id,
        city_id,

        profiles (
          display_name,
          avatar_url
        ),

        categories (
          name_ar
        ),

        cities (
          name_ar
        ),

        ad_images (
          image_path,
          sort_order
        )
      `)
      .eq("status", "approved")
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (error) throw error;

    const adsWithImages: Ad[] = await Promise.all(
      (data ?? []).map(async (rawAd) => {
        const ad = rawAd as unknown as Ad;

        const sortedImages = [...(ad.ad_images ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );

        const imagesWithUrls = await Promise.all(
          sortedImages.map(async (image) => {
            try {
              const { data: imageData, error: imageError } =
                await supabase.storage
                  .from("ad-images")
                  .createSignedUrl(image.image_path, 3600);

              if (imageError) {
                console.error("تعذر إنشاء رابط الصورة:", imageError);
                return { ...image, signedUrl: null };
              }

              return {
                ...image,
                signedUrl: imageData.signedUrl,
              };
            } catch (err) {
              console.error("حدث خطأ أثناء تحميل الصورة:", err);
              return { ...image, signedUrl: null };
            }
          })
        );

        return {
          ...ad,
          ad_images: imagesWithUrls,
        };
      })
    );

    setApprovedAds(adsWithImages);
  } catch (err) {
    setDataError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل الإعلانات المنشورة."
    );
  } finally {
    setApprovedAdsLoading(false);
  }
}, []);

const toggleFeaturedAd = async (ad: Ad) => {
  setActionLoading(ad.id);

  try {
    const newValue = !ad.is_featured;

    const { data, error } = await supabase
      .from("ads")
      .update({
        is_featured: newValue,
      })
      .eq("id", ad.id)
      .select("id, is_featured");

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error("لم يتم تحديث الإعلان. تحقق من صلاحيات التعديل في Supabase.");
    }

    console.log("نتيجة تحديث الإعلان:", data);

    await loadApprovedAds();

  } catch (err) {
    console.error("خطأ التمييز:", err);

    setDataError(
      err instanceof Error
        ? err.message
        : "تعذر تحديث حالة الإعلان المميز."
    );
  } finally {
    setActionLoading(null);
  }
};

const loadArchivedAds = useCallback(async () => {
  setArchivedAdsLoading(true);

  try {
    const { data, error } = await supabase
      .from("ads")
      .select(`
        id,
        user_id,
        title,
        listing_type,
        description,
        price,
        currency,
        condition,
        created_at,
        category_id,
        city_id,

        profiles (
          display_name,
          avatar_url
        ),

        categories (
          name_ar
        ),

        cities (
          name_ar
        ),

        ad_images (
          image_path,
          sort_order
        )
      `)
      .eq("status", "archived")
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (error) throw error;

    const adsWithImages: Ad[] = await Promise.all(
      (data ?? []).map(async (rawAd) => {
        const ad = rawAd as unknown as Ad;

        const sortedImages = [...(ad.ad_images ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );

        const imagesWithUrls = await Promise.all(
          sortedImages.map(async (image) => {
            try {
              const { data: imageData, error: imageError } =
                await supabase.storage
                  .from("ad-images")
                  .createSignedUrl(image.image_path, 3600);

              if (imageError) {
                console.error("تعذر إنشاء رابط الصورة:", imageError);
                return { ...image, signedUrl: null };
              }

              return {
                ...image,
                signedUrl: imageData.signedUrl,
              };
            } catch (err) {
              console.error("حدث خطأ أثناء تحميل الصورة:", err);
              return { ...image, signedUrl: null };
            }
          })
        );

        return {
          ...ad,
          ad_images: imagesWithUrls,
        };
      })
    );

    setArchivedAds(adsWithImages);
  } catch (err) {
    setDataError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل الإعلانات المؤرشفة."
    );
  } finally {
    setArchivedAdsLoading(false);
  }
}, []);


useEffect(() => {
  if (admin && activeMenu === "إدارة الإعلانات") {
    loadApprovedAds();
  }
}, [admin, activeMenu, loadApprovedAds]);
useEffect(() => {
  if (admin && activeMenu === "الإعلانات المؤرشفة") {
    loadArchivedAds();
  }
}, [admin, activeMenu, loadArchivedAds]);
  // تحميل البيانات بعد دخول المدير
  useEffect(() => {
    if (admin) {
      loadDashboard();
    }
  }, [admin, loadDashboard]);
// تحميل قائمة المستخدمين
const loadUsers = useCallback(async () => {
  setUsersLoading(true);
  setUsersError("");

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        display_name,
        avatar_url,
        created_at,
        ads(count)
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) throw error;

    setUsers((data ?? []) as Profile[]);
  } catch (err) {
    setUsersError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل المستخدمين."
    );
  } finally {
    setUsersLoading(false);
  }
}, []);
const loadReports = useCallback(async () => {
  setReportsLoading(true);
  setReportsError("");

  try {
    // تحميل البلاغات
    const { data, error } = await supabase
.from("user_reports")
.select(`
  id,
  reporter_id,
  reported_user_id,
  conversation_id,
  reason,
  details,
  status,
  created_at
`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const reportsData = (data ?? []) as Report[];

    // استخراج معرفات المستخدمين والإعلانات
    const userIds = [
      ...new Set(
        reportsData.flatMap((report) =>
          [report.reporter_id, report.reported_user_id].filter(
            (id): id is string => Boolean(id)
          )
        )
      ),
    ];



    const userNames = new Map<string, string>();


    // تحميل أسماء المستخدمين
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      profiles?.forEach((profile) => {
        userNames.set(
          profile.id,
          profile.display_name || "مستخدم جديد"
        );
      });
    }


// استخراج معرفات المستخدمين المبلّغ عنهم
const reportedUserIds = [
  ...new Set(reportsData.map((report) => report.reported_user_id)),
];

// تحميل سجلات الحظر
const activeBanUsers = new Set<string>();

if (reportedUserIds.length > 0) {
  const { data: bans, error: bansError } = await supabase
    .from("user_bans")
    .select("user_id, ban_type, banned_until, lifted_at")
    .in("user_id", reportedUserIds);

  if (bansError) throw bansError;

  (bans || []).forEach((ban) => {
    if (ban.lifted_at !== null) return;

    if (
      ban.ban_type === "permanent" ||
      (ban.banned_until !== null &&
        new Date(ban.banned_until).getTime() > Date.now())
    ) {
      activeBanUsers.add(ban.user_id);
    }
  });
}


// ربط أسماء المستخدمين بالبلاغات
const enrichedReports = reportsData.map((report) => ({
  ...report,
  reporter_name:
    userNames.get(report.reporter_id) || "مستخدم غير معروف",
  reported_user_name:
    userNames.get(report.reported_user_id) || "مستخدم غير معروف",
  active_ban: activeBanUsers.has(report.reported_user_id),
}));

    setReports(enrichedReports);

  } catch (err) {
    setReportsError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل البلاغات."
    );
  } finally {
    setReportsLoading(false);
  }
}, []);


const handleAdminBan = async (
  report: Report,
  banType: "temporary" | "permanent"
) => {
  const reason = window.prompt(
    "اكتب سبب حظر المستخدم:",
    report.reason
  );

  if (!reason?.trim()) return;

  let bannedUntil: string | null = null;

  if (banType === "temporary") {
    const daysInput = window.prompt(
      "مدة الحظر بالأيام:",
      "7"
    );

    if (daysInput === null) return;

    const days = Number(daysInput);

    if (!Number.isInteger(days) || days <= 0) {
      alert("يرجى إدخال عدد أيام صحيح.");
      return;
    }

    bannedUntil = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toISOString();
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("لم يتم العثور على حساب المدير.");

    const { data: history, error: historyError } = await supabase
      .from("user_bans")
      .select("id, ban_type, reason, banned_until, created_at, lifted_at")
      .eq("user_id", report.reported_user_id);

    if (historyError) throw historyError;

const activeBan = (history || []).find((ban) => {
  if (ban.lifted_at !== null) return false;

  if (ban.ban_type === "permanent") return true;

  return (
    ban.banned_until !== null &&
    new Date(ban.banned_until).getTime() > Date.now()
  );
});

if (activeBan) {
  alert("هذا المستخدم لديه حظر فعّال بالفعل.");
  return;
}

    const { error: insertError } = await supabase
      .from("user_bans")
      .insert({
        user_id: report.reported_user_id,
        ban_type: banType,
        reason: reason.trim(),
        banned_until: bannedUntil,
        banned_by: user.id,
      });

    if (insertError) throw insertError;

    setReports((prev) =>
  prev.map((item) =>
    item.reported_user_id === report.reported_user_id
      ? { ...item, active_ban: true }
      : item
  )
);

alert("تم حظر المستخدم بنجاح.");
  } catch (err) {
    console.error("خطأ في حظر المستخدم:", err);
    alert("تعذر تنفيذ الحظر.");
  }
};


const handleAdminUnban = async (report: Report) => {
  if (!window.confirm("هل أنت متأكد من فك الحظر عن هذا المستخدم؟")) {
    return;
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("لم يتم العثور على حساب المدير.");

    const { data: history, error: historyError } = await supabase
      .from("user_bans")
      .select("id, ban_type, banned_until, lifted_at")
      .eq("user_id", report.reported_user_id);

    if (historyError) throw historyError;

    const activeBan = (history || []).find((ban) => {
      if (ban.lifted_at !== null) return false;

      if (ban.ban_type === "permanent") return true;

      return (
        ban.banned_until !== null &&
        new Date(ban.banned_until).getTime() > Date.now()
      );
    });

    if (!activeBan) {
      alert("لا يوجد حظر فعّال على هذا المستخدم.");
      return;
    }

    const { error } = await supabase
      .from("user_bans")
      .update({
        lifted_at: new Date().toISOString(),
        lifted_by: user.id,
      })
      .eq("id", activeBan.id);

    if (error) throw error;

    setReports((prev) =>
  prev.map((item) =>
    item.reported_user_id === report.reported_user_id
      ? { ...item, active_ban: false }
      : item
  )
);

alert("تم فك الحظر بنجاح.");
  } catch (err) {
    console.error("خطأ في فك الحظر:", err);
    alert("تعذر فك الحظر.");
  }
};


async function updateReportStatus(
  reportId: string,
  status: Report["status"]
) {
  setReportSaving(true);
  setReportsError("");

  try {
    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", reportId);

    if (error) throw error;

    await loadReports();

    
  } catch (err) {
    setReportsError(
      err instanceof Error
        ? err.message
        : "تعذر تحديث حالة البلاغ."
    );
  } finally {
    setReportSaving(false);
  }
}
const loadCategories = useCallback(async () => {
  setCategoriesLoading(true);
  setCategoriesError("");

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id,parent_id,name_ar,icon,sort_order,is_active")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    setCategories((data ?? []) as Category[]);
  } catch (err) {
    setCategoriesError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل التصنيفات."
    );
  } finally {
    setCategoriesLoading(false);
  }
}, []);

const loadCities = useCallback(async () => {
  setCitiesLoading(true);
  setCitiesError("");

  try {
    const { data, error } = await supabase
      .from("cities")
      .select("id,name_ar,is_active")
      .order("name_ar", { ascending: true });

    if (error) throw error;

    setCities((data ?? []) as City[]);
  } catch (err) {
    setCitiesError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل المدن."
    );
  } finally {
    setCitiesLoading(false);
  }
}, []);
const loadSettings = useCallback(async () => {
  setSettingsLoading(true);
  setSettingsError("");

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, logo_url, hero_image_url, contact_email, contact_phone, allow_new_ads, maintenance_mode")
      .eq("id", 1)
      .single();

    if (error) throw error;

    setSiteName(data.site_name ?? "Sooq.Sy");
    setLogoUrl(data.logo_url ?? "");
    setHeroImageUrl(data.hero_image_url || "");
    setContactEmail(data.contact_email ?? "");
    setContactPhone(data.contact_phone ?? "");
    setAllowNewAds(data.allow_new_ads ?? true);
    setMaintenanceMode(data.maintenance_mode ?? false);
  } catch (err) {
    setSettingsError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل إعدادات الموقع."
        
    );
  } finally {
    setSettingsLoading(false);
  }
}, []);
const uploadHeroImage = async () => {
  if (!heroImageFile) {
    setSettingsError("يرجى اختيار صورة أولاً.");
    return;
  }

  setHeroImageUploading(true);
  setSettingsError("");
  setSettingsSuccess("");

  try {
    const fileExt = heroImageFile.name.split(".").pop() || "jpg";
    const filePath = `hero-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("site-images")
      .upload(filePath, heroImageFile, {
        upsert: true,
        contentType: heroImageFile.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("site-images")
      .getPublicUrl(filePath);

    setHeroImageUrl(data.publicUrl);
    setHeroImageFile(null);
    setSettingsSuccess("تم رفع صورة الواجهة بنجاح. اضغط حفظ الإعدادات لتثبيت الرابط.");
  } catch (err) {
    setSettingsError(
      err instanceof Error ? err.message : "تعذر رفع الصورة."
    );
  } finally {
    setHeroImageUploading(false);
  }
};
const saveSettings = useCallback(async () => {
  setSettingsSaving(true);
  setSettingsError("");
  setSettingsSuccess("");

  try {
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: siteName,
        logo_url: logoUrl || null,
        hero_image_url: heroImageUrl || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        allow_new_ads: allowNewAds,
        maintenance_mode: maintenanceMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) throw error;

    setSettingsSuccess("تم حفظ الإعدادات بنجاح.");
  } catch (err) {
    setSettingsError(
      err instanceof Error ? err.message : "تعذر حفظ الإعدادات."
    );
  } finally {
    setSettingsSaving(false);
  }
}, [siteName, logoUrl, heroImageUrl, contactEmail, contactPhone, allowNewAds, maintenanceMode]);
const loadGovernorates = useCallback(async () => {
  const { data, error } = await supabase
    .from("governorates")
    .select("id,name_ar,is_active")
    .eq("is_active", true)
    .order("name_ar", { ascending: true });

  if (error) {
    console.error("Load governorates error:", error);
    return;
  }

  setGovernorates((data ?? []) as Governorate[]);
}, []);

async function addCategory() {
  const name = newCategoryName.trim();

  if (!name) {
    setCategoriesError("يرجى كتابة اسم التصنيف.");
    return;
  }

  const parentId = newCategoryParent
  ? Number(newCategoryParent)
  : null;





const duplicate = categories.some(
  (category) =>
    category.name_ar.trim().toLowerCase() === name.toLowerCase() &&
    category.parent_id === parentId
);

if (duplicate) {
  setCategoriesError("هذا التصنيف موجود مسبقاً.");
  return;
}

  setCategorySaving(true);
  setCategoriesError("");
  setCategoriesSuccess("");

  try {
    const { error } = await supabase
      .from("categories")
      .insert({
        name_ar: name,
        parent_id: newCategoryParent
          ? Number(newCategoryParent)
          : null,
        sort_order: categories.length + 1,
        is_active: true,
      });

    if (error) throw error;

    setNewCategoryName("");
    setNewCategoryParent("");
    setShowCategoryForm(false);

    await loadCategories();
    setCategoriesSuccess("تمت إضافة التصنيف بنجاح.");
} catch (err) {
  console.error("Add category error:", err);

  setCategoriesError(
    err && typeof err === "object" && "message" in err
      ? String(err.message)
      : "تعذرت إضافة التصنيف."
  );
} finally {
  setCategorySaving(false);
}
}
async function updateCategory() {
  const category = editingCategory;

  if (category === null) {
    return;
  }

  const categoryId = category.id;
  const name = newCategoryName.trim();

  if (!name) {
    setCategoriesError("يرجى كتابة اسم التصنيف.");
    return;
  }

  const parentId = newCategoryParent
  ? Number(newCategoryParent)
  : null;

  let currentParentId = parentId;

while (currentParentId !== null) {
  if (currentParentId === categoryId) {
    setCategoriesError(
      "لا يمكن نقل التصنيف إلى أحد تصنيفاته الفرعية."
    );
    return;
  }

  const parentCategory = categories.find(
    (item) => item.id === currentParentId
  );

  currentParentId = parentCategory?.parent_id ?? null;
}

const hasSubCategories = categories.some(
  (item) => item.parent_id === categoryId
);

if (hasSubCategories && parentId !== null) {
  setCategoriesError(
    "لا يمكن تحويل تصنيف رئيسي يحتوي على تصنيفات فرعية إلى تصنيف فرعي."
  );
  return;
}

const duplicate = categories.some(
  (item) =>
    item.id !== categoryId &&
    item.name_ar.trim().toLowerCase() === name.toLowerCase() &&
    item.parent_id === parentId
);

if (duplicate) {
  setCategoriesError("يوجد تصنيف آخر بهذا الاسم ضمن التصنيف الأب نفسه.");
  return;
}

  setCategorySaving(true);
  setCategoriesError("");
  setCategoriesSuccess("");

  try {
    const { data, error } = await supabase
      .from("categories")
.update({
  name_ar: name,
  parent_id: newCategoryParent
    ? Number(newCategoryParent)
    : null,
})
      .eq("id", categoryId)
      .select("id, name_ar")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "لم يتم تعديل التصنيف. تحقق من صلاحيات التعديل في قاعدة البيانات."
      );
    }

await loadCategories();
setCategoriesSuccess("تم تعديل التصنيف بنجاح.");

setEditingCategory(null);
setNewCategoryName("");
setNewCategoryParent("");
setShowCategoryForm(false);

  } catch (err) {
    setCategoriesError(
      err instanceof Error
        ? err.message
        : "تعذر تعديل التصنيف."
    );
  } finally {
    setCategorySaving(false);
  }
}
async function toggleCategoryStatus(category: Category) {
  
  setCategorySaving(true);
  setCategoriesError("");
  setCategoriesSuccess("");

  try {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (error) throw error;

    await loadCategories();
    setCategoriesSuccess(
  category.is_active
    ? "تم إيقاف التصنيف بنجاح."
    : "تم تفعيل التصنيف بنجاح."
);
} catch (err) {
  console.error("Toggle category error:", err);

  setCategoriesError(
    err && typeof err === "object" && "message" in err
      ? String(err.message)
      : "تعذر تغيير حالة التصنيف."
  );
} finally {
  setCategorySaving(false);
}
}
async function addCity() {
  const name = newCityName.trim();

  if (!name) {
    setCitiesError("يرجى كتابة اسم المدينة.");
    return;
  }
  if (!selectedGovernorateId) {
  setCitiesError("يرجى اختيار المحافظة.");
  return;
}

  const duplicate = cities.some(
    (city) =>
      city.name_ar.trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    setCitiesError("هذه المدينة موجودة مسبقاً.");
    return;
  }

  setCitySaving(true);
  setCitiesError("");
  setCitiesSuccess("");

  try {
    const { error } = await supabase
      .from("cities")
.insert({
  name_ar: name,
  governorate_id: selectedGovernorateId,
  is_active: true,
});

    if (error) throw error;

    setNewCityName("");
    setSelectedGovernorateId("");
    setShowCityForm(false);

    await loadCities();
    setCitiesSuccess("تمت إضافة المدينة بنجاح.");
} catch (err) {
  console.error("Add city error:", err);

  setCitiesError(
    (err as { message?: string })?.message ||
    "تعذرت إضافة المدينة."
  );
}
 finally {
    setCitySaving(false);
  }
}
async function updateCity() {
  if (!editingCity) return;

  const name = newCityName.trim();

  if (!name) {
    setCitiesError("يرجى كتابة اسم المدينة.");
    return;
  }

  const duplicate = cities.some(
    (city) =>
      city.id !== editingCity.id &&
      city.name_ar.trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    setCitiesError("توجد مدينة أخرى بهذا الاسم.");
    return;
  }

  setCitySaving(true);
  setCitiesError("");
  setCitiesSuccess("");

  try {
    const { data, error } = await supabase
      .from("cities")
      .update({ name_ar: name })
      .eq("id", editingCity.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("لم يتم تعديل المدينة. تحقق من صلاحيات التعديل.");
    }

    await loadCities();

    setEditingCity(null);
    setNewCityName("");
    setShowCityForm(false);
    setCitiesSuccess("تم تعديل المدينة بنجاح.");
  } catch (err) {
    setCitiesError(
      err instanceof Error ? err.message : "تعذر تعديل المدينة."
    );
  } finally {
    setCitySaving(false);
  }
}

async function toggleCityStatus(city: City) {
  const { data: adminCheck, error: adminError } =
  await supabase.rpc("is_admin");

console.log("Admin check:", adminCheck);
console.log("Admin error:", adminError);
  setCitySaving(true);
  setCitiesError("");
  setCitiesSuccess("");

  try {
    const { error } = await supabase
      .from("cities")
      .update({ is_active: !city.is_active })
      .eq("id", city.id);

    if (error) throw error;

    await loadCities();

    setCitiesSuccess(
      city.is_active
        ? "تم إيقاف المدينة بنجاح."
        : "تم تفعيل المدينة بنجاح."
    );
} catch (err) {
  console.error("Toggle city status error:", err);

  setCitiesError(
    (err as { message?: string })?.message ||
    "تعذر تغيير حالة المدينة."
  );
} finally {
    setCitySaving(false);
  }
}

// فتح تفاصيل المستخدم وتحميل إعلاناته
async function openUser(user: Profile) {
  setSelectedUser(user);
  setUserAds([]);
  setUserAdsLoading(true);
  setUsersError("");

  try {
    const { data, error } = await supabase
      .from("ads")
      .select(`
        id,
        title,
        price,
        currency,
        status,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) throw error;

    setUserAds((data ?? []) as UserAd[]);
  } catch (err) {
    setUsersError(
      err instanceof Error
        ? err.message
        : "تعذر تحميل إعلانات المستخدم."
    );
  } finally {
    setUserAdsLoading(false);
  }
}
async function openReportedUser(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      alert("لم يتم العثور على بيانات هذا المستخدم.");
      return;
    }

    await openUser(data as Profile);
  } catch (err) {
    console.error("خطأ فتح المستخدم المُبلّغ عنه:", err);
    alert("تعذر فتح ملف المستخدم.");
  }
}
// تحميل المستخدمين عند فتح قسم المستخدمين
useEffect(() => {
  if (admin && activeMenu === "المستخدمون") {
    loadUsers();
  }
}, [admin, activeMenu, loadUsers]);
// تحميل البلاغات عند فتح قسم البلاغات
useEffect(() => {
  if (admin && activeMenu === "البلاغات") {
    loadReports();
  }
}, [admin, activeMenu, loadReports]);

// تحميل التصنيفات عند فتح قسم التصنيفات
useEffect(() => {
  if (admin && activeMenu === "التصنيفات") {
    loadCategories();
  }
}, [admin, activeMenu, loadCategories]);

// تحميل المدن عند فتح قسم إدارة المدن
useEffect(() => {
  if (admin && activeMenu === "إدارة المدن") {
    loadCities();
    loadGovernorates();
  }

  if (admin && activeMenu === "الإعدادات") {
    loadSettings();
  }
}, [
  admin,
  activeMenu,
  loadCities,
  loadGovernorates,
  loadSettings,
]);
// تحميل بيانات الاستهداف عند فتح قسم الإشعارات
useEffect(() => {
  if (admin && activeMenu === "الإشعارات") {
    loadCategories();
    loadCities();
    loadNotifications();
    loadGovernorates();
  }
}, [
  admin,
  activeMenu,
  loadCategories,
  loadCities,
  loadGovernorates,
]);


async function saveNotification() {
  setNotificationError("");
  setNotificationMessage("");

  if (!notificationTitle.trim() || !notificationBody.trim()) {
    setNotificationError("يرجى إدخال عنوان الإشعار ونصه.");
    return;
  }

  if (
    ["governorate", "city", "category"].includes(notificationTarget) &&
    !notificationTargetId
  ) {
    setNotificationError("يرجى اختيار الجمهور المستهدف.");
    return;
  }

  if (
    notificationScheduledAt &&
    new Date(notificationScheduledAt).getTime() <= Date.now()
  ) {
    setNotificationError("موعد الإرسال يجب أن يكون في المستقبل.");
    return;
  }

  setNotificationSaving(true);

  try {
    const { data: { user }, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("تعذر تحديد حساب المدير.");
    }

const notificationData = {
  title: notificationTitle.trim(),
  body: notificationBody.trim(),
  link: notificationLink.trim() || null,
  target_type: notificationTarget,
  target_id: notificationTargetId
    ? Number(notificationTargetId)
    : null,
  scheduled_at: notificationScheduledAt
    ? new Date(notificationScheduledAt).toISOString()
    : null,
  status: notificationScheduledAt ? "scheduled" : "draft",
};

const { error } = editingNotificationId
  ? await supabase
      .from("notifications")
      .update(notificationData)
      .eq("id", editingNotificationId)
  : await supabase
      .from("notifications")
      .insert({
        ...notificationData,
        created_by: user.id,
      });

    if (error) throw error;

    setNotificationMessage("تم حفظ الإشعار بنجاح.");
    await loadNotifications();
    setEditingNotificationId(null);
    setNotificationTitle("");
    setNotificationBody("");
    setNotificationLink("");
    setNotificationTarget("all");
    setNotificationTargetId("");
    setNotificationScheduledAt("");
  } catch (error) {
    console.error("Save notification error:", error);
    setNotificationError(
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء حفظ الإشعار."
    );
  } finally {
    setNotificationSaving(false);
  }
}

async function loadNotifications() {
  setNotificationsLoading(true);
  setNotificationsError("");

  try {
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        title,
        body,
        link,
        target_type,
        target_id,
        scheduled_at,
        sent_at,
        status,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setNotifications((data || []) as Notification[]);
  } catch (error) {
    console.error("Load notifications error:", error);
    setNotificationsError(
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء تحميل الإشعارات."
    );
  } finally {
    setNotificationsLoading(false);
  }
}

async function deleteNotification(id: string) {
  const confirmed = window.confirm(
    "هل أنت متأكد من حذف هذا الإشعار؟"
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await loadNotifications();

    alert("تم حذف الإشعار بنجاح.");
  } catch (error) {
    console.error("Delete notification error:", error);
    alert("حدث خطأ أثناء حذف الإشعار.");
  }
}

async function sendNotificationNow(notification: Notification) {
  const confirmed = window.confirm(
    `هل أنت متأكد من إرسال الإشعار "${notification.title}" الآن؟`
  );

  if (!confirmed) return;

  try {
    const { data, error } = await supabase.rpc(
      "send_notification_now",
      {
        p_notification_id: notification.id,
      }
    );

    if (error) throw error;

    await loadNotifications();

    alert(`تم إرسال الإشعار بنجاح إلى ${data} مستخدم.`);
  } catch (error) {
    console.error("Send notification error:", error);
    alert("تعذر إرسال الإشعار. تأكد من حالة الإشعار وصلاحياتك.");
  }
}

function editNotification(notification: Notification) {
  setEditingNotificationId(notification.id);
  setNotificationTitle(notification.title);
  setNotificationBody(notification.body);
  setNotificationLink(notification.link || "");
  setNotificationTarget(notification.target_type);
  setNotificationTargetId(
    notification.target_id !== null
      ? String(notification.target_id)
      : ""
  );
  setNotificationScheduledAt(
    notification.scheduled_at
      ? new Date(notification.scheduled_at).toISOString().slice(0, 16)
      : ""
  );

  setNotificationError("");
  setNotificationMessage("");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}
  // قبول إعلان
  async function approveAd(adId: string) {
    if (
      !window.confirm(
        "هل أنت متأكد من قبول هذا الإعلان؟"
      )
    ) {
      return;
    }

    setActionLoading(adId);
    setDataError("");

    try {
      const { error } = await supabase.rpc(
        "approve_ad",
        {
          p_ad_id: adId,
          p_notes: null,
        }
      );

      if (error) throw error;

      setSelectedAd(null);
      await loadDashboard();
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : "تعذر قبول الإعلان."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // رفض إعلان
  async function rejectAd(adId: string) {
    const reason = window.prompt(
      "اكتب سبب رفض الإعلان:"
    );

    if (!reason || !reason.trim()) {
      return;
    }

    setActionLoading(adId);
    setDataError("");

    try {
      const { error } = await supabase.rpc(
        "reject_ad",
        {
          p_ad_id: adId,
          p_reason: reason.trim(),
          p_notes: null,
        }
      );

      if (error) throw error;

      setSelectedAd(null);
      await loadDashboard();
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : "تعذر رفض الإعلان."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // أرشفة إعلان منشور
  async function archiveAd(adId: string) {
    if (
      !window.confirm(
        "هل أنت متأكد من أرشفة هذا الإعلان؟ لن يظهر للمستخدمين بعد الأرشفة."
      )
    ) {
      return;
    }

    setActionLoading(adId);
    setDataError("");

    try {
      const { error } = await supabase.rpc(
        "archive_ad",
        {
          p_ad_id: adId,
          p_notes: null,
        }
      );

      if (error) throw error;

      await loadApprovedAds();
    } catch (err) {
  console.error("خطأ أرشفة الإعلان:", err);

  setDataError(
    err instanceof Error
      ? err.message
      : (err as { message?: string })?.message ||
        JSON.stringify(err)
  );
}
 finally {
      setActionLoading(null);
    }
  }

  // إعادة نشر إعلان مؤرشف
  async function restoreAd(adId: string) {
    if (
      !window.confirm(
        "هل تريد إعادة نشر هذا الإعلان؟"
      )
    ) {
      return;
    }

    setActionLoading(adId);
    setDataError("");

    try {
      const { error } = await supabase.rpc(
        "restore_ad",
        {
          p_ad_id: adId,
          p_notes: null,
        }
      );

      if (error) throw error;

      await Promise.all([
  loadApprovedAds(),
  loadArchivedAds(),
]);
    } catch (err) {
  console.error("خطأ إعادة نشر الإعلان:", err);

  setDataError(
    err instanceof Error
      ? err.message
      : (err as { message?: string })?.message ||
        JSON.stringify(err)
  );
}
 finally {
      setActionLoading(null);
    }
  }

  // تنسيق التاريخ
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("ar-SY", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // ترجمة حالة الإعلان
  const formatCondition = (condition: string | null) => {
    switch (condition) {
      case "new":
        return "جديد";

      case "used":
        return "مستعمل";

      case "refurbished":
        return "مجدد";

      default:
        return "غير محدد";
    }
  };
// تصفية المستخدمين حسب البحث
const filteredUsers = users.filter((user) => {
  const search = userSearch.trim().toLowerCase();

  if (!search) return true;

  return (
    user.display_name?.toLowerCase().includes(search) ||
    user.id.toLowerCase().includes(search)
  );
});
const filteredReports = reports.filter((report) => {
  const search = reportSearch.trim().toLowerCase();

  const matchesSearch =
    !search ||
    report.reason.toLowerCase().includes(search) ||
    report.details?.toLowerCase().includes(search) ||
    report.id.toLowerCase().includes(search) ||
    report.reporter_id.toLowerCase().includes(search) ||
report.reported_user_id?.toLowerCase().includes(search) ||
report.conversation_id?.toLowerCase().includes(search);

  const matchesStatus =
    reportStatusFilter === "all" ||
    report.status === reportStatusFilter;

  return matchesSearch && matchesStatus;
});
const mainCategories = categories.filter(
  (category) => category.parent_id === null
);

function getSubCategories(categoryId: number) {
  return categories.filter(
    (category) => category.parent_id === categoryId
  );
}
// تحديث تسجيل دخول المدير إلى رقم الموبايل
async function updateAdminLogin() {
  const confirmed = window.confirm(
    "سيتم تحويل تسجيل دخول حساب المدير الحالي إلى رقم الموبايل المحفوظ. ستبقى كلمة المرور والصلاحيات والبيانات كما هي. هل تريد المتابعة؟"
  );

  if (!confirmed) return;

  setAdminLoginUpdating(true);
  setAdminLoginMessage("");
  setAdminLoginError("");

  try {
    const { data, error } = await supabase.functions.invoke(
      "update-admin-login"
    );

    if (error) throw error;

    if (!data?.success) {
      throw new Error(
        data?.error || "تعذر تحديث تسجيل الدخول."
      );
    }

    setAdminLoginMessage(
      data.message || "تم تحديث تسجيل الدخول بنجاح."
    );
  } catch (err) {
    setAdminLoginError(
      err instanceof Error
        ? err.message
        : "حدث خطأ أثناء تحديث تسجيل الدخول."
    );
  } finally {
    setAdminLoginUpdating(false);
  }
}
  // شاشة التحميل
  if (loading) {
    return (
      <div className="login-page" dir="rtl">
        <LoaderCircle
          className="spin"
          size={30}
        />

        <p>جارٍ التحقق من الجلسة...</p>
      </div>
    );
  }

  // شاشة تسجيل الدخول
  if (!admin) {
    return (
      <div className="login-page" dir="rtl">
        <div className="login-card">
          <div className="login-logo">س</div>

          <h1>Sooq.Sy</h1>

          <p className="login-subtitle">
            تسجيل دخول لوحة الإدارة
          </p>

<form onSubmit={handleLogin}>
  <label>رقم الموبايل</label>

  <div className="login-input">
    <Mail size={19} />

    <input
      type="tel"
      placeholder="09XXXXXXXX"
      value={phone}
      onChange={(event) => setPhone(event.target.value)}
      required
      autoComplete="username"
      maxLength={10}
      dir="ltr"
    />
  </div>

  <label>كلمة المرور</label>

  <div className="login-input">
    <LockKeyhole size={19} />

    <input
      type="password"
      placeholder="أدخل كلمة المرور"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
      autoComplete="current-password"
    />
  </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "جارٍ تسجيل الدخول..."
                : "تسجيل الدخول"}
            </button>
          </form>

          <div className="login-security">
            <LockKeyhole size={15} />

            الدخول مخصص لحسابات الإدارة فقط
          </div>
        </div>
      </div>
    );
  }

  // عناصر القائمة
  const menuItems = [
    {
      label: "الرئيسية",
      icon: LayoutDashboard,
    },
    {
      label: "مراجعة الإعلانات",
      icon: Megaphone,
    },
    {
  label: "إدارة الإعلانات",
  icon: Megaphone,
},
    {
  label: "الإعلانات المؤرشفة",
  icon: Megaphone,
},
    {
  label: "التبرعات",
  icon: Gift,
    },
    {
      label: "المستخدمون",
      icon: Users,
    },
    {
      label: "التصنيفات",
      icon: FolderOpen,
    },
    {
  label: "إدارة المدن",
  icon: MapPin,
},
    {
      label: "البلاغات",
      icon: Flag,
    },
    {
  label: "الإشعارات",
  icon: Bell,
},
    {
      label: "الإعدادات",
      icon: Settings,
    },
  ];

  return (
    <div className="app" dir="rtl">
      {/* القائمة الجانبية */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">س</div>

          <div>
            <h2>Sooq.Sy</h2>
            <span>لوحة الإدارة</span>
          </div>
        </div>

        <div className="menu-title">
          القائمة الرئيسية
        </div>

        <nav>
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`menu-item ${
                  activeMenu === item.label
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActiveMenu(item.label)
                }
              >
                <Icon size={19} />

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-avatar">م</div>

          <div className="admin-info">
            <strong>مدير النظام</strong>
            <span>{admin.email}</span>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
            title="تسجيل الخروج"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activeMenu}</h1>

            <p>
              مرحباً بك في لوحة إدارة Sooq.Sy
            </p>
          </div>

          <div className="top-actions">
            <button className="icon-button">
              <Bell size={20} />
            </button>

            <div className="top-avatar">م</div>
          </div>
        </header>

        <section className="content">
          {dataError && (
            <div className="data-error">
              {dataError}
            </div>
          )}

          {/* الرئيسية */}
          {activeMenu === "الرئيسية" && (
            <>
              <div className="welcome-card">
                <div>
                  <h2>
                    أهلاً بك في لوحة الإدارة 👋
                  </h2>

                  <p>
                    إليك ملخص الإعلانات في منصة Sooq.Sy.
                  </p>
                </div>

                <div className="welcome-symbol">
                  س
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon pending">
                    <Clock size={23} />
                  </div>

                  <span>قيد المراجعة</span>

                  <strong>{stats.pending}</strong>
                </div>

                <div className="stat-card">
                  <div className="stat-icon approved">
                    <CheckCircle size={23} />
                  </div>

                  <span>الإعلانات المنشورة</span>

                  <strong>{stats.approved}</strong>
                </div>

                <div className="stat-card">
                  <div className="stat-icon rejected">
                    <XCircle size={23} />
                  </div>

                  <span>الإعلانات المرفوضة</span>

                  <strong>{stats.rejected}</strong>
                </div>

                <div className="stat-card">
                  <div className="stat-icon total">
                    <Megaphone size={23} />
                  </div>

                  <span>إجمالي الإعلانات</span>

                  <strong>{stats.total}</strong>
                </div>
              </div>

              <div className="section-heading">
                <div>
                  <h2>
                    أحدث الإعلانات بانتظار المراجعة
                  </h2>

                  <p>
                    الإعلانات التي تحتاج إلى قرار الإدارة
                  </p>
                </div>

                <button
                  className="refresh-button"
                  onClick={loadDashboard}
                  disabled={adsLoading}
                >
                  <RefreshCw size={17} />
                  تحديث
                </button>
              </div>

              <AdsList
                ads={ads.slice(0, 5)}
                loading={adsLoading}
                actionLoading={actionLoading}
                onApprove={approveAd}
                onReject={rejectAd}
                onOpen={setSelectedAd}
                formatDate={formatDate}
                formatCondition={formatCondition}
              />

              <button
                className="view-all-button"
                onClick={() =>
                  setActiveMenu("مراجعة الإعلانات")
                }
              >
                عرض جميع الإعلانات المعلقة
              </button>
            </>
          )}

          {/* مراجعة الإعلانات */}
          {activeMenu === "مراجعة الإعلانات" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>مراجعة الإعلانات</h2>

                  <p>
                    راجع الإعلان قبل نشره على المنصة
                  </p>
                </div>

                <button
                  className="refresh-button"
                  onClick={loadDashboard}
                  disabled={adsLoading}
                >
                  <RefreshCw size={17} />
                  تحديث
                </button>
              </div>

              <AdsList
                ads={ads}
                loading={adsLoading}
                actionLoading={actionLoading}
                onApprove={approveAd}
                onReject={rejectAd}
                onOpen={setSelectedAd}
                formatDate={formatDate}
                formatCondition={formatCondition}
              />
            </>
          )}

{activeMenu === "إدارة الإعلانات" && (
  <>
    <div className="section-heading">
      <div>
        <h2>إدارة الإعلانات</h2>
        <p>
          عرض ومتابعة الإعلانات المنشورة على المنصة
        </p>
      </div>

      <button
        className="refresh-button"
        onClick={loadApprovedAds}
        disabled={approvedAdsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {approvedAdsLoading ? (
      <div className="loading-state">
        جاري تحميل الإعلانات...
      </div>
    ) : approvedAds.length === 0 ? (
      <div className="empty-state">
        لا توجد إعلانات منشورة حالياً
      </div>
    ) : (
      <div className="ads-grid">
        {approvedAds.map((ad) => (
          <div
            className="admin-ad-card"
            key={ad.id}
          >
            {ad.ad_images?.[0]?.signedUrl && (
  <img
    src={ad.ad_images[0].signedUrl}
    alt={ad.title}
    className="admin-ad-image"
  />
)}
{ad.is_featured && (
  <span className="featured-badge">
    ★ إعلان مميز
  </span>
)}
            <h3>{ad.title}</h3>
            {ad.price !== null && (
  <p className="admin-ad-price">
    {ad.price.toLocaleString("en-US")} {ad.currency || ""}
  </p>
)}

<p>
  التصنيف: {getOne(ad.categories)?.name_ar || "غير محدد"}
</p>

<p>
  تاريخ النشر: {formatDate(ad.created_at)}
</p>
            <p>
              {getOne(ad.profiles)?.display_name || "مستخدم"}
            </p>

            <p>
              {getOne(ad.cities)?.name_ar || "غير محدد"}
            </p>

            <button
              className="refresh-button"
              onClick={() => setSelectedAd(ad)}
            >
              عرض التفاصيل
            </button>
<button
  className="refresh-button"
  onClick={() => toggleFeaturedAd(ad)}
  disabled={actionLoading === ad.id}
  style={{
    background: ad.is_featured ? "#d97706" : "#64748b",
    color: "#fff",
  }}
>
  {actionLoading === ad.id
    ? "جاري التحديث..."
    : ad.is_featured
      ? "★ إلغاء التمييز"
      : "☆ تمييز الإعلان"}
</button>
<button
  className="refresh-button"
  onClick={() => archiveAd(ad.id)}
  disabled={actionLoading === ad.id}
>
  {actionLoading === ad.id
    ? "جاري الأرشفة..."
    : "أرشفة الإعلان"}
</button>

          </div>
        ))}
      </div>
    )}
  </>
)}


{activeMenu === "الإعلانات المؤرشفة" && (
  <>
    <div className="section-heading">
      <div>
        <h2>الإعلانات المؤرشفة</h2>
        <p>
          الإعلانات التي تم إيقاف نشرها ويمكن إعادتها
        </p>
      </div>

      <button
        className="refresh-button"
        onClick={loadArchivedAds}
        disabled={archivedAdsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {archivedAdsLoading ? (
      <div className="loading-state">
        جاري تحميل الإعلانات...
      </div>
    ) : archivedAds.length === 0 ? (
      <div className="empty-state">
        لا توجد إعلانات مؤرشفة حالياً
      </div>
    ) : (
      <div className="ads-grid">
        {archivedAds.map((ad) => (
          <div
            className="admin-ad-card"
            key={ad.id}
          >
            <h3>{ad.title}</h3>

            <p>
              {getOne(ad.profiles)?.display_name || "مستخدم"}
            </p>

            <p>
              {getOne(ad.cities)?.name_ar || "غير محدد"}
            </p>

            <button
              className="refresh-button"
              onClick={() => setSelectedAd(ad)}
            >
              عرض التفاصيل
            </button>

            <button
              className="refresh-button"
              onClick={() => restoreAd(ad.id)}
              disabled={actionLoading === ad.id}
            >
              {actionLoading === ad.id
                ? "جاري إعادة النشر..."
                : "إعادة النشر"}
            </button>
          </div>
        ))}
      </div>
    )}
  </>
)}



                    {/* قسم التبرعات */}
          {activeMenu === "التبرعات" && (
            <Donations />
          )}
{/* قسم المستخدمين */}
{activeMenu === "المستخدمون" && (
  <>
    <div className="section-heading">
      <div>
        <h2>إدارة المستخدمين</h2>
        <p>
          جميع الحسابات المسجلة في منصة Sooq.Sy
        </p>
      </div>

      <button
        className="refresh-button"
        onClick={loadUsers}
        disabled={usersLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    <div className="users-search">
      <Users size={19} />

      <input
        type="text"
        placeholder="ابحث باسم المستخدم أو معرّفه..."
        value={userSearch}
        onChange={(e) => setUserSearch(e.target.value)}
      />
    </div>

    {usersError && (
      <div className="data-error">
        {usersError}
      </div>
    )}

    {usersLoading ? (
      <div className="empty-state">
        <LoaderCircle className="spin" size={28} />
        <p>جارٍ تحميل المستخدمين...</p>
      </div>
    ) : filteredUsers.length === 0 ? (
      <div className="empty-state">
        <Users size={30} />
        <h3>لا يوجد مستخدمون</h3>
        <p>
          {userSearch
            ? "لم نعثر على مستخدم يطابق البحث."
            : "لا توجد حسابات مسجلة حالياً."}
        </p>
      </div>
    ) : (
      <div className="users-list">
        {filteredUsers.map((user) => (
          <article
            className="user-card"
            key={user.id}
            onClick={() => openUser(user)}
          >
            <div className="user-avatar">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                />
              ) : (
                <UserRound size={25} />
              )}
            </div>

            <div className="user-info">
              <h3>
                {user.display_name || "مستخدم جديد"}
              </h3>

              <p>
                معرّف الحساب: {user.id}
              </p>

              <span>
                تاريخ التسجيل: {formatDate(user.created_at)}
              </span>
            </div>

            <div className="user-count">
              <strong>
                {user.ads?.[0]?.count ?? 0}
              </strong>
              <span>إعلان</span>
            </div>

            <Eye size={19} />
          </article>
        ))}
      </div>
    )}
  </>
)}
{/* قسم إدارة التصنيفات */}
{activeMenu === "التصنيفات" && (
  <>
<div className="section-heading">
  <div>
    <h2>إدارة التصنيفات</h2>
    <p>
      إدارة التصنيفات الرئيسية والفرعية في Sooq.Sy
    </p>
  </div>

  <div className="section-actions">
    <button
      className="refresh-button"
      onClick={loadCategories}
      disabled={categoriesLoading}
    >
      <RefreshCw size={17} />
      تحديث
    </button>

    <button
      className="add-category-button"
      onClick={() => {
  setIsEditingCategory(false);
  setShowCategoryForm(true);
}}
    >
      <Plus size={17} />
      إضافة تصنيف
    </button>
  </div>
</div>

    {categoriesError && (
      <div className="data-error">
        {categoriesError}
      </div>
    )}
    {categoriesSuccess && (
  <div className="data-success">
    {categoriesSuccess}
  </div>
)}

    {categoriesLoading ? (
      <div className="empty-state">
        <LoaderCircle className="spin" size={28} />
        <p>جارٍ تحميل التصنيفات...</p>
      </div>
    ) : (
<div className="categories-list">
  {mainCategories.map((category) => (
    <div className="category-card" key={category.id}>
      <div className="category-card-info">
        <FolderOpen size={22} />

        <div>
          <h3>{category.name_ar}</h3>
          <span>
            {getSubCategories(category.id).length} تصنيف فرعي
          </span>
        </div>
      </div>

<div className="category-card-actions">
  <span className={category.is_active ? "category-active" : "category-inactive"}>
    {category.is_active ? "مفعّل" : "متوقف"}
  </span>

  <button
    type="button"
    className="category-edit-button"
    onClick={() => {
      setEditingCategory(category);
      setIsEditingCategory(true);
      setNewCategoryName(category.name_ar);
      setNewCategoryParent(
        category.parent_id === null
          ? ""
          : String(category.parent_id)
      );
    }}
  >
    <Pencil size={15} />
    تعديل
  </button>

  <button
    type="button"
    className="category-edit-button"
    disabled={categorySaving}
    onClick={() => toggleCategoryStatus(category)}
  >
    {category.is_active ? "إيقاف التصنيف" : "تفعيل التصنيف"}
  </button>
</div>

      {getSubCategories(category.id).length > 0 && (
        <div className="subcategories-list">
  {getSubCategories(category.id).map((sub) => (
    <div key={sub.id} className="subcategory-item">
      <span>{sub.name_ar}</span>

      <div className="category-card-actions">
        <span className={sub.is_active ? "category-active" : "category-inactive"}>
          {sub.is_active ? "مفعّل" : "متوقف"}
        </span>

        <button
          type="button"
          className="category-edit-button"
          onClick={() => {
            setEditingCategory(sub);
            setNewCategoryName(sub.name_ar);
            setNewCategoryParent(String(sub.parent_id));
          }}
        >
          <Pencil size={15} />
          تعديل
        </button>

        <button
          type="button"
          className="category-edit-button"
          disabled={categorySaving}
          onClick={() => toggleCategoryStatus(sub)}
        >
          {sub.is_active ? "إيقاف" : "تفعيل"}
        </button>
      </div>
    </div>
  ))}
</div>
      )}
    </div>
  ))}
</div>
    )}
  </>
)}

{/* قسم إدارة المدن */}
{activeMenu === "إدارة المدن" && (
  <>
    <div className="section-heading">
      <div>
        <h2>إدارة المدن</h2>
        <p>إضافة وتعديل وتفعيل المدن في Sooq.Sy</p>
      </div>

      <div className="section-actions">
        <button
          className="refresh-button"
          onClick={loadCities}
          disabled={citiesLoading}
        >
          <RefreshCw size={17} />
          تحديث
        </button>

        <button
          className="add-category-button"
          onClick={() => {
            setEditingCity(null);
            setNewCityName("");
            setCitiesError("");
            setShowCityForm(true);
          }}
        >
          <Plus size={17} />
          إضافة مدينة
        </button>
      </div>
    </div>

    {citiesError && (
      <div className="data-error">{citiesError}</div>
    )}

    {citiesSuccess && (
      <div className="data-success">{citiesSuccess}</div>
    )}

    {citiesLoading ? (
      <div className="empty-state">
        <LoaderCircle className="spin" size={28} />
        <p>جارٍ تحميل المدن...</p>
      </div>
    ) : (
      <div className="categories-list">
        {cities.length === 0 ? (
          <div className="empty-state">
            <p>لا توجد مدن حالياً.</p>
          </div>
        ) : (
          cities.map((city) => (
            <div className="category-card" key={city.id}>
              <div className="category-card-info">
                <MapPin size={22} />
                <div>
                  <h3>{city.name_ar}</h3>
                  <span>رقم المدينة: {city.id}</span>
                </div>
              </div>

              <div className="category-card-actions">
                <span
                  className={
                    city.is_active
                      ? "category-active"
                      : "category-inactive"
                  }
                >
                  {city.is_active ? "مفعّلة" : "متوقفة"}
                </span>

                <button
                  type="button"
                  className="category-edit-button"
                  onClick={() => {
                    setEditingCity(city);
                    setNewCityName(city.name_ar);
                    setCitiesError("");
                    setShowCityForm(true);
                  }}
                >
                  <Pencil size={15} />
                  تعديل
                </button>

                <button
                  type="button"
                  className="category-edit-button"
                  disabled={citySaving}
                  onClick={() => toggleCityStatus(city)}
                >
                  {city.is_active ? "إيقاف المدينة" : "تفعيل المدينة"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    )}
  </>
)}

{/* قسم إدارة البلاغات */}
{activeMenu === "البلاغات" && (
  <>
    <div className="section-heading">
      <div>
        <h2>إدارة البلاغات</h2>
        <p>مراجعة البلاغات المقدمة من مستخدمي منصة Sooq.sy</p>
      </div>

      <button
        className="refresh-button"
        onClick={loadReports}
        disabled={reportsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>
        <div className="report-stats">
  <button
    type="button"
    className="report-stat-card"
    onClick={() => setReportStatusFilter("all")}
  >
    <span>إجمالي البلاغات</span>
    <strong>{reportStats.all}</strong>
  </button>

  <button
    type="button"
    className="report-stat-card pending"
    onClick={() => setReportStatusFilter("pending")}
  >
    <span>قيد المراجعة</span>
    <strong>{reportStats.pending}</strong>
  </button>

  <button
    type="button"
    className="report-stat-card reviewed"
    onClick={() => setReportStatusFilter("reviewed")}
  >
    <span>تمت المراجعة</span>
    <strong>{reportStats.reviewed}</strong>
  </button>

  <button
    type="button"
    className="report-stat-card resolved"
    onClick={() => setReportStatusFilter("resolved")}
  >
    <span>تم اتخاذ إجراء</span>
    <strong>{reportStats.actioned}</strong>
  </button>

  <button
    type="button"
    className="report-stat-card dismissed"
    onClick={() => setReportStatusFilter("dismissed")}
  >
    <span>مرفوضة</span>
    <strong>{reportStats.rejected}</strong>
  </button>
</div>
    <div className="users-search">
      <Search size={19} />
      <input
        type="text"
        placeholder="ابحث في البلاغات..."
        value={reportSearch}
        onChange={(e) => setReportSearch(e.target.value)}
      />
    </div>

    <select
      value={reportStatusFilter}
      onChange={(e) => setReportStatusFilter(e.target.value)}
    >
      <option value="all">جميع الحالات</option>
      <option value="pending">قيد المراجعة</option>
      <option value="reviewed">تمت المراجعة</option>
      <option value="resolved">تم الحل</option>
      <option value="dismissed">مرفوض</option>
    </select>

    {reportsError && (
      <div className="data-error">{reportsError}</div>
    )}

    {reportsLoading ? (
      <div className="empty-state">
        <LoaderCircle className="spin" size={28} />
        <p>جارٍ تحميل البلاغات...</p>
      </div>
    ) : filteredReports.length === 0 ? (
      <div className="empty-state">
        <Eye size={30} />
        <h3>لا توجد بلاغات</h3>
        <p>لا توجد بلاغات تطابق البحث أو الحالة المحددة.</p>
      </div>
    ) : (
      <div className="users-list">
  {filteredReports.map((report) => (
    <article className="user-card report-card" key={report.id}>
      <div className="user-info">
        <h3>{report.reason}</h3>

        <p>
  <strong>المُبلّغ:</strong>{" "}
  <button
    type="button"
    onClick={() => openReportedUser(report.reporter_id)}
    style={{
      color: "#059669",
      fontWeight: "bold",
      textDecoration: "underline",
      cursor: "pointer",
      background: "none",
      border: "none",
      padding: 0,
    }}
  >
    {report.reporter_name || "فتح ملف المستخدم"}
  </button>
</p>

{report.reported_user_id && (
  <p>
    <strong>المستخدم المُبلّغ عنه:</strong>{" "}
    <button
      type="button"
      onClick={() => openReportedUser(report.reported_user_id!)}
      style={{
        color: "#059669",
        fontWeight: "bold",
        textDecoration: "underline",
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: 0,
      }}
    >
      {report.reported_user_name || "فتح ملف المستخدم"}
    </button>
  </p>
)}



        {report.details && (
          <p className="report-details">
            <strong>تفاصيل البلاغ:</strong> {report.details}
          </p>
        )}

        <span>تاريخ البلاغ: {formatDate(report.created_at)}</span>

        <small>رقم البلاغ: {report.id}</small>
      </div>

<div className="category-card-actions">
  <select
    value={report.status}
    disabled={reportSaving}
    onChange={(e) =>
      updateReportStatus(
        report.id,
        e.target.value as Report["status"]
      )
    }
  >
    <option value="pending">قيد المراجعة</option>
    <option value="reviewed">تمت المراجعة</option>
    <option value="actioned">تم اتخاذ إجراء</option>
    <option value="rejected">مرفوض</option>
  </select>

  <button
    type="button"
    className="category-edit-button"
    onClick={() => {
window.open(
  `${import.meta.env.BASE_URL}admin/conversation/${report.conversation_id}`,
  "_blank"
);
    }}
  >
    <Eye size={15} />
    عرض المحادثة
  </button>
{report.active_ban ? (
  <button
    type="button"
    className="category-edit-button"
    onClick={() => handleAdminUnban(report)}
  >
    فك الحظر
  </button>
) : (
  <>
    <button
      type="button"
      className="category-edit-button"
      onClick={() => handleAdminBan(report, "temporary")}
    >
      حظر مؤقت
    </button>

    <button
      type="button"
      className="category-edit-button"
      onClick={() => handleAdminBan(report, "permanent")}
    >
      حظر نهائي
    </button>
  </>
)}
</div>
    </article>
  ))}
</div>
    )}
  </>
)}
{activeMenu === "الإعدادات" && (
  <div className="admin-section">
    <h2>إعدادات الموقع</h2>

<div className="category-card">
  <h3>المعلومات العامة</h3>

  {settingsLoading ? (
    <p>جارٍ تحميل الإعدادات...</p>
  ) : (
    <div className="space-y-4 mt-4">
      <div>
        <label>اسم الموقع</label>
        <input
          type="text"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="w-full border rounded-lg p-3 mt-1"
        />
      </div>

      <div>
        <label>رابط الشعار</label>
        <input
          type="text"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="w-full border rounded-lg p-3 mt-1"
          placeholder="رابط صورة الشعار"
        />
      </div>
<div className="border rounded-xl p-4">
  <label className="block font-semibold mb-2">
    صورة الواجهة الرئيسية
  </label>

  {heroImageUrl && (
    <img
      src={heroImageUrl}
      alt="معاينة صورة الواجهة"
      className="w-full max-h-64 object-cover rounded-lg mb-3"
    />
  )}

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) =>
      setHeroImageFile(e.target.files?.[0] || null)
    }
    className="w-full border rounded-lg p-3"
  />

  <button
    type="button"
    onClick={uploadHeroImage}
    disabled={!heroImageFile || heroImageUploading}
    className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
  >
    {heroImageUploading ? "جارٍ رفع الصورة..." : "رفع صورة الواجهة"}
  </button>
</div>
      <div>
        <label>البريد الإلكتروني للتواصل</label>
        <input
          type="tel"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="w-full border rounded-lg p-3 mt-1"
        />
      </div>

      <div>
        <label>رقم الهاتف</label>
        <input
          type="text"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="w-full border rounded-lg p-3 mt-1"
        />
      </div>

      {settingsError && (
        <p className="text-red-600">{settingsError}</p>
      )}

      {settingsSuccess && (
        <p className="text-green-600">{settingsSuccess}</p>
      )}

      <button
        type="button"
        onClick={saveSettings}
        disabled={settingsSaving}
        className="bg-emerald-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
      >
        {settingsSaving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
      </button>
    </div>
  )}
</div>

<div className="category-card">

<h3>إعدادات الإعلانات</h3>

<label className="mt-4 flex items-center gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={allowNewAds}
    onChange={(e) => setAllowNewAds(e.target.checked)}
    className="h-5 w-5 accent-emerald-600"
  />

  <span className="font-medium text-slate-700">
    السماح للمستخدمين بنشر إعلانات جديدة
  </span>
</label>

<p className="mt-2 text-sm text-slate-500">
  عند إيقاف هذا الخيار، لن يتمكن المستخدمون من إضافة إعلانات جديدة.
</p>

<div className="mt-6 border-t border-slate-200 pt-5">
  <label className="flex cursor-pointer items-center gap-3">
    <input
      type="checkbox"
      checked={maintenanceMode}
      onChange={(e) => setMaintenanceMode(e.target.checked)}
      className="h-5 w-5 accent-red-600"
    />

    <span className="font-medium text-slate-700">
      تفعيل وضع الصيانة
    </span>
  </label>

  <p className="mt-2 text-sm text-slate-500">
    عند التفعيل، سيتم إيقاف تصفح الموقع مؤقتاً أمام الزوار.
  </p>
</div>

</div>

<div className="category-card mt-6">
  <h3>تحديث تسجيل دخول المدير</h3>

  <p className="mt-2 text-sm text-slate-500">
    تحويل طريقة دخول حساب المدير الحالي من البريد الإلكتروني
    إلى رقم الموبايل، مع الحفاظ على كلمة المرور والصلاحيات.
  </p>

  {adminLoginMessage && (
    <p className="mt-3 text-green-600">
      {adminLoginMessage}
    </p>
  )}

  {adminLoginError && (
    <p className="mt-3 text-red-600">
      {adminLoginError}
    </p>
  )}

  <button
    type="button"
    onClick={updateAdminLogin}
    disabled={adminLoginUpdating}
    className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
  >
    {adminLoginUpdating
      ? "جارٍ تحديث تسجيل الدخول..."
      : "تحديث تسجيل دخول المدير"}
  </button>
</div>

</div>
)}
{activeMenu === "الإشعارات" && (
  <div className="admin-section">
    <h2>إدارة الإشعارات</h2>

    <div className="category-card">
      <h3>إنشاء إشعار جديد</h3>

      <p className="mt-2 text-sm text-slate-500">
        إنشاء إشعارات عامة أو موجهة لمستخدمين حسب المحافظة أو المدينة أو التصنيف أو المفضلة.
      </p>
      <div className="mt-5 space-y-4">

  <div>
    <label className="block font-medium mb-2">عنوان الإشعار</label>
    <input
      type="text"
      value={notificationTitle}
      onChange={(e) => setNotificationTitle(e.target.value)}
      className="w-full border rounded-lg p-3"
      placeholder="مثلاً: عروض جديدة على Sooq.Sy"
    />
  </div>

  <div>
    <label className="block font-medium mb-2">نص الإشعار</label>
    <textarea
      value={notificationBody}
      onChange={(e) => setNotificationBody(e.target.value)}
      className="w-full border rounded-lg p-3"
      rows={4}
      placeholder="اكتب نص الإشعار هنا..."
    />
  </div>

  <div>
    <label className="block font-medium mb-2">رابط عند الضغط على الإشعار (اختياري)</label>
    <input
      type="text"
      value={notificationLink}
      onChange={(e) => setNotificationLink(e.target.value)}
      className="w-full border rounded-lg p-3"
      placeholder="رابط الإعلان أو الصفحة"
    />
  </div>

  <div>
    <label className="block font-medium mb-2">الجمهور المستهدف</label>
    <select
      value={notificationTarget}
      onChange={(e) => {
        setNotificationTarget(e.target.value);
        setNotificationTargetId("");
      }}
      className="w-full border rounded-lg p-3"
    >
      <option value="all">جميع المستخدمين</option>
      <option value="governorate">حسب المحافظة</option>
      <option value="city">حسب المدينة</option>
      <option value="category">المهتمون بتصنيف معين</option>
      <option value="favorites">حسب المفضلة</option>
    </select>
  </div>

  {notificationTarget === "governorate" && (
    <div>
      <label className="block font-medium mb-2">اختر المحافظة</label>
      <select
        value={notificationTargetId}
        onChange={(e) => setNotificationTargetId(e.target.value)}
        className="w-full border rounded-lg p-3"
      >
        <option value="">اختر المحافظة</option>
        {governorates.filter((g) => g.is_active).map((g) => (
          <option key={g.id} value={g.id}>{g.name_ar}</option>
        ))}
      </select>
    </div>
  )}

  {notificationTarget === "city" && (
    <div>
      <label className="block font-medium mb-2">اختر المدينة</label>
      <select
        value={notificationTargetId}
        onChange={(e) => setNotificationTargetId(e.target.value)}
        className="w-full border rounded-lg p-3"
      >
        <option value="">اختر المدينة</option>
        {cities.filter((c) => c.is_active).map((c) => (
          <option key={c.id} value={c.id}>{c.name_ar}</option>
        ))}
      </select>
    </div>
  )}

  {notificationTarget === "category" && (
    <div>
      <label className="block font-medium mb-2">اختر التصنيف</label>
      <select
        value={notificationTargetId}
        onChange={(e) => setNotificationTargetId(e.target.value)}
        className="w-full border rounded-lg p-3"
      >
        <option value="">اختر التصنيف</option>
        {categories.filter((c) => c.is_active).map((c) => (
          <option key={c.id} value={c.id}>{c.name_ar}</option>
        ))}
      </select>
    </div>
  )}

  <div>
    <label className="block font-medium mb-2">موعد الإرسال</label>
    <input
      type="datetime-local"
      value={notificationScheduledAt}
      onChange={(e) => setNotificationScheduledAt(e.target.value)}
      className="w-full border rounded-lg p-3"
    />
    <p className="text-sm text-slate-500 mt-1">
      اتركه فارغاً لحفظ الإشعار كمسودة. أما تحديد موعد فيحفظه كإشعار مجدول.
    </p>

  </div>

  {/* زر حفظ الإشعار */}
  <div className="mt-5">
    {notificationError && (
      <p className="text-red-600 mb-3">
        {notificationError}
      </p>
    )}

    {notificationMessage && (
      <p className="text-green-600 mb-3">
        {notificationMessage}
      </p>
    )}

    <button
      type="button"
      onClick={saveNotification}
      disabled={notificationSaving}
      className="bg-emerald-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
    >
      {notificationSaving
  ? "جارٍ الحفظ..."
  : editingNotificationId
    ? "حفظ التعديلات"
    : "حفظ الإشعار"}
    </button>
  </div>
    </div>

  </div>

    {/* سجل الإشعارات */}
    <div className="category-card mt-6">
      <h3>سجل الإشعارات</h3>

      {notificationsLoading && (
        <p className="mt-4 text-slate-500">
          جارٍ تحميل الإشعارات...
        </p>
      )}

      {notificationsError && (
        <p className="mt-4 text-red-600">
          {notificationsError}
        </p>
      )}

      {!notificationsLoading && notifications.length === 0 && (
        <p className="mt-4 text-slate-500">
          لا توجد إشعارات محفوظة حالياً.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="border rounded-lg p-4"
          >
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div>
                <h4 className="font-bold">
                  {notification.title}
                </h4>

                <p className="text-sm text-slate-600 mt-1">
                  {notification.body}
                </p>
              </div>

              <span className="text-sm font-medium">
                {notification.status === "draft" && "مسودة"}
                {notification.status === "scheduled" && "مجدول"}
                {notification.status === "sent" && "تم الإرسال"}
                {notification.status === "failed" && "فشل الإرسال"}
              </span>
            </div>

            <div className="text-sm text-slate-500 mt-3 space-y-1">
              <p>
                الجمهور المستهدف: {
                  {
                    all: "جميع المستخدمين",
                    governorate: "محافظة",
                    city: "مدينة",
                    category: "تصنيف",
                    favorites: "المفضلة",
                  }[notification.target_type]
                }
              </p>

              {notification.scheduled_at && (
                <p>
                  موعد الإرسال:{" "}
                  {new Date(notification.scheduled_at).toLocaleString("ar")}
                </p>
              )}

              <p>
                تاريخ الإنشاء:{" "}
                {new Date(notification.created_at).toLocaleString("ar")}
              </p>
            </div>

            {/* زر حذف الإشعار */}
<div className="mt-4 flex justify-end gap-2 flex-wrap">

  {notification.status !== "sent" && (
    <button
      type="button"
      onClick={() => sendNotificationNow(notification)}
      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
    >
      إرسال الآن
    </button>
  )}

  <button
    type="button"
    onClick={() => editNotification(notification)}
    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
  >
    تعديل الإشعار
  </button>

  <button
    type="button"
    onClick={() => deleteNotification(notification.id)}
    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
  >
    حذف الإشعار
  </button>

</div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

          {/* الأقسام التي لم يتم تجهيزها بعد */}
            {![
              "الرئيسية",
              "مراجعة الإعلانات",
              "التبرعات",
              "المستخدمون",
              "التصنيفات",
              "المدن",
              "إدارة المدن",
              "البلاغات",
              "إدارة الإعلانات",
              "الإعلانات المؤرشفة",
              "الإعدادات",
            ].includes(activeMenu) && (
            <div className="empty-state">
              <div className="empty-icon">
                <Eye size={30} />
              </div>

              <h3>{activeMenu}</h3>


            </div>
          )}
        </section>
      </main>

      {/* نافذة تفاصيل الإعلان */}
      {selectedAd && (
        <AdDetailsModal
          ad={selectedAd}
          actionLoading={actionLoading}
          onClose={() => setSelectedAd(null)}
          onApprove={approveAd}
          onReject={rejectAd}
          formatDate={formatDate}
          formatCondition={formatCondition}
        />
      )}

      {/* نافذة تفاصيل المستخدم */}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          ads={userAds}
          loading={userAdsLoading}
          onClose={() => setSelectedUser(null)}
          formatDate={formatDate}
        />
      )}
{(showCategoryForm || editingCategory) && (
  <CategoryFormModal
    categories={mainCategories.filter(
  (category) => category.id !== editingCategory?.id
)}
    isEditing={isEditingCategory}
    name={newCategoryName}
    parent={newCategoryParent}
    saving={categorySaving}
    error={categoriesError}
    onNameChange={setNewCategoryName}
    onParentChange={setNewCategoryParent}
    onClose={() => {
      setShowCategoryForm(false);
      setEditingCategory(null);
      setNewCategoryName("");
      setNewCategoryParent("");
      setCategoriesError("");
      setIsEditingCategory(false);
    }}
    onSave={editingCategory ? updateCategory : addCategory}
  />
)}
{(showCityForm || editingCity) && (
  <CityFormModal
    name={newCityName}
    isEditing={!!editingCity}
    governorates={governorates}
    selectedGovernorateId={selectedGovernorateId}
    saving={citySaving}
    error={citiesError}
    onNameChange={setNewCityName}
    onGovernorateChange={setSelectedGovernorateId}
    onClose={() => {
      setShowCityForm(false);
      setEditingCity(null);
      setNewCityName("");
      setSelectedGovernorateId("");
      setCitiesError("");
    }}
    onSave={editingCity ? updateCity : addCity}
  />
)}
    </div>
  );
}

// قائمة الإعلانات
function AdsList({
  ads,
  loading,
  actionLoading,
  onApprove,
  onReject,
  onOpen,
  formatDate,
  formatCondition,
}: {
  ads: Ad[];
  loading: boolean;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onOpen: (ad: Ad) => void;
  formatDate: (date: string) => string;
  formatCondition: (condition: string | null) => string;
}) {
  if (loading) {
    return (
      <div className="empty-state">
        <LoaderCircle
          className="spin"
          size={28}
        />

        <p>جارٍ تحميل الإعلانات...</p>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="empty-state">
        <CheckCircle size={30} />

        <h3>لا توجد إعلانات معلقة</h3>

        <p>
          لا يوجد حالياً أي إعلان بانتظار المراجعة.
        </p>
      </div>
    );
  }

  return (
    <div className="ads-list">
      {ads.map((ad) => {
        const profile = getOne(ad.profiles);
        const category = getOne(ad.categories);
        const city = getOne(ad.cities);

        const images = ad.ad_images ?? [];

        return (
          <article
            className="ad-card"
            key={ad.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(ad)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                onOpen(ad);
              }
            }}
          >
            <div className="ad-details">
              <h3>{ad.title}</h3>

              <p>
                {ad.description ||
                  "لا يوجد وصف للإعلان."}
              </p>

              <div className="ad-meta">
              <span>
                {ad.listing_type === "donation"
                  ? "مجاناً ❤️"
                  : ad.price != null
                    ? `${ad.price.toLocaleString("en-US")} ${ad.currency ?? ""}`
                    : "السعر غير محدد"}
              </span>

                <span>
                  {formatCondition(ad.condition)}
                </span>

                <span>
                  {formatDate(ad.created_at)}
                </span>
              </div>

<div className="ad-meta">
  <span>
    نوع الإعلان:{" "}
    {ad.listing_type === "donation"
      ? "تبرع مجاني ❤️"
      : "بيع"}
  </span>

  <span>
    صاحب الإعلان:{" "}
    {profile?.display_name ??
      "غير معروف"}
  </span>

                <span>
                  التصنيف:{" "}
                  {category?.name_ar ??
                    "غير محدد"}
                </span>

                <span>
                  المدينة:{" "}
                  {city?.name_ar ??
                    "غير محددة"}
                </span>
              </div>

              <div className="ad-meta">
                <span>
                  عدد الصور: {images.length}
                </span>

                <span>
                  رقم الإعلان: {ad.id.slice(0, 8)}
                </span>

                <span>
                  <Eye size={14} />
                  اضغط لعرض التفاصيل
                </span>
              </div>
            </div>

            <div className="ad-actions">
              <button
                className="approve-button"
                disabled={actionLoading === ad.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onApprove(ad.id);
                }}
              >
                {actionLoading === ad.id ? (
                  <LoaderCircle
                    size={17}
                    className="spin"
                  />
                ) : (
                  <CheckCircle size={17} />
                )}

                قبول
              </button>

              <button
                className="reject-button"
                disabled={actionLoading === ad.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onReject(ad.id);
                }}
              >
                <XCircle size={17} />

                رفض
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// نافذة تفاصيل الإعلان
function AdDetailsModal({
  ad,
  actionLoading,
  onClose,
  onApprove,
  onReject,
  formatDate,
  formatCondition,
}: {
  ad: Ad;
  actionLoading: string | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  formatDate: (date: string) => string;
  formatCondition: (condition: string | null) => string;
}) {
  const profile = getOne(ad.profiles);
  const category = getOne(ad.categories);
  const city = getOne(ad.cities);

  const images = ad.ad_images ?? [];
  const isProcessing = actionLoading === ad.id;

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="ad-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ad-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-modal-title"
      >
        <div className="ad-modal-header">
          <h2>تفاصيل الإعلان</h2>

          <button
            className="ad-modal-close"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            <X size={21} />
          </button>
        </div>

        <div className="ad-modal-body">
          <h3
            className="ad-modal-title"
            id="ad-modal-title"
          >
            {ad.title}
          </h3>

          <p className="ad-modal-description">
            {ad.description || "لا يوجد وصف للإعلان."}
          </p>

          <h4 className="ad-modal-section-title">
            <ImageIcon
              size={17}
              style={{
                verticalAlign: "middle",
                marginLeft: 7,
              }}
            />
            صور الإعلان
          </h4>

          {images.length > 0 ? (
            <div className="ad-modal-images">
              {images.map((image, index) => (
                image.signedUrl ? (
                  <a
                    key={`${image.image_path}-${index}`}
                    href={image.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <img
                      src={image.signedUrl}
                      alt={`صورة الإعلان ${index + 1}`}
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div
                    className="ad-no-images"
                    key={`${image.image_path}-${index}`}
                  >
                    تعذر تحميل هذه الصورة
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="ad-no-images">
              <ImageIcon
                size={25}
                style={{ marginBottom: 8 }}
              />

              <div>لا توجد صور مرفقة بهذا الإعلان</div>
            </div>
          )}

          <h4 className="ad-modal-section-title">
            معلومات الإعلان
          </h4>

          <div className="ad-info-grid">
            <InfoItem
              icon={<Tag size={16} />}
              label="التصنيف"
              value={category?.name_ar ?? "غير محدد"}
            />

            <InfoItem
              icon={<MapPin size={16} />}
              label="المدينة"
              value={city?.name_ar ?? "غير محددة"}
            />

<InfoItem
  icon={<Hash size={16} />}
  label="نوع الإعلان والسعر"
  value={
    ad.listing_type === "donation"
      ? "تبرع مجاني ❤️"
      : ad.price != null
        ? `${ad.price.toLocaleString("en-US")} ${ad.currency ?? ""}`
        : "السعر غير محدد"
  }
/>

            <InfoItem
              icon={<Tag size={16} />}
              label="حالة المنتج"
              value={formatCondition(ad.condition)}
            />

            <InfoItem
              icon={<CalendarDays size={16} />}
              label="تاريخ النشر"
              value={formatDate(ad.created_at)}
            />

            <InfoItem
              icon={<ImageIcon size={16} />}
              label="عدد الصور"
              value={String(images.length)}
            />
          </div>

          <h4 className="ad-modal-section-title">
            معلومات صاحب الإعلان
          </h4>

          <div className="ad-info-grid">
            <InfoItem
              icon={<UserRound size={16} />}
              label="اسم المستخدم"
              value={profile?.display_name ?? "غير معروف"}
            />

            <InfoItem
              icon={<Hash size={16} />}
              label="معرّف المستخدم"
              value={ad.user_id}
            />
          </div>

          <h4 className="ad-modal-section-title">
            معلومات إضافية
          </h4>

          <div className="ad-info-grid">
            <InfoItem
              icon={<Hash size={16} />}
              label="رقم الإعلان"
              value={ad.id}
            />

            <InfoItem
              icon={<CalendarDays size={16} />}
              label="تاريخ الإضافة"
              value={new Date(ad.created_at).toLocaleString("ar-SY")}
            />
          </div>
        </div>

        <div className="ad-modal-footer">
          <button
            className="approve-button"
            disabled={isProcessing}
            onClick={() => onApprove(ad.id)}
          >
            {isProcessing ? (
              <LoaderCircle
                size={17}
                className="spin"
              />
            ) : (
              <CheckCircle size={17} />
            )}

            قبول الإعلان
          </button>

          <button
            className="reject-button"
            disabled={isProcessing}
            onClick={() => onReject(ad.id)}
          >
            <XCircle size={17} />
            رفض الإعلان
          </button>
        </div>
      </div>
    </div>
  );
}

// عنصر معلومة داخل نافذة التفاصيل
function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="ad-info-item">
      <span>
        {icon} {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

// نافذة تفاصيل المستخدم
function UserDetailsModal({
  user,
  ads,
  loading,
  onClose,
  formatDate,
}: {
  user: Profile;
  ads: UserAd[];
  loading: boolean;
  onClose: () => void;
  formatDate: (date: string) => string;
}) {
  const [userBan, setUserBan] = useState<UserBan | null>(null);
  const [banHistory, setBanHistory] = useState<UserBan[]>([]);
  const [banLoading, setBanLoading] = useState(false);
  const [banActionLoading, setBanActionLoading] = useState(false);

  // تحديد الحظر الفعّال فقط
  function getActiveBan(history: UserBan[]) {
    return history.find((ban) => {
      if (ban.lifted_at !== null) return false;

      if (ban.ban_type === "permanent") return true;

      return (
        ban.banned_until !== null &&
        new Date(ban.banned_until).getTime() > Date.now()
      );
    }) || null;
  }

  // تحميل سجل الحظر
  async function loadUserBan() {
    setBanLoading(true);

    try {
      const { data, error } = await supabase
        .from("user_bans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const history = (data || []) as UserBan[];

      setBanHistory(history);
      setUserBan(getActiveBan(history));
    } catch (err) {
      console.error("Error loading user bans:", err);
    } finally {
      setBanLoading(false);
    }
  }

  useEffect(() => {
    loadUserBan();
  }, [user.id]);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // تنفيذ الحظر
  async function handleBan(type: "temporary" | "permanent") {
    const reason = window.prompt("اكتب سبب حظر هذا المستخدم:");

    if (!reason?.trim()) return;

    let duration_hours: number | undefined;

    if (type === "temporary") {
      const duration = window.prompt("أدخل مدة الحظر بالساعات:");

      if (!duration || !/^\d+$/.test(duration)) {
        alert("يرجى إدخال مدة صحيحة بالساعات.");
        return;
      }

      duration_hours = Number(duration);

      if (duration_hours < 1 || duration_hours > 876000) {
        alert("مدة الحظر يجب أن تكون بين ساعة واحدة و876000 ساعة.");
        return;
      }
    }

    if (
      type === "permanent" &&
      !window.confirm("هل أنت متأكد من حظر هذا المستخدم نهائياً؟")
    ) {
      return;
    }

    setBanActionLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-user-ban",
        {
          body: {
            action: "ban",
            user_id: user.id,
            ban_type: type,
            reason: reason.trim(),
            duration_hours,
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      alert(data?.message || "تم تنفيذ الحظر.");

      await loadUserBan();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "فشل تنفيذ الحظر."
      );
    } finally {
      setBanActionLoading(false);
    }
  }

  // فك الحظر
  async function handleUnban() {
    if (!window.confirm("هل أنت متأكد من فك الحظر عن هذا المستخدم؟")) {
      return;
    }

    setBanActionLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-user-ban",
        {
          body: {
            action: "unban",
            user_id: user.id,
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      alert(data?.message || "تم فك الحظر.");

      await loadUserBan();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "فشل فك الحظر."
      );
    } finally {
      setBanActionLoading(false);
    }
  }

  const statusLabels: Record<string, string> = {
    pending: "قيد المراجعة",
    approved: "منشور",
    rejected: "مرفوض",
    sold: "مباع",
    archived: "مؤرشف",
  };

  const pendingCount = ads.filter(
    (ad) => ad.status === "pending"
  ).length;

  const approvedCount = ads.filter(
    (ad) => ad.status === "approved"
  ).length;

  const rejectedCount = ads.filter(
    (ad) => ad.status === "rejected"
  ).length;

  return (
    <div
      className="ad-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ad-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ad-modal-header">
          <h2 id="user-modal-title">
            تفاصيل المستخدم
          </h2>

          <button
            className="ad-modal-close"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            <X size={21} />
          </button>
        </div>

        <div className="user-stats">
          <div className="user-stat approved">
            <strong>{approvedCount}</strong>
            <span>منشور</span>
          </div>

          <div className="user-stat pending">
            <strong>{pendingCount}</strong>
            <span>قيد المراجعة</span>
          </div>

          <div className="user-stat rejected">
            <strong>{rejectedCount}</strong>
            <span>مرفوض</span>
          </div>
        </div>

        <div className="ad-modal-body">
          <div className="user-details-heading">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" />
            ) : (
              <UserRound size={35} />
            )}

            <div>
              <h3>
                {user.display_name || "مستخدم جديد"}
              </h3>

              <p>عضو في Sooq.Sy</p>
            </div>
          </div>

          <h4 className="ad-modal-section-title">
            المعلومات الشخصية
          </h4>

          <div className="ad-info-grid">
            <InfoItem
              icon={<UserRound size={16} />}
              label="اسم المستخدم"
              value={user.display_name || "غير محدد"}
            />

            <InfoItem
              icon={<Hash size={16} />}
              label="معرّف الحساب"
              value={user.id}
            />

            <InfoItem
              icon={<CalendarDays size={16} />}
              label="تاريخ التسجيل"
              value={formatDate(user.created_at)}
            />

            <InfoItem
              icon={<Megaphone size={16} />}
              label="إجمالي الإعلانات"
              value={String(ads.length)}
            />
          </div>

          <h4 className="ad-modal-section-title">
            حالة الحساب
          </h4>

          <div className="ad-info-grid">
            <InfoItem
              icon={<UserRound size={16} />}
              label="حالة الحساب"
              value={
                banLoading
                  ? "جارٍ التحقق..."
                  : userBan
                    ? userBan.ban_type === "permanent"
                      ? "محظور نهائياً"
                      : "محظور مؤقتاً"
                    : "نشط"
              }
            />

            {userBan && (
              <>
                <InfoItem
                  icon={<CalendarDays size={16} />}
                  label="تاريخ الحظر"
                  value={formatDate(userBan.created_at)}
                />

                <InfoItem
                  icon={<Megaphone size={16} />}
                  label="سبب الحظر"
                  value={userBan.reason}
                />

                {userBan.banned_until && (
                  <InfoItem
                    icon={<CalendarDays size={16} />}
                    label="انتهاء الحظر"
                    value={new Date(userBan.banned_until).toLocaleString("ar-SY")}
                  />
                )}
              </>
            )}
          </div>

          <div className="user-ban-actions">
            {userBan ? (
              <button
                type="button"
                className="ban-button unban-button"
                onClick={handleUnban}
                disabled={banActionLoading || banLoading}
              >
                {banActionLoading ? "جارٍ التنفيذ..." : "فك الحظر"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="ban-button temporary-ban-button"
                  onClick={() => handleBan("temporary")}
                  disabled={banActionLoading || banLoading}
                >
                  حظر مؤقت
                </button>

                <button
                  type="button"
                  className="ban-button permanent-ban-button"
                  onClick={() => handleBan("permanent")}
                  disabled={banActionLoading || banLoading}
                >
                  حظر نهائي
                </button>
              </>
            )}
          </div>

          

          {banHistory.length === 0 ? (
  <div className="empty-state">
    <p>لا يوجد سجل حظر سابق.</p>
  </div>
) : (
  <div className="ban-history-list">
    {banHistory.map((ban) => {
      const isExpired =
        ban.ban_type === "temporary" &&
        ban.banned_until !== null &&
        new Date(ban.banned_until).getTime() <= Date.now();

      const status = ban.lifted_at
        ? "تم فك الحظر"
        : isExpired
          ? "انتهت المدة"
          : "الحظر نشط";

      const statusClass = ban.lifted_at
        ? "lifted"
        : isExpired
          ? "expired"
          : "active";

      return (
        <div className="ban-history-card" key={ban.id}>
          <div className="ban-history-header">
            <strong>
              {ban.ban_type === "permanent"
                ? "حظر نهائي"
                : "حظر مؤقت"}
            </strong>

            <span className={`ban-status-badge ${statusClass}`}>
              {status}
            </span>
          </div>

          <div className="ban-history-details">
            <p>
              <span>سبب الحظر:</span> {ban.reason}
            </p>

            <p>
              <span>تاريخ الحظر:</span> {formatDate(ban.created_at)}
            </p>

            {ban.banned_until && (
              <p>
                <span>انتهاء الحظر:</span>{" "}
                {formatDate(ban.banned_until)}
              </p>
            )}

            {ban.lifted_at && (
              <p>
                <span>تاريخ فك الحظر:</span>{" "}
                {formatDate(ban.lifted_at)}
              </p>
            )}
          </div>
        </div>
      );
    })}
  </div>
)}

          <h4 className="ad-modal-section-title">
            إعلانات المستخدم
          </h4>

          {loading ? (
  <div className="empty-state">
    <LoaderCircle className="spin" size={25} />
    <p>جارٍ تحميل إعلانات المستخدم...</p>
  </div>
) : ads.length === 0 ? (
  <div className="empty-state">
    <Megaphone size={28} />
    <p>هذا المستخدم لم يضف أي إعلانات بعد.</p>
  </div>
) : (
  <div className="user-ads-list">
    {ads.map((ad) => (
      <div className="user-ad-item" key={ad.id}>
        <div>
          <strong>{ad.title}</strong>
          <span>{formatDate(ad.created_at)}</span>
        </div>

        <div className="user-ad-meta">
          <strong>
            {ad.price != null
              ? `${ad.price.toLocaleString("en-US")} ${ad.currency ?? ""}`
              : "السعر غير محدد"}
          </strong>

          <span>
            {statusLabels[ad.status] ?? ad.status}
          </span>
        </div>
      </div>
    ))}
  </div>
)}

        </div>
      </div>
    </div>
  );
}

// نافذة إضافة تصنيف
function CategoryFormModal({
  categories,
  name,
  parent,
  saving,
  error,
  isEditing,
  onNameChange,
  onParentChange,
  onClose,
  onSave,
}: {
  categories: Category[];
  name: string;
  parent: string;
  saving: boolean;
  error: string;
  isEditing: boolean;
  onNameChange: (value: string) => void;
  onParentChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="ad-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ad-modal category-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ad-modal-header">
          <h2 id="category-form-title">
           {isEditing ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
          </h2>

          <button
            className="ad-modal-close"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            <X size={21} />
          </button>
        </div>

        <form
          className="ad-modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="category-form-field">
            <label htmlFor="category-name">
              اسم التصنيف
            </label>

            <input
              id="category-name"
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="اكتب اسم التصنيف"
              required
              autoFocus
            />
          </div>

          <div className="category-form-field">
            <label htmlFor="category-parent">
              التصنيف الرئيسي
            </label>

            <select
              id="category-parent"
              value={parent}
              onChange={(event) => onParentChange(event.target.value)}
            >
              <option value="">
                تصنيف رئيسي جديد
              </option>

              {categories
  .filter((category) => category.parent_id === null)
  .map((category) => (
                <option
                  key={category.id}
                  value={String(category.id)}
                >
                  {category.name_ar}
                </option>
              ))}
            </select>

            <small>
              اترك الخيار كما هو لإضافة تصنيف رئيسي،
              أو اختر تصنيفاً لإضافة تصنيف فرعي تحته.
            </small>
          </div>

          {error && (
            <div className="data-error">
              {error}
            </div>
          )}

          <div className="ad-modal-footer">
            <button
              type="button"
              className="reject-button"
              onClick={onClose}
              disabled={saving}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="approve-button"
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Plus size={17} />
              )}

              {saving ? "جارٍ الحفظ..." : "حفظ التصنيف"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function CityFormModal({
  name,
  saving,
  error,
  isEditing,
  governorates,
  selectedGovernorateId,
  onNameChange,
  onGovernorateChange,
  onClose,
  onSave,
}: {
  name: string;
  saving: boolean;
  error: string;
  isEditing: boolean;
  governorates: Governorate[];
  selectedGovernorateId: number | "";
  onNameChange: (value: string) => void;
  onGovernorateChange: (value: number | "") => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="ad-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ad-modal category-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ad-modal-header">
          <h2 id="city-form-title">
            {isEditing ? "تعديل المدينة" : "إضافة مدينة جديدة"}
          </h2>

          <button
            className="ad-modal-close"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            <X size={21} />
          </button>
        </div>

        <form
          className="ad-modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="category-form-field">
            <label htmlFor="city-name">
              اسم المدينة
            </label>

            <input
              id="city-name"
              type="text"
              value={name}
              onChange={(event) =>
                onNameChange(event.target.value)
              }
              placeholder="اكتب اسم المدينة"
              required
              autoFocus
            />
          </div>

{!isEditing && (
  <div className="category-form-field">
    <label htmlFor="city-governorate">المحافظة</label>

    <select
      id="city-governorate"
      value={selectedGovernorateId}
      onChange={(event) =>
        onGovernorateChange(
          event.target.value ? Number(event.target.value) : ""
        )
      }
      required
    >
      <option value="">اختر المحافظة</option>

      {governorates.map((governorate) => (
        <option key={governorate.id} value={governorate.id}>
          {governorate.name_ar}
        </option>
      ))}
    </select>
  </div>
)}

          {error && (
            <div className="data-error">
              {error}
            </div>
          )}

          <div className="ad-modal-footer">
            <button
              type="button"
              className="reject-button"
              onClick={onClose}
              disabled={saving}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="approve-button"
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Plus size={17} />
              )}

              {saving
                ? "جارٍ الحفظ..."
                : isEditing
                  ? "حفظ التعديل"
                  : "إضافة المدينة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default App;
