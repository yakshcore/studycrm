'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { NotificationSkeleton } from '@/components/Skeleton';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';
import type { Notification } from '@/types';

const TYPE_ICON: Record<string, string> = {
  document:    '📄',
  application: '🏫',
  visa:        '🛂',
  payment:     '💳',
  stage:       '🎯',
  message:     '💬',
  general:     '🔔',
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    api.get<Notification[]>('/notifications')
      .then(res => {
        setNotifications(res.data);
        // Mark all as read automatically on page visit (fire-and-forget)
        const hasUnread = res.data.some(n => !n.read);
        if (hasUnread) {
          api.patch('/notifications/read-all').catch(() => {});
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch {
      toast('Failed to mark as read', 'error');
    }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast('All notifications marked as read');
    } catch {
      toast('Failed to update', 'error');
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppShell title="Notifications">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-t1">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-t3 text-sm mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-accent hover:underline font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <NotificationSkeleton key={i} />)}</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-t2 font-medium">No notifications yet</p>
            <p className="text-t3 text-sm mt-1">Updates about your application will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <button
                key={n._id}
                onClick={() => !n.read && markRead(n._id)}
                className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition ${
                  n.read
                    ? 'bg-surface border-line hover:border-line'
                    : 'bg-sky-500/5 border-sky-500/20 hover:bg-sky-500/10'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                  n.read ? 'bg-muted' : 'bg-sky-500/15'
                }`}>
                  {TYPE_ICON[n.type] ?? '🔔'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold ${n.read ? 'text-t2' : 'text-t1'}`}>{n.title}</p>
                  <p className="text-xs text-t3 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-t3 mt-1">
                    {new Date(n.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
