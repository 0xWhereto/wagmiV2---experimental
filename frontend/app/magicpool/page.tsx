"use client";

import { Header, MIMPage } from '@/components/design';

export default function MagicPoolPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      <Header />
      
      <main className="flex-1 px-6 py-12 relative z-10">
        <MIMPage />
      </main>
    </div>
  );
}


