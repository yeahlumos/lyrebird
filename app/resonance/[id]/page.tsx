import { Suspense } from "react";
import Resonance from "../resonance";

async function DiaryContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Resonance relationshipId={id} />;
}

export default function SharedDiaryPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="res-loading" role="status">正在打开双人日记…</main>}><DiaryContent params={params} /></Suspense>;
}
