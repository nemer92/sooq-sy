import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  RefreshCw,
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  Car,
  Truck,
  Loader2,
} from "lucide-react";

type Vehicle = {
  id: string;
  vehicle_type: string;
  capacity: string;
  loading_help: boolean;
  is_active: boolean;
};

type Coverage = {
  city_id: number;
  name_ar: string;
};

type CoverageOption = {
  city_id: number;
  name_ar: string;
  is_covered: boolean;
};

type DriverProfile = {
  driver_id: string;
  driver_status: string;
  is_available: boolean;
  admin_disabled: boolean;
  application_status: string;
  vehicles: Vehicle[];
  coverage: Coverage[];
};

type DeliveryRequest = {
  id: string;
  status: string;
  payment_method: string;
  item_payment_status: string;
  item_price: number;
  item_currency: string;
  estimated_route_km: number;
  delivery_fee: number | null;
  pickup_address_label?: string;
  delivery_address_label?: string;
  buyer?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  seller?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  price_history?: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
  }>;
};

const statusLabels: Record<string, string> = {
  pending_driver: "بانتظار ردك",
  accepted: "تم قبول الطلب",
  waiting_price: "بانتظار تحديد الأجرة",
  waiting_buyer_approval: "بانتظار موافقة المشتري",
  agreed: "تم الاتفاق",
  picked_up: "تم استلام الغرض",
  on_the_way: "بالطريق إلى المشتري",
  awaiting_buyer_payment: "بانتظار تأكيد الدفع",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  expired: "انتهت المهلة",
  return_required: "مطلوب إرجاع الغرض",
  returning: "جارٍ الإرجاع",
  returned: "تم إرجاع الغرض",
};

const capacityLabels: Record<string, string> = {
  small: "صغيرة",
  medium: "متوسطة",
  large: "كبيرة",
};

const vehicleLabels: Record<string, string> = {
  small_car: "سيارة صغيرة",
  motorcycle: "دراجة نارية",
  bicycle: "دراجة هوائية",
  van: "فان",
  pickup: "بيك أب",
  truck: "شاحنة",
};

