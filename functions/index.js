const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendNotificationOnCreate = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const newValue = snap.data();
        
        // Se a notificação for para 'all', envia para o tópico 'all'
        if (newValue.userId === 'all') {
            const message = {
                notification: {
                    title: newValue.title,
                    body: newValue.message,
                },
                topic: 'all'
            };
            
            try {
                const response = await admin.messaging().send(message);
                console.log('Successfully sent message:', response);
                return response;
            } catch (error) {
                console.log('Error sending message:', error);
                return null;
            }
        }
        
        // Se for para um usuário específico, busca o token dele no Firestore
        if (newValue.userId && newValue.userId !== 'all') {
             try {
                const userDoc = await admin.firestore().collection('users').doc(newValue.userId).get();
                if (userDoc.exists && userDoc.data().fcmToken) {
                    const token = userDoc.data().fcmToken;
                    const message = {
                        notification: {
                            title: newValue.title,
                            body: newValue.message,
                        },
                        token: token
                    };
                    const response = await admin.messaging().send(message);
                    console.log('Successfully sent message to user:', response);
                    return response;
                }
             } catch (error) {
                 console.log('Error sending message to user:', error);
             }
        }

        return null;
    });

exports.subscribeToTopic = functions.firestore
    .document('users/{userId}')
    .onWrite(async (change, context) => {
        const newData = change.after.exists ? change.after.data() : null;
        const oldData = change.before.exists ? change.before.data() : null;

        // Se não houver novo token, não faz nada
        if (!newData || !newData.fcmToken) return null;

        // Se o token for o mesmo, não faz nada
        if (oldData && oldData.fcmToken === newData.fcmToken) return null;

        // Inscreve o novo token no tópico 'all'
        try {
            const response = await admin.messaging().subscribeToTopic(newData.fcmToken, 'all');
            console.log('Successfully subscribed to topic:', response);
            return response;
        } catch (error) {
            console.log('Error subscribing to topic:', error);
            return null;
        }
    });
