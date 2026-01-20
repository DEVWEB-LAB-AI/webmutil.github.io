// MQTT Web Client for ESP32 Smart Clock
class MQTTClient {
    constructor(config) {
        this.config = config || window.CONFIG || {};
        this.client = null;
        this.connected = false;
        this.reconnecting = false;
        this.subscriptions = new Map(); // topic -> handler
        this.messageHandlers = new Map(); // topic -> array of handlers
        this.connectionCallbacks = {
            onConnect: [],
            onDisconnect: [],
            onError: []
        };
        
        // Stats
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            lastMessageTime: null,
            connectionStart: null
        };
    }
    
    // Initialize MQTT connection
    async connect(options = {}) {
        try {
            // Disconnect existing connection
            if (this.client) {
                this.disconnect();
            }
            
            // Merge options
            const connectOptions = {
                ...this.config.MQTT?.OPTIONS,
                ...options,
                clientId: options.clientId || 
                         this.config.UTILS?.generateClientId() || 
                         `web_${Math.random().toString(36).substr(2, 9)}`
            };
            
            // Use broker URL from config or default
            const brokerUrl = this.config.MQTT?.BROKER || 
                            `wss://${this.config.MQTT_BROKER || 'broker.emqx.io'}:${this.config.MQTT_PORT || 8084}/mqtt`;
            
            console.log(`🔗 Connecting to MQTT broker: ${brokerUrl}`);
            console.log(`📋 Client ID: ${connectOptions.clientId}`);
            
            // Connect using MQTT.js
            this.client = mqtt.connect(brokerUrl, connectOptions);
            
            // Setup event handlers
            this.setupEventHandlers();
            
            this.stats.connectionStart = Date.now();
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout after 10 seconds'));
                }, 10000);
                
                this.client.once('connect', () => {
                    clearTimeout(timeout);
                    this.connected = true;
                    this.reconnecting = false;
                    console.log('✅ MQTT Connected successfully');
                    this.stats.connectionStart = Date.now();
                    this.executeCallbacks('onConnect');
                    resolve(true);
                });
                
                this.client.once('error', (error) => {
                    clearTimeout(timeout);
                    console.error('❌ MQTT Connection error:', error);
                    this.executeCallbacks('onError', error);
                    reject(error);
                });
            });
            
        } catch (error) {
            console.error('Failed to initialize MQTT:', error);
            this.executeCallbacks('onError', error);
            return false;
        }
    }
    
    // Setup MQTT event handlers
    setupEventHandlers() {
        // Message handler
        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message.toString());
        });
        
        // Error handler
        this.client.on('error', (error) => {
            console.error('MQTT Error:', error);
            this.connected = false;
            this.executeCallbacks('onError', error);
        });
        
        // Close handler
        this.client.on('close', () => {
            console.log('🔌 MQTT Connection closed');
            this.connected = false;
            this.executeCallbacks('onDisconnect');
        });
        
        // Reconnect handler
        this.client.on('reconnect', () => {
            console.log('🔄 MQTT Reconnecting...');
            this.reconnecting = true;
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
        });
    }
    
    // Subscribe to topic with optional handler
    subscribe(topic, handler = null) {
        if (!this.client || !this.connected) {
            console.warn('Cannot subscribe: MQTT not connected');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            this.client.subscribe(topic, { qos: 0 }, (err) => {
                if (err) {
                    console.error(`❌ Failed to subscribe to ${topic}:`, err);
                    reject(err);
                    return;
                }
                
                console.log(`✅ Subscribed to: ${topic}`);
                this.subscriptions.set(topic, handler);
                
                // Store handler for this topic
                if (handler) {
                    if (!this.messageHandlers.has(topic)) {
                        this.messageHandlers.set(topic, []);
                    }
                    this.messageHandlers.get(topic).push(handler);
                }
                
                resolve(true);
            });
        });
    }
    
    // Unsubscribe from topic
    unsubscribe(topic) {
        if (!this.client || !this.connected) {
            return false;
        }
        
        return new Promise((resolve, reject) => {
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
    
    // Publish message
    publish(topic, message, options = {}) {
        if (!this.client || !this.connected) {
            console.warn('Cannot publish: MQTT not connected');
            return false;
        }
        
        try {
            const payload = typeof message === 'string' ? message : JSON.stringify(message);
            const publishOptions = {
                qos: 0,
                retain: false,
                ...options
            };
            
            this.client.publish(topic, payload, publishOptions, (err) => {
                if (err) {
                    console.error(`Failed to publish to ${topic}:`, err);
                    return;
                }
                
                this.stats.messagesSent++;
                console.log(`📤 Published to ${topic}:`, message);
            });
            
            return true;
            
        } catch (error) {
            console.error('Error publishing message:', error);
            return false;
        }
    }
    
    // Handle incoming messages
    handleMessage(topic, message) {
        try {
            this.stats.messagesReceived++;
            this.stats.lastMessageTime = Date.now();
            
            let data;
            try {
                data = JSON.parse(message);
            } catch {
                data = message; // Keep as string if not JSON
            }
            
            console.log(`📨 Received from ${topic}:`, data);
            
            // Call specific handlers for this topic
            const handlers = this.messageHandlers.get(topic) || [];
            handlers.forEach(handler => {
                try {
                    handler(data, topic);
                } catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
            
            // Dispatch global event
            this.dispatchMessage(topic, data);
            
            // Log message rate (for debugging)
            if (this.stats.messagesReceived % 10 === 0) {
                console.log(`📊 MQTT Stats: ${this.stats.messagesReceived} messages received`);
            }
            
        } catch (error) {
            console.error('Error handling MQTT message:', error);
        }
    }
    
    // Dispatch message to UI via custom event
    dispatchMessage(topic, data) {
        const event = new CustomEvent('mqtt-message', {
            detail: { 
                topic, 
                data,
                timestamp: Date.now()
            },
            bubbles: true
        });
        
        window.dispatchEvent(event);
    }
    
    // Send command to ESP32 via MQTT
    sendCommand(command, data = {}) {
        const commandTopic = this.config.MQTT?.TOPICS?.COMMAND || 'smartclock/command';
        
        const message = {
            command: command,
            data: data,
            timestamp: Date.now(),
            source: 'web_mqtt_client',
            clientId: this.client?.options?.clientId
        };
        
        return this.publish(commandTopic, message);
    }
    
    // Request status update
    requestStatus() {
        return this.sendCommand('get_status', {});
    }
    
    // Send test message
    sendTest(message = 'Test from web client') {
        const testTopic = this.config.MQTT?.TOPICS?.TEST || 'smartclock/test';
        
        const testMessage = {
            type: 'test',
            message: message,
            timestamp: Date.now(),
            clientId: this.client?.options?.clientId
        };
        
        return this.publish(testTopic, testMessage);
    }
    
    // Register callback for connection events
    on(event, callback) {
        if (this.connectionCallbacks[event]) {
            this.connectionCallbacks[event].push(callback);
        }
    }
    
    // Remove callback
    off(event, callback) {
        if (this.connectionCallbacks[event]) {
            const index = this.connectionCallbacks[event].indexOf(callback);
            if (index > -1) {
                this.connectionCallbacks[event].splice(index, 1);
            }
        }
    }
    
    // Execute all callbacks for an event
    executeCallbacks(event, data = null) {
        if (this.connectionCallbacks[event]) {
            this.connectionCallbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }
    
    // Get connection status
    getStatus() {
        return {
            connected: this.connected,
            reconnecting: this.reconnecting,
            clientId: this.client?.options?.clientId,
            subscriptions: Array.from(this.subscriptions.keys()),
            stats: { ...this.stats }
        };
    }
    
    // Get uptime
    getUptime() {
        if (!this.stats.connectionStart) return 0;
        return Math.floor((Date.now() - this.stats.connectionStart) / 1000);
    }
    
    // Subscribe to all default topics
    subscribeToAll() {
        const topics = this.config.MQTT?.TOPICS;
        if (!topics) return;
        
        Object.values(topics).forEach(topic => {
            if (topic !== this.config.MQTT.TOPICS.COMMAND) { // Don't subscribe to command topic
                this.subscribe(topic);
            }
        });
    }
    
    // Disconnect gracefully
    disconnect() {
        if (this.client) {
            console.log('Disconnecting MQTT client...');
            
            // Unsubscribe from all topics
            this.subscriptions.forEach((_, topic) => {
                this.unsubscribe(topic).catch(() => {});
            });
            
            // End connection
            this.client.end();
            this.client = null;
            this.connected = false;
            this.reconnecting = false;
            
            console.log('MQTT client disconnected');
            this.executeCallbacks('onDisconnect');
        }
    }
    
    // Reconnect with new options
    async reconnect(options = {}) {
        if (this.reconnecting) {
            console.log('Already reconnecting...');
            return;
        }
        
        this.reconnecting = true;
        console.log('Starting reconnection...');
        
        try {
            await this.disconnect();
            await this.connect(options);
        } catch (error) {
            console.error('Reconnection failed:', error);
            this.reconnecting = false;
        }
    }
}

// Initialize MQTT client singleton
let mqttClient = null;

function initMQTT(config = null) {
    if (typeof mqtt === 'undefined') {
        console.error('MQTT.js library not loaded. Please include mqtt.min.js');
        return null;
    }
    
    if (!mqttClient) {
        mqttClient = new MQTTClient(config);
        console.log('MQTT Client initialized');
    }
    
    return mqttClient;
}

// Get or create MQTT client instance
function getMQTTClient(config = null) {
    if (!mqttClient) {
        return initMQTT(config);
    }
    return mqttClient;
}

// Utility function to check MQTT library
function isMQTTLoaded() {
    return typeof mqtt !== 'undefined';
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.MQTTClient = MQTTClient;
    window.initMQTT = initMQTT;
    window.getMQTTClient = getMQTTClient;
    window.isMQTTLoaded = isMQTTLoaded;
    window.mqttClient = mqttClient;
}

// Export for Node.js/ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MQTTClient,
        initMQTT,
        getMQTTClient,
        isMQTTLoaded
    };
}
