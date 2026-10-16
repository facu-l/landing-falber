import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
