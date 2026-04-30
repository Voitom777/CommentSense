import { Workspace } from "@/features/dashboard/workspace";
import { getWorkspaceData } from "@/server/db/repository";

export default async function HomePage() {
  const data = await getWorkspaceData();

  return <Workspace initialReviews={data.reviews} initialAnalyses={data.analyses} initialReplies={data.replies} brand={data.brand} />;
}
