import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { useAuth } from "@/hooks/useAuth";

const APP_ID = "54a39cc7-7923-48c4-bf40-a7f8b76fce44";

let initialization: Promise<void> | null = null;

const initializeOneSignal = () => {
  initialization ??= OneSignal.init({
    appId: APP_ID,
    serviceWorkerPath: "OneSignalSDKWorker.js",
    allowLocalhostAsSecureOrigin: true,
  });
  return initialization;
};

export const OneSignalProvider = () => {
  const { user } = useAuth();

  useEffect(() => {
    initializeOneSignal().catch((error) => {
      console.error("OneSignal initialization failed", error);
      initialization = null;
    });
  }, []);

  useEffect(() => {
    initializeOneSignal()
      .then(() => user ? OneSignal.login(user.id) : OneSignal.logout())
      .catch((error) => console.error("OneSignal user sync failed", error));
  }, [user?.id]);

  return null;
};