import React from "react";
import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import BriefInputBox from "@/components/BriefInputBox";

export default function Analyze() {
  return (
    <Shell dark={true}>
      <SEO
        title="Analyze a Client Brief"
        description="Paste a client brief and get evidence-backed scope, clarification questions, an hour range, and a transparent price floor."
        canonical="/analyze"
      />
      <div className="relative min-h-screen bg-[#090b10] px-5 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Analyze a client brief</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
            Paste the WhatsApp message, DM, or brief as-is. Baseline extracts scope evidence, flags what's
            missing, and computes an hour range and price floor from your cost profile.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Not sure yet? <Link to="/judge" className="font-semibold text-emerald-400 hover:text-emerald-300">
              <PlayCircle size={12} className="inline -mt-0.5" /> See the 90-second guided demo
            </Link> instead.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl">
          <BriefInputBox />
        </div>
      </div>
    </Shell>
  );
}
