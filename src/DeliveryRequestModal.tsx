
import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "./lib/supabase";
import {
  MapPin,
  Truck,
  UserRound,
  X,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Package,
} from "lucide-react";

type Governorate = {
  id: number;
  name_ar: string;
};

type City = {
  id: number;
  name_ar: string;
  governorate_id: number;
};

type DeliveryVehicle = {
  id: string;
  vehicle_type: string;
  capacity: string;
  loading_help: boolean;
};

type DeliveryDriver = {
  driver_id: string;
  display_name: string;
  avatar_url: string | null;
  vehicles: DeliveryVehicle[];
};

type Props = {
  saleRequestId: string;
  onClose: () => void;
  onSuccess: () => void;
};

const deliveryIcon = L.divIcon({
  className: "delivery-location-marker",
  html: `
    <div style="
      width: 30px;
      height: 30px;
      background: #059669;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
    "></div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function MapClickHandler({
  onChange,
}: {
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function DeliveryRequestModal({
  saleRequestId,
  onClose,
  onSuccess,
}: Props) {
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [cityId, setCityId] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<
    "driver_pays_seller" | "buyer_pays_seller"
  >("driver_pays_seller");

  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const filteredCities = governorateId
    ? cities.filter(
        (city) => city.governorate_id === Number(governorateId)
      )
    : [];

  useEffect(() => {
    async function loadCities() {
      setLoadingCities(true);

      try {
        const [governoratesResult, citiesResult] = await Promise.all([
          supabase
            .from("governorates")
            .select("id, name_ar")
            .eq("is_active", true)
            .order("name_ar"),

          supabase
            .from("cities")
            .select("id, name_ar, governorate_id")
            .eq("is_active", true)
            .order("name_ar"),
        ]);

        if (governoratesResult.error) throw governoratesResult.error;
        if (citiesResult.error) throw citiesResult.error;

        setGovernorates(
          (governoratesResult.data || []) as Governorate[]
        );
        setCities((citiesResult.data || []) as City[]);
      } catch (error: any) {
        console.error("خطأ تحميل المدن والمحافظات:", error);
        setMessage(error?.message || "تعذر تحميل المدن والمحافظات.");
      } finally {
        setLoadingCities(false);
      }
    }

    loadCities();
  }, []);

  async function loadDrivers(deliveryCityId: number) {
    setLoadingDrivers(true);
    setMessage("");
    setDrivers([]);
    setSelectedDriver("");

    try {
      const { data, error } = await supabase.rpc(
        "get_delivery_options_for_sale_request",
        {
          p_sale_request_id: saleRequestId,
          p_delivery_city_id: deliveryCityId,
        }
      );

      if (error) throw error;

      const result = data as any;

      // لا نطلب إحداثيات موقع الاستلام من الدالة؛ فهي خاصة بالبائع.
      setDrivers((result?.drivers || []) as DeliveryDriver[]);
    } catch (error: any) {
      console.error("خطأ جلب عمال التوصيل:", error);
      setMessage(
        error?.message || "تعذر تحميل عمال التوصيل المتاحين."
      );
    } finally {
      setLoadingDrivers(false);
    }
  }

  function handleGovernorateChange(value: string) {
    setGovernorateId(value);
    setCityId("");
    setDrivers([]);
    setSelectedDriver("");
    setMessage("");
  }

  function handleCityChange(value: string) {
    setCityId(value);
    setDrivers([]);
    setSelectedDriver("");
    setMessage("");

    if (value) {
      loadDrivers(Number(value));
    }
  }

  async function submitRequest() {
    if (!cityId) {
      setMessage("يرجى اختيار مدينة التسليم.");
      return;
    }

    if (latitude === null || longitude === null) {
      setMessage("يرجى تحديد موقع التسليم على الخريطة.");
      return;
    }

    if (!selectedDriver) {
      setMessage("يرجى اختيار عامل التوصيل.");
      return;
    }

    const confirmed = await window.sooqConfirm(
      "هل تريد إرسال طلب التوصيل إلى عامل التوصيل المحدد؟"
    );

    if (!confirmed) return;

    setSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("create_delivery_request", {
        p_sale_request_id: saleRequestId,
        p_driver_id: selectedDriver,
        p_delivery_city_id: Number(cityId),
        p_delivery_latitude: latitude,
        p_delivery_longitude: longitude,
        p_delivery_address_label: null,
        p_estimated_route_km: null,
        p_payment_method: paymentMethod,
      });

      if (error) throw error;

      await window.alert(
        "تم إرسال طلب التوصيل بنجاح. بانتظار رد عامل التوصيل."
      );

      onSuccess();
    } catch (error: any) {
      console.error("خطأ إنشاء طلب التوصيل:", error);
      setMessage(
        error?.message || "تعذر إرسال طلب التوصيل. حاول مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCities) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-6">
          <RefreshCw className="animate-spin text-emerald-600" />
          <span className="text-sm font-bold text-slate-700">
            جارٍ تحميل المدن...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="my-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white p-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              طلب توصيل السلعة
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              حدد موقع التسليم واختر عامل التوصيل
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            aria-label="إغلاق"
          >
            <X size={21} />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {message && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm leading-6 text-rose-700">
              <AlertCircle size={18} className="mt-1 shrink-0" />
              <p>{message}</p>
            </div>
          )}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                1. مدينة التسليم
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                اختر المحافظة ثم المدينة التي تريد استلام السلعة فيها
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={governorateId}
                onChange={(event) =>
                  handleGovernorateChange(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:bg-white"
              >
                <option value="">اختر المحافظة</option>
                {governorates.map((governorate) => (
                  <option key={governorate.id} value={governorate.id}>
                    {governorate.name_ar}
                  </option>
                ))}
              </select>

              <select
                value={cityId}
                onChange={(event) =>
                  handleCityChange(event.target.value)
                }
                disabled={!governorateId}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">اختر المدينة</option>
                {filteredCities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name_ar}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                2. موقع التسليم
              </h3>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                اضغط على الخريطة لتحديد مكان التسليم، ويمكنك تحريك العلامة
                لتعديل الموقع.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div dir="ltr" className="h-[300px] w-full">
                <MapContainer
                  center={[35, 38.5]}
                  zoom={6}
                  scrollWheelZoom
                  style={{ width: "100%", height: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapClickHandler
                    onChange={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                  />

                  {latitude !== null && longitude !== null && (
                    <Marker
                      position={[latitude, longitude]}
                      icon={deliveryIcon}
                      draggable
                      eventHandlers={{
                        dragend(event) {
                          const position = event.target.getLatLng();
                          setLatitude(position.lat);
                          setLongitude(position.lng);
                        },
                      }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>

            {latitude !== null && longitude !== null ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                <MapPin size={17} />
                تم تحديد موقع التسليم بنجاح
              </div>
            ) : (
              <p className="text-xs font-semibold text-amber-600">
                لم يتم تحديد موقع التسليم بعد.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                3. اختيار عامل التوصيل
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                تظهر هنا العمال الذين يغطون مدينتي الاستلام والتسليم.
              </p>
            </div>

            {loadingDrivers ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
                <RefreshCw size={18} className="animate-spin" />
                جارٍ البحث عن العمال...
              </div>
            ) : !cityId ? (
              <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                اختر مدينة التسليم أولاً.
              </div>
            ) : drivers.length === 0 ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                لا يوجد حالياً عامل متاح يغطي منطقتي الاستلام والتسليم.
                يمكنك المحاولة لاحقاً أو اختيار مدينة أخرى.
              </div>
            ) : (
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <button
                    type="button"
                    key={driver.driver_id}
                    onClick={() => setSelectedDriver(driver.driver_id)}
                    className={`w-full rounded-2xl border p-4 text-right transition ${
                      selectedDriver === driver.driver_id
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                        : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-500">
                        {driver.avatar_url ? (
                          <img
                            src={driver.avatar_url}
                            alt={driver.display_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound size={23} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-800">
                          {driver.display_name || "عامل توصيل"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {driver.vehicles.length} مركبة فعالة
                        </p>
                      </div>

                      {selectedDriver === driver.driver_id && (
                        <CheckCircle
                          size={22}
                          className="shrink-0 text-emerald-600"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {driver.vehicles.map((vehicle) => (
                        <span
                          key={vehicle.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600"
                        >
                          <Truck size={13} />
                          {vehicle.vehicle_type}
                          {vehicle.capacity ? ` - ${vehicle.capacity}` : ""}
                          {vehicle.loading_help ? " - يساعد بالتحميل" : ""}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-black text-slate-800">
              4. طريقة دفع ثمن السلعة
            </h3>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name="delivery-payment"
                checked={paymentMethod === "driver_pays_seller"}
                onChange={() => setPaymentMethod("driver_pays_seller")}
                className="mt-1 accent-emerald-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-700">
                  عامل التوصيل يدفع للبائع
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  يدفع العامل ثمن السلعة للبائع وفق آلية الدفع المتفق عليها.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name="delivery-payment"
                checked={paymentMethod === "buyer_pays_seller"}
                onChange={() => setPaymentMethod("buyer_pays_seller")}
                className="mt-1 accent-emerald-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-700">
                  المشتري يدفع ثمن السلعة للبائع
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  يكون ثمن السلعة مدفوعاً للبائع خارج آلية دفع العامل.
                </span>
              </span>
            </label>
          </section>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-800">
            <div className="flex items-center gap-2 font-bold">
              <Package size={16} />
              أجرة التوصيل
            </div>
            يحدد عامل التوصيل أجرة التوصيل بعد مراجعة الطريق، ثم تصلك
            للموافقة عليها قبل إتمام الاتفاق.
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={submitRequest}
              disabled={
                submitting ||
                loadingDrivers ||
                !cityId ||
                !selectedDriver ||
                latitude === null ||
                longitude === null
              }
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>
                  <CheckCircle size={17} />
                  إرسال طلب التوصيل
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-12 rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
