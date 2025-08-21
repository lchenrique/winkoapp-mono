import React from 'react';
import { cn } from '@/lib/utils';

interface UnreadBadgeProps {
  count: number;
  className?: string;
  maxCount?: number;
}

export function UnreadBadge({ count, className, maxCount = 99 }: UnreadBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <div
      className={cn(
        'absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1',
        'animate-pulse-soft border-2 border-zinc-900 dark:border-zinc-100',
        'shadow-lg',
        className
      )}
    >
      {displayCount}
    </div>
  );
}

export default UnreadBadge;
