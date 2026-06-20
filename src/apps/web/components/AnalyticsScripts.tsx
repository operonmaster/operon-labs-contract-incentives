import Script from "next/script";
import { googleAnalyticsMeasurementId, googleTagManagerId } from "../lib/site-seo";
import { AnalyticsPageView } from "./AnalyticsPageView";

const analyticsBootstrapScript = `
(function () {
  var hostname = (window.location.hostname || "").trim().toLowerCase();
  var analyticsEnabled = Boolean(hostname) &&
    hostname !== "localhost" &&
    hostname !== "::1" &&
    hostname !== "[::1]" &&
    hostname !== "0.0.0.0" &&
    hostname.indexOf("127.") !== 0 &&
    hostname.indexOf("local.") !== 0 &&
    !hostname.endsWith(".local");

  window.operonContractIncentivesAnalyticsEnabled = analyticsEnabled;
})();

(function () {
  if (!window.operonContractIncentivesAnalyticsEnabled) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;

  var gtagScript = document.createElement("script");
  gtagScript.async = true;
  gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}";
  document.head.appendChild(gtagScript);

  gtag("js", new Date());
  gtag("config", "${googleAnalyticsMeasurementId}", {
    send_page_view: false
  });
})();

(function (w, d, s, l, i) {
  if (!w.operonContractIncentivesAnalyticsEnabled) {
    return;
  }

  w[l] = w[l] || [];
  w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  var f = d.getElementsByTagName(s)[0],
    j = d.createElement(s),
    dl = l !== "dataLayer" ? "&l=" + l : "";
  j.async = true;
  j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
  f.parentNode.insertBefore(j, f);
})(window, document, "script", "dataLayer", "${googleTagManagerId}");
`;

export function AnalyticsScripts() {
  return (
    <>
      <Script
        id="operon-contract-incentives-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: analyticsBootstrapScript }}
      />
      <AnalyticsPageView />
    </>
  );
}
