/**
 * MQTT Web Client for ESP32 Smart Clock with Multi-Device Support
 * COMPATIBLE WITH HTML FILE - Solution 2
 */
class MQTTClient {
    constructor(config = {}) {
        // Default configuration with Device ID support
        this.config = {
            MQTT: {
                BROKER: 'wss://broker.emqx.io:8084/mqtt',
                TOPIC_PREFIX: 'smartclock/',
                TOPICS: {
                    COMMAND: 'smartclock/{device_id}/command',
                    STATUS: 'smartclock/{device_id}/status',
                    ALARM: 'smartclock/{device_id}/alarm',
                    SENSORS: 'smartclock/{device_id}/sensors',
                    AUTH: 'smartclock/{device_id}/auth',
                    TEST: 'smartclock/{device_id}/test'
                },
                OPTIONS: {
                    clean: true,
                    connectTimeout: 4000,
                    reconnectPeriod: 2000,
                    clientId: 'web_' + Math.random().toString(36).substr(2, 9),
                    keepalive: 60,
                    resubscribe: true
                }
            },
            DEVICE_ID: null,
            AUTH_TOKEN: null,
            ...config
        };
        
        this.client = null;
        this.connected = false;
        this.reconnecting = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 10;
        
        // Device management
        this.currentDeviceId = this.config.DEVICE_ID;
        this.availableDevices = new Map();
        
        // Authentication
        this.authToken = null;
        this.tokenExpiry = null;
        this.authRequired = true;
        
        // Message handling
        this.subscriptions = new Map();
        this.messageHandlers = new Map();
        this.globalHandlers = [];
        
        // Event callbacks
        this.eventCallbacks = {
            connect: [],
            disconnect: [],
            error: [],
            message: [],
            reconnect: [],
            max_reconnect_attempts: [],
            offline: [],
            publish: [],
            device_connected: [],
            device_disconnected: [],
            auth_success: [],
            auth_failed: [],
            device_switched: []
        };
        
        // Statistics
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            connectionStart: null,
            lastMessageTime: null,
            connectionAttempts: 0,
            errors: 0,
            reconnects: 0,
            bytesSent: 0,
            bytesReceived: 0,
            devicesConnected: 0
        };
        
        // Auto-reconnect
        this.autoReconnect = true;
        this.reconnectDelay = 2000;
        this.reconnectTimer = null;
        this.reconnectBackoffFactor = 1.5;
        
        // Message queue
        this.messageQueue = [];
        this.maxQueueSize = 50;
        this.processQueueOnReconnect = true;
        
        // Connection health check
        this.healthCheckInterval = null;
        this.healthCheckTime = 30000;
        this.lastActivity = null;
        
