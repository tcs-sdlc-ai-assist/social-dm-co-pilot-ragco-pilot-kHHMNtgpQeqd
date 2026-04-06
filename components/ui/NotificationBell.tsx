"use client";

import { useEffect, useRef, useState } from "react";

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
}

export default function NotificationBell({
  unreadCount,
  onClick,
}: NotificationBellProps) {
  const [animate, setAnimate] = useState(false);
  const prevCountRef = useRef<number>(unreadCount);

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setAnimate(true);
      const timeout = setTimeout(() => {
        setAnimate(false);
      }, 600);
      return () => clearTimeout(timeout);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        unreadCount > 0
          ? `Notifications: ${unreadCount} unread`
          : "Notifications: none"
      }
      className={`relative inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        animate ? "animate-pulse-soft" : ""
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={`h-6 w-6 transition-transform duration-300 ${
          animate ? "scale-110" : "scale-100"
        }`}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>

      {unreadCount > 0 && (
        <span
          className={`absolute -right-0.5 -top-0.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-transform duration-300 ${
            animate ? "scale-110" : "scale-100"
          } ${
            unreadCount > 99
              ? "min-w-[1.375rem] px-1 py-0.5 text-2xs"
              : "min-w-[1.125rem] px-1 py-0.5 text-2xs"
          }`}
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}
    </button>
  );
}

export { NotificationBell };
export type { NotificationBellProps };