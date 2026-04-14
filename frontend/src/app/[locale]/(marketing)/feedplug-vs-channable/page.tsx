import ComparisonLanding from "@/components/marketing/ComparisonLanding";
import { getComparisonCopy } from "@/lib/comparison-pages";

export default async function FeedPlugVsChannablePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ComparisonLanding copy={getComparisonCopy("channable", locale)} />;
}
