"use client";

import { useState } from "react";
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Zap, 
  TrendingUp,
  AlertTriangle,
  Clock,
  Check,
  Settings,
  ExternalLink,
} from "lucide-react";

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'ab_test' | 'performance';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    flowId?: string;
    campaignId?: string;
    testId?: string;
    value?: number;
    percentage?: number;
  };
}

type NotificationFilter = 'all' | 'unread' | 'error' | 'ab_test' | 'performance';

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'error',
    title: 'Erreur de synchronisation',
    message: 'Le flux Google Shopping a échoué lors de la dernière synchronisation. 12 produits n\'ont pas pu être mis à jour.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    read: false,
    priority: 'high',
    actionUrl: '/flux',
    actionLabel: 'Voir le flux',
    metadata: {
      flowId: 'google-shopping-1',
      value: 12
    }
  },
  {
    id: '2',
    type: 'ab_test',
    title: 'Test A/B terminé',
    message: 'Le test "Optimisation Prix Meta" est terminé. Le variant B montre une amélioration de +15% du taux de conversion.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    read: false,
    priority: 'medium',
    actionUrl: '/rapports',
    actionLabel: 'Voir les résultats',
    metadata: {
      testId: 'ab-test-1',
      percentage: 15
    }
  },
  {
    id: '3',
    type: 'performance',
    title: 'Performance exceptionnelle',
    message: 'Votre campagne Pinterest Ads génère +45% de revenus par rapport à la semaine dernière.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    read: true,
    priority: 'low',
    actionUrl: '/rapports',
    actionLabel: 'Analyser',
    metadata: {
      campaignId: 'pinterest-ads-1',
      percentage: 45
    }
  },
  {
    id: '4',
    type: 'success',
    title: 'Synchronisation réussie',
    message: 'Le flux Shopify a été synchronisé avec succès. 1,247 produits mis à jour.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    read: true,
    priority: 'low',
    actionUrl: '/sources',
    actionLabel: 'Voir les sources',
    metadata: {
      flowId: 'shopify-1',
      value: 1247
    }
  },
  {
    id: '5',
    type: 'warning',
    title: 'Quota API atteint',
    message: 'Vous avez atteint 85% de votre quota API Google Merchant Center pour ce mois.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: true,
    priority: 'medium',
    actionUrl: '/parametres',
    actionLabel: 'Gérer les quotas',
    metadata: {
      percentage: 85
    }
  },
  {
    id: '6',
    type: 'info',
    title: 'Nouvelle fonctionnalité',
    message: 'Le Report Builder est maintenant disponible ! Créez vos rapports personnalisés.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    read: true,
    priority: 'low',
    actionUrl: '/rapports',
    actionLabel: 'Essayer'
  }
];

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [showSettings, setShowSettings] = useState(false);
  const filterOptions: Array<{ key: NotificationFilter; label: string }> = [
    { key: 'all', label: 'Toutes' },
    { key: 'unread', label: 'Non lues' },
    { key: 'error', label: 'Erreurs' },
    { key: 'ab_test', label: 'Tests A/B' },
    { key: 'performance', label: 'Performance' },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return AlertCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      case 'ab_test': return Zap;
      case 'performance': return TrendingUp;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      case 'ab_test': return '#8b5cf6';
      case 'performance': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          padding: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          color: '#6b7280',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
          e.currentTarget.style.color = '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#6b7280';
        }}
      >
        <Bell style={{ width: '20px', height: '20px' }} />
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: '600',
            minWidth: '18px'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: '400px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          marginTop: '8px'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: unreadCount === 0 ? '#9ca3af' : '#6b7280',
                  cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                <Check style={{ width: '16px', height: '16px' }} />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                <Settings style={{ width: '16px', height: '16px' }} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto'
          }}>
            {filterOptions.map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: filter === filterOption.key ? '#2563eb' : 'transparent',
                  color: filter === filterOption.key ? 'white' : '#6b7280',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredNotifications.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <Bell style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>
                  {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const IconComponent = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);
                const priorityColor = getPriorityColor(notification.priority);

                return (
                  <div
                    key={notification.id}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: notification.read ? 'white' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = notification.read ? '#f9fafb' : '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = notification.read ? 'white' : '#f8fafc';
                    }}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id);
                      if (notification.actionUrl) {
                        // Navigate to action URL
                        console.log('Navigate to:', notification.actionUrl);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        backgroundColor: iconColor + '20',
                        borderRadius: '8px',
                        flexShrink: 0
                      }}>
                        <IconComponent style={{ width: '16px', height: '16px', color: iconColor }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#111827',
                            margin: 0,
                            flex: 1
                          }}>
                            {notification.title}
                          </h4>
                          <div style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: priorityColor,
                            borderRadius: '50%',
                            flexShrink: 0
                          }} />
                        </div>

                        <p style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          margin: '0 0 8px 0',
                          lineHeight: 1.4
                        }}>
                          {notification.message}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Clock style={{ width: '12px', height: '12px' }} />
                              {formatTimestamp(notification.timestamp)}
                            </span>
                            {notification.metadata?.percentage && (
                              <span style={{
                                fontSize: '12px',
                                color: notification.type === 'performance' ? '#22c55e' : '#6b7280',
                                fontWeight: '500'
                              }}>
                                +{notification.metadata.percentage}%
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            {notification.actionLabel && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Action clicked:', notification.actionUrl);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: 'transparent',
                                  color: '#2563eb',
                                  border: '1px solid #2563eb',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {notification.actionLabel}
                                <ExternalLink style={{ width: '10px', height: '10px' }} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              style={{
                                padding: '4px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                borderRadius: '4px'
                              }}
                            >
                              <X style={{ width: '12px', height: '12px' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            textAlign: 'center'
          }}>
            <button
              style={{
                fontSize: '12px',
                color: '#2563eb',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Voir toutes les notifications
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: '300px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 1001,
          marginTop: '8px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 16px 0' }}>
            Paramètres des notifications
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px' }} />
              Notifications par email
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px' }} />
              Notifications push
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px' }} />
              Erreurs critiques
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px' }} />
              Résultats de tests A/B
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" style={{ width: '16px', height: '16px' }} />
              Alertes de performance
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

