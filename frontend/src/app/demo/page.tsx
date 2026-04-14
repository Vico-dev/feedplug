import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function DemoRedirectPage() {
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language") || "";

  let locale = routing.defaultLocale;

  if (acceptLanguage.includes("es")) {
    locale = "es";
  } else if (acceptLanguage.includes("en")) {
    locale = "en";
  }

  redirect(`/${locale}/demo`);
}