        console.log('🔧 MQTT Client initialized');
    }
    
    // ==================== CORE METHODS ====================
    
    setDeviceId(deviceId) {
        if (!deviceId || deviceId.trim() === '') {
            console.error('❌ Invalid Device ID');
            return false;
        }
        
        const oldDeviceId = this.currentDeviceId;
        this.currentDeviceId = deviceId.trim();
        
        console.log(`🔄 Switching to device: ${this.currentDeviceId}`);
        
        if (this.connected && oldDeviceId) {
            this._unsubscribeDeviceTopics(oldDeviceId).catch(console.error);
        }
        
        this._updateTopicsForDevice();
        
        if (this.connected) {
            setTimeout(() => {
                this._subscribeDeviceTopics().catch(console.error);
            }, 500);
        }
        
        this._loadAuthToken();
        
        this._triggerEvent('device_switched', {
            oldDeviceId,
            newDeviceId: this.currentDeviceId,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    _updateTopicsForDevice() {
        if (!this.currentDeviceId) return;
        
        const deviceKey = this.currentDeviceId.toLowerCase()
            .replace(/[^a-z0-9]/g, '_');
        
        this.config.MQTT.TOPICS = {
            COMMAND: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/command`,
            STATUS: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/status`,
            ALARM: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/alarm`,
            SENSORS: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/sensors`,
            AUTH: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/auth`,
            AUTH_RESPONSE: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/auth/response/{clientId}`,
            TEST: `${this.config.MQTT.TOPIC_PREFIX}${deviceKey}/test`
        };
    }
    
    connect(options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.currentDeviceId) {
                const error = new Error('Device ID not set');
                console.error(error.message);
                this._handleError(error);
                reject(error);
                return;
            }
            
            if (typeof mqtt === 'undefined') {
                const error = new Error('MQTT.js library not loaded');
                console.error(error.message);
                this._handleError(error);
                reject(error);
                return;
            }
            
            if (this.client) {
                console.log('Cleaning up existing connection...');
                this.disconnect();
            }
            
            this._updateTopicsForDevice();
            
            const connectOptions = {
                ...this.config.MQTT.OPTIONS,
                ...options,
                clientId: `web_${this.currentDeviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
                will: {
                    topic: this.config.MQTT.TOPICS.STATUS,
                    payload: JSON.stringify({ 
                        status: 'offline',
                        deviceId: this.currentDeviceId,
                        timestamp: Date.now() 
                    }),
                    qos: 1,
                    retain: true
                }
            };
            
            const brokerUrl = options.broker || this.config.MQTT.BROKER;
            
            console.log(`🔗 Connecting to MQTT broker for device ${this.currentDeviceId}`);
            
            this.stats.connectionAttempts++;
            this.connectionAttempts++;
            
            try {
                this.client = mqtt.connect(brokerUrl, connectOptions);
                
                if (!this.client) {
                    const error = new Error('Failed to create MQTT client');
                    this._handleError(error);
                    reject(error);
                    return;
                }
                
                this._setupEventHandlers();
                
                const timeout = setTimeout(() => {
                    if (!this.connected) {
                        const error = new Error(`Connection timeout after 10s`);
                        this._handleError(error);
                        if (this.client) this.client.end();
                        reject(error);
                    }
                }, 10000);
                
                this.client.once('connect', () => {
                    clearTimeout(timeout);
                    
                    this.connected = true;
                    this.reconnecting = false;
                    this.connectionAttempts = 0;
                    this.stats.connectionStart = Date.now();
                    this.lastActivity = Date.now();
                    
                    console.log(`✅ MQTT Connected to device ${this.currentDeviceId}`);
                    
                    this._startHealthCheck();
                    this._subscribeDeviceTopics();
                    
                    if (this.processQueueOnReconnect && this.messageQueue.length > 0) {
                        console.log(`Processing ${this.messageQueue.length} queued messages...`);
                        this._processMessageQueue();
                    }
                    
                    this._publishDeviceStatus('online').catch(console.error);
                    
                    this._triggerEvent('connect', { 
                        deviceId: this.currentDeviceId,
                        timestamp: Date.now()
                    });
                    
                    resolve(true);
                });
                
                this.client.once('error', (error) => {
                    clearTimeout(timeout);
                    this._handleError(error);
                    reject(error);
                });
                
            } catch (error) {
                clearTimeout(timeout);
                this._handleError(error);
                reject(error);
            }
        });
    }
    
    async _publishDeviceStatus(status) {
        return this.publish(this.config.MQTT.TOPICS.STATUS, {
            status: status,
            deviceId: this.currentDeviceId,
            timestamp: Date.now()
        }, { qos: 1, retain: true });
    }
    
    async _subscribeDeviceTopics() {
        if (!this.connected || !this.client) return;
        
        const topics = [
            { topic: this.config.MQTT.TOPICS.STATUS, options: { qos: 1 } },
            { topic: this.config.MQTT.TOPICS.ALARM, options: { qos: 1 } },
            { topic: this.config.MQTT.TOPICS.SENSORS, options: { qos: 1 } }
        ];
        
        console.log(`📡 Subscribing to device topics for ${this.currentDeviceId}...`);
        
        const promises = topics.map(({ topic, options }) => {
            return new Promise((resolve, reject) => {
                this.client.subscribe(topic, options, (err) => {
                    if (err) {
                        console.error(`❌ Failed to subscribe to ${topic}:`, err);
                        reject(err);
                    } else {
                        console.log(`✅ Subscribed to: ${topic}`);
                        this.subscriptions.set(topic, {
                            subscribedAt: Date.now(),
                            deviceId: this.currentDeviceId
                        });
                        resolve(true);
                    }
                });
            });
        });
        
        try {
            await Promise.all(promises);
            console.log(`✅ All device topics subscribed for ${this.currentDeviceId}`);
        } catch (error) {
            console.error('Error subscribing to device topics:', error);
        }
    }
    
    _setupEventHandlers() {
        if (!this.client) return;
        
        this.client.on('message', (topic, message, packet) => {
            this.lastActivity = Date.now();
            this._handleIncomingMessage(topic, message, packet);
        });
        
        this.client.on('error', (error) => {
            this._handleError(error);
        });
        
        this.client.on('close', () => {
            console.log('🔌 MQTT Connection closed');
            this.connected = false;
            this._stopHealthCheck();
            
            this._publishDeviceStatus('offline').catch(() => {});
            
            this._triggerEvent('disconnect', { 
                deviceId: this.currentDeviceId,
                timestamp: Date.now(),
                reconnecting: this.reconnecting 
            });
            
            if (this.autoReconnect && !this.reconnecting) {
                this._scheduleReconnect();
            }
        });
        
        this.client.on('reconnect', () => {
            console.log('🔄 MQTT Reconnecting...');
            this.reconnecting = true;
            this.stats.reconnects++;
            this._triggerEvent('reconnect', {
                deviceId: this.currentDeviceId,
                attempt: this.connectionAttempts,
                timestamp: Date.now()
            });
        });
        
        this.client.on('offline', () => {
            console.log('📴 MQTT Offline');
            this.connected = false;
            this._triggerEvent('offline', { 
                deviceId: this.currentDeviceId,
                timestamp: Date.now() 
            });
        });
        
        this.client.on('end', () => {
            console.log('🛑 MQTT Connection ended');
            this.connected = false;
            this.client = null;
            this._stopHealthCheck();
        });
    }
    
    _handleIncomingMessage(topic, message, packet) {
        try {
            this.stats.messagesReceived++;
            this.stats.lastMessageTime = Date.now();
            this.stats.bytesReceived += message.length;
            
            let data;
            let isJSON = false;
            
            try {
                data = JSON.parse(message.toString());
                isJSON = true;
            } catch {
                data = message.toString();
            }
            
            if (topic.includes('/auth/response/')) {
                this._handleAuthResponse(topic, data);
                return;
            }
            
            this._processMessage(topic, data, packet, isJSON);
            
        } catch (error) {
            console.error('❌ Error handling message:', error);
            this.stats.errors++;
        }
    }
    
    _handleAuthResponse(topic, data) {
        console.log('🔐 Authentication response:', data);
        
        if (data.success && data.token) {
            const expiry = Date.now() + (data.expiry || 3600000);
            this._saveAuthToken(data.token, expiry);
            
            this._triggerEvent('auth_success', {
                deviceId: this.currentDeviceId,
                token: data.token,
                expiry: expiry,
                timestamp: Date.now()
            });
            
            console.log(`✅ Authentication successful for ${this.currentDeviceId}`);
        } else {
            this._clearAuthToken();
            
            this._triggerEvent('auth_failed', {
                deviceId: this.currentDeviceId,
                message: data.message || 'Authentication failed',
                timestamp: Date.now()
            });
            
            console.error(`❌ Authentication failed for ${this.currentDeviceId}`);
        }
    }
    
    _processMessage(topic, data, packet, isJSON = false) {
        const messageInfo = {
            topic,
            data,
            packet,
            isJSON,
            timestamp: Date.now(),
            deviceId: this.currentDeviceId
        };
        
        const handlers = this.messageHandlers.get(topic) || [];
        handlers.forEach(handler => {
            try {
                if (typeof handler === 'function') {
                    handler(data, topic, messageInfo);
                }
            } catch (error) {
                console.error(`Error in topic handler:`, error);
            }
        });
        
        this.globalHandlers.forEach(handler => {
            try {
                if (typeof handler === 'function') {
                    handler(data, topic, messageInfo);
                }
            } catch (error) {
                console.error('Error in global handler:', error);
            }
        });
        
        this._triggerEvent('message', messageInfo);
        
        this._dispatchMessageEvent(topic, data, isJSON);
    }
    
    _dispatchMessageEvent(topic, data, isJSON = false) {
        if (typeof window !== 'undefined') {
            try {
                const event = new CustomEvent('mqtt-message', {
                    detail: {
                        topic,
                        data,
                        isJSON,
                        deviceId: this.currentDeviceId,
                        timestamp: Date.now()
                    }
                });
                
                window.dispatchEvent(event);
                
            } catch (error) {
                console.error('Error dispatching DOM event:', error);
            }
        }
    }
    
    authenticate(password) {
        return new Promise((resolve, reject) => {
            if (!this.currentDeviceId) {
                reject(new Error('Device ID not set'));
                return;
            }
            
            if (!password || password.trim() === '') {
                reject(new Error('Password is required'));
                return;
            }
            
            if (!this.client || !this.connected) {
                reject(new Error('MQTT not connected'));
                return;
            }
            
            const authClientId = 'auth_' + Math.random().toString(36).substr(2, 8);
            const responseTopic = this.config.MQTT.TOPICS.AUTH_RESPONSE.replace('{clientId}', authClientId);
            
            this.client.subscribe(responseTopic, { qos: 1 }, (err) => {
                if (err) {
                    console.error('Failed to subscribe to auth response:', err);
                    reject(err);
                    return;
                }
                
                const timeout = setTimeout(() => {
                    this.client.unsubscribe(responseTopic, () => {});
                    reject(new Error('Authentication timeout'));
                }, 10000);
                
                const messageHandler = (t, msg) => {
                    if (t === responseTopic) {
                        clearTimeout(timeout);
                        this.client.unsubscribe(responseTopic, () => {});
                        this.client.removeListener('message', messageHandler);
                        
                        try {
                            const data = JSON.parse(msg.toString());
                            if (data.success) {
                                resolve(true);
                            } else {
                                reject(new Error(data.message || 'Authentication failed'));
                            }
                        } catch (error) {
                            reject(new Error('Invalid auth response'));
                        }
                    }
                };
                
                this.client.on('message', messageHandler);
                
                const authRequest = {
                    type: 'auth_request',
                    deviceId: this.currentDeviceId,
                    password: password,
                    clientId: authClientId,
                    timestamp: Date.now()
                };
                
                this.client.publish(this.config.MQTT.TOPICS.AUTH, JSON.stringify(authRequest), { qos: 1 }, (err) => {
                    if (err) {
                        clearTimeout(timeout);
                        this.client.unsubscribe(responseTopic, () => {});
                        this.client.removeListener('message', messageHandler);
                        reject(err);
                    } else {
                        console.log(`🔐 Authentication request sent to ${this.currentDeviceId}`);
                    }
                });
            });
        });
    }
    
    sendCommand(command, data = {}, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.currentDeviceId) {
                reject(new Error('Device ID not set'));
                return;
            }
            
            if (!this.client || !this.connected) {
                reject(new Error('MQTT not connected'));
                return;
            }
            
            if (this.authRequired && !this._isTokenValid()) {
                reject(new Error('Authentication required'));
                return;
            }
            
            const topic = this.config.MQTT.TOPICS.COMMAND;
            const message = {
                command,
                data,
                auth: this.authRequired ? {
                    token: this.authToken,
                    deviceId: this.currentDeviceId
                } : undefined,
                timestamp: Date.now()
            };
            
            const publishOptions = {
                qos: 1,
                retain: false,
                ...options
            };
            
            this.client.publish(topic, JSON.stringify(message), publishOptions, (err) => {
                if (err) {
                    console.error(`❌ Failed to send command:`, err);
                    reject(err);
                    return;
                }
                
                this.stats.messagesSent++;
                this.stats.bytesSent += JSON.stringify(message).length;
                this.lastActivity = Date.now();
                
                console.log(`📤 Command sent: ${command}`, data);
                
                resolve(true);
            });
        });
    }
    
    setAlarm(hour, minute, sound = 0, enabled = true, label = 'Alarm') {
        return this.sendCommand('setAlarm', {
            hour,
            minute,
            sound,
            enable: enabled ? 1 : 0,
            label
        }, { qos: 1, retain: true });
    }
    
    pressButton(button) {
        if (button < 1 || button > 3) {
            return Promise.reject(new Error('Button number must be 1, 2, or 3'));
        }
        return this.sendCommand('button', { btn: button });
    }
    
    snoozeAlarm() {
        return this.sendCommand('snooze', {});
    }
    
    resetDevice() {
        return this.sendCommand('reset', {});
    }
    
    requestStatus() {
        return this.sendCommand('get_status', {});
    }
    
    setBrightness(brightness) {
        return this.sendCommand('set_brightness', { brightness }, { qos: 1 });
    }
    
    publish(topic, message, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected && this.processQueueOnReconnect) {
                this._queueMessage(topic, message, options);
                resolve(true);
                return;
            }
            
            if (!this.client || !this.connected) {
                reject(new Error('MQTT not connected'));
                return;
            }
            
            try {
                let payload;
                let isJSON = false;
                
                if (typeof message === 'object' && message !== null) {
                    payload = JSON.stringify(message);
                    isJSON = true;
                } else {
                    payload = String(message);
                }
                
                const publishOptions = {
                    qos: 0,
                    retain: false,
                    ...options
                };
                
                this.client.publish(topic, payload, publishOptions, (err) => {
                    if (err) {
                        console.error(`❌ Failed to publish:`, err);
                        reject(err);
                        return;
                    }
                    
                    this.stats.messagesSent++;
                    this.stats.bytesSent += payload.length;
                    this.lastActivity = Date.now();
                    
                    console.log(`📤 Published to ${topic}`);
                    
                    resolve(true);
                });
                
            } catch (error) {
                console.error('❌ Error publishing:', error);
                reject(error);
            }
        });
    }
    
    disconnect() {
        if (this.client) {
            console.log('🔌 Disconnecting MQTT client...');
            
            if (this.connected && this.currentDeviceId) {
                this._publishDeviceStatus('offline').catch(() => {});
            }
            
            this._stopHealthCheck();
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            this.client.end(true, () => {
                console.log('✅ MQTT client disconnected');
            });
            
            this.client = null;
            this.connected = false;
            this.reconnecting = false;
            
            this._triggerEvent('disconnect', { 
                deviceId: this.currentDeviceId,
                timestamp: Date.now()
            });
            
        } else {
            console.log('⚠️  No active MQTT connection');
        }
    }
    
    isConnected() {
        return this.connected && this.client && this.client.connected === true;
    }
    
    getStatus() {
        const uptime = this.getUptime();
        
        return {
            connected: this.connected,
            currentDeviceId: this.currentDeviceId,
            authenticated: this._isTokenValid(),
            stats: {
                ...this.stats,
                queueSize: this.messageQueue.length
            },
            uptime
        };
    }
    
    getCurrentDevice() {
        return {
            id: this.currentDeviceId,
            hasToken: this._isTokenValid(),
            tokenExpiry: this.tokenExpiry,
            connected: this.connected
        };
    }
    
    logout() {
        if (!this.currentDeviceId) return;
        
        console.log(`🚪 Logging out from device ${this.currentDeviceId}`);
        this._clearAuthToken();
        this.disconnect();
    }
    
    // ==================== HELPER METHODS ====================
    
    _loadAuthToken() {
        if (!this.currentDeviceId) return;
        
        try {
            const authTokens = JSON.parse(localStorage.getItem('smartclock_auth_tokens') || '{}');
            const sessionExpiries = JSON.parse(localStorage.getItem('smartclock_session_expiries') || '{}');
            
            this.authToken = authTokens[this.currentDeviceId];
            this.tokenExpiry = sessionExpiries[this.currentDeviceId];
            
            if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                console.log(`🔑 Loaded valid token for ${this.currentDeviceId}`);
            } else {
                this.authToken = null;
                this.tokenExpiry = null;
            }
        } catch (error) {
            console.error('Error loading auth token:', error);
            this.authToken = null;
            this.tokenExpiry = null;
        }
    }
    
    _saveAuthToken(token, expiry) {
        if (!this.currentDeviceId || !token) return;
        
        try {
            const authTokens = JSON.parse(localStorage.getItem('smartclock_auth_tokens') || '{}');
            const sessionExpiries = JSON.parse(localStorage.getItem('smartclock_session_expiries') || '{}');
            
            authTokens[this.currentDeviceId] = token;
            sessionExpiries[this.currentDeviceId] = expiry;
            
            localStorage.setItem('smartclock_auth_tokens', JSON.stringify(authTokens));
            localStorage.setItem('smartclock_session_expiries', JSON.stringify(sessionExpiries));
            localStorage.setItem('smartclock_last_device_id', this.currentDeviceId);
            
            this.authToken = token;
            this.tokenExpiry = expiry;
            
            console.log(`💾 Saved token for ${this.currentDeviceId}`);
            
        } catch (error) {
            console.error('Error saving auth token:', error);
        }
    }
    
    _clearAuthToken() {
        if (!this.currentDeviceId) return;
        
        try {
            const authTokens = JSON.parse(localStorage.getItem('smartclock_auth_tokens') || '{}');
            const sessionExpiries = JSON.parse(localStorage.getItem('smartclock_session_expiries') || '{}');
            
            delete authTokens[this.currentDeviceId];
            delete sessionExpiries[this.currentDeviceId];
            
            localStorage.setItem('smartclock_auth_tokens', JSON.stringify(authTokens));
            localStorage.setItem('smartclock_session_expiries', JSON.stringify(sessionExpiries));
            
            this.authToken = null;
            this.tokenExpiry = null;
            
            console.log(`🧹 Cleared token for ${this.currentDeviceId}`);
            
        } catch (error) {
            console.error('Error clearing auth token:', error);
        }
    }
    
    _isTokenValid() {
        if (!this.authToken || !this.tokenExpiry) return false;
        if (Date.now() >= this.tokenExpiry) {
            console.log('Token expired');
            this._clearAuthToken();
            return false;
        }
        return true;
    }
    
    _handleError(error) {
        console.error('❌ MQTT Error:', error);
        this.stats.errors++;
        this._triggerEvent('error', error);
    }
    
    _scheduleReconnect() {
        if (this.reconnecting) return;
        
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error(`❌ Max reconnection attempts reached (${this.maxConnectionAttempts})`);
            this._triggerEvent('max_reconnect_attempts', {
                attempts: this.connectionAttempts,
                deviceId: this.currentDeviceId,
                timestamp: Date.now()
            });
            return;
        }
        
        console.log(`🔄 Scheduled reconnect in ${this.reconnectDelay}ms (attempt ${this.connectionAttempts + 1})`);
        
        this.reconnecting = true;
        this.reconnectTimer = setTimeout(() => {
            this.reconnecting = false;
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
                this._scheduleReconnect();
            });
        }, this.reconnectDelay);
        
        this.reconnectDelay *= this.reconnectBackoffFactor;
    }
    
    _startHealthCheck() {
        this._stopHealthCheck();
        
        this.healthCheckInterval = setInterval(() => {
            if (!this.connected || !this.client) {
                this._stopHealthCheck();
                return;
            }
            
            const now = Date.now();
            const timeSinceLastActivity = now - this.lastActivity;
            
            if (timeSinceLastActivity > this.healthCheckTime * 2) {
                console.warn('⚠️  No activity detected for long time, reconnecting...');
                this.client.reconnect();
            }
            
        }, this.healthCheckTime);
    }
    
    _stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    _queueMessage(topic, message, options) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            console.warn('⚠️  Message queue full, dropping oldest message');
            this.messageQueue.shift();
        }
        
        this.messageQueue.push({
            topic,
            message,
            options,
            timestamp: Date.now(),
            deviceId: this.currentDeviceId
        });
        
        console.log(`📥 Queued message for ${topic} (queue size: ${this.messageQueue.length})`);
    }
    
    _processMessageQueue() {
        if (!this.connected || !this.client || this.messageQueue.length === 0) return;
        
        console.log(`📤 Processing ${this.messageQueue.length} queued messages...`);
        
        const processNext = () => {
            if (this.messageQueue.length === 0) return;
            
            const queuedMsg = this.messageQueue.shift();
            
            this.publish(queuedMsg.topic, queuedMsg.message, queuedMsg.options)
                .then(() => {
                    console.log(`✅ Sent queued message to ${queuedMsg.topic}`);
                    setTimeout(processNext, 100);
                })
                .catch(error => {
                    console.error(`❌ Failed to send queued message:`, error);
                    this.messageQueue.unshift(queuedMsg);
                });
        };
        
        processNext();
    }
    
    on(event, callback) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event].push(callback);
        } else {
            console.warn(`Unknown event: ${event}`);
        }
        return this;
    }
    
    off(event, callback) {
        if (this.eventCallbacks[event]) {
            if (callback) {
                const index = this.eventCallbacks[event].indexOf(callback);
                if (index > -1) {
                    this.eventCallbacks[event].splice(index, 1);
                }
            } else {
                this.eventCallbacks[event] = [];
            }
        }
        return this;
    }
    
    _triggerEvent(event, data) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }
    
    addMessageHandler(topic, handler) {
        if (!this.messageHandlers.has(topic)) {
            this.messageHandlers.set(topic, []);
        }
        this.messageHandlers.get(topic).push(handler);
        return this;
    }
    
    removeMessageHandler(topic, handler) {
        if (this.messageHandlers.has(topic)) {
            const handlers = this.messageHandlers.get(topic);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        return this;
    }
    
    addGlobalHandler(handler) {
        this.globalHandlers.push(handler);
        return this;
    }
    
    removeGlobalHandler(handler) {
        const index = this.globalHandlers.indexOf(handler);
        if (index > -1) {
            this.globalHandlers.splice(index, 1);
        }
        return this;
    }
    
    getUptime() {
        if (!this.stats.connectionStart) return 0;
        return Date.now() - this.stats.connectionStart;
    }
    
    _formatUptime(uptime) {
        const seconds = Math.floor(uptime / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    destroy() {
        console.log('🧹 Destroying MQTT client...');
        
        this.disconnect();
        
        this.eventCallbacks = {};
        this.messageHandlers.clear();
        this.globalHandlers = [];
        this.subscriptions.clear();
        this.availableDevices.clear();
        this.messageQueue = [];
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this._stopHealthCheck();
        
        console.log('✅ MQTT client destroyed');
    }
}

// ==================== GLOBAL COMPATIBILITY FUNCTIONS ====================

// Global singleton instance
let globalMQTTInstance = null;

function getGlobalMQTT() {
    if (!globalMQTTInstance) {
        globalMQTTInstance = new MQTTClient();
        console.log('🌐 Global MQTT instance created');
    }
    return globalMQTTInstance;
}

// GLOBAL FUNCTIONS FOR HTML COMPATIBILITY
window.connectMQTT = function() {
    const mqtt = getGlobalMQTT();
    
    // Get current device ID from HTML input
    const deviceIdInput = document.getElementById('deviceId');
    if (deviceIdInput && deviceIdInput.value) {
        mqtt.setDeviceId(deviceIdInput.value.trim());
    } else if (window.currentDeviceId) {
        mqtt.setDeviceId(window.currentDeviceId);
    } else {
        console.error('No Device ID available');
        showToast('Vui lòng nhập Device ID', 'error');
        return;
    }
    
    mqtt.connect()
        .then(() => {
            console.log('✅ Global: MQTT Connected');
            window.dispatchEvent(new CustomEvent('mqtt-connected'));
        })
        .catch(error => {
            console.error('❌ Global: Connection failed:', error);
            showToast('Kết nối MQTT thất bại: ' + error.message, 'error');
        });
};

window.disconnectMQTT = function() {
    const mqtt = getGlobalMQTT();
    mqtt.disconnect();
    console.log('🔌 Global: MQTT Disconnected');
    window.dispatchEvent(new CustomEvent('mqtt-disconnected'));
};

window.sendMQTTCommand = function(command, data = {}) {
    const mqtt = getGlobalMQTT();
    
    if (!mqtt.isConnected()) {
        console.warn('Global: MQTT not connected, cannot send command');
        showToast('❌ Chưa kết nối MQTT!', 'error');
        return false;
    }
    
    return mqtt.sendCommand(command, data)
        .then(() => {
            console.log(`📤 Global: Command sent: ${command}`, data);
            return true;
        })
        .catch(error => {
            console.error('❌ Global: Command failed:', error);
            showToast('❌ Gửi lệnh thất bại: ' + error.message, 'error');
            return false;
        });
};

window.setAlarmMQTT = function(enable) {
    const hour = parseInt(document.getElementById('alarmHour')?.value || 7);
    const minute = parseInt(document.getElementById('alarmMinute')?.value || 30);
    const sound = parseInt(document.getElementById('alarmSound')?.value || 0);
    
    const mqtt = getGlobalMQTT();
    
    return mqtt.setAlarm(hour, minute, sound, enable, 'Alarm')
        .then(() => {
            const action = enable ? 'bật' : 'tắt';
            showToast(`✅ Đã ${action} báo thức!`, 'success');
            return true;
        })
        .catch(error => {
            showToast('❌ Lỗi đặt báo thức: ' + error.message, 'error');
            return false;
        });
};

window.sendButtonMQTT = function(buttonNumber) {
    const mqtt = getGlobalMQTT();
    
    return mqtt.pressButton(buttonNumber)
        .then(() => {
            const buttonNames = {1: 'Chọn', 2: 'Tăng', 3: 'Giảm'};
            showToast(`🎮 Đã nhấn nút ${buttonNumber} (${buttonNames[buttonNumber] || 'Unknown'})`, 'success');
            return true;
        })
        .catch(error => {
            showToast('❌ Lỗi nhấn nút: ' + error.message, 'error');
            return false;
        });
};

window.snoozeAlarmMQTT = function() {
    const mqtt = getGlobalMQTT();
    
    return mqtt.snoozeAlarm()
        .then(() => {
            showToast('⏸️ Đã tạm dừng báo thức', 'info');
            return true;
        })
        .catch(error => {
            showToast('❌ Lỗi tạm dừng: ' + error.message, 'error');
            return false;
        });
};

window.resetESP32MQTT = function() {
    const mqtt = getGlobalMQTT();
    
    if (confirm('Bạn có chắc muốn khởi động lại ESP32?')) {
        return mqtt.resetDevice()
            .then(() => {
                showToast('🔄 Đang khởi động lại ESP32...', 'info');
                return true;
            })
            .catch(error => {
                showToast('❌ Lỗi khởi động lại: ' + error.message, 'error');
                return false;
            });
    }
    return Promise.resolve(false);
};

window.requestStatusUpdate = function() {
    const mqtt = getGlobalMQTT();
    
    return mqtt.requestStatus()
        .then(() => {
            showToast('📊 Đang yêu cầu cập nhật trạng thái...', 'info');
            return true;
        })
        .catch(error => {
            showToast('❌ Lỗi yêu cầu trạng thái: ' + error.message, 'error');
            return false;
        });
};

window.testMQTT = function() {
    const mqtt = getGlobalMQTT();
    
    if (!mqtt.isConnected()) {
        showToast('❌ Chưa kết nối MQTT!', 'error');
        return;
    }
    
    const testMessage = {
        type: 'test',
        from: 'web_client',
        timestamp: Date.now(),
        deviceId: mqtt.currentDeviceId,
        message: 'Test connection from web client'
    };
    
    const testTopic = mqtt.config.MQTT.TOPICS.TEST;
    
    mqtt.publish(testTopic, testMessage, { qos: 1 })
        .then(() => {
            showToast('📡 Đã gửi tin nhắn test!', 'success');
        })
        .catch(error => {
            showToast('❌ Lỗi test: ' + error.message, 'error');
        });
};

// Authentication function for HTML
window.authenticateDevice = function(password) {
    return new Promise((resolve, reject) => {
        const deviceId = document.getElementById('deviceId')?.value || window.currentDeviceId;
        
        if (!deviceId) {
            reject(new Error('No Device ID'));
            return;
        }
        
        const mqtt = getGlobalMQTT();
        mqtt.setDeviceId(deviceId);
        
        // First connect, then authenticate
        mqtt.connect()
            .then(() => {
                return mqtt.authenticate(password);
            })
            .then(() => {
                // Success
                resolve({
                    success: true,
                    deviceId: deviceId
                });
            })
            .catch(error => {
                reject(error);
            });
    });
};

// Update checkCredentials function in HTML
window.updateCheckCredentials = function() {
    const deviceIdInput = document.getElementById('deviceId');
    const passwordInput = document.getElementById('password');
    
    if (!deviceIdInput || !passwordInput) {
        console.error('Input elements not found');
        return;
    }
    
    const deviceId = deviceIdInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!deviceId || !password) {
        showToast('Vui lòng nhập Device ID và mật khẩu', 'error');
        return;
    }
    
    showLoading(true);
    
    window.authenticateDevice(password)
        .then(result => {
            window.currentDeviceId = deviceId;
            
            // Save to localStorage
            if (typeof saveDeviceSession === 'function') {
                const token = 'token_' + Date.now();
                const expiry = Date.now() + 3600000;
                saveDeviceSession(deviceId, token, expiry);
            }
            
            // Show main interface
            if (typeof showMainInterface === 'function') {
                showMainInterface();
            }
            
            showToast(`✅ Đã kết nối với ${deviceId}`, 'success');
        })
        .catch(error => {
            showToast('Xác thực thất bại: ' + error.message, 'error');
            if (passwordInput) passwordInput.value = '';
        })
        .finally(() => {
            showLoading(false);
        });
};

// Setup MQTT message handling for HTML
window.setupMQTTMessageHandlers = function() {
    const mqtt = getGlobalMQTT();
    
    // Handle status messages
    mqtt.addMessageHandler(mqtt.config.MQTT.TOPICS.STATUS, (data, topic) => {
        console.log('📡 Status update:', data);
        window.dispatchEvent(new CustomEvent('device-status', { detail: data }));
    });
    
    // Handle alarm messages
    mqtt.addMessageHandler(mqtt.config.MQTT.TOPICS.ALARM, (data, topic) => {
        console.log('⏰ Alarm update:', data);
        window.dispatchEvent(new CustomEvent('device-alarm', { detail: data }));
    });
    
    // Handle sensor messages
    mqtt.addMessageHandler(mqtt.config.MQTT.TOPICS.SENSORS, (data, topic) => {
        console.log('🌡️ Sensor update:', data);
        window.dispatchEvent(new CustomEvent('device-sensors', { detail: data }));
    });
    
    // Global message handler
    mqtt.on('message', (message) => {
        if (typeof handleMQTTMessage === 'function') {
            handleMQTTMessage(message.topic, message.data);
        }
    });
    
    console.log('✅ MQTT message handlers setup');
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing MQTT Client for HTML compatibility');
    
    // Setup message handlers
    setTimeout(() => {
        window.setupMQTTMessageHandlers();
    }, 1000);
    
    // Try to restore last device
    const lastDeviceId = localStorage.getItem('smartclock_last_device_id');
    if (lastDeviceId) {
        console.log(`📱 Restoring last device: ${lastDeviceId}`);
        window.currentDeviceId = lastDeviceId;
        
        // Update input if exists
        const deviceIdInput = document.getElementById('deviceId');
        if (deviceIdInput) {
            deviceIdInput.value = lastDeviceId;
        }
    }
});

// Export for browser
if (typeof window !== 'undefined') {
    window.MQTTClient = MQTTClient;
    window.getGlobalMQTT = getGlobalMQTT;
    window.mqttClient = getGlobalMQTT(); // Backward compatibility
    
    // Replace old checkCredentials if exists
    if (typeof checkCredentials !== 'undefined') {
        window.originalCheckCredentials = checkCredentials;
        window.checkCredentials = window.updateCheckCredentials;
        console.log('✅ Replaced checkCredentials with MQTT version');
    }
}

// Export for Node.js/ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MQTTClient,
        getGlobalMQTT
    };
}

console.log('✅ MQTT Client with HTML compatibility loaded');
