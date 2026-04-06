"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import NotificationBell from "@/components/ui/NotificationBell";

export interface HeaderProps {
  userRole?: "SOCIAL_MEDIA_OFFICER" | "SALES_CONSULTANT" | "ADMIN";
  userName?: string;
  unreadNotificationCount?: number;
  onNotificationClick?: () => void;
  activePath?: string;
}

const ROLE_LABELS: Record<string, string> = {
  SOCIAL_MEDIA_OFFICER: "Social Media Officer",
  SALES_CONSULTANT: "Sales Consultant",
  ADMIN: "Admin",
};

interface NavItem {
  label: string;
  href: string;
  key: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Inbox", href: "/inbox", key: "inbox" },
  { label: "Leads", href: "/leads", key: "leads" },
];

function StocklandLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-7 w-7 text-brand-500"
      aria-hidden="true"
    >
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-body-sm font-semibold"
      aria-hidden="true"
    >
      {initials || "U"}
    </div>
  );
}

export default function Header({
  userRole = "SOCIAL_MEDIA_OFFICER",
  userName = "Officer",
  unreadNotificationCount = 0,
  onNotificationClick,
  activePath = "/inbox",
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleNotificationClick = useCallback(() => {
    if (onNotificationClick) {
      onNotificationClick();
    }
  }, [onNotificationClick]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on escape key
  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  const roleLabel = ROLE_LABELS[userRole] || userRole;

  function isActive(href: string): boolean {
    return activePath === href || activePath.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-header max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-gray-900 no-underline hover:text-brand-600 transition-colors duration-200"
            aria-label="Stockland DM Copilot Home"
          >
            <StocklandLogo />
            <span className="hidden sm:inline-block text-heading-4 text-gray-900">
              Stockland
            </span>
            <span className="hidden md:inline-block text-body-sm text-gray-400 font-normal">
              DM Copilot
            </span>
          </a>
        </div>

        {/* Center: Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <a
                key={item.key}
                href={item.href}
                className={`relative px-3 py-2 rounded-lg text-body-sm font-medium no-underline transition-colors duration-200 ${
                  active
                    ? "text-brand-600 bg-brand-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brand-500" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right: Notifications + User Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell
            unreadCount={unreadNotificationCount}
            onClick={handleNotificationClick}
          />

          {/* User info — desktop only */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="h-6 w-px bg-gray-200" aria-hidden="true" />
            <UserAvatar name={userName} />
            <div className="flex flex-col">
              <span className="text-body-sm font-medium text-gray-900 leading-tight">
                {userName}
              </span>
              <span className="text-2xs text-gray-500 leading-tight">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          ref={mobileMenuRef}
          className="border-t border-gray-200 bg-white md:hidden animate-fade-in"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="space-y-1 px-4 py-3">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`block rounded-lg px-3 py-2.5 text-body-sm font-medium no-underline transition-colors duration-200 ${
                    active
                      ? "text-brand-600 bg-brand-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          {/* Mobile user info */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar name={userName} />
              <div className="flex flex-col">
                <span className="text-body-sm font-medium text-gray-900 leading-tight">
                  {userName}
                </span>
                <span className="text-2xs text-gray-500 leading-tight">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export { Header };
export type { NavItem };