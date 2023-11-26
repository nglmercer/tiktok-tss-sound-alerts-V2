/**
 * Wrapper for client-side TikTok connection over Socket.IO
 * With reconnect functionality.
 */
/**
 * Clase que representa una conexión a TikTokIO.
 * @class
 * @param {string} backendUrl - La URL del backend al que se conectará.
 */
class TikTokIOConnection {
    constructor(backendUrl) {
        this.socket = io(backendUrl, {
            reconnectionDelay: 1000, // Tiempo inicial de espera antes de la primera reconexión
            reconnectionDelayMax: 5000, // Tiempo máximo de espera entre reconexiones
            randomizationFactor: 0.5 // Factor de aleatoriedad para variar los tiempos de espera
        });
        this.uniqueId = null;
        this.options = null;

        
        this.socket.on('connect', () => {
            console.info("Socket connected!");
            
            // Reconnect to streamer if uniqueId already set
            if (this.uniqueId) {
                this.setUniqueId();
            }
        })
        this.socket.on('reconnect_attempt', () => {
            console.info("Attempting to reconnect...");
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.info(`Reconnected on attempt ${attemptNumber}`);
        });

        this.socket.on('disconnect', (reason) => {
            console.warn("Socket disconnected due to " + reason);
            if (reason === 'io server disconnect') {
                // El servidor cerró la conexión, puedes intentar reconectar manualmente
                this.socket.connect();
            }
        })
        this.socket.on('streamEnd', () => {
            console.warn("LIVE has ended!");
            this.uniqueId = null;
        })

        this.socket.on('tiktokDisconnected', (errMsg) => {
            console.warn(errMsg);
            if (errMsg && errMsg.includes('LIVE has ended')) {
                this.uniqueId = null;
            }
        });
    }

    connect(uniqueId, options) {
        this.uniqueId = uniqueId;
        this.options = options || {};

        this.setUniqueId();

        return new Promise((resolve, reject) => {
            this.socket.once('tiktokConnected', resolve);
            this.socket.once('tiktokDisconnected', reject);

            setTimeout(() => {
                reject('Connection Timeout');
            }, 60000)
        })
    }

    setUniqueId() {
        this.socket.emit('setUniqueId', this.uniqueId, this.options);
    }

    on(eventName, eventHandler) {
        this.socket.on(eventName, eventHandler);
    }
}