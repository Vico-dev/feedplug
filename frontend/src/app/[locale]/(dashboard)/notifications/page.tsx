"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Info,
  Search,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import {
  DashboardInput,
  DashboardSection,
  DashboardStatCard,
  DashboardStatGrid,
  DashboardToolbar,
  EmptyState,
  PageButtonPrimary,
  PageButtonSecondary,
  PageHeader,
  PageLayout,
  StatusBadge,
} from "@/components/layout";

type FilterKey = "all" | "unread" | "error" | "ab_test" | "performance";

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "error", label: "Erreurs" },
  { key: "ab_test", label: "Tests A/B" },
  { key: "performance", label: "Performance" },
];

function getNotificationIcon(type: string) {
  switch (type) {
    case "success":
      return CheckCircle;
    case "error":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
    case "ab_test":
      return Zap;
    case "performance":
      return TrendingUp;
    default:
      return Bell;
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case "success":
      return "#16a34a";
    case "error":
      return "#dc2626";
    case "warning":
      return "#d97706";
    case "info":
      return "#0f766e";
    case "ab_test":
      return "#7c3aed";
    case "performance":
      return "#0891b2";
    default:
      return "#6b7280";
  }
}

function getPriorityVariant(priority: string): "success" | "error" | "warning" | "neutral" {
  switch (priority) {
    case "urgent":
      return "error";
    case "high":
      return "warning";
    case "medium":
      return "success";
    default:
      return "neutral";
  }
}

function formatTimestamp(timestamp: Date) {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${days} j`;
}

export default function NotificationsPage() {
  const t = useTranslations("dashboard");
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotifications = notifications.filter((notification) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !notification.read) ||
      notification.type === filter;

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      notification.title.toLowerCase().includes(query) ||
      notification.message.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  return (
    <PageLayout>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          <>
            <PageButtonSecondary onClick={clearAll}>
              <Trash2 size={16} />
              Tout supprimer
            </PageButtonSecondary>
            <PageButtonPrimary onClick={markAllAsRead} disabled={unreadCount === 0}>
              <Check size={16} />
              Tout marquer comme lu
            </PageButtonPrimary>
          </>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <DashboardStatGrid>
          <DashboardStatCard icon={<Bell size={20} />} label="Total" value={notifications.length} hint="Vue globale de votre centre de notifications" accent="#64748b" />
          <DashboardStatCard icon={<AlertCircle size={20} />} label="Non lues" value={unreadCount} hint="A traiter en priorite" accent="#dc2626" />
          <DashboardStatCard
            icon={<Zap size={20} />}
            label="Tests A/B"
            value={notifications.filter((item) => item.type === "ab_test").length}
            hint="Alertes liees aux experimentations"
            accent="#7c3aed"
          />
          <DashboardStatCard
            icon={<TrendingUp size={20} />}
            label="Performance"
            value={notifications.filter((item) => item.type === "performance").length}
            hint="Variations et resultats de diffusion"
            accent="#0891b2"
          />
        </DashboardStatGrid>

        <DashboardToolbar>
          <DashboardInput icon={<Search size={16} />}>
            <input
              type="text"
              placeholder="Rechercher dans les notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                minHeight: 44,
                padding: "0 14px 0 42px",
                border: "1px solid var(--app-border)",
                borderRadius: 12,
                fontSize: 14,
                backgroundColor: "#fff",
                color: "var(--app-text)",
                outline: "none",
              }}
            />
          </DashboardInput>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTER_OPTIONS.map((option) => {
              const active = filter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  style={{
                    minHeight: 40,
                    padding: "0 14px",
                    borderRadius: 999,
                    border: active ? "1px solid rgba(15, 118, 110, 0.18)" : "1px solid var(--app-border)",
                    backgroundColor: active ? "var(--app-accent-soft)" : "rgba(255,255,255,0.8)",
                    color: active ? "var(--app-accent-strong)" : "var(--app-text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </DashboardToolbar>

        <DashboardSection
          title="Dernieres notifications"
          description="Toutes les alertes, actions et suivis lies a votre compte FeedPlug."
        >
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Aucune notification"
              description={
                searchQuery
                  ? "Aucune notification ne correspond a votre recherche."
                  : "Vous n'avez aucune notification pour le moment."
              }
            />
          ) : (
            <div className="feedplug-shell-card" style={{ overflow: "hidden" }}>
              {filteredNotifications.map((notification, index) => {
                const Icon = getNotificationIcon(notification.type);
                const color = getNotificationColor(notification.type);

                return (
                  <div
                    key={notification.id}
                    style={{
                      padding: 20,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                      borderBottom: index < filteredNotifications.length - 1 ? "1px solid rgba(15, 23, 42, 0.06)" : "none",
                      backgroundColor: notification.read ? "transparent" : "rgba(15, 118, 110, 0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${color}18`,
                        color,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 600,
                                color: "var(--app-text)",
                                letterSpacing: "-0.02em",
                              }}
                            >
                              {notification.title}
                            </h3>
                            <StatusBadge variant={getPriorityVariant(notification.priority)}>{notification.priority}</StatusBadge>
                            {!notification.read && <StatusBadge variant="success">Nouveau</StatusBadge>}
                          </div>
                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: 14,
                              lineHeight: 1.6,
                              color: "var(--app-text-muted)",
                            }}
                          >
                            {notification.message}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            color: "var(--app-text-soft)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <Clock size={14} />
                          {formatTimestamp(notification.timestamp)}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          {notification.metadata?.percentage !== undefined && (
                            <span style={{ fontSize: 13, fontWeight: 600, color: color }}>
                              +{notification.metadata.percentage}%
                            </span>
                          )}
                          {notification.metadata?.value !== undefined && (
                            <span style={{ fontSize: 13, color: "var(--app-text-muted)" }}>
                              {notification.metadata.value} elements
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {!notification.read && (
                            <PageButtonSecondary onClick={() => markAsRead(notification.id)} style={{ minHeight: 36, padding: "0 12px" }}>
                              Marquer comme lu
                            </PageButtonSecondary>
                          )}
                          {notification.actionLabel && notification.actionUrl && (
                            <Link href={notification.actionUrl} prefetch={false}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  minHeight: 36,
                                  padding: "0 12px",
                                  borderRadius: 12,
                                  backgroundColor: "var(--app-text)",
                                  color: "#fff",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                {notification.actionLabel}
                                <ExternalLink size={13} />
                              </span>
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteNotification(notification.id)}
                            aria-label="Supprimer la notification"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              border: "1px solid var(--app-border)",
                              backgroundColor: "#fff",
                              color: "var(--app-text-soft)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>
      </div>
    </PageLayout>
  );
}
