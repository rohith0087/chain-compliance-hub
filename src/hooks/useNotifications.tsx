
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationSound } from './useNotificationSound';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  reference_id?: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { playNotificationSound } = useNotificationSound();
  const initialLoadComplete = useRef(false);

  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
      } else {
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      initialLoadComplete.current = true;
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    // Check if we're in a sandbox/development environment where WebSockets might be restricted
    const isSandbox = window.location.hostname.includes('sandbox') || 
                     window.location.hostname.includes('localhost') ||
                     window.location.protocol === 'http:';

    if (isSandbox) {
      return;
    }

    try {
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            
            // Play notification sound for new notifications (not on initial load)
            if (initialLoadComplete.current) {
              playNotificationSound(newNotification.type);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setNotifications(prev => 
              prev.map(notif => 
                notif.id === payload.new.id ? payload.new as Notification : notif
              )
            );
          }
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          // Silently handle cleanup errors
        }
      };
    } catch (error) {
      // Continue without real-time updates in case of WebSocket errors
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
      } else {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
      } else {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, read: true }))
        );
      }
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading,
    refetch: fetchNotifications
  };
};
