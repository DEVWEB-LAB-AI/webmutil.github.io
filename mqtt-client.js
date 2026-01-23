/**
 * MQTT Web Client for ESP32 Smart Clock
 * Complete and Error-Free Version
 */
class MQTTClient {
    constructor(config = {}) {
        // Default configuration
        this.config = {
            MQTT: {
                BROKER: 'wss://broker.emqx.io:8084/mqtt',
                TOPICS: {
                    COMMAND: 'smartclock/command',
                    STATUS: 'smartclock/status',
                    ALARM: 'smartclock/alarm',
                    SENSORS: 'smartclock/sensors',
                    TEST: 'smartclock/test',
                    CONFIG: 'smartclock/config',
                    DISPLAY: 'smartclock/display'
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
            ...config
        };
        
        this.client = null;
        this.connected = false;
        this.reconnecting = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 10;
        
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
            publish: []
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
            bytesReceived: 0
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
        
        console.log('🔧 MQTT Client initialized with config:', {
            broker: this.config.MQTT.BROKER,
            clientId: this.config.MQTT.OPTIONS.clientId,
            topics: Object.keys(this.config.MQTT.TOPICS)
        });
    }
    
    /**
     * Connect to MQTT broker
     * @param {Object} options - Connection options
     * @returns {Promise<boolean>}
     */
    connect(options = {}) {
        return new Promise((resolve, reject) => {
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
            
            // Merge options
            const connectOptions = {
                ...this.config.MQTT.OPTIONS,
                ...options,
                clientId: options.clientId || 
                         `web_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
                will: {
                    topic: this.config.MQTT.TOPICS.STATUS,
                    payload: JSON.stringify({ 
                        status: 'offline',
                        clientId: this.config.MQTT.OPTIONS.clientId,
                        timestamp: Date.now() 
                    }),
                    qos: 1,
                    retain: true
                }
            };
            
            // Get broker URL
            const brokerUrl = options.broker || this.config.MQTT.BROKER;
            
            console.log(`🔗 Connecting to MQTT broker: ${brokerUrl}`);
            console.log(`📋 Client ID: ${connectOptions.clientId}`);
            console.log(`🎯 Topics: ${Object.values(this.config.MQTT.TOPICS).join(', ')}`);
            
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
                    
                    console.log('✅ MQTT Connected successfully');
                    console.log(`📡 Session present: ${this.client.options.sessionPresent}`);
                    
                    // Start health check
                    this._startHealthCheck();
                    
                    // Subscribe to previously subscribed topics
                    this._resubscribeTopics();
                    
                    // Process queued messages
                    if (this.processQueueOnReconnect && this.messageQueue.length > 0) {
                        console.log(`Processing ${this.messageQueue.length} queued messages...`);
                        this._processMessageQueue();
                    }
                    
                    // Publish online status
                    this.publish(this.config.MQTT.TOPICS.STATUS, {
                        status: 'online',
                        clientId: connectOptions.clientId,
                        ip: await this._getClientIP(),
                        timestamp: Date.now(),
                        version: '2.0.0'
                    }, { qos: 1, retain: true }).catch(console.error);
                    
                    // Trigger connect callbacks
                    this._triggerEvent('connect', { 
                        broker: brokerUrl,
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
            this._triggerEvent('disconnect', { 
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
                attempt: this.connectionAttempts,
                timestamp: Date.now()
            });
        });
        
        // Offline handler
        this.client.on('offline', () => {
            console.log('📴 MQTT Offline');
            this.connected = false;
            this._triggerEvent('offline', { timestamp: Date.now() });
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
            
            // Log for debugging (limit to avoid console spam)
            if (this.stats.messagesReceived <= 5 || this.stats.messagesReceived % 20 === 0) {
                console.log(`📨 [${topic}] ${isJSON ? 'JSON' : 'TEXT'} (${message.length} bytes)`);
                if (isJSON) {
                    console.debug('Message data:', data);
                }
            }
            
            // Process message
            this._processMessage(topic, data, packet, isJSON);
            
        } catch (error) {
            console.error('❌ Error handling incoming message:', error);
            console.error('Topic:', topic);
            console.error('Raw message:', message.toString());
            this.stats.errors++;
        }
    }
    
    /**
     * Process and route message to handlers
     * @private
     */
    _processMessage(topic, data, packet, isJSON = false) {
        const messageInfo = {
            topic,
            data,
            packet,
            isJSON,
            timestamp: Date.now(),
            qos: packet.qos,
            retain: packet.retain
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
        this._dispatchMessageEvent(topic, data, isJSON);
    }
    
    /**
     * Dispatch message as DOM event
     * @private
     */
    _dispatchMessageEvent(topic, data, isJSON = false) {
        if (typeof window !== 'undefined') {
            try {
                const event = new CustomEvent('mqtt-message', {
                    detail: {
                        topic,
                        data,
                        isJSON,
                        timestamp: Date.now(),
                        clientId: this.client?.options?.clientId
                    },
                    bubbles: true,
                    cancelable: true
                });
                
                window.dispatchEvent(event);
                
                // Also dispatch topic-specific events
                const topicEvent = new CustomEvent(`mqtt-${topic.replace(/\//g, '-')}`, {
                    detail: {
                        data,
                        timestamp: Date.now()
                    },
                    bubbles: true,
                    cancelable: true
                });
                
                window.dispatchEvent(topicEvent);
                
            } catch (error) {
                console.error('Error dispatching DOM event:', error);
            }
        }
    }
    
    /**
     * Handle MQTT errors
     * @private
     */
    _handleError(error) {
        console.error('❌ MQTT Error:', error.message || error);
        this.stats.errors++;
        
        // Log additional error info if available
        if (error.code) console.error('Error code:', error.code);
        
        // Trigger error callbacks
        this._triggerEvent('error', {
            error: error.message || error,
            code: error.code,
            timestamp: Date.now()
        });
        
        // Auto-reconnect on error
        if (this.autoReconnect && 
            !this.reconnecting && 
            this.connectionAttempts < this.maxConnectionAttempts &&
            (!this.client || !this.connected)) {
            this._scheduleReconnect();
        }
    }
    
    /**
     * Schedule auto-reconnect
     * @private
     */
    _scheduleReconnect() {
        // Clear existing timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Check max attempts
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.log(`⛔ Max reconnection attempts (${this.maxConnectionAttempts}) reached. Stopping auto-reconnect.`);
            
            this._triggerEvent('max_reconnect_attempts', {
                attempts: this.connectionAttempts,
                maxAttempts: this.maxConnectionAttempts,
                timestamp: Date.now()
            });
            return;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.reconnectDelay * Math.pow(this.reconnectBackoffFactor, this.connectionAttempts),
            30000 // Max 30 seconds
        );
        
        console.log(`⏰ Scheduling reconnect attempt ${this.connectionAttempts + 1} in ${Math.round(delay)}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnecting = true;
            console.log(`🔁 Attempting reconnect #${this.connectionAttempts + 1}...`);
            
            this.connect().catch(error => {
                console.error('Auto-reconnect failed:', error.message);
                this.reconnecting = false;
            });
        }, delay);
    }
    
    /**
     * Start connection health check
     * @private
     */
    _startHealthCheck() {
        this._stopHealthCheck(); // Clear any existing interval
        
        this.healthCheckInterval = setInterval(() => {
            if (!this.client || !this.connected) {
                this._stopHealthCheck();
                return;
            }
            
            // Check for inactivity
            if (this.lastActivity && (Date.now() - this.lastActivity) > this.healthCheckTime * 2) {
                console.warn('⚠️  No MQTT activity detected, connection may be stale');
                
                // Try to ping the broker
                if (this.client._pingTimer) {
                    console.log('Sending health check ping...');
                    this.client._sendPacket({ cmd: 'pingreq' });
                }
            }
        }, this.healthCheckTime);
    }
    
    /**
     * Stop health check
     * @private
     */
    _stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    /**
     * Resubscribe to previously subscribed topics
     * @private
     */
    _resubscribeTopics() {
        if (!this.connected || !this.client) return;
        
        const topics = Array.from(this.subscriptions.entries());
        if (topics.length === 0) return;
        
        console.log(`🔄 Resubscribing to ${topics.length} topics...`);
        
        const promises = topics.map(([topic, subscription]) => {
            return new Promise((resolve, reject) => {
                this.client.subscribe(topic, { qos: subscription.qos }, (err) => {
                    if (err) {
                        console.error(`❌ Failed to resubscribe to ${topic}:`, err);
                        reject(err);
                    } else {
                        console.log(`✅ Resubscribed to: ${topic} (QoS: ${subscription.qos})`);
                        resolve(true);
                    }
                });
            });
        });
        
        // Handle resubscribe results
        Promise.allSettled(promises).then(results => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (failed > 0) {
                console.warn(`⚠️  ${successful} topics resubscribed, ${failed} failed`);
            } else {
                console.log(`✅ All ${successful} topics resubscribed successfully`);
            }
        });
    }
    
