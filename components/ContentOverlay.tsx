'use client';

import { Loader2 } from 'lucide-react';
import { useNavigation } from './NavigationContext';

export function ContentOverlay() {
  const { isPending } = useNavigation();
  if (!isPending) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f1115]/60 backdrop-blur-[1px]">
      <Loader2 className="w-10 h-10 text-blue-400 animate-spin" strokeWidth={2.5} />
    </div>
  );
}
