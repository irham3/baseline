import { useEffect } from "react";

const BASE_URL = "https://baselinework.app";
const DEFAULT_TITLE = "Baseline — AI pre-deal decision system for Indonesian freelancers";
const DEFAULT_DESCRIPTION = "AI pre-deal critique and pricing workflow for Indonesian freelancers before they say yes. Baseline surfaces ambiguous scope with evidence, explains why it matters, and — on calibrated work templates — computes transparent effort and price-floor ranges.";
const DEFAULT_IMAGE = `${BASE_URL}/assets/baseline-logo-512.png`;

function setMetaTag(selector, attribute, value) {
  if (!value) return;
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    if (selector.startsWith('meta[name="')) {
      const name = selector.match(/name="([^"]+)"/)?.[1];
      if (name) element.setAttribute("name", name);
    } else if (selector.startsWith('meta[property="')) {
      const property = selector.match(/property="([^"]+)"/)?.[1];
      if (property) element.setAttribute("property", property);
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function setCanonical(href) {
  if (!href) return;
  let element = document.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href.startsWith("http") ? href : `${BASE_URL}${href}`);
}

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical = "/",
  ogImage = DEFAULT_IMAGE,
  ogType = "website",
  noIndex = false,
  jsonLd = null,
}) {
  useEffect(() => {
    // 1. Page Title
    const formattedTitle = title ? `${title} | Baseline` : DEFAULT_TITLE;
    document.title = formattedTitle;

    // 2. Standard Meta Tags
    setMetaTag('meta[name="description"]', "content", description);
    setMetaTag('meta[name="title"]', "content", formattedTitle);
    setMetaTag('meta[name="robots"]', "content", noIndex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");

    // 3. Canonical Link
    setCanonical(canonical);

    // 4. OpenGraph Tags (Facebook, WhatsApp, LinkedIn, Telegram, Discord)
    const fullCanonical = canonical.startsWith("http") ? canonical : `${BASE_URL}${canonical}`;
    setMetaTag('meta[property="og:site_name"]', "content", "Baseline");
    setMetaTag('meta[property="og:title"]', "content", formattedTitle);
    setMetaTag('meta[property="og:description"]', "content", description);
    setMetaTag('meta[property="og:url"]', "content", fullCanonical);
    setMetaTag('meta[property="og:type"]', "content", ogType);
    setMetaTag('meta[property="og:image"]', "content", ogImage);
    setMetaTag('meta[property="og:image:secure_url"]', "content", ogImage);
    setMetaTag('meta[property="og:image:alt"]', "content", "Baseline Logo & Dashboard");

    // 5. Twitter / X / Slack / Discord Cards
    setMetaTag('meta[name="twitter:card"]', "content", "summary_large_image");
    setMetaTag('meta[name="twitter:site"]', "content", "@baselinework");
    setMetaTag('meta[name="twitter:creator"]', "content", "@baselinework");
    setMetaTag('meta[name="twitter:title"]', "content", formattedTitle);
    setMetaTag('meta[name="twitter:description"]', "content", description);
    setMetaTag('meta[name="twitter:image"]', "content", ogImage);
    setMetaTag('meta[name="twitter:image:alt"]', "content", "Baseline Logo & Dashboard");

    // 6. Optional Dynamic JSON-LD script
    let scriptEl = null;
    if (jsonLd) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.id = "page-dynamic-jsonld";
      scriptEl.text = JSON.stringify(jsonLd);
      document.head.appendChild(scriptEl);
    }

    return () => {
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
    };
  }, [title, description, canonical, ogImage, ogType, noIndex, jsonLd]);

  return null;
}

export default SEO;
