"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: CallableFunction;
  operonContractIncentivesAnalyticsEnabled?: boolean;
};

export function AnalyticsPageView() {
  const pathname = usePathname();
  const lastTrackedPath = useRef("");

  useEffect(() => {
    const analyticsWindow = window as AnalyticsWindow;

    if (!analyticsWindow.operonContractIncentivesAnalyticsEnabled || !pathname) {
      return;
    }

    const path = `${pathname}${window.location.search}${window.location.hash}`;
    if (path === lastTrackedPath.current) {
      return;
    }

    lastTrackedPath.current = path;
    const pageView = {
      page_location: window.location.href,
      page_path: path,
      page_title: document.title
    };

    analyticsWindow.gtag?.("event", "page_view", pageView);
    analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
    analyticsWindow.dataLayer.push({
      event: "page_view",
      ...pageView
    });
  }, [pathname]);

  return null;
}
