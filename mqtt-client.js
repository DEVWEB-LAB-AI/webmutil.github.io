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
                    TEST: 'smartclock/test'
                },
                OPTIONS: {
                    clean: true,
                    connectTimeout: 4000,
                    reconnectPeriod: 2000,
                    clientId: 'web_' + Math.random().toString(36).substr(2, 9)
                }
            },
            ...config
        };
        
        this.client = null;
        this.connected = false;
        this.reconnecting = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        
        // Message handling
        this.subscriptions = new Map(); // topic -> QoS
        this.messageHandlers = new Map(); // topic -> array of handlers
        this.globalHandlers = []; // handlers for all topics
        
        // Event callbacks
        this.eventCallbacks = {
            connect: [],
            disconnect: [],
            error: [],
            message: [],
            reconnect: []
        };
        
        // Statistics
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            connectionStart: null,
            lastMessageTime: null,
            connectionAttempts: 0,
            errors: 0
        };
        
        // Auto-reconnect
        this.autoReconnect = true;
        this.reconnectDelay = 5000;
        this.reconnectTimer = null;
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
                this._handleError(error);
                reject(error);
                return;
            }
            
            // Clean up existing connection
            if (this.client) {
                this.disconnect();
            }
            
            // Merge options
            const connectOptions = {
                ...this.config.MQTT.OPTIONS,
                ...options,
                clientId: options.clientId || 
                         `web_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            };
            
            // Get broker URL
            const brokerUrl = options.broker || this.config.MQTT.BROKER;
            
            console.log(`🔗 Connecting to MQTT broker: ${brokerUrl}`);
            console.log(`📋 Client ID: ${connectOptions.clientId}`);
            
            this.stats.connectionAttempts++;
            this.connectionAttempts++;
            
            try {
                // Create MQTT client
                this.client = mqtt.connect(brokerUrl, connectOptions);
                
                // Setup event handlers
                this._setupEventHandlers();
                
                // Set connection timeout
                const timeout = setTimeout(() => {
                    if (!this.connected) {
                        const error = new Error('Connection timeout');
                        this._handleError(error);
                        this.client.end();
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
                    
                    console.log('✅ MQTT Connected successfully');
                    
                    // Subscribe to previously subscribed topics
                    this._resubscribeTopics();
                    
                    // Trigger connect callbacks
                    this._triggerEvent('connect', { 
                        broker: brokerUrl,
                        clientId: connectOptions.clientId 
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
                this._handleError(error);
                reject(error);
            }
        });
    }
    
    /**
     * Setup MQTT event handlers
     * @private
     */
    _setupEventHandlers() {
        if (!this.client) return;
        
        // Message handler
        this.client.on('message', (topic, message, packet) => {
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
            this._triggerEvent('disconnect');
            
            // Auto-reconnect if enabled
            if (this.autoReconnect && !this.reconnecting) {
                this._scheduleReconnect();
            }
        });
        
        // Reconnect handler
        this.client.on('reconnect', () => {
            console.log('🔄 MQTT Reconnecting...');
            this.reconnecting = true;
            this._triggerEvent('reconnect');
        });
        
        // Offline handler
        this.client.on('offline', () => {
            console.log('📴 MQTT Offline');
            this.connected = false;
        });
        
        // End handler
        this.client.on('end', () => {
            console.log('🛑 MQTT Connection ended');
            this.connected = false;
            this.client = null;
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
            
            // Parse message
            let data;
            try {
                data = JSON.parse(message.toString());
            } catch {
                data = message.toString(); // Keep as string if not JSON
            }
            
            // Log for debugging (limit to avoid console spam)
            if (this.stats.messagesReceived <= 10 || this.stats.messagesReceived % 50 === 0) {
                console.log(`📨 Received from ${topic}:`, data);
            }
            
            // Process message
            this._processMessage(topic, data, packet);
            
        } catch (error) {
            console.error('Error handling incoming message:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * Process and route message to handlers
     * @private
     */
    _processMessage(topic, data, packet) {
        // Call topic-specific handlers
        const handlers = this.messageHandlers.get(topic) || [];
        handlers.forEach(handler => {
            try {
                if (typeof handler === 'function') {
                    handler(data, topic, packet);
                }
            } catch (error) {
                console.error('Error in topic handler:', error);
            }
        });
        
        // Call global handlers
        this.globalHandlers.forEach(handler => {
            try {
                if (typeof handler === 'function') {
                    handler(data, topic, packet);
                }
            } catch (error) {
                console.error('Error in global handler:', error);
            }
        });
        
        // Trigger message event
        this._triggerEvent('message', {
            topic,
            data,
            packet,
            timestamp: Date.now()
        });
        
        // Dispatch custom DOM event for UI integration
        this._dispatchMessageEvent(topic, data);
    }
    
    /**
     * Dispatch message as DOM event
     * @private
     */
    _dispatchMessageEvent(topic, data) {
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('mqtt-message', {
                detail: {
                    topic,
                    data,
                    timestamp: Date.now(),
                    clientId: this.client?.options?.clientId
                },
                bubbles: true,
                cancelable: true
            });
            
            window.dispatchEvent(event);
        }
    }
    
    /**
     * Handle MQTT errors
     * @private
     */
    _handleError(error) {
        console.error('❌ MQTT Error:', error);
        this.stats.errors++;
        
        // Trigger error callbacks
        this._triggerEvent('error', error);
        
        // Auto-reconnect on error
        if (this.autoReconnect && !this.reconnecting && this.connectionAttempts < this.maxConnectionAttempts) {
            this._scheduleReconnect();
        }
    }
    
    /**
     * Schedule auto-reconnect
     * @private
     */
    _scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.log(`Max reconnection attempts (${this.maxConnectionAttempts}) reached. Stopping auto-reconnect.`);
            return;
        }
        
        const delay = this.reconnectDelay * Math.pow(1.5, this.connectionAttempts);
        console.log(`Scheduling reconnect attempt ${this.connectionAttempts + 1} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnecting = true;
            this.connect().catch(error => {
                console.error('Auto-reconnect failed:', error);
            });
        }, Math.min(delay, 30000)); // Max 30 seconds delay
    }
    
    /**
     * Resubscribe to previously subscribed topics
     * @private
     */
    _resubscribeTopics() {
        if (!this.connected || !this.client) return;
        
        const topics = Array.from(this.subscriptions.entries());
        if (topics.length === 0) return;
        
        console.log(`Resubscribing to ${topics.length} topics...`);
        
        topics.forEach(([topic, qos]) => {
            this.client.subscribe(topic, { qos }, (err) => {
                if (err) {
                    console.error(`Failed to resubscribe to ${topic}:`, err);
                } else {
                    console.log(`Resubscribed to: ${topic} (QoS: ${qos})`);
                }
            });
        });
    }
    
    /**
     * Subscribe to a topic
     * @param {string} topic - MQTT topic
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
            
            this.client.subscribe(topic, subscribeOptions, (err) => {
                if (err) {
                    console.error(`❌ Failed to subscribe to ${topic}:`, err);
                    reject(err);
                    return;
                }
                
                console.log(`✅ Subscribed to: ${topic} (QoS: ${subscribeOptions.qos})`);
                
                // Store subscription
                this.subscriptions.set(topic, subscribeOptions.qos);
                
                // Store handler if provided
                if (handler && typeof handler === 'function') {
                    if (!this.messageHandlers.has(topic)) {
                        this.messageHandlers.set(topic, []);
                    }
                    this.messageHandlers.get(topic).push(handler);
                }
                
                resolve(true);
            });
        });
    }
    
    /**
     * Unsubscribe from topic
     * @param {string} topic - MQTT topic
     * @returns {Promise<boolean>}
     */
    unsubscribe(topic) {
        return new Promise((resolve, reject) => {
            if (!this.client || !this.connected) {
                resolve(false);
                return;
            }
            
            this.client.unsubscribe(topic, (err) => {
                if (err) {
                    console.error(`Failed to unsubscribe from ${topic}:`, err);
                    reject(err);
                    return;
                }
                
                console.log(`Unsubscribed from: ${topic}`);
                this.subscriptions.delete(topic);
                this.messageHandlers.delete(topic);
                resolve(true);
            });
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
            if (!this.client || !this.connected) {
                const error = new Error('Cannot publish: MQTT not connected');
                console.warn(error.message);
                reject(error);
                return;
            }
            
            try {
                // Prepare message
                const payload = typeof message === 'string' 
                    ? message 
                    : JSON.stringify(message);
                
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
                    
                    this.stats.messagesSent++;
                    
                    // Log for debugging (limit to avoid console spam)
                    if (this.stats.messagesSent <= 10 || this.stats.messagesSent % 20 === 0) {
                        console.log(`📤 Published to ${topic}:`, 
                            payload.length > 100 ? payload.substring(0, 100) + '...' : payload);
                    }
                    
                    resolve(true);
                });
                
            } catch (error) {
                console.error('Error publishing message:', error);
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
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }
    
    /**
     * Send command to ESP32
     * @param {string} command - Command name
     * @param {Object} data - Command data
     * @returns {Promise<boolean>}
     */
    sendCommand(command, data = {}) {
        const topic = this.config.MQTT.TOPICS.COMMAND;
        const message = {
            command,
            data,
            timestamp: Date.now(),
            source: 'web_mqtt_client',
            clientId: this.client?.options?.clientId
        };
        
        return this.publish(topic, message);
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
     * @returns {Promise<boolean>}
     */
    setAlarm(hour, minute, sound = 0, enabled = true) {
        return this.sendCommand('set_alarm', {
            hour,
            minute,
            sound,
            enabled: enabled ? 1 : 0
        });
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
            clientId: this.client?.options?.clientId
        };
        
        return this.publish(topic, testMessage);
    }
    
    /**
     * Subscribe to all default topics
     * @returns {Promise<Array<boolean>>}
     */
    subscribeToAll() {
        const promises = [];
        const topics = this.config.MQTT.TOPICS;
        
        Object.entries(topics).forEach(([key, topic]) => {
            if (key !== 'COMMAND') { // Don't subscribe to command topic
                promises.push(this.subscribe(topic));
            }
        });
        
        return Promise.all(promises);
    }
    
    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            connected: this.connected,
            reconnecting: this.reconnecting,
            clientId: this.client?.options?.clientId,
            broker: this.client?.options?.hostname || this.config.MQTT.BROKER,
            subscriptions: Array.from(this.subscriptions.keys()),
            stats: { ...this.stats },
            uptime: this.getUptime(),
            connectionAttempts: this.connectionAttempts
        };
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
     * Disconnect from MQTT broker
     */
    disconnect() {
        if (this.client) {
            console.log('Disconnecting MQTT client...');
            
            // Clear reconnect timer
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Unsubscribe from all topics
            this.subscriptions.forEach((_, topic) => {
                this.unsubscribe(topic).catch(() => {});
            });
            
            // Clear handlers
            this.messageHandlers.clear();
            this.globalHandlers = [];
            
            // End connection
            this.client.end();
            this.client = null;
            this.connected = false;
            this.reconnecting = false;
            
            console.log('MQTT client disconnected');
            this._triggerEvent('disconnect');
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.disconnect();
        
        // Clear all event callbacks
        Object.keys(this.eventCallbacks).forEach(event => {
            this.eventCallbacks[event] = [];
        });
        
        // Clear all data structures
        this.subscriptions.clear();
        this.messageHandlers.clear();
        this.globalHandlers = [];
        
        console.log('MQTT client destroyed');
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
        console.error('MQTT.js is not loaded. Please include it in your HTML:');
        console.error('<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>');
        
        // Provide a mock for development
        if (process.env.NODE_ENV === 'development') {
            console.warn('Running in development mode without MQTT.js');
            return createMockMQTTClient();
        }
        
        throw new Error('MQTT.js library required');
    }
    
    if (!mqttClientInstance) {
        mqttClientInstance = new MQTTClient(config);
        console.log('✅ MQTT Client initialized');
    } else {
        console.log('✅ Using existing MQTT Client instance');
    }
    
    return mqttClientInstance;
}

