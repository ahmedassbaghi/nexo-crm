import PublicBooking from "../../../components/public-booking";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBooking slug={slug} />;
}
