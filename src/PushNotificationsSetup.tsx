
import { useEffect, useRef } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./lib/supabase";
import { useNavigate } from "react-router-dom";

export default function PushNotificationsSetup() {
  const userIdRef = useRef<string | null>(null);
  const registeredForUserRef = useRef<string | null>(null);
  const registeringRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // الإشعارات مخصصة لتطبيق Android فقط
    if (Capacitor.getPlatform() !== "android") return;

    let active = true;
    let listenerHandles: PluginListenerHandle[] = [];
    let authSubscription:
      | ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"]
      | null = null;

    const registerDevice = async () => {
      const userId = userIdRef.current;

      if (!userId || registeringRef.current) return;
      if (registeredForUserRef.current === userId) return;

      registeringRef.current = true;

      try {
        let permission = await PushNotifications.checkPermissions();

        if (permission.receive !== "granted") {
          permission = await PushNotifications.requestPermissions();
        }

        if (!active || permission.receive !== "granted") return;

        registeredForUserRef.current = userId;

        await PushNotifications.register();
      } catch (error) {
        registeredForUserRef.current = null;
        console.error("Push registration error:", error);
      } finally {
        registeringRef.current = false;
      }
    };

    const setup = async () => {
      try {
        const registrationListener = await PushNotifications.addListener(
          "registration",
          async (token) => {
            const userId = userIdRef.current;

            if (!active || !userId) return;

            const { error } = await supabase
              .from("push_tokens")
              .upsert(
                {
                  user_id: userId,
                  token: token.value,
                  platform: "android",
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: "user_id,token",
                }
              );

            if (error) {
              console.error("Saving push token failed:", error);
            } else {
              console.log("Push token saved successfully.");
            }
          }
        );

        listenerHandles.push(registrationListener);

        const errorListener = await PushNotifications.addListener(
          "registrationError",
          (error) => {
            console.error("Push registration failed:", error);
          }
        );

        listenerHandles.push(errorListener);

        const receivedListener = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("Push notification received:", notification);
          }
        );

        listenerHandles.push(receivedListener);

const actionListener = await PushNotifications.addListener(
  "pushNotificationActionPerformed",
  (action) => {
    console.log("Push notification opened:", action);

    const link = action.notification.data?.link;

    if (!link) return;

    try {
      const url = new URL(link);

      if (url.hostname !== "nemer92.github.io") return;

      const match = url.pathname.match(
        /^\/sooq-sy\/ad\/([^/]+)\/?$/
      );

      if (!match) return;

      const adId = match[1];

      navigate(`/ad/${encodeURIComponent(adId)}`);
    } catch (error) {
      console.error("Invalid notification link:", error);
    }
  }
);

        listenerHandles.push(actionListener);

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Loading session failed:", error);
        }

        if (!active) return;

        userIdRef.current = data.session?.user.id ?? null;

        const { data: authData } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            userIdRef.current = session?.user.id ?? null;

            if (!session) {
              registeredForUserRef.current = null;
              return;
            }

            void registerDevice();
          }
        );

        authSubscription = authData.subscription;

        if (userIdRef.current) {
          await registerDevice();
        }
      } catch (error) {
        console.error("Push setup error:", error);
      }
    };

    void setup();

    return () => {
      active = false;
      authSubscription?.unsubscribe();

      listenerHandles.forEach((listener) => {
        void listener.remove();
      });
    };
  }, []);

  return null;
}
