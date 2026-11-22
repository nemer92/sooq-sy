
import { useEffect } from "react";
import { startAutomaticLiveUpdateCheck } from "./lib/liveUpdate";

export default function LiveUpdateReady() {
  useEffect(() => {
    startAutomaticLiveUpdateCheck();
  }, []);

  return null;
}