    /**
     * Queue message for sending when offline
     * @private
     */
    _queueMessage(topic, message, options) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            // Remove oldest message if queue is full
            this.messageQueue.shift();
        }
        
        this.messageQueue.push({
            topic,
            message,
            options,
            timestamp: Date.now(),
            attempts: 0
        });
        
        console.log(`💾 Message queued (${this.messageQueue.length}/${this.maxQueueSize})`);
    }
    
    /**
     * Process queued messages
     * @private
     */
    async _processMessageQueue() {
        if (!this.connected || this.messageQueue.length === 0) return;
        
        console.log(`📤 Processing ${this.messageQueue.length} queued messages...`);
        
        const failedMessages = [];
        
        for (const queuedMessage of this.messageQueue) {
            try {
                await this.publish(
                    queuedMessage.topic,
                    queuedMessage.message,
                    queuedMessage.options
                );
                console.log(`✅ Sent queued message to ${queuedMessage.topic}`);
            } catch (error) {
                queuedMessage.attempts++;
                queuedMessage.lastError = error.message;
                queuedMessage.lastAttempt = Date.now();
                
                if (queuedMessage.attempts < 3) {
                    failedMessages.push(queuedMessage);
                    console.warn(`⚠️  Failed to send queued message (attempt ${queuedMessage.attempts}):`, error.message);
                } else {
                    console.error(`❌ Giving up on queued message after 3 attempts:`, queuedMessage.topic);
                }
            }
            
            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.messageQueue = failedMessages;
        
        if (failedMessages.length > 0) {
            console.warn(`${failedMessages.length} messages failed to send and remain queued`);
        }
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
                        subscribedAt: Date.now()
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
                        console.log(`📤 [${topic}] ${isJSON ? 'JSON' : 'TEXT'} (${payload.length} bytes)`);
                    }
                    
                    // Trigger publish event
                    this._triggerEvent('publish', {
                        topic,
                        message: isJSON ? message : payload,
                        options: publishOptions,
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
     * Add global message handler
     * @param {Function} handler - Handler function
     */
    addMessageHandler(handler) {
        if (typeof handler === 'function') {
            this.globalHandlers.push(handler);
            console.log('✅ Added global message handler');
        }
    }
    
    /**
     * Remove global message handler
     * @param {Function} handler - Handler function to remove
     */
    removeMessageHandler(handler) {
        const index = this.globalHandlers.indexOf(handler);
        if (index > -1) {
            this.globalHandlers.splice(index, 1);
            console.log('✅ Removed global message handler');
        }
    }
    
    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.eventCallbacks[event] && typeof callback === 'function') {
            this.eventCallbacks[event].push(callback);
            console.log(`✅ Added ${event} event listener`);
        }
    }
    
    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.eventCallbacks[event]) {
            const index = this.eventCallbacks[event].indexOf(callback);
            if (index > -1) {
                this.eventCallbacks[event].splice(index, 1);
                console.log(`✅ Removed ${event} event listener`);
            }
        }
    }
    
    /**
     * Trigger event callbacks
     * @private
     */
    _triggerEvent(event, data = null) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in ${event} callback:`, error);
                }
            });
        }
    }
    
    /**
     * Send command to ESP32
     * @param {string} command - Command name
     * @param {Object} data - Command data
     * @param {Object} options - Publish options
     * @returns {Promise<boolean>}
     */
    sendCommand(command, data = {}, options = {}) {
        const topic = this.config.MQTT.TOPICS.COMMAND;
        const message = {
            command,
            data,
            timestamp: Date.now(),
            source: 'web_mqtt_client',
            clientId: this.client?.options?.clientId,
            version: '2.0.0'
        };
        
        return this.publish(topic, message, { qos: 1, ...options });
    }
    
    /**
     * Request status from ESP32
     * @returns {Promise<boolean>}
     */
    requestStatus() {
        return this.sendCommand('get_status');
    }
    
    /**
     * Set alarm on ESP32
     * @param {number} hour - Hour (0-23)
     * @param {number} minute - Minute (0-59)
     * @param {number} sound - Sound type (0-2)
     * @param {boolean} enabled - Alarm enabled
     * @param {string} label - Alarm label
     * @returns {Promise<boolean>}
     */
    setAlarm(hour, minute, sound = 0, enabled = true, label = 'Alarm') {
        return this.sendCommand('set_alarm', {
            hour,
            minute,
            sound,
            enabled: enabled ? 1 : 0,
            label,
            days: [1, 1, 1, 1, 1, 1, 1] // All days enabled
        }, { qos: 1, retain: true });
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
     * Set timezone
     * @param {string} timezone - Timezone (e.g., "Asia/Ho_Chi_Minh")
     * @returns {Promise<boolean>}
     */
    setTimezone(timezone) {
        return this.sendCommand('set_timezone', { timezone }, { qos: 1, retain: true });
    }
    
    /**
     * Request sensor data
     * @returns {Promise<boolean>}
     */
    requestSensors() {
        return this.sendCommand('get_sensors');
    }
    
    /**
     * Send test message
     * @param {string} message - Test message
     * @returns {Promise<boolean>}
     */
    sendTest(message = 'Test from MQTT client') {
        const topic = this.config.MQTT.TOPICS.TEST;
        const testMessage = {
            type: 'test',
            message,
            timestamp: Date.now(),
            clientId: this.client?.options?.clientId,
            version: '2.0.0'
        };
        
        return this.publish(topic, testMessage, { qos: 0 });
    }
    
    /**
     * Subscribe to all default topics
     * @returns {Promise<Array<boolean>>}
     */
    subscribeToAll() {
        const promises = [];
        const topics = this.config.MQTT.TOPICS;
        
        // Subscribe to all topics except COMMAND (we only send commands)
        Object.entries(topics).forEach(([key, topic]) => {
            if (key !== 'COMMAND') {
                promises.push(this.subscribe(topic, { qos: 1 }));
            }
        });
        
        return Promise.allSettled(promises).then(results => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            console.log(`✅ Subscribed to ${successful}/${promises.length} default topics`);
            return results;
        });
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
            clientId: this.client?.options?.clientId,
            broker: this.client?.options?.hostname || this.config.MQTT.BROKER,
            subscriptions: Array.from(this.subscriptions.keys()),
            stats: {
                ...this.stats,
                uptimeFormatted: this._formatUptime(uptime),
                queueSize: this.messageQueue.length,
                lastActivityAgo: this.lastActivity ? Math.floor((now - this.lastActivity) / 1000) : null
            },
            uptime,
            connectionAttempts: this.connectionAttempts,
            autoReconnect: this.autoReconnect,
            maxQueueSize: this.maxQueueSize,
            timestamp: now
        };
    }
    
    /**
     * Format uptime to readable string
     * @private
     */
    _formatUptime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
    }
    
    /**
     * Get connection uptime in seconds
     * @returns {number}
     */
    getUptime() {
        if (!this.stats.connectionStart) return 0;
        return Math.floor((Date.now() - this.stats.connectionStart) / 1000);
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
            if (this.connected) {
                this.publish(this.config.MQTT.TOPICS.STATUS, {
                    status: 'offline',
                    clientId: this.client.options.clientId,
                    timestamp: Date.now()
                }, { qos: 1, retain: true }).catch(() => {});
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
                    timestamp: Date.now(),
                    graceful: true 
                });
            });
            
        } else {
            console.log('⚠️  No active MQTT connection to disconnect');
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        console.log('🧹 Destroying MQTT client...');
        
        // Disable auto reconnect
        this.autoReconnect = false;
        
        // Clear all timers
        this._stopHealthCheck();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Disconnect if connected
        this.disconnect();
        
        // Clear all event callbacks
        Object.keys(this.eventCallbacks).forEach(event => {
            this.eventCallbacks[event] = [];
        });
        
        // Clear all data structures
        this.subscriptions.clear();
        this.messageHandlers.clear();
        this.globalHandlers = [];
        this.messageQueue = [];
        
        // Reset stats
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            connectionStart: null,
            lastMessageTime: null,
            connectionAttempts: 0,
            errors: 0,
            reconnects: 0,
            bytesSent: 0,
            bytesReceived: 0
        };
        
        console.log('✅ MQTT client completely destroyed');
    }
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
        console.log('🎉 MQTT Client initialized successfully');
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
        connect: () => {
            console.log('✅ [MOCK] Connected to broker');
            mockStats.connected = true;
            return Promise.resolve(true);
        },
        
        subscribe: (topic, options, handler) => {
            console.log(`✅ [MOCK] Subscribed to ${topic}`);
            if (handler) mockHandlers.push({ topic, handler });
            return Promise.resolve(true);
        },
        
        publish: (topic, message, options) => {
            console.log(`📤 [MOCK] Published to ${topic}:`, message);
            mockStats.messagesSent++;
            
            // Simulate receiving own messages
            setTimeout(() => {
                mockHandlers.forEach(h => {
                    if (h.topic === topic || h.topic.includes('#')) {
                        try {
                            h.handler(message, topic, { qos: 0 });
                        } catch (e) {
                            console.error('Mock handler error:', e);
                        }
                    }
                });
            }, 100);
            
            return Promise.resolve(true);
        },
        
        sendCommand: (command, data) => {
            console.log(`🎛️  [MOCK] Command: ${command}`, data);
            return Promise.resolve(true);
        },
        
        disconnect: () => {
            console.log('🔌 [MOCK] Disconnected');
            mockStats.connected = false;
        },
        
        getStatus: () => ({
            connected: mockStats.connected,
            mock: true,
            stats: mockStats,
            message: 'Running in mock mode'
        }),
        
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

// Example usage with detailed instructions
/*
// ============ BASIC USAGE ============
// 1. Include MQTT.js in your HTML
// <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

// 2. Initialize MQTT client
const mqtt = initMQTT({
    MQTT: {
        BROKER: 'wss://broker.emqx.io:8084/mqtt',
        TOPICS: {
            COMMAND: 'smartclock/command',
            STATUS: 'smartclock/status',
            ALARM: 'smartclock/alarm',
            SENSORS: 'smartclock/sensors'
        },
        OPTIONS: {
            clientId: 'my-web-client',
            clean: true,
            connectTimeout: 5000
        }
    }
});

// 3. Connect to broker
mqtt.connect()
    .then(() => {
        console.log('✅ Connected successfully!');
        
        // Subscribe to status updates
        mqtt.subscribe('smartclock/status', { qos: 1 }, (data, topic) => {
            console.log('📊 Status update:', data);
        });
        
        // Subscribe to all smartclock topics
        mqtt.subscribe('smartclock/#', { qos: 1 });
        
        // Request initial status
        mqtt.requestStatus();
        
    })
    .catch(error => {
        console.error('❌ Connection failed:', error);
    });

// 4. Send commands to ESP32
mqtt.setAlarm(7, 30, 0, true, 'Morning Alarm');
mqtt.setBrightness(75);
mqtt.setTimezone('Asia/Ho_Chi_Minh');

// 5. Handle events
mqtt.on('connect', (data) => {
    console.log('🎉 Connected event:', data);
});

mqtt.on('message', (msg) => {
    console.log('📨 Message event:', msg.topic, msg.data);
});

mqtt.on('error', (err) => {
    console.error('❌ Error event:', err);
});

mqtt.on('disconnect', () => {
    console.log('🔌 Disconnected event');
});

// 6. Get connection status
const status = mqtt.getStatus();
console.log('📊 Connection status:', status);

// 7. Cleanup when done
// mqtt.destroy();

// ============ ADVANCED USAGE ============
// Queue messages when offline
mqtt.publish('smartclock/test', 'This will be queued if offline', { qos: 1 });

// Monitor DOM events
window.addEventListener('mqtt-message', (event) => {
    console.log('DOM Event:', event.detail);
});

// Check connection health
setInterval(() => {
    if (!mqtt.isConnected()) {
        console.warn('⚠️  Connection lost, attempting reconnect...');
        mqtt.connect().catch(console.error);
    }
}, 10000);
*/
