
import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import Donations from "./Donations";
import { useNavigate } from "react-router-dom";
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
  Copy,
  CalendarDays,
  UserRound,
  MapPin,
  Tag,
  Coins,
  Wallet,
  Plus,
  Image as ImageIcon,
  Hash,
  Store,
  ShieldCheck,
  Truck,

} from "lucide-react";

import { supabase } from "./lib/supabase";
import "./App.css";
declare global {
  interface Window {
    sooqConfirm: (message: string) => Promise<boolean>;
    sooqPrompt: (message: string) => Promise<string | null>;
  }
}
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
type SubscriptionPaymentRequest = {
  id: string;
  user_id: string;
  phone: string;
  package_number: number;
  amount_usd: number;
  exchange_rate: number;
  amount_syp: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  request_type: "subscription" | "featured_campaign";
  plan_name?: string;
  duration_months?: number;
  user_name?: string;
};

type PointsCampaignRequest = {
  id: string;
  user_id: string;
  ad_id: string | null;
  points_cost: number;
  status: string;
  created_at: string;
  admin_note: string | null;
  reviewed_at: string | null;
  user_name?: string;
  ad_title?: string;
};

type StoreSubscriptionRequest = {
  id: string;
  store_id: string;
  user_id: string;
  phone: string;
  price_usd: number;
  duration_months: number;
  ordinary_ads_limit: number;
  featured_ads_limit: number;
  exchange_rate: number;
  amount_syp: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  store_name?: string;
  business_type?: string;
  governorate?: string;
  city?: string;
  store_phone?: string;
  whatsapp?: string;
  owner_name?: string;
  ordinary_used: number;
  featured_used: number;

  ordinary_remaining: number;

  featured_remaining: number;
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

type SupportConversation = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  last_message_at: string;
  user_name?: string;
  unread_count?: number;
  last_message?: string;
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type DeliveryApplication = {
  id: string;
  user_id: string;
  status: string;
  applicant_note: string | null;
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type AdminDeliveryDriver = {
  user_id: string;
  status: string;
  is_available: boolean;
  admin_disabled: boolean;
  admin_disabled_reason?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type AdminStore = {
  id: string;
  owner_id: string | null;
  name: string | null;
  business_type: string | null;
  governorate: string | null;
  city: string | null;
  phone: string | null;
  status: string;
  owner_disabled: boolean;
  admin_disabled: boolean;
  disabled_ads_mode: "hide" | "show";
};

function getOne<T>(value: Related<T>): T | null {
  if (!value) return null;

  return Array.isArray(value)
    ? value[0] ?? null
    : value as T;
}

function App() {
  const navigate = useNavigate();
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
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
const [logoUploading, setLogoUploading] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
const [heroImageUploading, setHeroImageUploading] = useState(false);
const [shamCashQrUrl, setShamCashQrUrl] = useState("");
const [shamCashQrFile, setShamCashQrFile] = useState<File | null>(null);
const [shamCashQrUploading, setShamCashQrUploading] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  const [deliveryApplications, setDeliveryApplications] = useState<DeliveryApplication[]>([]);
  const [deliveryApplicationsLoading, setDeliveryApplicationsLoading] = useState(false);
  const [deliveryApplicationsError, setDeliveryApplicationsError] = useState("");
  const [deliveryApplicationActionLoading, setDeliveryApplicationActionLoading] = useState<string | null>(null);
  const [adminDeliveryDrivers, setAdminDeliveryDrivers] = useState<AdminDeliveryDriver[]>([]);
  const [adminDeliveryDriversLoading, setAdminDeliveryDriversLoading] = useState(false);
  const [adminDeliveryDriversError, setAdminDeliveryDriversError] = useState("");
  const [deliveryDriverActionLoading, setDeliveryDriverActionLoading] = useState<string | null>(null);

  const [activeMenu, setActiveMenu] = useState("الرئيسية");
  const [supportConversations, setSupportConversations] = useState<SupportConversation[]>([]);
  const [supportConversationsLoading, setSupportConversationsLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [selectedSupportConversationId, setSelectedSupportConversationId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportMessagesLoading, setSupportMessagesLoading] = useState(false);
  const [supportReply, setSupportReply] = useState("");
  const [supportSending, setSupportSending] = useState(false);

  const [stats, setStats] = useState({

    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [reports, setReports] = useState<Report[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionPaymentRequest[]>([]);
const [subscriptionRequestsLoading, setSubscriptionRequestsLoading] = useState(false);
const [subscriptionRequestsError, setSubscriptionRequestsError] = useState("");
const [campaignRequests, setCampaignRequests] = useState<SubscriptionPaymentRequest[]>([]);
const [campaignRequestsLoading, setCampaignRequestsLoading] = useState(false);
const [campaignRequestsError, setCampaignRequestsError] = useState("");
const [pointsCampaignRequests, setPointsCampaignRequests] =
  useState<PointsCampaignRequest[]>([]);
const [storeRequests, setStoreRequests] = useState<StoreSubscriptionRequest[]>([]);
const [storeRequestsLoading, setStoreRequestsLoading] = useState(false);
const [storeRequestsError, setStoreRequestsError] = useState("");

const [adminStores, setAdminStores] = useState<AdminStore[]>([]);
const [adminStoresLoading, setAdminStoresLoading] = useState(false);
const [adminStoresError, setAdminStoresError] = useState("");
const [storeActionLoading, setStoreActionLoading] = useState<string | null>(null);
const [adminStoreAdsMode, setAdminStoreAdsMode] =
  useState<"hide" | "show">("hide");

const [accountVerificationRequests, setAccountVerificationRequests] =
  useState<AccountVerificationRequest[]>([]);
const [accountVerificationRequestsLoading, setAccountVerificationRequestsLoading] =
  useState(false);
const [accountVerificationRequestsError, setAccountVerificationRequestsError] =

  useState("");
  type AccountVerificationRequest = {
  id: string;
  user_id: string;
  status: string;
  phone: string;
  payment_reference: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  start_at: string | null;
  end_at: string | null;
  user_name: string;
};
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
  // شحن النقاط - إدارة الباقات
type PointPackage = {
  id: string;
  name: string;
  price_usd: number;
  points: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type PointTopupRequest = {
  id: string;
  user_id: string;
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

const [pointPackages, setPointPackages] = useState<PointPackage[]>([]);
const [pointPackagesLoading, setPointPackagesLoading] = useState(false);
const [pointPackagesError, setPointPackagesError] = useState("");
const [pointPackagesSuccess, setPointPackagesSuccess] = useState("");

const [editingPointPackage, setEditingPointPackage] =
  useState<PointPackage | null>(null);
const [pointPackageName, setPointPackageName] = useState("");
const [pointPackagePrice, setPointPackagePrice] = useState("");
const [pointPackageSortOrder, setPointPackageSortOrder] = useState("0");
const [pointPackageSaving, setPointPackageSaving] = useState(false);

const [pointTopupRequests, setPointTopupRequests] =
  useState<PointTopupRequest[]>([]);
const [pointTopupRequestsLoading, setPointTopupRequestsLoading] =
  useState(false);
const [pointTopupRequestsError, setPointTopupRequestsError] = useState("");
const [pointTopupActionLoading, setPointTopupActionLoading] =
  useState<string | null>(null);
const [pointTopupAdminNote, setPointTopupAdminNote] = useState("");

const resetPointPackageForm = () => {
  setEditingPointPackage(null);
  setPointPackageName("");
  setPointPackagePrice("");
  setPointPackageSortOrder("0");
};

const handleSavePointPackage = async () => {
  const name = pointPackageName.trim();
  const price = Number(pointPackagePrice);
  const sortOrder = Number(pointPackageSortOrder);

  if (!name || !Number.isFinite(price) || price <= 0) {
    setPointPackagesError("أدخل اسم الباقة وسعراً صحيحاً.");
    return;
  }

  if (!Number.isFinite(sortOrder)) {
    setPointPackagesError("ترتيب الباقة غير صحيح.");
    return;
  }

  setPointPackageSaving(true);
  setPointPackagesError("");
  setPointPackagesSuccess("");

  try {
    const payload = {
      name,
      price_usd: price,
      points: Math.round(price * 10),
      sort_order: sortOrder,
    };

    const query = editingPointPackage
      ? supabase
          .from("point_packages")
          .update(payload)
          .eq("id", editingPointPackage.id)
      : supabase
          .from("point_packages")
          .insert({ ...payload, is_active: true });

    const { error } = await query;

    if (error) throw error;

    setPointPackagesSuccess("تم حفظ الباقة بنجاح.");
    resetPointPackageForm();
    await loadPointPackages();
  } catch (err) {
    setPointPackagesError(
      err instanceof Error ? err.message : "تعذر حفظ الباقة."
    );
  } finally {
    setPointPackageSaving(false);
  }
};

const handleTogglePointPackage = async (pkg: PointPackage) => {
  setPointPackagesError("");
  setPointPackagesSuccess("");

  const { error } = await supabase
    .from("point_packages")
    .update({ is_active: !pkg.is_active })
    .eq("id", pkg.id);

  if (error) {
    setPointPackagesError(error.message);
    return;
  }

  setPointPackagesSuccess("تم تحديث حالة الباقة.");
  await loadPointPackages();
};

const handlePointTopupAction = async (
  request: PointTopupRequest,
  action: "approve" | "reject"
) => {
  if (request.status !== "pending") return;

  const confirmed = window.confirm(
    action === "approve"
      ? "هل أنت متأكد من الموافقة على طلب الشحن وإضافة النقاط؟"
      : "هل أنت متأكد من رفض طلب الشحن؟"
  );

  if (!confirmed) return;

  setPointTopupActionLoading(request.id);
  setPointTopupRequestsError("");

  try {
    const { error } = await supabase.rpc(
      action === "approve"
        ? "approve_point_topup"
        : "reject_point_topup",
      {
        p_request_id: request.id,
        p_admin_note: pointTopupAdminNote.trim() || null,
      }
    );

    if (error) throw error;

    setPointTopupAdminNote("");
    await loadPointTopupRequests();
} catch (err: any) {
  console.error("Point topup admin action failed:", err);

  setPointTopupRequestsError(
    err?.message ||
    err?.details ||
    err?.hint ||
    "تعذر تنفيذ العملية."
  );
} finally {
  setPointTopupActionLoading(null);
}
};

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

  const loadPointPackages = async () => {
  setPointPackagesLoading(true);
  setPointPackagesError("");

  try {
    const { data, error } = await supabase
      .from("point_packages")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    setPointPackages(data || []);
  } catch (err) {
    setPointPackagesError(
      err instanceof Error ? err.message : "تعذر تحميل الباقات."
    );
  } finally {
    setPointPackagesLoading(false);
  }
};

const loadPointTopupRequests = async () => {
  setPointTopupRequestsLoading(true);
  setPointTopupRequestsError("");

  try {
    const { data, error } = await supabase
      .from("point_topup_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setPointTopupRequests(data || []);
  } catch (err) {
    setPointTopupRequestsError(
      err instanceof Error ? err.message : "تعذر تحميل طلبات الشحن."
    );
  } finally {
    setPointTopupRequestsLoading(false);
  }
};

useEffect(() => {
  if (activeMenu !== "شحن النقاط" || !admin) return;

  loadPointPackages();
  loadPointTopupRequests();
}, [activeMenu, admin]);

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

const loadSubscriptionRequests = useCallback(async () => {
  setSubscriptionRequestsLoading(true);
  setSubscriptionRequestsError("");

  try {
    const { data, error } = await supabase
      .from("subscription_payment_requests")
      .select("*")
      .eq("request_type", "subscription")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const requests = (data ?? []) as SubscriptionPaymentRequest[];

    const packageNumbers = [
      ...new Set(requests.map((request) => request.package_number)),
    ];

    const userIds = [
      ...new Set(requests.map((request) => request.user_id)),
    ];

    let plans: {
      id: number;
      name: string;
      duration_months: number;
    }[] = [];

    let profiles: {
      id: string;
      display_name: string | null;
    }[] = [];

    if (packageNumbers.length > 0) {
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("id, name, duration_months")
        .in("id", packageNumbers);

      if (plansError) throw plansError;
      plans = plansData ?? [];
    }

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      profiles = profilesData ?? [];
    }

    const enrichedRequests = requests.map((request) => {
      const plan = plans.find(
        (item) => item.id === request.package_number
      );

      const profile = profiles.find(
        (item) => item.id === request.user_id
      );

      return {
        ...request,
        plan_name: plan?.name ?? `الباقة ${request.package_number}`,
        duration_months: plan?.duration_months ?? 0,
        user_name: profile?.display_name ?? "مستخدم غير معروف",
      };
    });

    setSubscriptionRequests(enrichedRequests);
  } catch (err) {
    console.error("Error loading subscription requests:", err);
    setSubscriptionRequestsError("تعذر تحميل طلبات الاشتراك.");
  } finally {
    setSubscriptionRequestsLoading(false);
  }
}, []);
const loadCampaignRequests = useCallback(async () => {
  setCampaignRequestsLoading(true);
  setCampaignRequestsError("");

  try {
    const [
      { data: cashData, error: cashError },
      { data: pointsData, error: pointsError },
    ] = await Promise.all([
      supabase
        .from("subscription_payment_requests")
        .select("*")
        .eq("request_type", "featured_campaign")
        .order("created_at", { ascending: false }),

      supabase
        .from("featured_ad_campaigns")
        .select(
          "id, user_id, ad_id, points_cost, status, created_at, admin_note, reviewed_at"
        )
        .is("payment_request_id", null)
        .not("points_transaction_id", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    if (cashError) throw cashError;
    if (pointsError) throw pointsError;

    const cashRequests = (cashData ?? []) as SubscriptionPaymentRequest[];
    const pointsRequests = (pointsData ?? []) as PointsCampaignRequest[];

    const userIds = [
      ...new Set([
        ...cashRequests.map((request) => request.user_id),
        ...pointsRequests.map((request) => request.user_id),
      ]),
    ];

    const adIds = [
      ...new Set(
        pointsRequests
          .map((request) => request.ad_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    let profiles: {
      id: string;
      display_name: string | null;
    }[] = [];

    let ads: {
      id: string;
      title: string;
    }[] = [];

    const [profilesResult, adsResult] = await Promise.all([
      userIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),

      adIds.length > 0
        ? supabase
            .from("ads")
            .select("id, title")
            .in("id", adIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (adsResult.error) throw adsResult.error;

    profiles = profilesResult.data ?? [];
    ads = adsResult.data ?? [];

    const enrichedCashRequests = cashRequests.map((request) => {
      const profile = profiles.find(
        (item) => item.id === request.user_id
      );

      return {
        ...request,
        user_name: profile?.display_name ?? "مستخدم غير معروف",
      };
    });

    const enrichedPointsRequests = pointsRequests.map((request) => {
      const profile = profiles.find(
        (item) => item.id === request.user_id
      );

      const ad = ads.find(
        (item) => item.id === request.ad_id
      );

      return {
        ...request,
        user_name: profile?.display_name ?? "مستخدم غير معروف",
        ad_title: ad?.title ?? "إعلان غير متوفر",
      };
    });

    setCampaignRequests(enrichedCashRequests);
    setPointsCampaignRequests(enrichedPointsRequests);
  } catch (err) {
    console.error("Error loading campaign requests:", err);
    setCampaignRequestsError("تعذر تحميل طلبات حملات التمييز.");
  } finally {
    setCampaignRequestsLoading(false);
  }
}, []);



const loadStoreRequests = useCallback(async () => {
  setStoreRequestsLoading(true);
  setStoreRequestsError("");

  try {
    const { data, error } = await supabase
      .from("store_subscription_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const requests = data ?? [];

    const storeIds = [
      ...new Set(requests.map((r) => r.store_id)),
    ];

    const userIds = [
      ...new Set(requests.map((r) => r.user_id)),
    ];

    const [storesResult, profilesResult, subscriptionsResult] =
      await Promise.all([
        storeIds.length
          ? supabase
              .from("stores")
              .select(
                "id,name,business_type,governorate,city,phone,whatsapp"
              )
              .in("id", storeIds)
          : Promise.resolve({ data: [], error: null }),

        userIds.length
          ? supabase
              .from("profiles")
              .select("id,display_name")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null }),

        storeIds.length
          ? supabase
              .from("store_subscriptions")
              .select(
                "id,store_id,status,start_at,end_at,created_at,ordinary_ads_limit,featured_ads_limit"
              )
              .in("store_id", storeIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (storesResult.error) throw storesResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;

    const storesMap = new Map(
      (storesResult.data ?? []).map((store) => [
        store.id,
        store,
      ])
    );

    const profilesMap = new Map(
      (profilesResult.data ?? []).map((profile) => [
        profile.id,
        profile.display_name,
      ])
    );

    // آخر اشتراك لكل متجر
    const subscriptionsMap = new Map<
      string,
      {
        id: string;
        ordinary_ads_limit: number;
        featured_ads_limit: number;
      }
    >();

    (subscriptionsResult.data ?? []).forEach((subscription) => {
      if (!subscriptionsMap.has(subscription.store_id)) {
        subscriptionsMap.set(subscription.store_id, {
          id: subscription.id,
          ordinary_ads_limit: subscription.ordinary_ads_limit,
          featured_ads_limit: subscription.featured_ads_limit,
        });
      }
    });

    // جلب استخدام الإعلانات للاشتراكات الحالية
    const subscriptionIds = [
      ...subscriptionsMap.values(),
    ].map((subscription) => subscription.id);

    const usageResult = subscriptionIds.length
      ? await supabase
          .from("store_ad_usage")
          .select("store_id,subscription_id,ad_type")
          .in("subscription_id", subscriptionIds)
      : { data: [], error: null };

    if (usageResult.error) throw usageResult.error;

    const usageMap = new Map<
      string,
      { ordinary: number; featured: number }
    >();

    (usageResult.data ?? []).forEach((usage) => {
      const key = usage.subscription_id;

      const current = usageMap.get(key) ?? {
        ordinary: 0,
        featured: 0,
      };

      const type = (usage.ad_type ?? "").toLowerCase();

      if (["ordinary", "regular", "normal"].includes(type)) {
        current.ordinary += 1;
      } else if (["featured", "premium"].includes(type)) {
        current.featured += 1;
      }

      usageMap.set(key, current);
    });

    setStoreRequests(
      requests.map((request) => {
        const store = storesMap.get(request.store_id);
        const subscription = subscriptionsMap.get(request.store_id);

        const usage = subscription
          ? usageMap.get(subscription.id) ?? {
              ordinary: 0,
              featured: 0,
            }
          : {
              ordinary: 0,
              featured: 0,
            };

        const ordinaryLimit =
          subscription?.ordinary_ads_limit ??
          request.ordinary_ads_limit ??
          100;

        const featuredLimit =
          subscription?.featured_ads_limit ??
          request.featured_ads_limit ??
          20;

        return {
          ...request,
          store_name: store?.name ?? "متجر غير معروف",
          business_type: store?.business_type ?? "",
          governorate: store?.governorate ?? "",
          city: store?.city ?? "",
          store_phone: store?.phone ?? "",
          whatsapp: store?.whatsapp ?? "",
          owner_name:
            profilesMap.get(request.user_id) ?? "غير معروف",

          ordinary_used: usage.ordinary,
          ordinary_remaining: Math.max(
            0,
            ordinaryLimit - usage.ordinary
          ),

          featured_used: usage.featured,
          featured_remaining: Math.max(
            0,
            featuredLimit - usage.featured
          ),
        };
      })
    );
  } catch (error) {
    console.error("Error loading store requests:", error);
    setStoreRequestsError(
      "تعذر تحميل طلبات المتاجر. حاول تحديث الصفحة."
    );
  } finally {
    setStoreRequestsLoading(false);
  }
}, []);

const loadAdminStores = useCallback(async () => {
  setAdminStoresLoading(true);
  setAdminStoresError("");

  try {
    const { data, error } = await supabase
      .from("stores")
      .select(`
        id,
        owner_id,
        name,
        business_type,
        governorate,
        city,
        phone,
        status,
        owner_disabled,
        admin_disabled,
        disabled_ads_mode
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setAdminStores((data ?? []) as AdminStore[]);
  } catch (error) {
    console.error("Error loading admin stores:", error);
    setAdminStoresError("تعذر تحميل المتاجر. حاول تحديث الصفحة.");
  } finally {
    setAdminStoresLoading(false);
  }
}, []);

const handleAdminStoreToggle = async (store: AdminStore) => {
  const disabling = !store.admin_disabled;

  const confirmed = window.confirm(
    disabling
      ? `هل تريد إيقاف متجر "${store.name || "بدون اسم"}" من الإدارة؟`
      : `هل تريد رفع إيقاف الإدارة عن متجر "${store.name || "بدون اسم"}"؟`
  );

  if (!confirmed) return;

  setStoreActionLoading(store.id);
  setAdminStoresError("");

  try {
    const { error } = await supabase.rpc(
      "admin_set_store_disabled",
      {
        p_store_id: store.id,
        p_disabled: disabling,
        p_ads_mode: adminStoreAdsMode,
      }
    );

    if (error) throw error;

    await loadAdminStores();

    alert(
      disabling
        ? "تم إيقاف المتجر من الإدارة."
        : "تم رفع إيقاف الإدارة عن المتجر."
    );
  } catch (error) {
    console.error("Error updating store:", error);
    setAdminStoresError(
      "تعذر تغيير حالة المتجر. حاول مرة أخرى."
    );
  } finally {
    setStoreActionLoading(null);
  }
};

const revokeAccountVerification = async (userId: string) => {
  const reason = window.prompt("اكتب سبب سحب شارة التوثيق:");

  if (reason === null) return;

  if (!reason.trim()) {
    alert("يجب كتابة سبب سحب التوثيق");
    return;
  }

  const confirmed = window.confirm(
    "هل أنت متأكد من سحب شارة التوثيق من هذا الحساب؟"
  );

  if (!confirmed) return;

  const { error } = await supabase.rpc(
    "revoke_account_verification",
    {
      p_user_id: userId,
      p_admin_note: reason.trim(),
    }
  );

  if (error) {
    alert("تعذر سحب التوثيق: " + error.message);
    return;
  }

  alert("تم سحب شارة التوثيق بنجاح");
  await loadAccountVerificationRequests();
};

const loadAccountVerificationRequests = useCallback(async () => {
  setAccountVerificationRequestsLoading(true);
  setAccountVerificationRequestsError("");

  const { data, error } = await supabase.rpc(
    "get_admin_account_verification_requests"
  );

  if (error) {
    console.error("loadAccountVerificationRequests:", error);
    setAccountVerificationRequestsError(error.message);
    setAccountVerificationRequests([]);
  } else {
    setAccountVerificationRequests(
      (data ?? []) as AccountVerificationRequest[]
    );
  }

  setAccountVerificationRequestsLoading(false);
}, []);

const approveSubscriptionRequest = async (requestId: string) => {
  const confirmed = await window.sooqConfirm(
    "هل تأكدت من وصول الحوالة وصحة المبلغ ورقم الهاتف؟ سيتم تفعيل الاشتراك أو جدولته."
  );

  if (!confirmed) return;

  setSubscriptionRequestsLoading(true);
  setSubscriptionRequestsError("");

  try {
    const { error } = await supabase.rpc(
      "approve_subscription_payment_request",
      { p_request_id: requestId }
    );

    if (error) throw error;

    alert("تمت الموافقة على طلب الاشتراك بنجاح.");
    await loadSubscriptionRequests();
  } catch (err) {
    console.error("Error approving subscription:", err);
    alert(
      err instanceof Error
        ? err.message
        : "تعذرت الموافقة على طلب الاشتراك."
    );
  } finally {
    setSubscriptionRequestsLoading(false);
  }
};

const approveCampaignRequest = async (requestId: string) => {
  const confirmed = await window.sooqConfirm(
    "هل تأكدت من وصول الحوالة وصحة المبلغ؟ سيتم تفعيل حملة التمييز لمدة 10 أيام."
  );

  if (!confirmed) return;

  setCampaignRequestsLoading(true);
  setCampaignRequestsError("");

  try {
    const { error } = await supabase.rpc(
      "approve_featured_campaign_request",
      { p_request_id: requestId }
    );

    if (error) throw error;

    alert("تم اعتماد حملة التمييز وتفعيلها بنجاح.");

    await loadCampaignRequests();
} catch (err: any) {
  console.error("Error approving campaign:", err);

  alert(
    JSON.stringify(
      {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      },
      null,
      2
    )
  );
}
 finally {
    setCampaignRequestsLoading(false);
  }
};

const approvePointsCampaignRequest = async (campaignId: string) => {
  const confirmed = await window.sooqConfirm(
    "هل تريد الموافقة على حملة التمييز؟ ستبدأ الحملة لمدة 10 أيام."
  );

  if (!confirmed) return;

  setCampaignRequestsLoading(true);

  try {
    const { error } = await supabase.rpc(
      "approve_featured_campaign_points",
      { p_campaign_id: campaignId }
    );

    if (error) throw error;

    alert("تمت الموافقة على حملة التمييز وتفعيلها بنجاح.");
    await loadCampaignRequests();
  } catch (err: any) {
    console.error("Error approving points campaign:", err);
    alert(err?.message || "تعذرت الموافقة على الحملة.");
  } finally {
    setCampaignRequestsLoading(false);
  }
};

const rejectPointsCampaignRequest = async (campaignId: string) => {
  const adminNote = await window.sooqPrompt(
    "اكتب سبب رفض طلب حملة التمييز:"
  );

  if (!adminNote || !adminNote.trim()) return;

  setCampaignRequestsLoading(true);

  try {
    const { error } = await supabase.rpc(
      "reject_featured_campaign_points",
      {
        p_campaign_id: campaignId,
        p_admin_note: adminNote.trim(),
      }
    );

    if (error) throw error;

    alert("تم رفض الحملة وإعادة النقاط إلى رصيد المستخدم.");
    await loadCampaignRequests();
  } catch (err: any) {
    console.error("Error rejecting points campaign:", err);
    alert(err?.message || "تعذر رفض طلب الحملة.");
  } finally {
    setCampaignRequestsLoading(false);
  }
};

const rejectCampaignRequest = async (requestId: string) => {
  const adminNote = await window.sooqPrompt(
  "اكتب سبب رفض طلب الاشتراك:"
);

  if (!adminNote || !adminNote.trim()) return;

  setCampaignRequestsLoading(true);
  setCampaignRequestsError("");

  try {
    const { error } = await supabase.rpc(
      "reject_featured_campaign_request",
      {
        p_request_id: requestId,
        p_admin_note: adminNote.trim(),
      }
    );

    if (error) throw error;

    alert("تم رفض طلب حملة التمييز.");
    await loadCampaignRequests();
  } catch (err) {
    console.error("Error rejecting campaign:", err);
    alert(
      err instanceof Error
        ? err.message
        : "تعذر رفض طلب الحملة."
    );
  } finally {
    setCampaignRequestsLoading(false);
  }
};


const rejectSubscriptionRequest = async (requestId: string) => {
  const adminNote = await window.sooqPrompt(
    "اكتب سبب رفض طلب الاشتراك:"
  );

  if (adminNote === null || !adminNote.trim()) return;

  setSubscriptionRequestsLoading(true);
  setSubscriptionRequestsError("");

  try {
    const { error } = await supabase.rpc(
      "reject_subscription_payment_request",
      {
        p_request_id: requestId,
        p_admin_note: adminNote.trim(),
      }
    );

    if (error) throw error;

    alert("تم رفض طلب الاشتراك.");
    await loadSubscriptionRequests();
  } catch (err) {
    console.error("Error rejecting subscription:", err);
    alert(
      err instanceof Error
        ? err.message
        : "تعذر رفض طلب الاشتراك."
    );
  } finally {
    setSubscriptionRequestsLoading(false);
  }
};

const approveStoreRequest = async (requestId: string) => {
  const confirmed = await window.sooqConfirm(
    "هل تريد الموافقة على طلب المتجر وتفعيل اشتراكه؟"
  );

  if (!confirmed) return;

  setStoreRequestsLoading(true);

  try {
    const { error } = await supabase.rpc(
      "approve_store_subscription_request",
      { p_request_id: requestId }
    );

    if (error) throw error;

    await loadStoreRequests();
  } catch (error) {
    console.error("Error approving store request:", error);
    window.alert("تعذرت الموافقة على الطلب.");
  } finally {
    setStoreRequestsLoading(false);
  }
};

const approveAccountVerificationRequest = async (requestId: string) => {
  const confirmed = window.confirm("هل تريد الموافقة على توثيق هذا الحساب لمدة 365 يوماً؟");
  if (!confirmed) return;

  const { error } = await supabase.rpc(
    "approve_account_verification_request",
    {
      p_request_id: requestId,
      p_admin_note: null,
    }
  );

  if (error) {
    alert("تعذرت الموافقة: " + error.message);
    return;
  }

  alert("تم توثيق الحساب بنجاح");
  await loadAccountVerificationRequests();
};

const rejectAccountVerificationRequest = async (requestId: string) => {
  const reason = window.prompt("اكتب سبب رفض طلب التوثيق:");

  if (reason === null) return;

  if (!reason.trim()) {
    alert("يجب كتابة سبب الرفض");
    return;
  }

  const { error } = await supabase.rpc(
    "reject_account_verification_request",
    {
      p_request_id: requestId,
      p_admin_note: reason.trim(),
    }
  );

  if (error) {
    alert("تعذر رفض الطلب: " + error.message);
    return;
  }

  alert("تم رفض طلب التوثيق");
  await loadAccountVerificationRequests();
};

const rejectStoreRequest = async (requestId: string) => {
  const adminNote = await window.sooqPrompt(
    "اكتب سبب رفض طلب المتجر:"
  );

  if (adminNote === null) return;

  setStoreRequestsLoading(true);

  try {
    const { error } = await supabase.rpc(
      "reject_store_subscription_request",
      {
        p_request_id: requestId,
        p_admin_note: adminNote.trim(),
      }
    );

    if (error) throw error;

    await loadStoreRequests();
  } catch (error) {
    console.error("Error rejecting store request:", error);
    window.alert("تعذر رفض الطلب.");
  } finally {
    setStoreRequestsLoading(false);
  }
};

useEffect(() => {
  if (admin && activeMenu === "طلبات الاشتراك") {
    loadSubscriptionRequests();
  }
}, [admin, activeMenu, loadSubscriptionRequests]);

useEffect(() => {
  if (admin && activeMenu === "طلبات حملات التمييز") {
    loadCampaignRequests();
  }
}, [admin, activeMenu, loadCampaignRequests]);

useEffect(() => {
  if (admin && activeMenu === "طلبات توثيق الحسابات") {
    loadAccountVerificationRequests();
  }
}, [admin, activeMenu, loadAccountVerificationRequests]);

  const loadDeliveryApplications = useCallback(async () => {
    setDeliveryApplicationsLoading(true);
    setDeliveryApplicationsError("");

    try {
      const { data, error } = await supabase.rpc(
        "get_delivery_applications_for_admin",
        { p_status: "pending" }
      );

      if (error) throw error;

      const rawRows: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.applications)
          ? data.applications
          : data
            ? [data]
            : [];

      const normalized = rawRows
        .map((row) => ({
          ...row,
          id: row.id ?? row.application_id,
          user_id: row.user_id ?? row.applicant_id,
        }))
        .filter((row) => Boolean(row.id && row.user_id)) as DeliveryApplication[];

      const userIds = [...new Set(normalized.map((row) => row.user_id))];
      let profiles: { id: string; display_name: string | null; avatar_url: string | null }[] = [];

      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        profiles = profileRows ?? [];
      }

      setDeliveryApplications(
        normalized.map((application) => {
          const profile = profiles.find((item) => item.id === application.user_id);
          return {
            ...application,
            display_name: application.display_name ?? profile?.display_name ?? null,
            avatar_url: application.avatar_url ?? profile?.avatar_url ?? null,
          };
        })
      );
    } catch (err: any) {
      console.error("Error loading delivery applications:", err);
      setDeliveryApplicationsError(
        err?.message || err?.details || "تعذر تحميل طلبات مندوبي التوصيل."
      );
      setDeliveryApplications([]);
    } finally {
      setDeliveryApplicationsLoading(false);
    }
  }, []);

  const reviewDeliveryApplication = async (
    application: DeliveryApplication,
    approve: boolean
  ) => {
    const confirmed = await window.sooqConfirm(
      approve
        ? `هل تريد الموافقة على طلب ${application.display_name || "هذا المستخدم"} ليصبح مندوب توصيل؟`
        : `هل تريد رفض طلب ${application.display_name || "هذا المستخدم"}؟`
    );

    if (!confirmed) return;

    setDeliveryApplicationActionLoading(application.id);
    setDeliveryApplicationsError("");

    try {
      const { error } = await supabase.rpc("review_delivery_application", {
        p_application_id: application.id,
        p_approve: approve,
      });

      if (error) throw error;

      await loadDeliveryApplications();
      window.alert(approve ? "تمت الموافقة على طلب المندوب." : "تم رفض طلب الانضمام.");
    } catch (err: any) {
      console.error("Error reviewing delivery application:", err);
      setDeliveryApplicationsError(
        err?.message || err?.details || "تعذر تنفيذ مراجعة طلب المندوب."
      );
    } finally {
      setDeliveryApplicationActionLoading(null);
    }
  };

useEffect(() => {
  if (admin && activeMenu === "طلبات مندوبي التوصيل") {
    loadDeliveryApplications();
  }
}, [admin, activeMenu, loadDeliveryApplications]);

const loadAdminDeliveryDrivers = useCallback(async () => {
  setAdminDeliveryDriversLoading(true);
  setAdminDeliveryDriversError("");
  try {
    const { data: drivers, error } = await supabase
      .from("delivery_drivers")
      .select("user_id, status, is_available, admin_disabled, admin_disabled_reason")
      .order("user_id", { ascending: true });
    if (error) throw error;

    const userIds = [...new Set((drivers ?? []).map((driver) => driver.user_id))];
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    setAdminDeliveryDrivers((drivers ?? []).map((driver) => {
      const profile = (profiles ?? []).find((item) => item.id === driver.user_id);
      return {
        ...driver,
        admin_disabled: Boolean(driver.admin_disabled),
        admin_disabled_reason: driver.admin_disabled_reason ?? null,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      };
    }));
  } catch (err: any) {
    console.error("Error loading delivery drivers:", err);
    setAdminDeliveryDriversError(
      err?.message || err?.details || "تعذر تحميل قائمة عمال التوصيل."
    );
    setAdminDeliveryDrivers([]);
  } finally {
    setAdminDeliveryDriversLoading(false);
  }
}, []);

const toggleAdminDeliveryDriver = async (driver: AdminDeliveryDriver) => {
  const disabling = !driver.admin_disabled;
  let reason: string | null = null;

  if (disabling) {
    reason = await window.sooqPrompt(
      `اكتب سبب إيقاف عامل التوصيل ${driver.display_name || "هذا المندوب"} إدارياً:`
    );
    if (reason === null) return;
    reason = reason.trim();
    if (!reason) {
      window.alert("يجب كتابة سبب الإيقاف قبل المتابعة.");
      return;
    }
  }

  const confirmed = await window.sooqConfirm(
    disabling
      ? `هل تريد إيقاف عامل التوصيل ${driver.display_name || "هذا المندوب"} إدارياً؟\nالسبب: ${reason}`
      : `هل تريد إعادة تفعيل عامل التوصيل ${driver.display_name || "هذا المندوب"}؟`
  );
  if (!confirmed) return;

  setDeliveryDriverActionLoading(driver.user_id);
  setAdminDeliveryDriversError("");
  try {
    const { error } = await supabase.rpc("admin_set_delivery_driver_disabled", {
      p_user_id: driver.user_id,
      p_disabled: disabling,
      p_reason: reason,
    });
    if (error) throw error;
    await loadAdminDeliveryDrivers();
    window.alert(
      disabling
        ? "تم إيقاف عامل التوصيل وإرسال إشعار يتضمن السبب."
        : "تمت إعادة تفعيل عامل التوصيل وإرسال إشعار له."
    );
  } catch (err: any) {
    console.error("Error changing delivery driver status:", err);
    setAdminDeliveryDriversError(
      err?.message || err?.details || "تعذر تغيير حالة عامل التوصيل."
    );
  } finally {
    setDeliveryDriverActionLoading(null);
  }
};

useEffect(() => {
  if (admin && activeMenu === "عمال التوصيل") {
    loadAdminDeliveryDrivers();
  }
}, [admin, activeMenu, loadAdminDeliveryDrivers]);

useEffect(() => {
  if (admin && activeMenu === "طلبات المتاجر") {
    loadStoreRequests();
  }
}, [admin, activeMenu, loadStoreRequests]);

useEffect(() => {
  if (admin && activeMenu === "إدارة المتاجر") {
    loadAdminStores();
  }
}, [admin, activeMenu, loadAdminStores]);

const handleAdminBan = async (
  report: Report,
  banType: "temporary" | "permanent"
) => {
  const reason = await window.sooqPrompt(
    "اكتب سبب حظر المستخدم:"
  );

  if (reason === null || !reason.trim()) return;

  let bannedUntil: string | null = null;

  if (banType === "temporary") {
    const daysInput = await window.sooqPrompt(
      "مدة الحظر بالأيام:"
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
  const confirmed = await window.sooqConfirm(
    "هل أنت متأكد من فك الحظر عن هذا المستخدم؟"
  );

  if (!confirmed) return;

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
      .select("site_name, logo_url, hero_image_url, sham_cash_qr_url, contact_email, contact_phone, allow_new_ads, maintenance_mode, subscriptions_enabled")
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
    setSubscriptionsEnabled(data.subscriptions_enabled ?? false);
    setShamCashQrUrl(data.sham_cash_qr_url ?? "");
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
const uploadShamCashQr = async () => {
  if (!shamCashQrFile) {
    setSettingsError("يرجى اختيار صورة QR أولاً.");
    return;
  }

  setShamCashQrUploading(true);
  setSettingsError("");
  setSettingsSuccess("");

  try {
    const fileExt = shamCashQrFile.name.split(".").pop() || "png";
    const filePath = `sham-cash-qr-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("site-images")
      .upload(filePath, shamCashQrFile, {
        upsert: true,
        contentType: shamCashQrFile.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("site-images")
      .getPublicUrl(filePath);

    setShamCashQrUrl(data.publicUrl);
    setShamCashQrFile(null);
    setSettingsSuccess(
      "تم رفع صورة QR بنجاح. اضغط حفظ الإعدادات لتثبيت الرابط."
    );
  } catch (err) {
    setSettingsError(
      err instanceof Error ? err.message : "تعذر رفع صورة QR."
    );
  } finally {
    setShamCashQrUploading(false);
  }
};
const uploadLogo = async () => {
  if (!logoFile) {
    setSettingsError("يرجى اختيار صورة الشعار أولاً.");
    return;
  }

  setLogoUploading(true);
  setSettingsError("");
  setSettingsSuccess("");

  try {
    const fileExt = logoFile.name.split(".").pop() || "png";
    const filePath = `site-logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("site-images")
      .upload(filePath, logoFile, {
        upsert: true,
        contentType: logoFile.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("site-images")
      .getPublicUrl(filePath);

    setLogoUrl(data.publicUrl);
    setLogoFile(null);
    setLogoPreviewUrl("");

    setSettingsSuccess(
      "تم رفع الشعار بنجاح. اضغط حفظ الإعدادات لتثبيت الشعار."
    );
  } catch (err) {
    setSettingsError(
      err instanceof Error ? err.message : "تعذر رفع الشعار."
    );
  } finally {
    setLogoUploading(false);
  }
};
const saveSettings = useCallback(async () => {
  setSettingsSaving(true);
  setSettingsError("");
  setSettingsSuccess("");

  try {
    const { error: plansError } = await supabase
      .from("subscription_plans")
      .update({ is_active: subscriptionsEnabled })
      .in("id", [1, 2, 3]);

    if (plansError) throw plansError;

    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: siteName,
        logo_url: logoUrl || null,
        hero_image_url: heroImageUrl || null,
        sham_cash_qr_url: shamCashQrUrl || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        allow_new_ads: allowNewAds,
        maintenance_mode: maintenanceMode,
        subscriptions_enabled: subscriptionsEnabled,
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
}, [
  siteName,
  logoUrl,
  heroImageUrl,
  shamCashQrUrl,
  contactEmail,
  contactPhone,
  allowNewAds,
  maintenanceMode,
  subscriptionsEnabled,
]);
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
// تحميل محادثات خدمة العملاء
const loadSupportConversations = async () => {
  if (!admin) return;

  setSupportConversationsLoading(true);
  setSupportError("");

  try {
    const { data, error } = await supabase
      .from("support_conversations")
      .select("id,user_id,status,created_at,updated_at,last_message_at")
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    const conversations = (data ?? []) as SupportConversation[];
    const userIds = [...new Set(conversations.map((item) => item.user_id))];
    const conversationIds = conversations.map((item) => item.id);

    const [profilesResult, messagesResult] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id,display_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length
        ? supabase
            .from("support_messages")
            .select("conversation_id,sender_id,is_read,body,created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const names = new Map(
      (profilesResult.data ?? []).map((profile) => [
        profile.id,
        profile.display_name || "مستخدم",
      ])
    );

    const messageStats = new Map<string, { unread: number; lastMessage: string }>();
    (messagesResult.data ?? []).forEach((message) => {
      const current = messageStats.get(message.conversation_id) ?? {
        unread: 0,
        lastMessage: message.body,
      };
      if (message.sender_id !== admin.id && !message.is_read) {
        current.unread += 1;
      }
      messageStats.set(message.conversation_id, current);
    });

    setSupportConversations(
      conversations.map((conversation) => {
        const stats = messageStats.get(conversation.id);
        return {
          ...conversation,
          user_name: names.get(conversation.user_id) ?? "مستخدم",
          unread_count: stats?.unread ?? 0,
          last_message: stats?.lastMessage ?? "لا توجد رسائل",
        };
      })
    );
  } catch (err) {
    console.error("Error loading support conversations:", err);
    setSupportError(
      err instanceof Error ? err.message : "تعذر تحميل محادثات خدمة العملاء."
    );
  } finally {
    setSupportConversationsLoading(false);
  }
};

const loadSupportMessages = async (conversationId: string) => {
  setSupportMessagesLoading(true);
  setSupportError("");

  try {
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,conversation_id,sender_id,body,is_read,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    setSupportMessages((data ?? []) as SupportMessage[]);

    if (admin) {
      const { error: readError } = await supabase
        .from("support_messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", admin.id)
        .eq("is_read", false);

      if (readError) throw readError;
      await loadSupportConversations();
    }
  } catch (err) {
    console.error("Error loading support messages:", err);
    setSupportError(
      err instanceof Error ? err.message : "تعذر تحميل رسائل المحادثة."
    );
  } finally {
    setSupportMessagesLoading(false);
  }
};

const handleSelectSupportConversation = (conversationId: string) => {
  setSelectedSupportConversationId(conversationId);
  setSupportReply("");
};

const handleSendSupportReply = async () => {
  const body = supportReply.trim();
  if (!body || !admin || !selectedSupportConversationId || supportSending) return;

  setSupportSending(true);
  setSupportError("");

  try {
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: selectedSupportConversationId,
      sender_id: admin.id,
      body,
    });

    if (error) throw error;

    setSupportReply("");
    await Promise.all([
      loadSupportMessages(selectedSupportConversationId),
      loadSupportConversations(),
    ]);
  } catch (err) {
    console.error("Error sending support reply:", err);
    setSupportError(
      err instanceof Error ? err.message : "تعذر إرسال الرد."
    );
  } finally {
    setSupportSending(false);
  }
};

const handleToggleSupportStatus = async (conversation: SupportConversation) => {
  const nextStatus = conversation.status === "open" ? "closed" : "open";
  const confirmed = window.confirm(
    nextStatus === "closed"
      ? "هل تريد إغلاق طلب خدمة العملاء؟"
      : "هل تريد إعادة فتح طلب خدمة العملاء؟"
  );
  if (!confirmed) return;

  setSupportError("");
  try {
    const { error } = await supabase
      .from("support_conversations")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    if (error) throw error;
    await loadSupportConversations();
  } catch (err) {
    console.error("Error updating support conversation:", err);
    setSupportError(
      err instanceof Error ? err.message : "تعذر تحديث حالة المحادثة."
    );
  }
};

useEffect(() => {
  if (admin && activeMenu === "خدمة العملاء") {
    loadSupportConversations();
  }
}, [admin, activeMenu]);

useEffect(() => {
  if (activeMenu === "خدمة العملاء" && selectedSupportConversationId) {
    loadSupportMessages(selectedSupportConversationId);
  }
}, [activeMenu, selectedSupportConversationId]);

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
  const confirmed = await window.sooqConfirm(
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
  const confirmed = await window.sooqConfirm(
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
  const confirmed = await window.sooqConfirm(
    "هل أنت متأكد من قبول هذا الإعلان؟"
  );

  if (!confirmed) return;

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
  const reason = await window.sooqPrompt(
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
  const confirmed = await window.sooqConfirm(
    "هل أنت متأكد من أرشفة هذا الإعلان؟ لن يظهر للمستخدمين بعد الأرشفة."
  );

  if (!confirmed) return;

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
  } finally {
    setActionLoading(null);
  }
}


// إعادة نشر إعلان مؤرشف
async function restoreAd(adId: string) {
  const confirmed = await window.sooqConfirm(
    "هل تريد إعادة نشر هذا الإعلان؟"
  );

  if (!confirmed) return;

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

    await loadApprovedAds();
  } catch (err) {
    console.error("خطأ إعادة نشر الإعلان:", err);

    setDataError(
      err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ||
          JSON.stringify(err)
    );
  } finally {
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
<img
  src="/logo.png?v=3"
  alt="Sooq.Sy"
  className="login-logo"
/>

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
  label: "طلبات الاشتراك",
  icon: Wallet,
},
{
  label: "طلبات حملات التمييز",
  icon: Megaphone,
},
{
  label: "شحن النقاط",
  icon: Coins,
},
{
  label: "طلبات مندوبي التوصيل",
  icon: Truck,
},
{
  label: "عمال التوصيل",
  icon: Truck,
},
{
  label: "طلبات المتاجر",
  icon: Store,
},
{
  label: "إدارة المتاجر",
  icon: Store,
},
{
  label: "طلبات توثيق الحسابات",
  icon: ShieldCheck,
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
  label: "خدمة العملاء",
  icon: Mail,
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
    <div className="app admin-app-scroll-layout" dir="rtl">
      <style>{`
        .admin-app-scroll-layout {
          display: flex !important;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          min-height: 0;
          overflow: hidden !important;
          background: #f5f7fb;
        }

        .admin-app-scroll-layout > .sidebar {
          display: flex !important;
          flex-direction: column !important;
          height: 100%;
          min-height: 0;
          overflow: hidden !important;
          flex-shrink: 0;
          background: #fff;
          border-left: 1px solid #e8edf4;
        }

        .admin-app-scroll-layout > .sidebar > .brand,
        .admin-app-scroll-layout > .sidebar > .menu-title,
        .admin-app-scroll-layout > .sidebar > .sidebar-footer {
          flex-shrink: 0;
        }

        .admin-app-scroll-layout > .sidebar > nav {
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          min-height: 0;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
          padding: 6px 10px 14px;
          gap: 4px;
        }

        .admin-app-scroll-layout > .sidebar > nav::-webkit-scrollbar,
        .admin-app-scroll-layout > .main > .content::-webkit-scrollbar {
          width: 7px;
        }

        .admin-app-scroll-layout > .sidebar > nav::-webkit-scrollbar-thumb,
        .admin-app-scroll-layout > .main > .content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
        }

        .admin-app-scroll-layout > .sidebar > nav .menu-item {
          flex: 0 0 auto;
          width: 100%;
          min-height: 44px;
          border-radius: 12px;
          transition: background .18s ease, color .18s ease, transform .18s ease;
        }

        .admin-app-scroll-layout > .sidebar > nav .menu-item:hover {
          transform: translateX(-2px);
        }

        .admin-app-scroll-layout > .sidebar > .sidebar-footer {
          margin-top: auto;
          background: #fff;
          border-top: 1px solid #edf1f6;
          padding-top: 12px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }

        .admin-app-scroll-layout > .main {
          display: flex !important;
          flex: 1 1 0%;
          flex-direction: column !important;
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden !important;
        }

        .admin-app-scroll-layout > .main > .topbar {
          position: relative;
          z-index: 5;
          flex: 0 0 auto;
          background: rgba(255,255,255,.94);
          border-bottom: 1px solid #e8edf4;
          box-shadow: 0 3px 14px rgba(15,23,42,.035);
          backdrop-filter: blur(12px);
        }

        .admin-app-scroll-layout > .main > .content {
          display: block;
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          height: auto;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
          padding: clamp(14px, 2vw, 26px);
          background: #f5f7fb;
        }

        .admin-app-scroll-layout .content > * {
          max-width: 100%;
        }

        .admin-app-scroll-layout .welcome-card,
        .admin-app-scroll-layout .stat-card,
        .admin-app-scroll-layout .category-card,
        .admin-app-scroll-layout .admin-section,
        .admin-app-scroll-layout .admin-ad-card {
          border-radius: 18px;
        }

        /* أساسيات تمنع تمدد عناصر لوحة الإدارة خارج مساحة العرض */
        .admin-app-scroll-layout,
        .admin-app-scroll-layout * {
          box-sizing: border-box;
        }

        .admin-app-scroll-layout img,
        .admin-app-scroll-layout video,
        .admin-app-scroll-layout canvas {
          max-width: 100%;
        }

        .admin-app-scroll-layout input,
        .admin-app-scroll-layout select,
        .admin-app-scroll-layout textarea,
        .admin-app-scroll-layout button {
          max-width: 100%;
          font: inherit;
        }

        .admin-app-scroll-layout .content table {
          width: 100%;
          max-width: 100%;
        }

        .admin-app-scroll-layout .content {
          overflow-wrap: anywhere;
        }

        /* الشاشات المتوسطة */
        @media (min-width: 769px) and (max-width: 1100px) {
          .admin-app-scroll-layout > .sidebar {
            width: 230px;
          }

          .admin-app-scroll-layout > .main > .content {
            padding: 18px;
          }
        }

        /* الهاتف والتابلت العمودي */
        @media (max-width: 768px) {
          .admin-app-scroll-layout {
            display: flex !important;
            flex-direction: column !important;
            width: 100%;
            height: 100dvh;
            min-height: 0;
            overflow: hidden !important;
          }

          .admin-app-scroll-layout > .sidebar {
            order: 1;
            display: flex !important;
            flex: 0 0 auto;
            flex-direction: column !important;
            width: 100% !important;
            height: auto !important;
            max-height: 34dvh;
            min-height: 0;
            overflow: hidden !important;
            border-left: 0;
            border-bottom: 1px solid #e8edf4;
            box-shadow: 0 4px 16px rgba(15,23,42,.045);
          }

          .admin-app-scroll-layout > .sidebar > .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px 6px;
          }

          .admin-app-scroll-layout > .sidebar > .brand .brand-icon {
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
          }

          .admin-app-scroll-layout > .sidebar > .brand h2 {
            margin: 0;
            font-size: 17px;
            line-height: 1.3;
          }

          .admin-app-scroll-layout > .sidebar > .brand span {
            font-size: 11px;
          }

          .admin-app-scroll-layout > .sidebar > .menu-title {
            display: none !important;
          }

          .admin-app-scroll-layout > .sidebar > nav {
            display: flex !important;
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch;
            width: 100%;
            min-height: 0;
            max-height: 76px;
            gap: 7px;
            padding: 7px 10px 10px;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
          }

          .admin-app-scroll-layout > .sidebar > nav .menu-item {
            display: inline-flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            gap: 7px;
            width: auto;
            min-width: max-content;
            min-height: 42px;
            padding: 0 13px;
            border-radius: 12px;
            white-space: nowrap;
            scroll-snap-align: start;
            font-size: 12px;
          }

          .admin-app-scroll-layout > .sidebar > nav .menu-item svg {
            width: 17px;
            height: 17px;
            flex: 0 0 auto;
          }

          .admin-app-scroll-layout > .sidebar > .sidebar-footer {
            display: none !important;
          }

          .admin-app-scroll-layout > .main {
            order: 2;
            display: flex !important;
            flex: 1 1 auto;
            width: 100%;
            min-width: 0;
            min-height: 0;
            height: auto !important;
            overflow: hidden !important;
          }

          .admin-app-scroll-layout > .main > .topbar {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-height: 62px;
            padding: 10px 14px;
          }

          .admin-app-scroll-layout > .main > .topbar h1 {
            margin: 0;
            font-size: clamp(17px, 4.5vw, 21px);
            line-height: 1.35;
          }

          .admin-app-scroll-layout > .main > .topbar p {
            margin: 3px 0 0;
            font-size: 11px;
            line-height: 1.5;
          }

          .admin-app-scroll-layout > .main > .topbar .top-actions {
            flex: 0 0 auto;
            gap: 7px;
          }

          .admin-app-scroll-layout > .main > .content {
            flex: 1 1 auto;
            width: 100%;
            min-width: 0;
            min-height: 0;
            padding: 12px;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
          }

          .admin-app-scroll-layout .welcome-card {
            gap: 12px;
            padding: 16px;
          }

          .admin-app-scroll-layout .welcome-card h2 {
            font-size: clamp(17px, 4.5vw, 21px);
          }

          .admin-app-scroll-layout .welcome-card p {
            font-size: 12px;
            line-height: 1.7;
          }

          .admin-app-scroll-layout .welcome-symbol {
            flex: 0 0 auto;
          }

          .admin-app-scroll-layout .stat-card,
          .admin-app-scroll-layout .category-card,
          .admin-app-scroll-layout .admin-section,
          .admin-app-scroll-layout .admin-ad-card {
            min-width: 0;
            max-width: 100%;
          }

          .admin-app-scroll-layout .admin-section {
            padding: 14px;
            overflow: hidden;
          }

          .admin-app-scroll-layout .content table {
            display: block;
            width: 100%;
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
          }

          .admin-app-scroll-layout .content form {
            min-width: 0;
            max-width: 100%;
          }

          .admin-app-scroll-layout .content input,
          .admin-app-scroll-layout .content select,
          .admin-app-scroll-layout .content textarea {
            min-width: 0;
            width: 100%;
          }

          .admin-app-scroll-layout .content button {
            touch-action: manipulation;
          }

          .admin-app-scroll-layout .content [class*="grid"] {
            min-width: 0;
          }
        }

        /* الهواتف الصغيرة */
        @media (max-width: 420px) {
          .admin-app-scroll-layout > .sidebar {
            max-height: 31dvh;
          }

          .admin-app-scroll-layout > .sidebar > .brand {
            padding-inline: 11px;
          }

          .admin-app-scroll-layout > .sidebar > nav {
            gap: 6px;
            padding-inline: 8px;
          }

          .admin-app-scroll-layout > .sidebar > nav .menu-item {
            min-height: 39px;
            padding-inline: 10px;
            font-size: 11px;
          }

          .admin-app-scroll-layout > .main > .topbar {
            padding-inline: 11px;
          }

          .admin-app-scroll-layout > .main > .content {
            padding: 9px;
          }

          .admin-app-scroll-layout .welcome-card,
          .admin-app-scroll-layout .admin-section {
            border-radius: 14px;
          }
        }

        /* تحسين توزيع المحتوى ومنع الفراغات الرأسية غير الضرورية */
        .admin-app-scroll-layout > .main {
          min-height: 0;
          min-width: 0;
        }

        .admin-app-scroll-layout > .main > .content {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          align-content: flex-start;
          justify-content: flex-start;
          gap: 16px;
        }

        .admin-support-panel {
          height: 650px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .admin-app-scroll-layout > .main > .content > .admin-section,
        .admin-app-scroll-layout > .main > .content > .delivery-applications-section {
          margin-block: 0;
          min-height: 0;
        }

        .delivery-applications-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
          gap: 14px;
        }

        .delivery-application-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid #e7edf3;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 5px 18px rgba(15, 23, 42, .045);
        }

        .delivery-application-user {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .delivery-application-user img,
        .delivery-application-avatar {
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          border-radius: 14px;
          object-fit: cover;
          background: #f1f5f9;
          color: #64748b;
          display: grid;
          place-items: center;
        }

        .delivery-application-user-info {
          min-width: 0;
          flex: 1;
        }

        .delivery-application-user-info h3 {
          margin: 0;
          color: #172033;
          font-size: 15px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .delivery-application-user-info span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .delivery-pending-badge {
          flex: 0 0 auto;
          padding: 6px 10px;
          border-radius: 999px;
          background: #fff7e6;
          color: #a16207;
          font-size: 11px;
          font-weight: 700;
        }

        .delivery-application-note {
          margin-top: 15px;
          padding: 12px;
          border-radius: 12px;
          background: #f8fafc;
          color: #475569;
          overflow-wrap: anywhere;
        }

        .delivery-application-note strong {
          display: block;
          margin-bottom: 5px;
          color: #334155;
          font-size: 12px;
        }

        .delivery-application-note p {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.7;
          font-size: 13px;
        }

        .delivery-application-id {
          display: grid;
          gap: 4px;
          margin-top: 12px;
          color: #94a3b8;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .delivery-application-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 16px;
        }

        .delivery-application-actions button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        @media (max-width: 768px) {
          .admin-app-scroll-layout > .main > .content {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 10px;
          }

          .admin-support-panel {
            height: min(58dvh, 480px);
            max-height: 58dvh;
          }

          .admin-app-scroll-layout .section-heading {
            align-items: flex-start;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 14px;
          }

          .admin-app-scroll-layout .section-heading > div {
            min-width: 0;
            flex: 1 1 180px;
          }

          .admin-app-scroll-layout .section-heading button {
            min-height: 40px;
          }

          .admin-app-scroll-layout .admin-section,
          .admin-app-scroll-layout .category-card,
          .admin-app-scroll-layout .delivery-application-card {
            padding: 13px;
            border-radius: 14px;
          }

          .delivery-applications-list {
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
          }

          .delivery-application-user {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .delivery-pending-badge {
            margin-inline-start: 58px;
          }

          .delivery-application-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
          }

          .delivery-application-actions button {
            width: 100%;
            min-height: 46px;
          }

          .admin-app-scroll-layout .content table {
            font-size: 12px;
          }

          .admin-app-scroll-layout .content .grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 380px) {
          .admin-app-scroll-layout > .main > .content {
            padding: 8px;
          }

          .delivery-application-card {
            padding: 11px;
          }

          .delivery-application-user-info h3 {
            font-size: 14px;
          }
        }

        /* الهاتف بالوضع الأفقي */
        @media (max-height: 520px) and (max-width: 900px) {
          .admin-app-scroll-layout > .sidebar {
            max-height: 42dvh;
          }

          .admin-app-scroll-layout > .sidebar > .brand {
            padding-block: 5px 2px;
          }

          .admin-app-scroll-layout > .sidebar > nav {
            max-height: 58px;
            padding-block: 4px 7px;
          }

          .admin-app-scroll-layout > .main > .topbar {
            min-height: 52px;
            padding-block: 6px;
          }
        }
        @media (max-width: 768px) {
          .admin-app-scroll-layout > .main > .content > .admin-section {
            flex: 0 0 auto !important;
            min-height: max-content !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }      `}</style>
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

{/* طلبات الاشتراك */}
{activeMenu === "طلبات الاشتراك" && (
  <div className="space-y-6" dir="rtl">
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          إدارة الاشتراكات
        </div>
        <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
          طلبات الاشتراك
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          مراجعة طلبات الاشتراك والتحقق من الحوالات وإدارة تفعيل الباقات
        </p>
      </div>

      <button
        type="button"
        onClick={loadSubscriptionRequests}
        disabled={subscriptionRequestsLoading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={17} className={subscriptionRequestsLoading ? "animate-spin" : ""} />
        تحديث الطلبات
      </button>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-amber-800">بانتظار المراجعة</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
            <RefreshCw size={19} />
          </span>
        </div>
        <div className="mt-3 text-3xl font-black tabular-nums text-amber-900">
          {subscriptionRequests.filter((r) => r.status === "pending").length}
        </div>
        <p className="mt-1 text-xs text-amber-700">طلبات تحتاج إلى إجراء</p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-emerald-800">طلبات مقبولة</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
            <span className="text-xl font-black">✓</span>
          </span>
        </div>
        <div className="mt-3 text-3xl font-black tabular-nums text-emerald-900">
          {subscriptionRequests.filter((r) => r.status === "approved").length}
        </div>
        <p className="mt-1 text-xs text-emerald-700">تمت الموافقة عليها</p>
      </div>

      <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-red-800">طلبات مرفوضة</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
            <span className="text-xl font-black">×</span>
          </span>
        </div>
        <div className="mt-3 text-3xl font-black tabular-nums text-red-900">
          {subscriptionRequests.filter((r) => r.status === "rejected").length}
        </div>
        <p className="mt-1 text-xs text-red-700">لم تتم الموافقة عليها</p>
      </div>
    </div>

    {subscriptionRequestsLoading ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <RefreshCw size={28} className="mx-auto animate-spin text-indigo-500" />
        <p className="mt-4 text-sm font-medium text-slate-500">جارٍ تحميل طلبات الاشتراك...</p>
      </div>
    ) : subscriptionRequestsError ? (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm font-bold text-red-700">
        {subscriptionRequestsError}
      </div>
    ) : subscriptionRequests.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Copy size={25} />
        </div>
        <h3 className="mt-4 font-bold text-slate-800">لا توجد طلبات اشتراك حالياً</h3>
        <p className="mt-2 text-sm text-slate-500">ستظهر طلبات المستخدمين هنا عند إرسالها</p>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-slate-800">قائمة الطلبات</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {subscriptionRequests.length} طلب
          </span>
        </div>

        {subscriptionRequests.map((request) => (
          <div
            key={request.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 font-black text-indigo-700">
                  #
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">رقم الطلب</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="max-w-[190px] truncate text-xs font-bold text-slate-700 sm:max-w-xs" dir="ltr" title={request.id}>
                      {request.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(request.id);
                        alert("تم نسخ رقم الطلب");
                      }}
                      className="shrink-0 rounded-lg p-1.5 text-indigo-600 transition hover:bg-indigo-100"
                      title="نسخ رقم الطلب"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                request.status === "pending"
                  ? "bg-amber-100 text-amber-800"
                  : request.status === "approved"
                  ? "bg-emerald-100 text-emerald-800"
                  : request.status === "rejected"
                  ? "bg-red-100 text-red-800"
                  : "bg-slate-200 text-slate-700"
              }`}>
                <span className={`h-2 w-2 rounded-full ${
                  request.status === "pending"
                    ? "bg-amber-500"
                    : request.status === "approved"
                    ? "bg-emerald-500"
                    : request.status === "rejected"
                    ? "bg-red-500"
                    : "bg-slate-500"
                }`} />
                {request.status === "pending"
                  ? "بانتظار المراجعة"
                  : request.status === "approved"
                  ? "مقبول"
                  : request.status === "rejected"
                  ? "مرفوض"
                  : "ملغي"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">المستخدم / الهاتف</p>
                <p className="mt-2 truncate font-bold text-slate-800">
                  {request.user_name || "مستخدم غير معروف"}
                </p>
                <p className="mt-1 text-sm text-slate-500" dir="ltr">
                  {request.phone || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">الباقة</p>
                <p className="mt-2 font-bold text-slate-800">
                  {request.plan_name || `الباقة ${request.package_number}`}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {request.duration_months
                    ? `${request.duration_months} شهر`
                    : "المدة غير محددة"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">قيمة الاشتراك</p>
                <p className="mt-2 text-xl font-black text-indigo-700" dir="ltr">
                  ${Number(request.amount_usd).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  سعر الصرف: {Number(request.exchange_rate).toLocaleString("en-US")}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">المبلغ بالليرة السورية</p>
                <p className="mt-2 text-lg font-black text-slate-800">
                  {Number(request.amount_syp).toLocaleString("en-US")} ل.س
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  تاريخ الطلب: {formatDate(request.created_at)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs text-slate-500">
                {request.status === "pending"
                  ? "يرجى التحقق من الحوالة قبل اتخاذ القرار"
                  : "تمت مراجعة هذا الطلب"}
              </p>

              {request.status === "pending" ? (
                <div className="flex w-full gap-2 sm:w-auto">
                  <button
                    type="button"
                    disabled={subscriptionRequestsLoading}
                    onClick={() => approveSubscriptionRequest(request.id)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  >
                    <span className="text-lg leading-none">✓</span>
                    موافقة وتفعيل
                  </button>
                  <button
                    type="button"
                    disabled={subscriptionRequestsLoading}
                    onClick={() => rejectSubscriptionRequest(request.id)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  >
                    <span className="text-lg leading-none">×</span>
                    رفض الطلب
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500">لا توجد إجراءات مطلوبة</span>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* طلبات حملات التمييز المدفوعة والنقاط */}
{activeMenu === "طلبات حملات التمييز" && (
  <>
<div className="mt-2 space-y-5" dir="rtl">
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div>
      <h2 className="text-lg font-black text-slate-800">
        طلبات حملات التمييز المدفوعة
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        مراجعة الحوالات وتفعيل الحملات لمدة 10 أيام
      </p>
    </div>

    <button
      type="button"
      className="refresh-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4"
      onClick={loadCampaignRequests}
      disabled={campaignRequestsLoading}
    >
      <RefreshCw
        size={17}
        className={campaignRequestsLoading ? "animate-spin" : ""}
      />
      تحديث الطلبات
    </button>
  </div>

  {campaignRequestsLoading ? (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      جارٍ تحميل طلبات الحملات...
    </div>
  ) : campaignRequestsError ? (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm font-medium text-red-700">
      {campaignRequestsError}
    </div>
  ) : campaignRequests.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-bold text-slate-700">
        لا توجد طلبات حملات تمييز حالياً
      </p>
      <p className="mt-2 text-sm text-slate-500">
        ستظهر الطلبات الجديدة هنا عند إرسالها.
      </p>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4">
      {campaignRequests.map((request) => (
        <div
          key={request.id}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">
                رقم الطلب
              </p>
              <p
                className="mt-1 break-all text-sm font-bold text-slate-700"
                dir="ltr"
              >
                {request.id}
              </p>
            </div>

            <div>
              {request.status === "pending" ? (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                  بانتظار المراجعة
                </span>
              ) : request.status === "approved" ? (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  مقبول
                </span>
              ) : request.status === "rejected" ? (
                <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                  مرفوض
                </span>
              ) : (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                  ملغي
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                بيانات المستخدم
              </p>
              <p className="mt-1 font-bold text-slate-800">
                {request.user_name || "مستخدم غير معروف"}
              </p>
              <p
                className="mt-1 text-sm text-slate-500"
                dir="ltr"
              >
                {request.phone}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                <p className="text-xs font-medium text-emerald-700">
                  المبلغ بالدولار
                </p>
                <p className="mt-1 text-xl font-black text-emerald-800">
                  ${Number(request.amount_usd).toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                <p className="text-xs font-medium text-sky-700">
                  المبلغ بالليرة السورية
                </p>
                <p className="mt-1 text-lg font-black text-sky-800">
                  {Number(request.amount_syp).toLocaleString("en-US")} ل.س
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">
                تاريخ تقديم الطلب
              </span>
              <span className="text-sm font-medium text-slate-700">
                {formatDate(request.created_at)}
              </span>
            </div>

            {request.status === "pending" ? (
              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={campaignRequestsLoading}
                  onClick={() => approveCampaignRequest(request.id)}
                  className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle size={18} className="ml-2" />
                  موافقة وتفعيل الحملة
                </button>

                <button
                  type="button"
                  disabled={campaignRequestsLoading}
                  onClick={() => rejectCampaignRequest(request.id)}
                  className="flex min-h-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  رفض الطلب
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-3 text-center text-sm font-medium text-slate-400">
                تمت مراجعة هذا الطلب
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
{/* طلبات حملات التمييز بالنقاط */}

<div className="mt-5 space-y-5" dir="rtl">
  <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-800">
      طلبات حملات التمييز بالنقاط
    </h2>
    <p className="mt-1 text-sm text-slate-500">
      مراجعة طلبات المستخدمين والموافقة عليها أو رفضها
    </p>
  </div>

  <div className="max-h-[75vh] overflow-y-auto overscroll-contain pr-1">
    {campaignRequestsLoading ? (
      <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">
        جارٍ تحميل الطلبات...
      </div>
    ) : pointsCampaignRequests.length === 0 ? (
      <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
        <p className="font-bold text-slate-700">
          لا توجد طلبات حملات بالنقاط حالياً
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4">
        {pointsCampaignRequests.map((request) => (
          <div
            key={request.id}
            className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"
          >
            <div className="flex flex-col gap-2 border-b bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-500">رقم الطلب</p>
                <p className="mt-1 break-all text-sm font-bold text-slate-700" dir="ltr">
                  {request.id}
                </p>
              </div>

              {request.status === "pending_ad_approval" ? (
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                  بانتظار موافقة الإدارة
                </span>
              ) : request.status === "active" ? (
                <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  الحملة مفعّلة
                </span>
              ) : request.status === "completed" ? (
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                  مكتملة
                </span>
              ) : request.status === "cancelled" ? (
                <span className="w-fit rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
                  مرفوضة أو ملغاة
                </span>
              ) : (
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                  {request.status}
                </span>
              )}
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="text-xs text-slate-500">المستخدم</p>
                <p className="mt-1 font-bold text-slate-800">
                  {request.user_name || "مستخدم غير معروف"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">الإعلان</p>
                <p className="mt-1 font-bold text-slate-800">
                  {request.ad_title || "إعلان غير متوفر"}
                </p>
                {request.ad_id && (
                  <p className="mt-1 break-all text-xs text-slate-400" dir="ltr">
                    {request.ad_id}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">
                  النقاط المخصومة للحملة
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-800">
                  {Number(request.points_cost).toLocaleString("en-US")} نقطة
                </p>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-slate-500">تاريخ تقديم الطلب</p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {formatDate(request.created_at)}
                </p>
              </div>

              {request.admin_note && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">
                    ملاحظة الإدارة
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {request.admin_note}
                  </p>
                </div>
              )}

              {request.status === "pending_ad_approval" ? (
                <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={campaignRequestsLoading}
                    onClick={() => approvePointsCampaignRequest(request.id)}
                    className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle size={18} className="ml-2" />
                    موافقة وتفعيل الحملة
                  </button>

                  <button
                    type="button"
                    disabled={campaignRequestsLoading}
                    onClick={() => rejectPointsCampaignRequest(request.id)}
                    className="min-h-12 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    رفض الطلب وإعادة النقاط
                  </button>
                </div>
              ) : (
                <div className="border-t pt-3 text-center text-sm text-slate-400">
                  تمت مراجعة هذا الطلب
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
  </>
)}

{/* طلبات مندوبي التوصيل */}
{activeMenu === "طلبات مندوبي التوصيل" && (
  <>
    <div className="section-heading">
      <div>
        <h2>طلبات الانضمام كمندوب توصيل</h2>
        <p>راجع بيانات المتقدمين ووافق على الطلب أو ارفضه</p>
      </div>
      <button
        className="refresh-button"
        onClick={loadDeliveryApplications}
        disabled={deliveryApplicationsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {deliveryApplicationsError && (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {deliveryApplicationsError}
      </div>
    )}

    {deliveryApplicationsLoading ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        جارٍ تحميل طلبات مندوبي التوصيل...
      </div>
    ) : deliveryApplications.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Truck size={34} className="mx-auto mb-3 text-slate-400" />
        <h3 className="font-bold text-slate-700">لا توجد طلبات معلّقة</h3>
        <p className="mt-1 text-sm text-slate-500">ستظهر هنا طلبات الانضمام الجديدة عند إرسالها</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {deliveryApplications.map((application) => (
          <div key={application.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              {application.avatar_url ? (
                <img src={application.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Truck size={21} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="break-words font-bold text-slate-800">
                  {application.display_name || "مستخدم بدون اسم"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">تاريخ التقديم: {formatDate(application.created_at)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">قيد المراجعة</span>
            </div>
            {application.applicant_note && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <span className="mb-1 block font-bold text-slate-500">ملاحظة المتقدم</span>
                {application.applicant_note}
              </div>
            )}
            <p className="mt-3 break-all text-xs text-slate-400">رقم الطلب: {application.id}</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => reviewDeliveryApplication(application, true)}
                disabled={deliveryApplicationActionLoading === application.id}
                className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {deliveryApplicationActionLoading === application.id ? "جارٍ التنفيذ..." : "الموافقة وتفعيل المندوب"}
              </button>
              <button
                type="button"
                onClick={() => reviewDeliveryApplication(application, false)}
                disabled={deliveryApplicationActionLoading === application.id}
                className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                رفض الطلب
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
)}

{/* قائمة عمال التوصيل */}
{activeMenu === "عمال التوصيل" && (
  <>
    <div className="section-heading">
      <div>
        <h2>عمال التوصيل</h2>
        <p>جميع المندوبين المعتمدين، مع إمكانية الإيقاف الإداري وإعادة التفعيل</p>
      </div>
      <button
        className="refresh-button"
        onClick={loadAdminDeliveryDrivers}
        disabled={adminDeliveryDriversLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {adminDeliveryDriversError && (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {adminDeliveryDriversError}
      </div>
    )}

    {adminDeliveryDriversLoading ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        جارٍ تحميل عمال التوصيل...
      </div>
    ) : adminDeliveryDrivers.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Truck size={34} className="mx-auto mb-3 text-slate-400" />
        <h3 className="font-bold text-slate-700">لا يوجد عمال توصيل معتمدون</h3>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {adminDeliveryDrivers.map((driver) => (
          <div key={driver.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              {driver.avatar_url ? (
                <img src={driver.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Truck size={21} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="break-words font-bold text-slate-800">
                  {driver.display_name || "مندوب بدون اسم"}
                </h3>
                <p className="mt-1 break-all text-xs text-slate-400">{driver.user_id}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${driver.admin_disabled ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {driver.admin_disabled ? "موقوف إدارياً" : "غير موقوف إدارياً"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                حالة الحساب: {driver.status || "غير محددة"}
              </span>
              <span className={`rounded-full px-3 py-1.5 ${driver.is_available ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {driver.is_available ? "متاح لاستقبال الطلبات" : "غير متاح حالياً"}
              </span>
            </div>
            {driver.admin_disabled && driver.admin_disabled_reason && (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-800">
                <span className="font-bold">سبب الإيقاف: </span>
                {driver.admin_disabled_reason}
              </div>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => toggleAdminDeliveryDriver(driver)}
                disabled={deliveryDriverActionLoading === driver.user_id}
                className={`min-h-11 w-full rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${driver.admin_disabled ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}
              >
                {deliveryDriverActionLoading === driver.user_id
                  ? "جارٍ التنفيذ..."
                  : driver.admin_disabled ? "إعادة تفعيل المندوب" : "إيقاف عامل التوصيل"}
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
)}

{/* طلبات المتاجر */}
{activeMenu === "طلبات المتاجر" && (
  <>
    <div className="section-heading">
      <div>
        <h2>طلبات اشتراك المتاجر</h2>
        <p>مراجعة طلبات إنشاء المتاجر وتفعيل اشتراكاتها</p>
      </div>

      <button
        className="refresh-button"
        onClick={loadStoreRequests}
        disabled={storeRequestsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {storeRequestsError && (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {storeRequestsError}
      </div>
    )}

    {storeRequestsLoading && storeRequests.length === 0 ? (
      <div className="py-12 text-center text-slate-500">
        <LoaderCircle className="mx-auto mb-3 animate-spin" size={30} />
        جارٍ تحميل طلبات المتاجر...
      </div>
    ) : storeRequests.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Store className="mx-auto mb-3 text-slate-400" size={38} />
        <p className="font-bold text-slate-700">
          لا توجد طلبات اشتراك متاجر حالياً
        </p>
      </div>
    ) : (

<div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
  {storeRequests.map((request) => {
    const ordinaryLimit = Number(request.ordinary_ads_limit) || 100;
    const featuredLimit = Number(request.featured_ads_limit) || 20;

    const ordinaryUsed = Number(request.ordinary_used) || 0;
    const featuredUsed = Number(request.featured_used) || 0;

    const ordinaryRemaining = Math.max(0, ordinaryLimit - ordinaryUsed);
    const featuredRemaining = Math.max(0, featuredLimit - featuredUsed);

    const ordinaryPercent = ordinaryLimit
      ? Math.min(100, (ordinaryUsed / ordinaryLimit) * 100)
      : 0;

    const featuredPercent = featuredLimit
      ? Math.min(100, (featuredUsed / featuredLimit) * 100)
      : 0;

    return (
      <div
        key={request.id}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">
              {request.store_name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {request.business_type || "نوع النشاط غير محدد"}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              request.status === "pending"
                ? "bg-amber-100 text-amber-700"
                : request.status === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {request.status === "pending"
              ? "قيد المراجعة"
              : request.status === "approved"
                ? "تمت الموافقة"
                : "مرفوض"}
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">صاحب المتجر</p>
              <p className="mt-1 font-bold text-slate-800">
                {request.owner_name}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">هاتف مقدم الطلب</p>
              <p className="mt-1 font-bold text-slate-800" dir="ltr">
                {request.phone}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">المحافظة والمدينة</p>
              <p className="mt-1 font-bold text-slate-800">
                {[request.governorate, request.city]
                  .filter(Boolean)
                  .join(" - ") || "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">هاتف المتجر</p>
              <p className="mt-1 font-bold text-slate-800" dir="ltr">
                {request.store_phone || "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">واتساب المتجر</p>
              <p className="mt-1 font-bold text-slate-800" dir="ltr">
                {request.whatsapp || "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">مدة الاشتراك</p>
              <p className="mt-1 font-bold text-slate-800">
                {request.duration_months} شهر
              </p>
            </div>
          </div>

          {/* حصص الاشتراك */}
          <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
            <p className="mb-3 text-sm font-bold text-sky-800">
              حصص الإعلانات المضمنة
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-sky-700">إعلانات عادية</p>
                <p className="text-xl font-black text-sky-900">
                  {ordinaryLimit}
                </p>
              </div>

              <div>
                <p className="text-xs text-sky-700">إعلانات مميزة</p>
                <p className="text-xl font-black text-sky-900">
                  {featuredLimit}
                </p>
              </div>
            </div>
          </div>

          {/* استهلاك الإعلانات */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-black text-slate-800">
                استهلاك إعلانات المتجر
              </h4>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                إحصائيات الاستخدام
              </span>
            </div>

            {/* الإعلانات العادية */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-700">
                  الإعلانات العادية المنشورة
                </span>
                <span className="text-xs font-black text-emerald-700">
                  {ordinaryUsed} / {ordinaryLimit}
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${ordinaryPercent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  المستخدم: {ordinaryUsed}
                </span>
                <span className="font-bold text-emerald-700">
                  المتبقي: {ordinaryRemaining}
                </span>
              </div>
            </div>

            <div className="mb-4 border-t border-slate-100" />

            {/* الإعلانات المميزة */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-700">
                  الإعلانات المميزة
                </span>
                <span className="text-xs font-black text-amber-700">
                  {featuredUsed} / {featuredLimit}
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${featuredPercent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  المستخدم: {featuredUsed}
                </span>
                <span className="font-bold text-amber-700">
                  المتبقي: {featuredRemaining}
                </span>
              </div>
            </div>
          </div>

          {/* الأسعار */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">السعر بالدولار</p>
              <p className="mt-1 text-xl font-black text-emerald-800">
                ${Number(request.price_usd).toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
              <p className="text-xs text-sky-700">المبلغ بالليرة السورية</p>
              <p className="mt-1 text-lg font-black text-sky-800">
                {Number(request.amount_syp).toLocaleString("en-US")} ل.س
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">تاريخ تقديم الطلب</p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {formatDate(request.created_at)}
            </p>
          </div>

          {request.admin_note && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500">
                ملاحظة الإدارة
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {request.admin_note}
              </p>
            </div>
          )}

          {request.status === "pending" && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={storeRequestsLoading}
                onClick={() => approveStoreRequest(request.id)}
                className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle size={18} className="ml-2" />
                موافقة وتفعيل المتجر
              </button>

              <button
                type="button"
                disabled={storeRequestsLoading}
                onClick={() => rejectStoreRequest(request.id)}
                className="flex min-h-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle size={18} className="ml-2" />
                رفض الطلب
              </button>
            </div>
          )}
        </div>
      </div>
    );
  })}
</div>

    )}
  </>
)}


{/* إدارة المتاجر */}
{activeMenu === "إدارة المتاجر" && (
  <>
    <div className="section-heading">
      <div>
        <h2>إدارة المتاجر</h2>
        <p>
          متابعة حالة المتاجر وإيقافها أو رفع إيقاف الإدارة عنها
        </p>
      </div>

      <button
        className="refresh-button"
        onClick={loadAdminStores}
        disabled={adminStoresLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    <div className="category-card mb-5">
      <label className="block font-bold mb-2">
        عند إيقاف متجر، ماذا نفعل بإعلاناته؟
      </label>

      <select
        value={adminStoreAdsMode}
        onChange={(e) =>
          setAdminStoreAdsMode(e.target.value as "hide" | "show")
        }
        className="w-full rounded-lg border p-3"
      >
        <option value="hide">
          إخفاء إعلانات المتجر من السوق العام
        </option>
        <option value="show">
          إبقاء إعلانات المتجر ظاهرة في السوق العام
        </option>
      </select>

      <p className="mt-2 text-sm text-slate-500">
        هذا الاختيار يُطبّق عند إيقاف المتجر من الإدارة.
      </p>
    </div>

    {adminStoresError && (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">
        {adminStoresError}
      </div>
    )}

    {adminStoresLoading && adminStores.length === 0 ? (
      <div className="py-12 text-center text-slate-500">
        <LoaderCircle
          className="mx-auto mb-3 animate-spin"
          size={30}
        />
        جارٍ تحميل المتاجر...
      </div>
    ) : adminStores.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Store className="mx-auto mb-3 text-slate-400" size={38} />
        <p className="font-bold text-slate-700">
          لا توجد متاجر حالياً
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {adminStores.map((store) => {
          const disabled =
            store.owner_disabled || store.admin_disabled;

          const statusLabel =
            store.admin_disabled
              ? "موقوف من الإدارة"
              : store.owner_disabled
                ? "موقوف من المالك"
                : store.status === "active"
                  ? "مفعّل"
                  : store.status === "pending"
                    ? "بانتظار الموافقة"
                    : store.status === "rejected"
                      ? "مرفوض"
                      : store.status;

          return (
            <div
              key={store.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    {store.name || "متجر بدون اسم"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {store.business_type || "نوع النشاط غير محدد"}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                    disabled
                      ? "bg-red-100 text-red-700"
                      : store.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  <strong>المحافظة والمدينة:</strong>{" "}
                  {[store.governorate, store.city]
                    .filter(Boolean)
                    .join(" - ") || "غير محدد"}
                </p>

                <p>
                  <strong>الهاتف:</strong>{" "}
                  <span dir="ltr">
                    {store.phone || "غير محدد"}
                  </span>
                </p>

                <p>
                  <strong>حالة موافقة المتجر:</strong>{" "}
                  {store.status}
                </p>

                <p>
                  <strong>إيقاف المالك:</strong>{" "}
                  {store.owner_disabled ? "نعم" : "لا"}
                </p>

                <p>
                  <strong>إيقاف الإدارة:</strong>{" "}
                  {store.admin_disabled ? "نعم" : "لا"}
                </p>

                {(store.owner_disabled || store.admin_disabled) && (
                  <p>
                    <strong>ظهور الإعلانات:</strong>{" "}
                    {store.disabled_ads_mode === "show"
                      ? "تبقى ظاهرة"
                      : "مخفية"}
                  </p>
                )}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    store.admin_disabled
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                  disabled={
                    storeActionLoading === store.id ||
                    (!store.admin_disabled && store.status !== "active")
                  }
                  onClick={() => handleAdminStoreToggle(store)}
                >
                  {storeActionLoading === store.id
                    ? "جارٍ التنفيذ..."
                    : store.admin_disabled
                      ? "رفع إيقاف الإدارة"
                      : "إيقاف المتجر من الإدارة"}
                </button>

                {store.owner_disabled && !store.admin_disabled && (
                  <p className="mt-2 text-xs text-amber-700">
                    المتجر موقوف من المالك حالياً.
                  </p>
                )}

                {store.admin_disabled && (
                  <p className="mt-2 text-xs text-red-600">
                    المالك لا يستطيع إعادة تفعيل المتجر قبل رفع إيقاف الإدارة.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>
)}


{/* طلبات توثيق الحسابات */}
{activeMenu === "طلبات توثيق الحسابات" && (
  <>
    <div className="section-heading">
      <div>
        <h2>طلبات توثيق الحسابات</h2>
        <p>مراجعة طلبات توثيق الحسابات والموافقة عليها أو رفضها</p>
      </div>

      <button
        className="refresh-button"
        onClick={loadAccountVerificationRequests}
        disabled={accountVerificationRequestsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {accountVerificationRequestsError && (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {accountVerificationRequestsError}
      </div>
    )}

    {accountVerificationRequestsLoading &&
    accountVerificationRequests.length === 0 ? (
      <div className="py-12 text-center text-slate-500">
        <LoaderCircle className="mx-auto mb-3 animate-spin" size={30} />
        جارٍ تحميل طلبات التوثيق...
      </div>
    ) : accountVerificationRequests.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <ShieldCheck className="mx-auto mb-3 text-slate-400" size={38} />
        <p className="font-bold text-slate-700">
          لا توجد طلبات توثيق حالياً
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {accountVerificationRequests.map((request) => (
          <div
            key={request.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4">
              <div>
                <h3 className="font-black text-slate-800">
                  {request.user_name}
                </h3>
                <p className="mt-1 text-xs text-slate-500" dir="ltr">
                  {request.user_id}
                </p>
              </div>

<span
  className={`rounded-full px-3 py-1 text-xs font-bold ${
    request.status === "pending"
      ? "bg-amber-100 text-amber-700"
      : request.status === "approved"
        ? "bg-emerald-100 text-emerald-700"
        : request.status === "revoked"
          ? "bg-slate-200 text-slate-700"
          : "bg-red-100 text-red-700"
  }`}
>
  {request.status === "pending"
    ? "قيد المراجعة"
    : request.status === "approved"
      ? "تمت الموافقة"
      : request.status === "revoked"
        ? "تم سحب التوثيق"
        : "مرفوض"}
</span>
            </div>

            <div className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    رقم الهاتف المطلوب توثيقه
                  </p>
                  <p className="mt-1 font-bold text-slate-800" dir="ltr">
                    {request.phone}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">مرجع الدفع</p>
                  <p className="mt-1 font-bold text-slate-800">
                    {request.payment_reference || "غير مرفق"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">تاريخ تقديم الطلب</p>
                <p className="mt-1 font-bold text-slate-800">
                  {formatDate(request.created_at)}
                </p>
              </div>

              {request.status === "approved" && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-700">
                    مدة التوثيق
                  </p>
                  <p className="mt-1 font-bold text-emerald-800">
                    {request.start_at
                      ? formatDate(request.start_at)
                      : "—"}
                    {" إلى "}
                    {request.end_at
                      ? formatDate(request.end_at)
                      : "—"}
                  </p>
                </div>
              )}

              {request.admin_note && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">
                    ملاحظة الإدارة
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {request.admin_note}
                  </p>
                </div>
              )}

              {request.status === "pending" && (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={accountVerificationRequestsLoading}
                    onClick={() =>
                      approveAccountVerificationRequest(request.id)
                    }
                    className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle size={18} className="ml-2" />
                    الموافقة وتوثيق الحساب
                  </button>

                  <button
                    type="button"
                    disabled={accountVerificationRequestsLoading}
                    onClick={() =>
                      rejectAccountVerificationRequest(request.id)
                    }
                    className="flex min-h-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle size={18} className="ml-2" />
                    رفض الطلب
                  </button>
                </div>
              )}
            {request.status === "approved" &&
  request.end_at &&
  new Date(request.end_at).getTime() > Date.now() && (
    <div className="border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={accountVerificationRequestsLoading}
        onClick={() =>
          revokeAccountVerification(request.user_id)
        }
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
      >
        <XCircle size={18} className="ml-2" />
        سحب شارة التوثيق
      </button>
    </div>
  )}
            </div>
          </div>
        ))}
      </div>
    )}
  </>
)}


{/* قسم إدارة الإعلانات */}
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
{/* قسم خدمة العملاء */}
{activeMenu === "خدمة العملاء" && (
  <>
    <div className="section-heading">
      <div>
        <h2>خدمة العملاء</h2>
        <p>استقبال رسائل المستخدمين والرد عليها من داخل لوحة الإدارة</p>
      </div>
      <button
        type="button"
        className="refresh-button"
        onClick={loadSupportConversations}
        disabled={supportConversationsLoading}
      >
        <RefreshCw size={17} />
        تحديث
      </button>
    </div>

    {supportError && (
      <div className="data-error mb-4">{supportError}</div>
    )}

<div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">

  {/* قائمة المحادثات */}
  <div className="category-card admin-support-panel max-h-[80vh] min-h-0 p-0">

    {/* عنوان القائمة - ثابت */}
    <div className="shrink-0 border-b p-4">
      <h3 className="font-bold">طلبات الدعم</h3>
      <p className="text-xs text-slate-500 mt-1">
        {supportConversations.length} محادثة
      </p>
    </div>

    {/* محتوى القائمة */}
    {supportConversationsLoading ? (
      <div className="empty-state flex-1">
        <LoaderCircle className="spin" size={25} />
        <p>جارٍ تحميل المحادثات...</p>
      </div>
    ) : supportConversations.length === 0 ? (
      <div className="empty-state flex-1">
        <Mail size={28} />
        <p>لا توجد طلبات دعم حالياً.</p>
      </div>
    ) : (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y">
        {supportConversations.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            onClick={() =>
              handleSelectSupportConversation(conversation.id)
            }
            className={`w-full text-right p-4 transition-colors hover:bg-slate-50 ${
              selectedSupportConversationId === conversation.id
                ? "bg-blue-50"
                : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-slate-800">
                {conversation.user_name}
              </strong>

              <span
                className={`text-xs rounded-full px-2 py-1 ${
                  conversation.status === "open"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {conversation.status === "open" ? "مفتوحة" : "مغلقة"}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
              {conversation.last_message}
            </p>

            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-slate-400">
                {formatDate(conversation.last_message_at)}
              </span>

              {!!conversation.unread_count && (
                <span className="min-w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center px-1">
                  {conversation.unread_count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    )}
  </div>

  {/* نافذة المحادثة */}
  <div className="category-card admin-support-panel max-h-[80vh] min-h-0">

    {!selectedSupportConversationId ? (
      <div className="empty-state flex-1">
        <Mail size={34} />
        <p>اختر محادثة من القائمة لعرض الرسائل والرد عليها.</p>
      </div>
    ) : (
      <>
        {/* رأس المحادثة - ثابت */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b pb-4">
          <div>
            <h3 className="font-bold">
              {supportConversations.find(
                (item) => item.id === selectedSupportConversationId
              )?.user_name || "محادثة خدمة العملاء"}
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              محادثة دعم منفصلة عن محادثات الإعلانات
            </p>
          </div>

          {(() => {
            const currentConversation = supportConversations.find(
              (item) => item.id === selectedSupportConversationId
            );

            return currentConversation ? (
              <button
                type="button"
                className="category-edit-button"
                onClick={() =>
                  handleToggleSupportStatus(currentConversation)
                }
              >
                {currentConversation.status === "open"
                  ? "إغلاق الطلب"
                  : "إعادة فتح الطلب"}
              </button>
            ) : null;
          })()}
        </div>

        {/* الرسائل - سكرول مستقل */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-4 space-y-3">
          {supportMessagesLoading ? (
            <div className="empty-state">
              <LoaderCircle className="spin" size={25} />
              <p>جارٍ تحميل الرسائل...</p>
            </div>
          ) : supportMessages.length === 0 ? (
            <div className="empty-state">
              <p>لا توجد رسائل في هذه المحادثة بعد.</p>
            </div>
          ) : (
            supportMessages.map((message) => {
              const isAdminMessage = message.sender_id === admin?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    isAdminMessage ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      isAdminMessage
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.body}
                    </p>

                    <span
                      className={`block text-[10px] mt-2 ${
                        isAdminMessage
                          ? "text-blue-100"
                          : "text-slate-400"
                      }`}
                    >
                      {isAdminMessage ? "الإدارة" : "المستخدم"} ·{" "}
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* منطقة الرد - ثابتة بالأسفل */}
        {supportConversations.find(
          (item) => item.id === selectedSupportConversationId
        )?.status === "closed" ? (
          <div className="shrink-0 border-t pt-4 text-sm text-amber-700">
            الطلب مغلق. أعد فتحه حتى تتمكن من إرسال رد جديد.
          </div>
        ) : (
          <div className="shrink-0 border-t pt-4">
            <textarea
              value={supportReply}
              onChange={(event) => setSupportReply(event.target.value)}
              placeholder="اكتب ردك للمستخدم..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />

            <div className="flex justify-end mt-3">
              <button
                type="button"
                className="approve-button"
                onClick={handleSendSupportReply}
                disabled={supportSending || !supportReply.trim()}
              >
                {supportSending ? "جارٍ الإرسال..." : "إرسال الرد"}
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>
</div>
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
  navigate(`/admin/conversation/${report.conversation_id}`);
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

<div className="border rounded-xl p-4">
  <label className="block font-semibold mb-3">
    شعار الموقع
  </label>

  {(logoPreviewUrl || logoUrl) && (
    <div className="mb-3">
      <img
        src={logoPreviewUrl || logoUrl}
        alt="معاينة شعار الموقع"
        className="w-24 h-24 object-contain rounded-xl border p-2 bg-white"
      />
    </div>
  )}

  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0] || null;
      setLogoFile(file);

      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          setLogoPreviewUrl(String(reader.result));
        };
        reader.readAsDataURL(file);
      }
    }}
    className="w-full border rounded-lg p-3"
  />

  <button
    type="button"
    onClick={uploadLogo}
    disabled={!logoFile || logoUploading}
    className="mt-3 px-5 py-2 rounded-lg bg-emerald-700 text-white disabled:opacity-50"
  >
    {logoUploading ? "جارٍ رفع الشعار..." : "رفع الشعار"}
  </button>

  <p className="text-sm text-gray-500 mt-2">
    اختر صورة من جهازك، ثم ارفعها واضغط حفظ الإعدادات لتثبيتها.
  </p>
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
<div className="border rounded-xl p-4">
  <label className="block font-semibold mb-2">
    رمز الدفع عبر شام كاش (QR)
  </label>

  <p className="text-sm text-slate-500 mb-3">
    الصورة التي ستظهر للمستخدمين عند طلب تمييز إعلاناتهم.
  </p>

  {shamCashQrUrl && (
    <img
      src={shamCashQrUrl}
      alt="رمز شام كاش"
      className="w-64 max-w-full object-contain rounded-lg border p-2 mb-3"
    />
  )}

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) =>
      setShamCashQrFile(e.target.files?.[0] || null)
    }
    className="w-full border rounded-lg p-3"
  />

  <button
    type="button"
    onClick={uploadShamCashQr}
    disabled={!shamCashQrFile || shamCashQrUploading}
    className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
  >
    {shamCashQrUploading
      ? "جارٍ رفع رمز QR..."
      : "رفع رمز QR"}
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
<div className="mt-6 border-t border-slate-200 pt-5">
  <label className="flex cursor-pointer items-center gap-3">
    <input
      type="checkbox"
      checked={subscriptionsEnabled}
      onChange={(e) => setSubscriptionsEnabled(e.target.checked)}
      className="h-5 w-5 accent-emerald-600"
    />

    <span className="font-medium text-slate-700">
      تفعيل باقات الاشتراك واستقبال الطلبات
    </span>
  </label>

  <p className="mt-2 text-sm text-slate-500">
    عند التفعيل، ستصبح الباقات الثلاث متاحة لاستقبال طلبات الاشتراك.
    وعند الإيقاف، يتوقف استقبال الطلبات وتبقى الباقات ظاهرة للزوار.
  </p>
</div>
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
{/* قسم شحن النقاط */}
{activeMenu === "شحن النقاط" && (
  <div className="space-y-6">

    {/* إدارة الباقات */}
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <Coins className="text-amber-500" />
            إدارة باقات النقاط
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            أضف الباقات وعدّل أسعارها ورتّب ظهورها للمستخدمين.
          </p>
        </div>
      </div>

      {pointPackagesError && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {pointPackagesError}
        </div>
      )}

      {pointPackagesSuccess && (
        <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
          {pointPackagesSuccess}
        </div>
      )}

      <div className="mb-6 grid gap-3 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
        <input
          value={pointPackageName}
          onChange={(e) => setPointPackageName(e.target.value)}
          placeholder="اسم الباقة"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-amber-400"
        />

        <input
          type="number"
          min="0.1"
          step="0.1"
          value={pointPackagePrice}
          onChange={(e) => setPointPackagePrice(e.target.value)}
          placeholder="السعر بالدولار"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-amber-400"
        />

        <input
          type="number"
          value={pointPackageSortOrder}
          onChange={(e) => setPointPackageSortOrder(e.target.value)}
          placeholder="ترتيب الظهور"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-amber-400"
        />

        <button
          type="button"
          onClick={handleSavePointPackage}
          disabled={pointPackageSaving}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          {pointPackageSaving ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Plus size={18} />
          )}
          {editingPointPackage ? "حفظ التعديلات" : "إضافة باقة"}
        </button>

        {editingPointPackage && (
          <button
            type="button"
            onClick={resetPointPackageForm}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-600 md:col-span-4"
          >
            إلغاء التعديل
          </button>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-500">
        النقاط تُحسب تلقائياً: كل دولار = 10 نقاط.
      </div>

      {pointPackagesLoading ? (
        <div className="flex justify-center py-8">
          <LoaderCircle className="animate-spin text-amber-500" size={28} />
        </div>
      ) : pointPackages.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          لا توجد باقات حتى الآن.
        </p>
      ) : (
        <div className="space-y-3">
          {pointPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-4"
            >
              <div>
                <h3 className="font-bold text-gray-800">{pkg.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {Number(pkg.price_usd).toFixed(2)} دولار
                  {" · "}
                  {pkg.points} نقطة
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    pkg.is_active
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {pkg.is_active ? "نشطة" : "متوقفة"}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPointPackage(pkg);
                    setPointPackageName(pkg.name);
                    setPointPackagePrice(String(pkg.price_usd));
                    setPointPackageSortOrder(String(pkg.sort_order));
                    setPointPackagesError("");
                    setPointPackagesSuccess("");
                  }}
                  className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                  title="تعديل الباقة"
                >
                  <Pencil size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePointPackage(pkg)}
                  className={`rounded-lg p-2 ${
                    pkg.is_active
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  }`}
                  title={pkg.is_active ? "إيقاف الباقة" : "تفعيل الباقة"}
                >
                  {pkg.is_active ? (
                    <XCircle size={17} />
                  ) : (
                    <CheckCircle size={17} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>


{/* طلبات شحن النقاط */}
<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
  <div className="mb-5">
    <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
      <Wallet className="text-green-600" />
      طلبات شحن النقاط
    </h2>
    <p className="mt-1 text-sm text-gray-500">
      راجع التحويلات اليدوية ووافق على الطلب أو ارفضه.
    </p>
  </div>

  {pointTopupRequestsError && (
    <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
      {pointTopupRequestsError}
    </div>
  )}

  <textarea
    value={pointTopupAdminNote}
    onChange={(e) => setPointTopupAdminNote(e.target.value)}
    placeholder="ملاحظة إدارية اختيارية للطلب..."
    rows={2}
    className="mb-5 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-green-400"
  />

  {pointTopupRequestsLoading ? (
    <div className="flex justify-center py-8">
      <LoaderCircle className="animate-spin text-green-600" size={28} />
    </div>
  ) : pointTopupRequests.length === 0 ? (
    <p className="py-8 text-center text-gray-500">
      لا توجد طلبات شحن حتى الآن.
    </p>
  ) : (
    <div className="space-y-4">
      {pointTopupRequests.map((request) => (
        <div
          key={request.id}
          className="rounded-xl border border-gray-100 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold text-gray-800">
                طلب شحن نقاط جديد
              </p>
              <p className="mt-1 text-sm text-gray-500">
                المستخدم: {request.user_id}
              </p>
              <p className="text-sm text-gray-500">
                رقم الهاتف: {request.phone || "غير متوفر"}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                request.status === "approved"
                  ? "bg-green-50 text-green-700"
                  : request.status === "rejected"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {request.status === "approved"
                ? "مقبول"
                : request.status === "rejected"
                ? "مرفوض"
                : "قيد المراجعة"}
            </span>
          </div>

          {/* عدد النقاط المطلوبة */}
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-700">
              عدد النقاط المطلوبة
            </p>
            <p className="mt-1 text-3xl font-extrabold text-green-700">
              {Number(request.points).toLocaleString("en-US")}
              <span className="mr-2 text-base font-semibold">نقطة</span>
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-gray-500">المبلغ بالدولار</p>
              <p className="font-bold">
                {Number(request.amount_usd).toFixed(2)} $
              </p>
            </div>

            <div>
              <p className="text-gray-500">المبلغ بالليرة</p>
              <p className="font-bold">
                {Number(request.amount_syp).toLocaleString("en-US")} ل.س
              </p>
            </div>

            <div>
              <p className="text-gray-500">سعر الصرف</p>
              <p className="font-bold">
                {Number(request.exchange_rate).toLocaleString("en-US")}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            تاريخ الطلب:{" "}
            {new Date(request.created_at).toLocaleString("ar")}
          </p>

          {request.admin_note && (
            <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              ملاحظة الإدارة: {request.admin_note}
            </p>
          )}

          {request.status === "pending" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pointTopupActionLoading === request.id}
                onClick={() =>
                  handlePointTopupAction(request, "approve")
                }
                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {pointTopupActionLoading === request.id ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                موافقة وإضافة النقاط
              </button>

              <button
                type="button"
                disabled={pointTopupActionLoading === request.id}
                onClick={() =>
                  handlePointTopupAction(request, "reject")
                }
                className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle size={16} />
                رفض الطلب
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>

  </div>
)}

{/* الأقسام التي لم يتم تجهيزها بعد */}
{![
  "الرئيسية",
  "مراجعة الإعلانات",
  "طلبات الاشتراك",
  "طلبات حملات التمييز",
  "طلبات مندوبي التوصيل",
  "عمال التوصيل",
  "طلبات المتاجر",
  "إدارة المتاجر",
  "طلبات توثيق الحسابات",
  "التبرعات",
  "المستخدمون",
  "التصنيفات",
  "المدن",
  "إدارة المدن",
  "البلاغات",
  "إدارة الإعلانات",
  "الإعلانات المؤرشفة",
  "الإعدادات",
  "الإشعارات",
  "شحن النقاط",
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
const duration = await window.sooqPrompt(
  "أدخل مدة الحظر بالساعات:"
);

if (duration === null) return;

    let duration_hours: number | undefined;

    if (type === "temporary") {
      const duration = await window.sooqPrompt(
  "أدخل مدة الحظر بالساعات:"
);

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


if (type === "permanent") {
  const confirmed = await window.sooqConfirm(
    "هل أنت متأكد من حظر هذا المستخدم نهائياً؟"
  );

  if (!confirmed) return;
}

const reason = await window.sooqPrompt(
  "اكتب سبب حظر هذا المستخدم:"
);

if (reason === null || !reason.trim()) return;

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
const confirmed = await window.sooqConfirm(
  "هل أنت متأكد من فك الحظر عن هذا المستخدم؟"
);

if (!confirmed) return;

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
