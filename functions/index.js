// Cloud Functions de 2ª geração (a 1ª geração exige uma conta de serviço que este projeto não tem)
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
admin.initializeApp();

// Mesma região do banco Firestore (nam5 = Estados Unidos)
setGlobalOptions({ region: 'us-central1' });

// Erros que indicam token inválido (app desinstalado, permissão revogada etc.)
const INVALID_TOKEN_ERRORS = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument'
];

// Monta a mensagem com as opções de cada plataforma (navegador, Android e iPhone)
const buildMessage = (title, body, notificationId) => ({
    notification: { title, body },
    data: { notificationId },
    android: {
        priority: 'high',
        notification: { sound: 'default' }
    },
    apns: {
        payload: { aps: { sound: 'default' } }
    },
    webpush: {
        notification: { icon: '/icon-192.png' },
        fcmOptions: { link: '/' }
    }
});

exports.sendNotificationOnCreate = onDocumentCreated('notifications/{notificationId}', async (event) => {
        const newValue = event.data.data();
        const title = newValue.title || 'Prefeitura de Riachão';
        const body = newValue.message || 'Você tem uma nova notificação.';
        const message = buildMessage(title, body, event.params.notificationId);

        // Aviso geral: envia para o tópico 'all' (todos os aparelhos inscritos)
        if (newValue.userId === 'all') {
            try {
                const response = await admin.messaging().send({ ...message, topic: 'all' });
                console.log('Successfully sent message:', response);
                return response;
            } catch (error) {
                console.error('Error sending message:', error);
                return null;
            }
        }

        // Aviso para um usuário específico: usa o token salvo no perfil dele
        if (!newValue.userId) return null;
        const userRef = admin.firestore().collection('users').doc(newValue.userId);
        const userDoc = await userRef.get();
        const token = userDoc.exists ? userDoc.data().fcmToken : null;
        if (!token) return null;

        try {
            const response = await admin.messaging().send({ ...message, token });
            console.log('Successfully sent message to user:', response);
            return response;
        } catch (error) {
            console.error('Error sending message to user:', error);
            // Token inválido: remove para não tentar de novo
            if (INVALID_TOKEN_ERRORS.includes(error.code)) {
                await userRef.update({ fcmToken: admin.firestore.FieldValue.delete() });
            }
            return null;
        }
    });

exports.subscribeToTopic = onDocumentWritten('users/{userId}', async (event) => {
        const { before, after } = event.data;
        const newToken = after.exists ? after.data().fcmToken : null;
        const oldToken = before.exists ? before.data().fcmToken : null;

        // Se o token não mudou, não faz nada
        if (newToken === oldToken) return null;

        try {
            // Aparelho antigo deixa de receber os avisos gerais
            if (oldToken) await admin.messaging().unsubscribeFromTopic(oldToken, 'all');
            // Inscreve o novo token no tópico 'all'
            if (newToken) {
                const response = await admin.messaging().subscribeToTopic(newToken, 'all');
                console.log('Successfully subscribed to topic:', response);
                return response;
            }
        } catch (error) {
            console.error('Error updating topic subscription:', error);
        }
        return null;
    });
