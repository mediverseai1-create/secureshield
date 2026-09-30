import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://secureshieldai.click";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/governance", "/features", "/pricing", "/about", "/contact", "/privacy", "/terms"], disallow: ["/overview", "/pipeline", "/accounts", "/leads", "/conversations", "/briefings", "/actions", "/insights", "/reports", "/assistant", "/team", "/activity", "/settings", "/usage", "/subscription", "/api/", "/invite/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
