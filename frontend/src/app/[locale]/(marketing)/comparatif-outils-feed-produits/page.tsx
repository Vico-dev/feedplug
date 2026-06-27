import ComparisonLanding from "@/components/marketing/ComparisonLanding";
import { getComparisonCopy } from "@/lib/comparison-pages";

export default async function ProductFeedToolsComparisonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ComparisonLanding copy={getComparisonCopy("tools", locale)} locale={locale} />;
}