/**
 * Get existing MQTT client instance
 * @returns {MQTTClient|null}
 */
function getMQTTClient() {
    if (!mqttClientInstance) {
        console.warn('MQTT client not initialized. Call initMQTT() first.');
    }
    return mqttClientInstance;
}

/**
 * Create mock MQTT client for development
 * @private
 */
function createMockMQTTClient() {
    console.warn('⚠️  Creating mock MQTT client for development');
    
    return {
        connect: () => Promise.resolve(true),
        subscribe: () => Promise.resolve(true),
        publish: () => Promise.resolve(true),
        sendCommand: () => Promise.resolve(true),
        disconnect: () => {},
        getStatus: () => ({ connected: false, mock: true }),
        on: () => {},
        off: () => {}
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.MQTTClient = MQTTClient;
    window.initMQTT = initMQTT;
    window.getMQTTClient = getMQTTClient;
    
    // Auto-initialize with global config if available
    if (window.CONFIG && window.CONFIG.MQTT) {
        setTimeout(() => {
            window.mqttClient = initMQTT(window.CONFIG);
        }, 1000);
    }
}

// Export for Node.js/ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MQTTClient,
        initMQTT,
        getMQTTClient
    };
}

// Example usage:
/*
// 1. Include MQTT.js in your HTML
// <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

// 2. Initialize MQTT client
const mqtt = initMQTT({
    MQTT: {
        BROKER: 'wss://broker.emqx.io:8084/mqtt',
        TOPICS: {
            COMMAND: 'smartclock/command',
            STATUS: 'smartclock/status'
        }
    }
});

// 3. Connect
mqtt.connect().then(() => {
    console.log('Connected!');
    
    // Subscribe to status topic
    mqtt.subscribe('smartclock/status', (data, topic) => {
        console.log('Status update:', data);
    });
    
    // Send command
    mqtt.sendCommand('get_status');
    
}).catch(error => {
    console.error('Connection failed:', error);
});

// 4. Handle events
mqtt.on('connect', () => console.log('Connected event'));
mqtt.on('message', (msg) => console.log('Message event:', msg));
mqtt.on('error', (err) => console.error('Error event:', err));
*/
