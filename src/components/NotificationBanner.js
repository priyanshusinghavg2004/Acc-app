import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const NotificationBanner = ({ db, userId, companyInfo }) => {
    const [notifications, setNotifications] = useState([]);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (!db || !userId) return;

        // Listen for notifications for this user
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('status', '==', 'unread'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newNotifications = [];
            snapshot.forEach(doc => {
                newNotifications.push({ id: doc.id, ...doc.data() });
            });
            setNotifications(newNotifications);
            setShowBanner(newNotifications.length > 0);
        });

        return () => unsubscribe();
    }, [db, userId]);

    const markAsRead = async (notificationId) => {
        try {
            // Update notification status to read
            await updateDoc(doc(db, 'notifications', notificationId), {
                status: 'read',
                readAt: new Date()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    if (!showBanner || notifications.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-4 z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex-1">
                    <h3 className="font-semibold">Company Invitation</h3>
                    <p className="text-sm opacity-90">
                        You have been invited to join {notifications[0]?.companyName || 'a company'}. 
                        Please check your email for login details.
                    </p>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => markAsRead(notifications[0].id)}
                        className="px-3 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 text-sm"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationBanner; 