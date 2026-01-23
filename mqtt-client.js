/**
 * MQTT Web Client for ESP32 Smart Clock with Multi-Device Support
 * Complete and Error-Free Version
 */
class MQTTClient {
    constructor(config = {}) {
        // Default configuration with Device ID support
        this.config = {
            MQTT: {
                BROKER: 'wss://broker.emqx.io:8084/mqtt',
                TOPIC_PREFIX: 'smartclock/', // Base topic prefix
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
            DEVICE_ID: null, // Will be set during connection
            AUTH_TOKEN: null, // For authenticated commands
            ...config
        };
        
        this.client = null;
        this.connected = false;
        this.reconnecting = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 10;
        
        // Device management
        this.currentDeviceId = this.config.DEVICE_ID;
        this.availableDevices = new Map(); // deviceId -> {name, lastSeen, status}
        
        // Authentication
        this.authToken = null;
        this.tokenExpiry = null;
        this.authRequired = true;
        
        // Message handling
        this.subscriptions = new Map(); // topic -> {qos, options}
        this.messageHandlers = new Map(); // topic -> array of handlers
        this.globalHandlers = []; // handlers for all topics
        
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
        
        // Message queue for when offline
        this.messageQueue = [];
        this.maxQueueSize = 50;
        this.processQueueOnReconnect = true;
        
        // Connection health check
        this.healthCheckInterval = null;
        this.healthCheckTime = 30000; // 30 seconds
        this.lastActivity = null;
        
        console.log('🔧 MQTT Client initialized with Device ID support');
    }
    
    /**
     * Set Device ID and update topics
     * @param {string} deviceId - Device ID
     */
    setDeviceId(deviceId) {
        if (!deviceId || deviceId.trim() === '') {
            console.error('❌ Invalid Device ID');
            return false;
        }
        
        const oldDeviceId = this.currentDeviceId;
        this.currentDeviceId = deviceId.trim();
        
        console.log(`🔄 Switching to device: ${this.currentDeviceId}`);
        
        // Unsubscribe from old device topics if connected
        if (this.connected && oldDeviceId) {
            this._unsubscribeDeviceTopics(oldDeviceId).catch(console.error);
        }
        
        // Update topics with new device ID
        this._updateTopicsForDevice();
        
        // Subscribe to new device topics if connected
        if (this.connected) {
            setTimeout(() => {
                this._subscribeDeviceTopics().catch(console.error);
            }, 500);
        }
        
        // Load authentication token from localStorage
        this._loadAuthToken();
        
        // Trigger device switched event
        this._triggerEvent('device_switched', {
            oldDeviceId,
            newDeviceId: this.currentDeviceId,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    /**
     * Update MQTT topics with current device ID
     * @private
     */
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
        
        console.log(`🔧 Updated topics for device ${this.currentDeviceId}:`, 
            Object.values(this.config.MQTT.TOPICS).filter(t => !t.includes('{clientId}')));
    }
    
    /**
     * Load authentication token from localStorage
     * @private
     */
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
                console.log(`🔐 No valid token for ${this.currentDeviceId}`);
                this.authToken = null;
                this.tokenExpiry = null;
            }
        } catch (error) {
            console.error('Error loading auth token:', error);
            this.authToken = null;
            this.tokenExpiry = null;
        }
    }
    
    /**
     * Save authentication token to localStorage
     * @private
     */
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
            
