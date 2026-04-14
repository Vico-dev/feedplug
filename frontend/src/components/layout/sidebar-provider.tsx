"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type SidebarContextValue = {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
  isMobile: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_STORAGE_KEY = "feedplug.sidebar.collapsed";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const toggle = () => setIsCollapsed((current) => !current);
  const toggleMobile = () => setMobileOpen((v) => !v);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const nextIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) {
        setMobileOpen(false);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggle, mobileOpen, setMobileOpen, toggleMobile, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      isCollapsed: false,
      setIsCollapsed: () => {},
      toggle: () => {},
      mobileOpen: false,
      setMobileOpen: () => {},
      toggleMobile: () => {},
      isMobile: false,
    };
  }
  return ctx;
}
