import Link from "next/link";
import AtelierBackground from "./background";
import { ArrowLeft } from "lucide-react";

export default function AtelierPage() {
  return <main className="atelier-page relative isolate min-h-screen bg-white"><AtelierBackground /><Link href="/" className="absolute left-6 top-6 grid h-10 w-10 place-items-center rounded-full border border-neutral-200 text-neutral-600" aria-label="返回主页" title="返回主页"><ArrowLeft size={19} /></Link></main>;
}