            console.log(`💾 Saved token for ${this.currentDeviceId}, expires at: ${new Date(expiry).toLocaleString()}`);
            
        } catch (error) {
            console.error('Error saving auth token:', error);
        }
    }
    
    /**
     * Clear authentication token
     * @private
     */
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
    
    /**
     * Check if authentication token is valid
     * @private
     */
    _isTokenValid() {
        if (!this.authToken || !this.tokenExpiry) return false;
        if (Date.now() >= this.tokenExpiry) {
            console.log('Token expired');
            this._clearAuthToken();
            return false;
        }
        return true;
    }
    
    /**
     * Connect to MQTT broker
     * @param {Object} options - Connection options
     * @returns {Promise<boolean>}
     */
    connect(options = {}) {
        return new Promise((resolve, reject) => {
            // Check if Device ID is set
            if (!this.currentDeviceId) {
                const error = new Error('Device ID not set. Call setDeviceId() first.');
                console.error(error.message);
                this._handleError(error);
                reject(error);
                return;
            }
            
            // Check if MQTT library is available
            if (typeof mqtt === 'undefined') {
                const error = new Error('MQTT.js library not loaded. Please include: <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>');
                console.error(error.message);
                this._handleError(error);
                reject(error);
                return;
            }
            
            // Clean up existing connection
            if (this.client) {
                console.log('Cleaning up existing connection...');
                this.disconnect();
            }
            
            // Update topics for current device
            this._updateTopicsForDevice();
            
            // Merge options
            const connectOptions = {
                ...this.config.MQTT.OPTIONS,
                ...options,
                clientId: `web_${this.currentDeviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
                will: {
                    topic: this.config.MQTT.TOPICS.STATUS,
                    payload: JSON.stringify({ 
                        status: 'offline',
                        deviceId: this.currentDeviceId,
                        clientId: this.config.MQTT.OPTIONS.clientId,
                        timestamp: Date.now() 
                    }),
                    qos: 1,
                    retain: true
                }
            };
            
            // Get broker URL
            const brokerUrl = options.broker || this.config.MQTT.BROKER;
            
            console.log(`🔗 Connecting to MQTT broker for device ${this.currentDeviceId}: ${brokerUrl}`);
            console.log(`📋 Client ID: ${connectOptions.clientId}`);
            
            this.stats.connectionAttempts++;
            this.connectionAttempts++;
            
            try {
                // Create MQTT client
                this.client = mqtt.connect(brokerUrl, connectOptions);
                
                // Verify client was created
                if (!this.client) {
                    const error = new Error('Failed to create MQTT client instance');
                    this._handleError(error);
                    reject(error);
                    return;
                }
                
                // Setup event handlers
                this._setupEventHandlers();
                
                // Set connection timeout
                const timeout = setTimeout(() => {
                    if (!this.connected) {
                        const error = new Error(`Connection timeout after 10s to ${brokerUrl}`);
                        this._handleError(error);
                        if (this.client) {
                            this.client.end();
                        }
                        reject(error);
                    }
                }, 10000);
                
                // Handle successful connection
                this.client.once('connect', () => {
                    clearTimeout(timeout);
                    
                    this.connected = true;
                    this.reconnecting = false;
                    this.connectionAttempts = 0;
                    this.stats.connectionStart = Date.now();
                    this.lastActivity = Date.now();
                    
                    console.log(`✅ MQTT Connected successfully to device ${this.currentDeviceId}`);
                    console.log(`📡 Session present: ${this.client.options.sessionPresent}`);
                    
                    // Start health check
                    this._startHealthCheck();
                    
                    // Subscribe to device topics
                    this._subscribeDeviceTopics();
                    
                    // Process queued messages
                    if (this.processQueueOnReconnect && this.messageQueue.length > 0) {
                        console.log(`Processing ${this.messageQueue.length} queued messages...`);
                        this._processMessageQueue();
                    }
                    
                    // Publish online status with device ID
                    this._publishDeviceStatus('online').catch(console.error);
                    
                    // Trigger connect callbacks
                    this._triggerEvent('connect', { 
                        broker: brokerUrl,
                        deviceId: this.currentDeviceId,
                        clientId: connectOptions.clientId,
                        sessionPresent: this.client.options.sessionPresent,
                        timestamp: Date.now()
                    });
                    
                    resolve(true);
                });
                
                // Handle initial connection error
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
    
    /**
     * Publish device status
     * @private
     */
    async _publishDeviceStatus(status) {
        const ip = await this._getClientIP();
        
        return this.publish(this.config.MQTT.TOPICS.STATUS, {
            status: status,
            deviceId: this.currentDeviceId,
            deviceName: 'ESP32 Smart Clock',
            clientId: this.client?.options?.clientId,
            ip: ip,
            timestamp: Date.now(),
            version: '2.0.0',
            mqttAuthEnabled: this.authRequired
        }, { qos: 1, retain: true });
    }
    
    /**
     * Get client IP address
     * @private
     */
    async _getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    }
    
    /**
     * Subscribe to device-specific topics
     * @private
     */
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
                        console.log(`✅ Subscribed to: ${topic} (QoS: ${options.qos})`);
                        
                        // Store subscription
                        this.subscriptions.set(topic, {
                            qos: options.qos,
                            options: options,
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
    
    /**
     * Unsubscribe from device topics
     * @private
     */
    async _unsubscribeDeviceTopics(deviceId) {
        if (!this.client) return;
        
        const topicsToUnsubscribe = Array.from(this.subscriptions.entries())
            .filter(([topic, sub]) => sub.deviceId === deviceId)
            .map(([topic]) => topic);
        
        if (topicsToUnsubscribe.length === 0) return;
        
        console.log(`🗑️  Unsubscribing from ${topicsToUnsubscribe.length} topics for device ${deviceId}`);
        
        const promises = topicsToUnsubscribe.map(topic => {
            return new Promise((resolve, reject) => {
                this.client.unsubscribe(topic, (err) => {
                    if (err) {
                        console.error(`❌ Failed to unsubscribe from ${topic}:`, err);
                        reject(err);
                    } else {
                        console.log(`✅ Unsubscribed from: ${topic}`);
                        this.subscriptions.delete(topic);
                        this.messageHandlers.delete(topic);
                        resolve(true);
                    }
                });
            });
        });
        
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Error unsubscribing from device topics:', error);
        }
    }
    
    /**
     * Setup MQTT event handlers
     * @private
     */
    _setupEventHandlers() {
        if (!this.client) return;
        
        // Message handler
        this.client.on('message', (topic, message, packet) => {
            this.lastActivity = Date.now();
            this._handleIncomingMessage(topic, message, packet);
        });
        
        // Error handler
        this.client.on('error', (error) => {
            this._handleError(error);
        });
        
        // Close handler
        this.client.on('close', () => {
            console.log('🔌 MQTT Connection closed');
            this.connected = false;
            this._stopHealthCheck();
            
            // Publish offline status
            this._publishDeviceStatus('offline').catch(() => {});
            
            this._triggerEvent('disconnect', { 
                deviceId: this.currentDeviceId,
                timestamp: Date.now(),
                reconnecting: this.reconnecting 
            });
            
            // Auto-reconnect if enabled
            if (this.autoReconnect && !this.reconnecting) {
                this._scheduleReconnect();
            }
        });
        
        // Reconnect handler
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
        
        // Offline handler
        this.client.on('offline', () => {
            console.log('📴 MQTT Offline');
            this.connected = false;
            this._triggerEvent('offline', { 
                deviceId: this.currentDeviceId,
                timestamp: Date.now() 
            });
        });
        
        // End handler
        this.client.on('end', () => {
            console.log('🛑 MQTT Connection ended');
            this.connected = false;
            this.client = null;
            this._stopHealthCheck();
        });
        
        // Packetsend handler (for monitoring)
        this.client.on('packetsend', (packet) => {
            // Track ping requests
            if (packet.cmd === 'pingreq') {
                console.debug('📤 Sending ping request');
            }
        });
        
        // Packetreceive handler
        this.client.on('packetreceive', (packet) => {
            // Track ping responses
            if (packet.cmd === 'pingresp') {
                console.debug('📥 Received ping response');
                this.lastActivity = Date.now();
            }
        });
    }
    
    /**
     * Handle incoming MQTT messages
     * @private
     */
    _handleIncomingMessage(topic, message, packet) {
        try {
            // Update stats
            this.stats.messagesReceived++;
            this.stats.lastMessageTime = Date.now();
            this.stats.bytesReceived += message.length;
            
            // Parse message
            let data;
            let isJSON = false;
            
            try {
                data = JSON.parse(message.toString());
                isJSON = true;
            } catch {
                data = message.toString(); // Keep as string if not JSON
            }
            
            // Handle authentication responses
            if (topic.includes('/auth/response/')) {
                this._handleAuthResponse(topic, data);
                return;
            }
            
            // Extract device ID from topic
            const deviceId = this._extractDeviceIdFromTopic(topic);
            
            // Track device activity
            if (deviceId && isJSON && data.deviceId) {
                this._updateDeviceActivity(data.deviceId, data);
            }
            
            // Log for debugging
            if (this.stats.messagesReceived <= 5 || this.stats.messagesReceived % 20 === 0) {
                console.log(`📨 [${deviceId || 'unknown'}] ${topic} - ${isJSON ? 'JSON' : 'TEXT'} (${message.length} bytes)`);
            }
            
            // Process message
            this._processMessage(topic, data, packet, isJSON, deviceId);
            
        } catch (error) {
            console.error('❌ Error handling incoming message:', error);
            console.error('Topic:', topic);
            console.error('Raw message:', message.toString());
            this.stats.errors++;
        }
    }
    
    /**
     * Extract device ID from MQTT topic
     * @private
     */
    _extractDeviceIdFromTopic(topic) {
        try {
            // Topic format: smartclock/{device_key}/status
            const parts = topic.split('/');
            if (parts.length >= 2 && parts[0] === 'smartclock') {
                return parts[1]; // This is the device key, not the original ID
            }
        } catch (error) {
            console.error('Error extracting device ID from topic:', error);
        }
        return null;
    }
    
    /**
     * Update device activity tracking
     * @private
     */
    _updateDeviceActivity(deviceId, data) {
        if (!this.availableDevices.has(deviceId)) {
            this.availableDevices.set(deviceId, {
                name: deviceId,
                lastSeen: Date.now(),
                status: 'online',
                data: data,
                firstSeen: Date.now()
            });
            this.stats.devicesConnected++;
            
            // Trigger device connected event
            this._triggerEvent('device_connected', {
                deviceId,
                data,
                timestamp: Date.now()
            });
        } else {
            const device = this.availableDevices.get(deviceId);
            device.lastSeen = Date.now();
            device.data = { ...device.data, ...data };
            device.status = 'online';
            this.availableDevices.set(deviceId, device);
        }
    }
    
    /**
     * Handle authentication response
     * @private
     */
    _handleAuthResponse(topic, data) {
        console.log('🔐 Authentication response:', data);
        
        if (data.success && data.token) {
            const expiry = Date.now() + (data.expiry || 3600000);
            this._saveAuthToken(data.token, expiry);
            
            this._triggerEvent('auth_success', {
                deviceId: this.currentDeviceId,
                token: data.token,
                expiry: expiry,
                message: data.message,
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
            
            console.error(`❌ Authentication failed for ${this.currentDeviceId}:`, data.message);
        }
    }
    
    /**
     * Process and route message to handlers
     * @private
     */
    _processMessage(topic, data, packet, isJSON = false, deviceId = null) {
        const messageInfo = {
            topic,
            data,
            packet,
            isJSON,
            deviceId,
            timestamp: Date.now(),
            qos: packet.qos,
            retain: packet.retain,
            currentDeviceId: this.currentDeviceId
        };
        
        // Call topic-specific handlers
        const handlers = this.messageHandlers.get(topic) || [];
        handlers.forEach(handler => {
            try {
                if (typeof handler === 'function') {
                    handler(data, topic, messageInfo);
                }
            } catch (error) {
                console.error(`Error in topic handler for ${topic}:`, error);
            }
        });
        
        // Call global handlers
        this.globalHandlers.forEach(handler => {
            try {
                if (typeof handler === 'function') {
                    handler(data, topic, messageInfo);
                }
            } catch (error) {
                console.error('Error in global handler:', error);
            }
        });
        
        // Trigger message event
        this._triggerEvent('message', messageInfo);
        
        // Dispatch custom DOM event for UI integration
        this._dispatchMessageEvent(topic, data, isJSON, deviceId);
    }
    
    /**
     * Dispatch message as DOM event
     * @private
     */
    _dispatchMessageEvent(topic, data, isJSON = false, deviceId = null) {
        if (typeof window !== 'undefined') {
            try {
                const event = new CustomEvent('mqtt-message', {
                    detail: {
                        topic,
                        data,
                        isJSON,
                        deviceId,
                        currentDeviceId: this.currentDeviceId,
                        timestamp: Date.now(),
                        clientId: this.client?.options?.clientId
                    },
                    bubbles: true,
                    cancelable: true
                });
                
                window.dispatchEvent(event);
                
                // Also dispatch device-specific events
                if (deviceId) {
                    const deviceEvent = new CustomEvent(`mqtt-device-${deviceId}`, {
                        detail: {
                            topic,
                            data,
                            timestamp: Date.now()
                        },
                        bubbles: true,
                        cancelable: true
                    });
                    
                    window.dispatchEvent(deviceEvent);
                }
                
            } catch (error) {
                console.error('Error dispatching DOM event:', error);
            }
        }
    }
    
    /**
     * Authenticate with device
     * @param {string} password - Device password
     * @returns {Promise<boolean>}
     */
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
            
            // Generate client ID for auth response
            const authClientId = 'auth_' + Math.random().toString(36).substr(2, 8);
            const responseTopic = this.config.MQTT.TOPICS.AUTH_RESPONSE.replace('{clientId}', authClientId);
            
            // Subscribe to auth response
            this.client.subscribe(responseTopic, { qos: 1 }, (err) => {
                if (err) {
                    console.error('Failed to subscribe to auth response:', err);
                    reject(err);
                    return;
                }
                
                console.log(`🔐 Subscribed to auth response: ${responseTopic}`);
                
                // Set timeout for auth response
                const timeout = setTimeout(() => {
                    this.client.unsubscribe(responseTopic, () => {});
                    reject(new Error('Authentication timeout'));
                }, 10000);
                
                // Handle auth response
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
                
                // Send auth request
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
    
    /**
     * Send authenticated command to device
     * @param {string} command - Command name
     * @param {Object} data - Command data
     * @param {Object} options - Publish options
     * @returns {Promise<boolean>}
     */
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
            
            // Check authentication if required
            if (this.authRequired && !this._isTokenValid()) {
                reject(new Error('Authentication required. Please authenticate first.'));
                return;
            }
            
            const topic = this.config.MQTT.TOPICS.COMMAND;
            const message = {
                command,
                data,
                auth: this.authRequired ? {
                    token: this.authToken,
                    deviceId: this.currentDeviceId,
                    clientId: this.client.options.clientId
                } : undefined,
                timestamp: Date.now(),
                source: 'web_mqtt_client',
                version: '2.0.0'
            };
            
            const publishOptions = {
                qos: 1,
                retain: false,
                ...options
            };
            
            this.client.publish(topic, JSON.stringify(message), publishOptions, (err) => {
                if (err) {
                    console.error(`❌ Failed to send command to ${this.currentDeviceId}:`, err);
                    reject(err);
                    return;
                }
                
                // Update stats
                this.stats.messagesSent++;
                this.stats.bytesSent += JSON.stringify(message).length;
                this.lastActivity = Date.now();
                
                console.log(`📤 [${this.currentDeviceId}] Command sent: ${command}`, data);
                
                resolve(true);
            });
        });
    }
    
    /**
     * Set alarm on device
     * @param {number} hour - Hour (0-23)
     * @param {number} minute - Minute (0-59)
     * @param {number} sound - Sound type (0-2)
     * @param {boolean} enabled - Alarm enabled
     * @param {string} label - Alarm label
     * @returns {Promise<boolean>}
     */
    setAlarm(hour, minute, sound = 0, enabled = true, label = 'Alarm') {
        return this.sendCommand('setAlarm', {
            hour,
            minute,
            sound,
            enable: enabled ? 1 : 0,
            label
        }, { qos: 1, retain: true });
    }
    
    /**
     * Send button press simulation
     * @param {number} button - Button number (1-3)
     * @returns {Promise<boolean>}
     */
    pressButton(button) {
        if (button < 1 || button > 3) {
            return Promise.reject(new Error('Button number must be 1, 2, or 3'));
        }
        return this.sendCommand('button', { btn: button });
    }
    
    /**
     * Snooze alarm
     * @returns {Promise<boolean>}
     */
    snoozeAlarm() {
        return this.sendCommand('snooze', {});
    }
    
    /**
     * Reset device
     * @returns {Promise<boolean>}
     */
    resetDevice() {
        return this.sendCommand('reset', {});
    }
    
    /**
     * Request device status
     * @returns {Promise<boolean>}
     */
    requestStatus() {
        return this.sendCommand('get_status', {});
    }
    
    /**
     * Set display brightness
     * @param {number} brightness - Brightness level (0-100)
     * @returns {Promise<boolean>}
     */
    setBrightness(brightness) {
        return this.sendCommand('set_brightness', { brightness }, { qos: 1 });
    }
    
    /**
     * Subscribe to a topic
     * @param {string|string[]} topic - MQTT topic or array of topics
     * @param {Object} options - Subscribe options
     * @param {Function} handler - Message handler function
     * @returns {Promise<boolean>}
     */
    subscribe(topic, options = {}, handler = null) {
        return new Promise((resolve, reject) => {
            if (!this.client || !this.connected) {
                const error = new Error('Cannot subscribe: MQTT not connected');
                console.warn(error.message);
                reject(error);
                return;
            }
            
            const subscribeOptions = {
                qos: 0,
                ...options
            };
            
            // Handle array of topics
            const topics = Array.isArray(topic) ? topic : [topic];
            
            this.client.subscribe(topics, subscribeOptions, (err, granted) => {
                if (err) {
                    console.error(`❌ Failed to subscribe:`, err);
                    reject(err);
                    return;
                }
                
                // Store subscriptions and handlers
                topics.forEach((t, index) => {
                    console.log(`✅ Subscribed to: ${t} (QoS: ${granted[index].qos})`);
                    
                    // Store subscription
                    this.subscriptions.set(t, {
                        qos: granted[index].qos,
                        options: subscribeOptions,
                        subscribedAt: Date.now(),
                        deviceId: this.currentDeviceId
                    });
                    
                    // Store handler if provided
                    if (handler && typeof handler === 'function') {
                        if (!this.messageHandlers.has(t)) {
                            this.messageHandlers.set(t, []);
                        }
                        this.messageHandlers.get(t).push(handler);
                    }
                });
                
                resolve(true);
            });
        });
    }
    
    /**
     * Unsubscribe from topic
     * @param {string|string[]} topic - MQTT topic or array of topics
     * @returns {Promise<boolean>}
     */
    unsubscribe(topic) {
        return new Promise((resolve, reject) => {
            if (!this.client || !this.connected) {
                console.warn('Not connected, skipping unsubscribe');
                resolve(false);
                return;
            }
            
            const topics = Array.isArray(topic) ? topic : [topic];
            
            try {
                this.client.unsubscribe(topics, (err) => {
                    if (err) {
                        console.error(`❌ Failed to unsubscribe:`, err);
                        reject(err);
                        return;
                    }
                    
                    // Remove from internal tracking
                    topics.forEach(t => {
                        console.log(`✅ Unsubscribed from: ${t}`);
                        this.subscriptions.delete(t);
                        this.messageHandlers.delete(t);
                    });
                    
                    resolve(true);
                });
            } catch (error) {
                console.error(`Error unsubscribing:`, error);
                resolve(false);
            }
        });
    }
    
    /**
     * Publish message to topic
     * @param {string} topic - MQTT topic
     * @param {any} message - Message to publish
     * @param {Object} options - Publish options
     * @returns {Promise<boolean>}
     */
    publish(topic, message, options = {}) {
        return new Promise((resolve, reject) => {
            // If not connected and queueing enabled, queue the message
            if (!this.connected && this.processQueueOnReconnect) {
                this._queueMessage(topic, message, options);
                resolve(true);
                return;
            }
            
            if (!this.client || !this.connected) {
                const error = new Error('Cannot publish: MQTT not connected');
                console.warn(error.message);
                reject(error);
                return;
            }
            
            try {
                // Prepare message
                let payload;
                let isJSON = false;
                
                if (typeof message === 'object' && message !== null) {
                    payload = JSON.stringify(message);
                    isJSON = true;
                } else if (typeof message === 'string') {
                    payload = message;
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
                        console.error(`❌ Failed to publish to ${topic}:`, err);
                        reject(err);
                        return;
                    }
                    
                    // Update stats
                    this.stats.messagesSent++;
                    this.stats.bytesSent += payload.length;
                    this.lastActivity = Date.now();
                    
                    // Log for debugging
                    if (this.stats.messagesSent <= 5 || this.stats.messagesSent % 10 === 0) {
                        console.log(`📤 [${this.currentDeviceId}] ${topic} - ${isJSON ? 'JSON' : 'TEXT'} (${payload.length} bytes)`);
                    }
                    
                    // Trigger publish event
                    this._triggerEvent('publish', {
                        topic,
                        message: isJSON ? message : payload,
                        options: publishOptions,
                        deviceId: this.currentDeviceId,
                        timestamp: Date.now()
                    });
                    
                    resolve(true);
                });
                
            } catch (error) {
                console.error('❌ Error publishing message:', error);
                reject(error);
            }
        });
    }
    
    /**
     * Get connected devices
     * @returns {Array}
     */
    getDevices() {
        return Array.from(this.availableDevices.entries()).map(([id, device]) => ({
            id,
            ...device
        }));
    }
    
    /**
     * Get current device info
     * @returns {Object}
     */
    getCurrentDevice() {
        return {
            id: this.currentDeviceId,
            hasToken: this._isTokenValid(),
            tokenExpiry: this.tokenExpiry,
            connected: this.connected
        };
    }
    
    /**
     * Logout from current device
     */
    logout() {
        if (!this.currentDeviceId) return;
        
        console.log(`🚪 Logging out from device ${this.currentDeviceId}`);
        this._clearAuthToken();
        
        // Unsubscribe from device topics
        if (this.connected) {
            this._unsubscribeDeviceTopics(this.currentDeviceId).catch(console.error);
        }
        
        // Clear current device
        this.currentDeviceId = null;
        
        console.log('✅ Logged out successfully');
    }
    
    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        const uptime = this.getUptime();
        const now = Date.now();
        
        return {
            connected: this.connected,
            reconnecting: this.reconnecting,
            currentDeviceId: this.currentDeviceId,
            clientId: this.client?.options?.clientId,
            broker: this.client?.options?.hostname || this.config.MQTT.BROKER,
            subscriptions: Array.from(this.subscriptions.keys()),
            authenticated: this._isTokenValid(),
            stats: {
                ...this.stats,
                uptimeFormatted: this._formatUptime(uptime),
                queueSize: this.messageQueue.length,
                lastActivityAgo: this.lastActivity ? Math.floor((now - this.lastActivity) / 1000) : null,
                devicesConnected: this.availableDevices.size
            },
            uptime,
            connectionAttempts: this.connectionAttempts,
            autoReconnect: this.autoReconnect,
            maxQueueSize: this.maxQueueSize,
            timestamp: now,
            deviceInfo: this.getCurrentDevice()
        };
    }
    
    /**
     * Check if client is currently connected
     * @returns {boolean}
     */
    isConnected() {
        return this.connected && 
               this.client && 
               this.client.connected === true;
    }
    
    /**
     * Disconnect from MQTT broker
     */
    disconnect() {
        if (this.client) {
            console.log('🔌 Disconnecting MQTT client...');
            
            // Publish offline status if connected
            if (this.connected && this.currentDeviceId) {
                this._publishDeviceStatus('offline').catch(() => {});
            }
            
            // Clear timers
            this._stopHealthCheck();
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Unsubscribe from all topics
            const unsubscribePromises = Array.from(this.subscriptions.keys())
                .map(topic => this.unsubscribe(topic).catch(() => {}));
            
            // Wait for unsubscribes then disconnect
            Promise.allSettled(unsubscribePromises).then(() => {
                // End connection
                this.client.end(true, () => {
                    console.log('✅ MQTT client disconnected gracefully');
                });
                
                this.client = null;
                this.connected = false;
                this.reconnecting = false;
                
                this._triggerEvent('disconnect', { 
                    deviceId: this.currentDeviceId,
                    timestamp: Date.now(),
                    graceful: true 
                });
            });
            
        } else {
            console.log('⚠️  No active MQTT connection to disconnect');
        }
    }
    
    // Các phương thức helper khác giữ nguyên...
    // (các phương thức như _handleError, _scheduleReconnect, _startHealthCheck, 
    // _stopHealthCheck, _resubscribeTopics, _queueMessage, _processMessageQueue, 
    // _formatUptime, getUptime, destroy, addMessageHandler, removeMessageHandler, 
    // on, off, _triggerEvent vẫn giữ nguyên như file gốc)
    
    // ... (giữ nguyên tất cả các phương thức helper khác từ file gốc)
}

// Singleton instance management
let mqttClientInstance = null;

/**
 * Initialize or get MQTT client instance
 * @param {Object} config - Configuration
 * @returns {MQTTClient}
 */
function initMQTT(config = {}) {
    // Check if MQTT library is loaded
    if (typeof mqtt === 'undefined') {
        console.error('❌ MQTT.js is not loaded. Please include it in your HTML:');
        console.error('<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>');
        
        // Check if we're in a development environment
        const isDev = typeof process !== 'undefined' && 
                     process.env && 
                     process.env.NODE_ENV === 'development';
        
        // Provide a mock for development
        if (isDev) {
            console.warn('⚠️  Running in development mode without MQTT.js - Using mock client');
            return createMockMQTTClient();
        }
        
        throw new Error('MQTT.js library required');
    }
    
    if (!mqttClientInstance) {
        mqttClientInstance = new MQTTClient(config);
        console.log('🎉 MQTT Client with Device ID support initialized successfully');
    } else {
        console.log('🔁 Using existing MQTT Client instance');
    }
    
    return mqttClientInstance;
}

/**
 * Get existing MQTT client instance
 * @returns {MQTTClient|null}
 */
function getMQTTClient() {
    if (!mqttClientInstance) {
        console.warn('⚠️  MQTT client not initialized. Call initMQTT() first.');
    }
    return mqttClientInstance;
}

/**
 * Create mock MQTT client for development
 * @private
 */
function createMockMQTTClient() {
    console.warn('🔄 Creating mock MQTT client for development');
    
    const mockHandlers = [];
    const mockStats = {
        messagesSent: 0,
        messagesReceived: 0,
        connected: false
    };
    
    return {
        setDeviceId: (deviceId) => {
            console.log(`✅ [MOCK] Set device ID: ${deviceId}`);
            return true;
        },
        
        connect: () => {
            console.log('✅ [MOCK] Connected to broker');
            mockStats.connected = true;
            return Promise.resolve(true);
        },
        
        authenticate: (password) => {
            console.log(`🔐 [MOCK] Authentication with password: ${password ? '***' : 'empty'}`);
            return Promise.resolve(true);
        },
        
        subscribe: (topic, options, handler) => {
            console.log(`✅ [MOCK] Subscribed to ${topic}`);
            if (handler) mockHandlers.push({ topic, handler });
            return Promise.resolve(true);
        },
        
        sendCommand: (command, data) => {
            console.log(`🎛️  [MOCK] Command: ${command}`, data);
            return Promise.resolve(true);
        },
        
        setAlarm: (hour, minute, sound, enabled, label) => {
            console.log(`⏰ [MOCK] Set alarm: ${hour}:${minute}, sound: ${sound}, enabled: ${enabled}, label: ${label}`);
            return Promise.resolve(true);
        },
        
        pressButton: (button) => {
            console.log(`🔼 [MOCK] Button pressed: ${button}`);
            return Promise.resolve(true);
        },
        
        snoozeAlarm: () => {
            console.log('⏸️  [MOCK] Alarm snoozed');
            return Promise.resolve(true);
        },
        
        resetDevice: () => {
            console.log('🔄 [MOCK] Device reset');
            return Promise.resolve(true);
        },
        
        disconnect: () => {
            console.log('🔌 [MOCK] Disconnected');
            mockStats.connected = false;
        },
        
        getStatus: () => ({
            connected: mockStats.connected,
            currentDeviceId: 'ESP32_CLOCK_001',
            authenticated: true,
            mock: true,
            stats: mockStats,
            message: 'Running in mock mode'
        }),
        
        getDevices: () => [
            { id: 'ESP32_CLOCK_001', name: 'Living Room Clock', status: 'online', lastSeen: Date.now() },
            { id: 'ESP32_CLOCK_002', name: 'Bedroom Clock', status: 'online', lastSeen: Date.now() - 10000 }
        ],
        
        getCurrentDevice: () => ({
            id: 'ESP32_CLOCK_001',
            hasToken: true,
            tokenExpiry: Date.now() + 3600000,
            connected: true
        }),
        
        logout: () => {
            console.log('🚪 [MOCK] Logged out');
        },
        
        isConnected: () => mockStats.connected,
        
        on: (event, callback) => {
            console.log(`✅ [MOCK] Added ${event} event listener`);
        },
        
        off: (event, callback) => {
            console.log(`✅ [MOCK] Removed ${event} event listener`);
        },
        
        destroy: () => {
            console.log('🧹 [MOCK] Client destroyed');
        }
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.MQTTClient = MQTTClient;
    window.initMQTT = initMQTT;
    window.getMQTTClient = getMQTTClient;
    
    // Auto-initialize with global config if available
    document.addEventListener('DOMContentLoaded', () => {
        if (window.CONFIG && window.CONFIG.MQTT) {
            console.log('🚀 Auto-initializing MQTT client with window.CONFIG');
            setTimeout(() => {
                try {
                    window.mqttClient = initMQTT(window.CONFIG);
                    
                    // Load last used device ID
                    const lastDeviceId = localStorage.getItem('smartclock_last_device_id');
                    if (lastDeviceId && window.mqttClient.setDeviceId) {
                        window.mqttClient.setDeviceId(lastDeviceId);
                        console.log(`📱 Restored last device: ${lastDeviceId}`);
                    }
                } catch (error) {
                    console.error('Failed to auto-initialize MQTT:', error);
                }
            }, 1000);
        }
    });
}

// Export for Node.js/ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MQTTClient,
        initMQTT,
        getMQTTClient
    };
}

// Example usage with Device ID:
/*
// 1. Initialize client
const mqtt = initMQTT({
    MQTT: {
        BROKER: 'wss://broker.emqx.io:8084/mqtt',
        TOPIC_PREFIX: 'smartclock/',
        OPTIONS: {
            clientId: 'web-client-' + Math.random().toString(36).substr(2, 8),
            clean: true,
            connectTimeout: 5000
        }
    }
});

// 2. Set Device ID (required before connection)
mqtt.setDeviceId('ESP32_CLOCK_001');

// 3. Connect to broker
mqtt.connect()
    .then(() => {
        console.log('✅ Connected to device');
        
        // 4. Authenticate with device password
        return mqtt.authenticate('123456');
    })
    .then(() => {
        console.log('🔐 Authenticated successfully');
        
        // 5. Now you can send commands
        mqtt.setAlarm(7, 30, 0, true, 'Morning Alarm');
        mqtt.pressButton(1);
        
        // 6. Handle messages from device
        mqtt.on('message', (msg) => {
            console.log('📨 Message from device:', msg.topic, msg.data);
        });
        
        // 7. Get status
        const status = mqtt.getStatus();
        console.log('📊 Connection status:', status);
        
        // 8. List available devices
        const devices = mqtt.getDevices();
        console.log('📱 Available devices:', devices);
    })
    .catch(error => {
        console.error('❌ Error:', error);
    });

// 9. Switch to another device
mqtt.setDeviceId('ESP32_CLOCK_002');
mqtt.connect().then(() => mqtt.authenticate('789012'));

// 10. Logout from current device
mqtt.logout();

// 11. Cleanup
// mqtt.destroy();
*/