export default function DeliveryDriver() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [coverageOptions, setCoverageOptions] = useState<CoverageOption[]>([]);
  const [selectedCoverageCityIds, setSelectedCoverageCityIds] = useState<string[]>([]);
  const [coverageSearch, setCoverageSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [paymentInputs, setPaymentInputs] = useState<
    Record<string, { item: string; fee: string }>
  >({});
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_type: "small_car",
    capacity: "small",
    loading_help: false,
  });
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [editVehicleForm, setEditVehicleForm] = useState({
    vehicle_type: "small_car",
    capacity: "small",
    loading_help: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        navigate("/auth", { state: { from: "/delivery-driver" } });
        return;
      }

      const { data: driverAdminStatus, error: driverAdminStatusError } =
        await supabase
          .from("delivery_drivers")
          .select("admin_disabled")
          .eq("user_id", user.id)
          .maybeSingle();

      if (driverAdminStatusError) throw driverAdminStatusError;

      const [profileResult, requestsResult, coverageResult] = await Promise.all([
        supabase.rpc("get_my_delivery_driver_profile"),
        supabase.rpc("get_my_delivery_requests"),
        supabase.rpc("get_delivery_coverage_options"),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (requestsResult.error) throw requestsResult.error;
      if (coverageResult.error) throw coverageResult.error;

      setProfile({
        ...(profileResult.data as DriverProfile),
        admin_disabled: driverAdminStatus?.admin_disabled === true,
      });

      setCoverageOptions(
        Array.isArray(coverageResult.data)
          ? (coverageResult.data as CoverageOption[])
          : []
      );

      setRequests(
        Array.isArray(requestsResult.data)
          ? requestsResult.data.map((item: any) => ({
              ...item.request,
              buyer: item.buyer,
              seller: item.seller,
              driver: item.driver,
              price_history: item.price_history,
              events: item.events,
            }))
          : []
      );
    } catch (error: any) {
      console.error("Delivery driver load error:", error);
      setMessage(error?.message || "تعذر تحميل بيانات المندوب.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function ensureDriverCanHandleRequests(): boolean {
    if (profile?.admin_disabled) {
      setMessage("حسابك موقوف من قبل الإدارة، ولا يمكنك تنفيذ إجراءات طلبات التوصيل.");
      return false;
    }
    if (profile?.driver_status !== "active") {
      setMessage("حساب المندوب غير مفعل حالياً.");
      return false;
    }
    return true;
  }

  async function runAction(
    key: string,
    action: () => PromiseLike<{ error: any }>
  ) {
    setActionLoading(key);
    setMessage("");

    try {
      const result = await action();
      if (result.error) throw result.error;

      await loadData();
      setMessage("تم تنفيذ العملية بنجاح.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "تعذر تنفيذ العملية.");
    } finally {
      setActionLoading("");
    }
  }

  async function respond(requestId: string, accept: boolean) {
    if (!ensureDriverCanHandleRequests()) return;

    await runAction(`${requestId}-respond`, () =>
      supabase.rpc("respond_delivery_request", {
        p_request_id: requestId,
        p_accept: accept,
      })
    );
  }

  async function proposePrice(request: DeliveryRequest) {
    if (!ensureDriverCanHandleRequests()) return;

    const amount = Number(priceInputs[request.id]);

    if (!Number.isFinite(amount) || amount < 0) {
      setMessage("أدخل أجرة توصيل صحيحة.");
      return;
    }

    await runAction(`${request.id}-price`, () =>
      supabase.rpc("propose_delivery_price", {
        p_request_id: request.id,
        p_amount: amount,
        p_currency: request.item_currency,
      })
    );
  }

  async function simpleAction(requestId: string, functionName: string) {
    if (!ensureDriverCanHandleRequests()) return;

    await runAction(requestId, () =>
      supabase.rpc(functionName, { p_request_id: requestId })
    );
  }

  async function confirmPayment(request: DeliveryRequest) {
    if (!ensureDriverCanHandleRequests()) return;

    const values = paymentInputs[request.id] || { item: "", fee: "" };
    const itemAmount =
      request.payment_method === "driver_pays_seller"
        ? Number(request.item_price)
        : 0;
    const feeAmount = Number(
      values.fee !== "" ? values.fee : request.delivery_fee ?? 0
    );

    if (
      !Number.isFinite(itemAmount) ||
      !Number.isFinite(feeAmount) ||
      feeAmount < 0
    ) {
      setMessage("أدخل أجرة التوصيل المستلمة بشكل صحيح.");
      return;
    }

    if (
      request.delivery_fee !== null &&
      feeAmount !== Number(request.delivery_fee)
    ) {
      setMessage("المبلغ المدخل لأجرة التوصيل لا يطابق الأجرة المتفق عليها.");
      return;
    }

    await runAction(`${request.id}-payment`, () =>
      supabase.rpc("confirm_delivery_payment_received", {
        p_request_id: request.id,
        p_item_amount_received: itemAmount,
        p_delivery_fee_received: feeAmount,
      })
    );
  }

  async function addVehicle() {
    await runAction("add-vehicle", () =>
      supabase.rpc("add_delivery_vehicle", {
        p_vehicle_type: vehicleForm.vehicle_type,
        p_capacity: vehicleForm.capacity,
        p_loading_help: vehicleForm.loading_help,
      })
    );
  }

  function startEditingVehicle(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setEditVehicleForm({
      vehicle_type: vehicle.vehicle_type,
      capacity: vehicle.capacity,
      loading_help: vehicle.loading_help,
    });
  }

  async function saveVehicle(vehicle: Vehicle) {
    await runAction(`vehicle-${vehicle.id}`, () =>
      supabase.rpc("update_delivery_vehicle", {
        p_vehicle_id: vehicle.id,
        p_vehicle_type: editVehicleForm.vehicle_type,
        p_capacity: editVehicleForm.capacity,
        p_loading_help: editVehicleForm.loading_help,
        p_is_active: vehicle.is_active,
      })
    );
    setEditingVehicleId("");
  }

  async function toggleVehicleActive(vehicle: Vehicle) {
    await runAction(`vehicle-${vehicle.id}`, () =>
      supabase.rpc("update_delivery_vehicle", {
        p_vehicle_id: vehicle.id,
        p_vehicle_type: vehicle.vehicle_type,
        p_capacity: vehicle.capacity,
        p_loading_help: vehicle.loading_help,
        p_is_active: !vehicle.is_active,
      })
    );
  }

  async function addCoverage() {
    if (profile?.admin_disabled) {
      setMessage("حسابك موقوف إدارياً. لا يمكنك تعديل مناطق التغطية حالياً.");
      return;
    }

    if (selectedCoverageCityIds.length === 0) {
      setMessage("حدد مدينة واحدة على الأقل.");
      return;
    }

    setActionLoading("add-coverage");
    setMessage("");
    let addedCount = 0;
    const failedCities: string[] = [];

    try {
      for (const cityId of selectedCoverageCityIds) {
        const city = coverageOptions.find(
          (option) => String(option.city_id) === cityId
        );
        const result = await supabase.rpc("add_delivery_coverage", {
          p_city_id: Number(cityId),
        });

        if (result.error) {
          failedCities.push(
            `${city?.name_ar || cityId}: ${result.error.message || "تعذر الإضافة"}`
          );
        } else {
          addedCount++;
        }
      }

      setSelectedCoverageCityIds([]);
      await loadData();

      if (failedCities.length > 0) {
        setMessage(
          addedCount > 0
            ? `تمت إضافة ${addedCount} مدينة، وتعذرت إضافة بعض المدن: ${failedCities.join("، ")}`
            : `تعذرت إضافة المدن المحددة: ${failedCities.join("، ")}`
        );
      } else {
        setMessage(`تمت إضافة ${addedCount} مدينة إلى مناطق التغطية بنجاح.`);
      }
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "تعذرت إضافة مناطق التغطية.");
      await loadData();
    } finally {
      setActionLoading("");
    }
  }

  async function removeCoverage(cityId: number) {
    if (profile?.admin_disabled) {
      setMessage("حسابك موقوف إدارياً. لا يمكنك تعديل مناطق التغطية حالياً.");
      return;
    }

    await runAction(`coverage-${cityId}`, () =>
      supabase.rpc("remove_delivery_coverage", { p_city_id: cityId })
    );
  }

  async function toggleAvailability() {
    if (!profile) return;
    if (profile.admin_disabled) {
      setMessage("حسابك موقوف من قبل الإدارة ولا يمكنك تغيير حالة التوفر.");
      return;
    }

    await runAction("availability", () =>
      supabase.rpc("set_delivery_driver_availability", {
        p_is_available: !profile.is_available,
      })
    );
  }

  const activeVehicles =
    profile?.vehicles?.filter((vehicle) => vehicle.is_active) || [];

  const activeRequests = requests.filter((request) =>
    [
      "pending_driver",
      "accepted",
      "waiting_price",
      "waiting_buyer_approval",
      "agreed",
      "picked_up",
      "on_the_way",
      "awaiting_buyer_payment",
      "return_required",
      "returning",
    ].includes(request.status)
  );

  const availableCoverageOptions = coverageOptions.filter(
    (city) => !city.is_covered
  );

  const filteredCoverageOptions = availableCoverageOptions.filter((city) =>
    city.name_ar.toLowerCase().includes(coverageSearch.trim().toLowerCase())
  );

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-5">
        <div className="max-w-xl mx-auto rounded-2xl bg-white p-6 shadow-sm">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 mb-6">
            <ArrowRight size={19} />
            رجوع
          </button>
          <h1 className="text-xl font-bold mb-3">حساب المندوب</h1>
          <p className="text-slate-600">{message || "لا يوجد حساب مندوب مرتبط بحسابك."}</p>
          <button onClick={() => navigate("/profile")} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-white font-bold">
            العودة إلى الملف الشخصي
          </button>
        </div>
      </div>
    );
  }

  const requestActionDisabled = !!actionLoading || profile.admin_disabled || profile.driver_status !== "active";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-xl p-2 hover:bg-slate-100">
              <ArrowRight size={21} />
            </button>
            <div>
              <h1 className="font-bold text-lg">لوحة المندوب</h1>
              <p className="text-xs text-slate-500">إدارة طلبات التوصيل</p>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} className="rounded-xl border border-slate-200 p-2">
            <RefreshCw size={19} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-5">
        {message && <div className="rounded-xl bg-blue-50 text-blue-800 p-3 text-sm">{message}</div>}

        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg">حالة حسابك</h2>
              <p className="text-sm text-slate-500 mt-1">
                {profile.admin_disabled
                  ? "تم إيقاف حسابك من قبل الإدارة"
                  : profile.driver_status === "active"
                  ? "حساب المندوب مفعل"
                  : "حساب المندوب موقوف"}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              profile.driver_status === "active" && !profile.admin_disabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}>
              {profile.admin_disabled ? "موقوف إدارياً" : profile.driver_status === "active" ? "نشط" : "موقوف"}
            </span>
          </div>

          {profile.admin_disabled && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-bold mb-1">حسابك موقوف من قبل الإدارة</p>
              <p>لا يمكنك استقبال طلبات توصيل أو تنفيذ إجراءات الطلبات حالياً. يرجى التواصل مع الإدارة لمعرفة التفاصيل وإعادة تفعيل حسابك.</p>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <div>
              <p className="font-bold">استقبال الطلبات</p>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك إيقاف استقبال الطلبات مؤقتاً
              </p>
            </div>
            <button
              onClick={toggleAvailability}
              disabled={
                actionLoading === "availability" ||
                profile.admin_disabled ||
                profile.driver_status !== "active" ||
                (activeVehicles.length === 0 && !profile.is_available)
              }
              className={`rounded-xl px-4 py-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                profile.is_available ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {actionLoading === "availability" ? "..." : profile.is_available ? "متاح" : "غير متاح"}
            </button>
          </div>
          {activeVehicles.length === 0 && (
            <p className="text-xs text-amber-700 mt-3">أضف مركبة فعالة حتى تتمكن من استقبال الطلبات.</p>
          )}
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Car size={20} className="text-emerald-600" />
            <h2 className="font-bold">مركباتك</h2>
          </div>

          {profile.vehicles.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">لا توجد مركبات مسجلة.</p>
          ) : (
            <div className="space-y-3 mb-5">
              {profile.vehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-xl bg-slate-50 p-3 space-y-3">
                  {editingVehicleId === vehicle.id ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-sm">
                          نوع المركبة
                          <select value={editVehicleForm.vehicle_type} onChange={(event) => setEditVehicleForm((previous) => ({ ...previous, vehicle_type: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">
                            <option value="small_car">سيارة صغيرة</option>
                            <option value="motorcycle">دراجة نارية</option>
                            <option value="bicycle">دراجة هوائية</option>
                            <option value="van">فان</option>
                            <option value="pickup">بيك أب</option>
                            <option value="truck">شاحنة</option>
                          </select>
                        </label>
                        <label className="block text-sm">
                          سعة الحمولة
                          <select value={editVehicleForm.capacity} onChange={(event) => setEditVehicleForm((previous) => ({ ...previous, capacity: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">
                            <option value="small">صغيرة</option>
                            <option value="medium">متوسطة</option>
                            <option value="large">كبيرة</option>
                          </select>
                        </label>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editVehicleForm.loading_help} onChange={(event) => setEditVehicleForm((previous) => ({ ...previous, loading_help: event.target.checked }))} className="h-4 w-4" />
                        أستطيع المساعدة في تحميل وتنزيل الأغراض
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => saveVehicle(vehicle)} disabled={!!actionLoading} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">حفظ التعديلات</button>
                        <button onClick={() => setEditingVehicleId("")} disabled={!!actionLoading} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">إلغاء</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm">{vehicleLabels[vehicle.vehicle_type] || vehicle.vehicle_type}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          الحمولة: {capacityLabels[vehicle.capacity] || vehicle.capacity}
                          {vehicle.loading_help ? " • مساعدة بالتحميل" : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold ${vehicle.is_active ? "text-emerald-700" : "text-slate-500"}`}>
                          {vehicle.is_active ? "فعالة" : "غير فعالة"}
                        </span>
                        <button onClick={() => startEditingVehicle(vehicle)} disabled={!!actionLoading} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">تعديل</button>
                        <button onClick={() => toggleVehicleActive(vehicle)} disabled={!!actionLoading} className={`rounded-lg px-3 py-2 text-xs font-bold ${vehicle.is_active ? "bg-red-50 text-red-700" : "bg-emerald-600 text-white"}`}>
                          {vehicle.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <h3 className="font-bold text-sm">إضافة مركبة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                نوع المركبة
                <select value={vehicleForm.vehicle_type} onChange={(event) => setVehicleForm((previous) => ({ ...previous, vehicle_type: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">
                  <option value="small_car">سيارة صغيرة</option>
                  <option value="motorcycle">دراجة نارية</option>
                  <option value="bicycle">دراجة هوائية</option>
                  <option value="van">فان</option>
                  <option value="pickup">بيك أب</option>
                  <option value="truck">شاحنة</option>
                </select>
              </label>
              <label className="block text-sm">
                سعة الحمولة
                <select value={vehicleForm.capacity} onChange={(event) => setVehicleForm((previous) => ({ ...previous, capacity: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">
                  <option value="small">صغيرة</option>
                  <option value="medium">متوسطة</option>
                  <option value="large">كبيرة</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={vehicleForm.loading_help} onChange={(event) => setVehicleForm((previous) => ({ ...previous, loading_help: event.target.checked }))} className="h-4 w-4" />
              أستطيع المساعدة في تحميل وتنزيل الأغراض
            </label>
            <button onClick={addVehicle} disabled={!!actionLoading} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
              {actionLoading === "add-vehicle" ? "جارٍ إضافة المركبة..." : "إضافة المركبة"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-emerald-600" />
            <h2 className="font-bold">مناطق التغطية</h2>
          </div>
          <p className="text-xs text-slate-500">
            اختر المدن والأحياء التي تستطيع الاستلام والتوصيل ضمنها. سيظهر حسابك للعميل عندما تغطي منطقتي البائع والمشتري.
          </p>

          {profile.coverage.length === 0 ? (
            <p className="text-sm text-slate-500">لم تحدد مناطق التغطية بعد.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-bold">المناطق المضافة</p>
              <div className="flex flex-wrap gap-2">
                {profile.coverage.map((city) => (
                  <div key={city.city_id} className="flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
                    <span>{city.name_ar}</span>
                    <button type="button" onClick={() => removeCoverage(city.city_id)} disabled={!!actionLoading || profile.admin_disabled} aria-label={`إزالة ${city.name_ar} من التغطية`} className="font-bold text-red-600 disabled:opacity-50">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm font-bold mb-2">ابحث واختر المدن التي تريد تغطيتها</p>
              <input type="search" value={coverageSearch} onChange={(event) => setCoverageSearch(event.target.value)} placeholder="اكتب اسم المدينة للبحث..." disabled={!!actionLoading || profile.admin_disabled} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y">
              {filteredCoverageOptions.length > 0 ? (
                filteredCoverageOptions.map((city) => (
                  <label key={city.city_id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedCoverageCityIds.includes(String(city.city_id))}
                      onChange={(event) => {
                        const cityId = String(city.city_id);
                        setSelectedCoverageCityIds((previous) =>
                          event.target.checked ? [...previous, cityId] : previous.filter((id) => id !== cityId)
                        );
                      }}
                      disabled={!!actionLoading || profile.admin_disabled}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-sm">{city.name_ar}</span>
                  </label>
                ))
              ) : availableCoverageOptions.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">تمت إضافة جميع المدن المتاحة.</p>
              ) : (
                <p className="p-3 text-sm text-slate-500">لا توجد مدن مطابقة لبحثك.</p>
              )}
            </div>
            <p className="text-xs text-slate-500">عدد المدن المحددة: {selectedCoverageCityIds.length}</p>
            {selectedCoverageCityIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCoverageCityIds.map((cityId) => {
                  const city = coverageOptions.find((option) => String(option.city_id) === cityId);
                  return city ? (
                    <span key={cityId} className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs">{city.name_ar}</span>
                  ) : null;
                })}
              </div>
            )}
            <button type="button" onClick={addCoverage} disabled={selectedCoverageCityIds.length === 0 || !!actionLoading || profile.admin_disabled} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
              {actionLoading === "add-coverage" ? "جارٍ إضافة المناطق..." : `إضافة المناطق المحددة (${selectedCoverageCityIds.length})`}
            </button>
            {coverageOptions.length === 0 && (
              <p className="text-xs text-amber-700">لم تصل قائمة المناطق. تحقق من دالة جلب مناطق التغطية في قاعدة البيانات.</p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">طلبات التوصيل</h2>
            <span className="text-sm text-slate-500">{activeRequests.length} طلب نشط</span>
          </div>

          {profile.admin_disabled && activeRequests.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-bold">حسابك موقوف إدارياً</p>
              <p className="mt-1">يمكنك الاطلاع على الطلبات الحالية، لكن لا يمكنك قبولها أو تنفيذ أي إجراء عليها حتى تعيد الإدارة تفعيل حسابك.</p>
            </div>
          )}

          {activeRequests.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
              <Package size={35} className="mx-auto text-slate-300 mb-3" />
              <p className="font-bold">لا توجد طلبات حالياً</p>
              <p className="text-sm text-slate-500 mt-1">ستظهر هنا طلبات التوصيل الجديدة.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeRequests.map((request) => (
                <article key={request.id} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-bold">طلب توصيل</p>
                      <p className="text-xs text-slate-500 mt-1">{request.id.slice(0, 8)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold">
                      {statusLabels[request.status] || request.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 mb-1">المشتري</p>
                      <p className="font-bold">{request.buyer?.display_name || "مستخدم"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 mb-1">البائع</p>
                      <p className="font-bold">{request.seller?.display_name || "مستخدم"}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {request.pickup_address_label && (
                      <p className="flex gap-2">
                        <MapPin size={17} className="text-emerald-600 shrink-0" />
                        <span>الاستلام: {request.pickup_address_label}</span>
                      </p>
                    )}
                    {request.delivery_address_label && (
                      <p className="flex gap-2">
                        <MapPin size={17} className="text-blue-600 shrink-0" />
                        <span>التسليم: {request.delivery_address_label}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">المسافة التقديرية</p>
                      <p className="font-bold mt-1">{request.estimated_route_km} كم</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">سعر الغرض</p>
                      <p className="font-bold mt-1">{request.item_price} {request.item_currency}</p>
                    </div>
                  </div>

                  {request.status === "pending_driver" && (
                    <div className="flex gap-2">
                      <button onClick={() => respond(request.id, true)} disabled={requestActionDisabled} className="flex-1 rounded-xl bg-emerald-600 text-white py-3 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        <CheckCircle size={17} className="inline ml-1" /> قبول الطلب
                      </button>
                      <button onClick={() => respond(request.id, false)} disabled={requestActionDisabled} className="flex-1 rounded-xl bg-red-50 text-red-700 py-3 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        <XCircle size={17} className="inline ml-1" /> رفض
                      </button>
                    </div>
                  )}

                  {(request.status === "accepted" || request.status === "waiting_price") && (
                    <div className="border-t pt-4 space-y-3">
                      <label className="text-sm font-bold block">أجرة التوصيل المقترحة</label>
                      <input type="number" min="0" step="0.01" value={priceInputs[request.id] || ""} onChange={(event) => setPriceInputs((previous) => ({ ...previous, [request.id]: event.target.value }))} placeholder="أدخل الأجرة" disabled={requestActionDisabled} className="w-full rounded-xl border border-slate-200 p-3 disabled:bg-slate-100" />
                      <button onClick={() => proposePrice(request)} disabled={requestActionDisabled} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed">إرسال الأجرة للمشتري</button>
                    </div>
                  )}

                  {request.status === "waiting_buyer_approval" && (
                    <p className="rounded-xl bg-amber-50 text-amber-800 p-3 text-sm">بانتظار موافقة المشتري على أجرة التوصيل.</p>
                  )}                  {request.status === "agreed" && (
                    <button
                      onClick={() => simpleAction(request.id, "mark_delivery_picked_up_and_on_the_way")}
                      disabled={requestActionDisabled}
                      className="w-full rounded-xl bg-emerald-600 text-white py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Truck size={18} className="inline ml-1" />
                      استلمت الطلب وأنا بطريقي إلى المشتري
                    </button>
                  )}

                  {request.status === "awaiting_buyer_payment" && (
                    <div className="border-t pt-4 space-y-3">
                      <p className="font-bold text-sm">تسجيل المبالغ المستلمة</p>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <label className="text-xs text-slate-500">مبلغ الغرض الذي يجب أن تستلمه</label>
                        <p className="font-bold mt-1">
                          {request.payment_method === "driver_pays_seller"
                            ? `${request.item_price} ${request.item_currency}`
                            : `0 ${request.item_currency}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {request.payment_method === "driver_pays_seller"
                            ? "أنت دفعت للبائع، لذلك تستلم ثمن الغرض من المشتري."
                            : "المشتري يدفع ثمن الغرض للبائع مباشرة، وأنت تستلم أجرة التوصيل فقط."}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">أجرة التوصيل المستلمة</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={paymentInputs[request.id]?.fee ?? (request.delivery_fee === null ? "" : String(request.delivery_fee))}
                          onChange={(event) => setPaymentInputs((previous) => ({
                            ...previous,
                            [request.id]: { item: "", fee: event.target.value },
                          }))}
                          disabled={requestActionDisabled}
                          className="w-full rounded-xl border p-3 mt-1 disabled:bg-slate-100"
                        />
                      </div>
                      <p className="text-xs text-slate-500">أكّد استلام أجرة التوصيل المتفق عليها فعلياً. سيتحقق الخادم من المبلغ.</p>
                      <button onClick={() => confirmPayment(request)} disabled={requestActionDisabled} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                        تأكيد استلام المبالغ وإتمام التسليم
                      </button>
                    </div>
                  )}

                  {request.status === "return_required" && (
                    <button onClick={() => simpleAction(request.id, "mark_delivery_returning")} disabled={requestActionDisabled} className="w-full rounded-xl bg-amber-600 text-white py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                      بدء إرجاع الغرض للبائع
                    </button>
                  )}

                  {request.status === "returning" && (
                    <button onClick={() => simpleAction(request.id, "confirm_delivery_returned")} disabled={requestActionDisabled} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                      تأكيد إعادة الغرض للبائع
                    </button>
                  )}

                  {request.status === "delivered" && (
                    <p className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-bold">
                      <CheckCircle size={17} className="inline ml-1" /> اكتمل طلب التوصيل.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">منصة Sooq.sy — إدارة التوصيل</p>
      </main>
    </div>
  );
}
