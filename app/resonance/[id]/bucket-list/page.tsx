import { Suspense } from "react";
import Resonance from "../../resonance";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Resonance relationshipId={id} bucket />;
}

export default function BucketPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="res-loading">正在打开心愿清单…</main>}><Content params={params} /></Suspense>;
}
