/**
 * ESP32 Smart Clock Web Control Configuration
 * Complete and Error-Free Version
 */
const CONFIG = {
    // MQTT Configuration (Primary communication method)
    MQTT: {
        BROKER: 'wss://broker.emqx.io:8084/mqtt',
        BROKER_WS: 'ws://broker.emqx.io:8083/mqtt', // Fallback WS
        OPTIONS: {
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 2000,
            clientId: 'web_client_' + Math.random().toString(16).substr(2, 8),
            username: 'emqx',
            password: 'public',
            keepalive: 60
        },
        TOPICS: {
            COMMAND: 'smartclock/command',
            STATUS: 'smartclock/status',
            ALARM: 'smartclock/alarm',
            SENSORS: 'smartclock/sensors',
            TEST: 'smartclock/test',
            DISPLAY: 'smartclock/display',
            CONFIG: 'smartclock/config'
        }
    },
    
    // WebSocket Configuration (Direct connection to ESP32 - optional)
    WEBSOCKET: {
        PORT: 81,
        RECONNECT_DELAY: 3000,
        PING_INTERVAL: 30000,
        TIMEOUT: 5000
    },
    
    // HTTP Fallback Configuration (if direct connection is possible)
    HTTP: {
        ENDPOINTS: {
            ROOT: '/',
            SET_ALARM: '/setAlarm',
            SET_ALARM_DIRECT: '/setAlarmDirect',
            BUTTON: '/button',
            SNOOZE: '/snooze',
            RESET: '/reset',
            RESET_SLEEP: '/resetSleepTimer',
            UNLOCK: '/unlock',
            MANIFEST: '/manifest.json',
            SERVICE_WORKER: '/sw.js',
            INFO: '/info',
            STATUS: '/status',
            SENSORS: '/sensors'
        },
        TIMEOUT: 5000,
        RETRY_COUNT: 3,
        CORS_PROXIES: [
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.org/?'
        ]
    },
    
    // UI Configuration
    UI: {
        REFRESH_INTERVAL: 10000, // 10 seconds for MQTT updates
        TOAST_DURATION: 3000,
        CONNECTION_TIMEOUT: 5000,
        AUTO_CONNECT_DELAY: 1000,
        DEBOUNCE_DELAY: 300,
        ANIMATION_DURATION: 300,
        THEMES: {
            LIGHT: {
                primary: '#4361ee',
                secondary: '#3a0ca3',
                background: '#ffffff',
                text: '#2c3e50',
                card: '#f8f9fa'
            },
            DARK: {
                primary: '#7209b7',
                secondary: '#3a0ca3',
                background: '#121212',
                text: '#ffffff',
                card: '#1e1e1e'
            }
        }
    },
    
    // Alarm Configuration
    ALARM: {
        SOUNDS: [
            { id: 0, name: '🔔 Beep', description: 'Tiếng bip đơn giản' },
            { id: 1, name: '🎵 Melody 1', description: 'Giai điệu nhẹ nhàng' },
            { id: 2, name: '🎶 Melody 2', description: 'Giai điệu vui nhộn' }
        ],
        DEFAULT_HOUR: 7,
        DEFAULT_MINUTE: 30,
        MIN_HOUR: 0,
        MAX_HOUR: 23,
        MIN_MINUTE: 0,
        MAX_MINUTE: 59,
        SNOOZE_MINUTES: 5,
        DAYS: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    },
    
    // Button Mappings
    BUTTONS: {
        1: { name: 'Nút 1', color: 'green', action: 'Chọn/Enter', icon: '🟢', command: 'button1' },
        2: { name: 'Nút 2', color: 'blue', action: 'Tăng giá trị', icon: '🔵', command: 'button2' },
        3: { name: 'Nút 3', color: 'red', action: 'Giảm giá trị', icon: '🔴', command: 'button3' }
    },
    
    // System Configuration
    SYSTEM: {
        AUTO_SAVE: true,
        STORAGE_KEY: 'esp32_smart_clock_config',
        STORAGE_PREFIX: 'esp32_',
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        MAX_LOG_ENTRIES: 100,
        VERSION: '2.0.0',
        SUPPORTED_BROWSERS: ['chrome', 'firefox', 'safari', 'edge'],
        MIN_BROWSER_VERSION: 80
    },
    
    // MQTT Command Templates (Factory functions)
    COMMANDS: {
        SET_ALARM: function(hour, minute, sound, enabled, label = 'Alarm', days = [1,1,1,1,1,1,1]) {
            return {
                command: 'set_alarm',
                data: {
                    hour: parseInt(hour) || 0,
                    minute: parseInt(minute) || 0,
                    sound: parseInt(sound) || 0,
                    enable: enabled ? 1 : 0,
                    label: label,
                    days: Array.isArray(days) ? days : [1,1,1,1,1,1,1]
                },
                timestamp: Date.now()
            };
        },
        
        BUTTON: function(button) {
            return {
                command: 'button',
                data: { 
                    btn: parseInt(button) || 1 
                },
                timestamp: Date.now()
            };
        },
        
        SNOOZE: function() {
            return {
                command: 'snooze',
                data: {},
                timestamp: Date.now()
            };
        },
        
        RESET: function() {
            return {
                command: 'reset',
                data: {},
                timestamp: Date.now()
            };
        },
        
        GET_STATUS: function() {
            return {
                command: 'get_status',
                data: {},
                timestamp: Date.now()
            };
        },
        
        GET_SENSORS: function() {
            return {
                command: 'get_sensors',
                data: {},
                timestamp: Date.now()
            };
        },
        
        SET_BRIGHTNESS: function(brightness) {
            return {
                command: 'set_brightness',
                data: {
                    brightness: Math.min(100, Math.max(0, parseInt(brightness) || 50))
                },
                timestamp: Date.now()
            };
        },
        
        SET_TIME: function(hour, minute, second) {
            return {
                command: 'set_time',
                data: {
                    hour: parseInt(hour) || 0,
                    minute: parseInt(minute) || 0,
                    second: parseInt(second) || 0
                },
                timestamp: Date.now()
            };
        },
        
        SET_TIMEZONE: function(timezone) {
            return {
                command: 'set_timezone',
                data: {
                    timezone: timezone || 'Asia/Ho_Chi_Minh'
                },
                timestamp: Date.now()
            };
        },
        
        TEST: function(message) {
            return {
                command: 'test',
                data: { 
                    message: message || 'Test from web client',
                    version: CONFIG.SYSTEM.VERSION
                },
                timestamp: Date.now()
            };
        }
    },
    
    // Connection Modes
    MODES: {
        MQTT: 'mqtt',
        HTTP: 'http',
        WEBSOCKET: 'websocket',
        AUTO: 'auto',
        HYBRID: 'hybrid'
    },
    
    // User Settings (Will be loaded from storage)
    SETTINGS: {
        connectionMode: 'mqtt',
        preferredBroker: 'wss://broker.emqx.io:8084/mqtt',
        alarmEnabled: false,
        theme: 'light', // 'light', 'dark', 'auto'
        language: 'vi',
        notifications: true,
        autoConnect: true,
        soundVolume: 80,
        lastConnectedIP: '',
        alarmHour: 7,
        alarmMinute: 30,
        alarmSound: 0,
        displayBrightness: 70,
        timezone: 'Asia/Ho_Chi_Minh',
        debugMode: false,
        reconnectAttempts: 5
    },
    
    // Default Values (Fallback if settings not found)
    DEFAULTS: {
        CONNECTION_MODE: 'mqtt',
        PREFERRED_BROKER: 'wss://broker.emqx.io:8084/mqtt',
        ALARM_ENABLED: false,
        THEME: 'light',
        LANGUAGE: 'vi',
        NOTIFICATIONS: true,
        AUTO_CONNECT: true,
        SOUND_VOLUME: 80,
        DISPLAY_BRIGHTNESS: 70,
        TIMEZONE: 'Asia/Ho_Chi_Minh',
        DEBUG_MODE: false,
        RECONNECT_ATTEMPTS: 5
    },
    
    // Utility Functions
    UTILS: {
        // Generate random client ID
        generateClientId: () => {
            const prefix = 'web_';
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substr(2, 6);
            return `${prefix}${timestamp}_${random}`;
        },
        
        // Format time (HH:MM)
        formatTime: (hour, minute) => {
            const h = parseInt(hour) || 0;
            const m = parseInt(minute) || 0;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        },
        
        // Format time with seconds (HH:MM:SS)
        formatTimeFull: (hour, minute, second) => {
            const h = parseInt(hour) || 0;
            const m = parseInt(minute) || 0;
            const s = parseInt(second) || 0;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        },
        
        // Validate IP address
        isValidIP: (ip) => {
            if (!ip || typeof ip !== 'string') return false;
            
            // Check for mDNS (.local)
            if (ip.endsWith('.local')) return true;
            
            // Check IPv4 pattern
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(ip)) return false;
            
            const parts = ip.split('.');
            return parts.every(part => {
                const num = parseInt(part, 10);
                return !isNaN(num) && num >= 0 && num <= 255;
            });
        },
        
        // Save to localStorage with error handling
        saveToStorage: (key, value) => {
            try {
                if (typeof localStorage === 'undefined') {
                    console.warn('localStorage is not available');
                    return false;
                }
                
                const storageKey = `${CONFIG.SYSTEM.STORAGE_PREFIX}${key}`;
                const stringValue = JSON.stringify(value);
                localStorage.setItem(storageKey, stringValue);
                return true;
                
            } catch (error) {
                console.error('Error saving to storage:', error);
                
                // Try to clear some space if quota exceeded
                if (error.name === 'QuotaExceededError') {
                    console.warn('Storage quota exceeded, attempting to clear old data...');
                    try {
                        // Clear old items
                        const keysToKeep = [`${CONFIG.SYSTEM.STORAGE_PREFIX}${CONFIG.SYSTEM.STORAGE_KEY}`];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && !keysToKeep.includes(key) && key.startsWith(CONFIG.SYSTEM.STORAGE_PREFIX)) {
                                localStorage.removeItem(key);
                            }
                        }
                        // Try again
                        const storageKey = `${CONFIG.SYSTEM.STORAGE_PREFIX}${key}`;
                        const stringValue = JSON.stringify(value);
                        localStorage.setItem(storageKey, stringValue);
                        return true;
                    } catch (e) {
                        console.error('Failed to clear storage:', e);
                    }
                }
                
                return false;
            }
        },
        
        // Load from localStorage with error handling
        loadFromStorage: (key, defaultValue = null) => {
            try {
                if (typeof localStorage === 'undefined') {
                    console.warn('localStorage is not available');
                    return defaultValue;
                }
                
                const storageKey = `${CONFIG.SYSTEM.STORAGE_PREFIX}${key}`;
                const item = localStorage.getItem(storageKey);
                
                if (!item) return defaultValue;
                
                return JSON.parse(item);
                
            } catch (error) {
                console.error('Error loading from storage:', error);
                return defaultValue;
            }
        },
        
        // Clear specific storage key
        clearStorage: (key) => {
            try {
                if (typeof localStorage === 'undefined') return false;
                
                const storageKey = `${CONFIG.SYSTEM.STORAGE_PREFIX}${key}`;
                localStorage.removeItem(storageKey);
                return true;
                
            } catch (error) {
                console.error('Error clearing storage:', error);
                return false;
            }
        },
        
        // Clear all app storage
        clearAllStorage: () => {
            try {
                if (typeof localStorage === 'undefined') return false;
                
                const prefix = CONFIG.SYSTEM.STORAGE_PREFIX;
                const keysToRemove = [];
                
                // Collect keys to remove
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keysToRemove.push(key);
                    }
                }
                
                // Remove collected keys
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                });
                
                return true;
                
            } catch (error) {
                console.error('Error clearing all storage:', error);
                return false;
            }
        },
        
        // Show browser notification
        showNotification: (title, options = {}) => {
            try {
                // Check if browser supports notifications
                if (!('Notification' in window)) {
                    console.log('This browser does not support notifications');
                    return false;
                }
                
                // Check current permission
                if (Notification.permission === 'granted') {
                    new Notification(title, {
                        icon: options.icon || '/favicon.ico',
                        body: options.body || '',
                        tag: options.tag || 'esp32-notification',
                        ...options
                    });
                    return true;
                }
                
                // Request permission if not denied
                if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            new Notification(title, {
                                icon: options.icon || '/favicon.ico',
                                body: options.body || '',
                                tag: options.tag || 'esp32-notification',
                                ...options
                            });
                        }
                    });
                }
                
                return false;
                
            } catch (error) {
                console.error('Error showing notification:', error);
                return false;
            }
        },
        
        // Debounce function
        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        // Throttle function
        throttle: (func, limit) => {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func(...args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        // Deep clone object
        deepClone: (obj) => {
            try {
                return JSON.parse(JSON.stringify(obj));
            } catch (error) {
                console.error('Error cloning object:', error);
                return null;
            }
        },
        
        // Merge objects deeply
        deepMerge: (target, source) => {
            const output = Object.assign({}, target);
            
            if (CONFIG.UTILS.isObject(target) && CONFIG.UTILS.isObject(source)) {
                Object.keys(source).forEach(key => {
                    if (CONFIG.UTILS.isObject(source[key])) {
                        if (!(key in target)) {
                            Object.assign(output, { [key]: source[key] });
                        } else {
                            output[key] = CONFIG.UTILS.deepMerge(target[key], source[key]);
                        }
                    } else {
                        Object.assign(output, { [key]: source[key] });
                    }
                });
            }
            
            return output;
        },
        
        // Check if value is an object
        isObject: (item) => {
            return item && typeof item === 'object' && !Array.isArray(item);
        },
        
        // Get current timestamp
        getTimestamp: () => {
            return Date.now();
        },
        
        // Format date for display
        formatDate: (timestamp = Date.now()) => {
            const date = new Date(timestamp);
            return date.toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // Validate alarm parameters
        validateAlarm: (hour, minute, sound) => {
            const h = parseInt(hour);
            const m = parseInt(minute);
            const s = parseInt(sound);
            
            if (isNaN(h) || h < 0 || h > 23) return false;
            if (isNaN(m) || m < 0 || m > 59) return false;
            if (isNaN(s) || s < 0 || s > CONFIG.ALARM.SOUNDS.length - 1) return false;
            
            return true;
        },
        
        // Get browser info
        getBrowserInfo: () => {
            const ua = navigator.userAgent;
            let browser = 'unknown';
            let version = 'unknown';
            
            if (ua.includes('Chrome') && !ua.includes('Edge')) {
                browser = 'chrome';
                const match = ua.match(/Chrome\/(\d+)/);
                version = match ? match[1] : 'unknown';
            } else if (ua.includes('Firefox')) {
                browser = 'firefox';
                const match = ua.match(/Firefox\/(\d+)/);
                version = match ? match[1] : 'unknown';
            } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
                browser = 'safari';
                const match = ua.match(/Version\/(\d+)/);
                version = match ? match[1] : 'unknown';
            } else if (ua.includes('Edge')) {
                browser = 'edge';
                const match = ua.match(/Edge\/(\d+)/);
                version = match ? match[1] : 'unknown';
            }
            
            return { browser, version, userAgent: ua };
        },
        
        // Check if browser is supported
        isBrowserSupported: () => {
            const info = CONFIG.UTILS.getBrowserInfo();
            if (!CONFIG.SYSTEM.SUPPORTED_BROWSERS.includes(info.browser)) {
                return false;
            }
            
            const versionNum = parseInt(info.version);
            return !isNaN(versionNum) && versionNum >= CONFIG.SYSTEM.MIN_BROWSER_VERSION;
        },
        
        // Get client IP address (async)
        getClientIP: async () => {
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                return data.ip;
            } catch (error) {
                console.warn('Could not get public IP:', error);
                return 'unknown';
            }
        },
        
        // Generate QR code data URL
        generateQRCodeData: (text) => {
            try {
                // This would use a QR code library in practice
                // For now, return a placeholder
                return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
            } catch (error) {
                console.error('Error generating QR code:', error);
                return null;
            }
        },
        
        // Parse MQTT message
        parseMQTTMessage: (message) => {
            try {
                if (typeof message === 'string') {
                    return JSON.parse(message);
                } else if (message instanceof ArrayBuffer || message instanceof Buffer) {
                    const text = new TextDecoder().decode(message);
                    return JSON.parse(text);
                } else {
                    return message;
                }
            } catch (error) {
                // If not JSON, return as string
                if (typeof message === 'string') {
                    return message;
                } else if (message instanceof ArrayBuffer || message instanceof Buffer) {
                    return new TextDecoder().decode(message);
                } else {
                    return String(message);
                }
            }
        }
    }
};

/**
 * Initialize configuration on first load
 */
function initializeConfig() {
    try {
        // Update client ID with fresh one
        CONFIG.MQTT.OPTIONS.clientId = CONFIG.UTILS.generateClientId();
        
        // Load saved settings from localStorage
        const savedSettings = CONFIG.UTILS.loadFromStorage(
            CONFIG.SYSTEM.STORAGE_KEY,
            {}
        );
        
        // Merge saved settings with defaults (saved settings take priority)
        CONFIG.SETTINGS = CONFIG.UTILS.deepMerge(
            CONFIG.UTILS.deepClone(CONFIG.DEFAULTS),
            savedSettings
        );
        
        // Ensure required settings exist
        const requiredSettings = ['connectionMode', 'alarmEnabled', 'theme'];
        requiredSettings.forEach(setting => {
            if (!(setting in CONFIG.SETTINGS)) {
                CONFIG.SETTINGS[setting] = CONFIG.DEFAULTS[setting.toUpperCase()];
            }
        });
        
        // Update MQTT broker if user has a preferred one
        if (CONFIG.SETTINGS.preferredBroker && CONFIG.SETTINGS.preferredBroker !== CONFIG.MQTT.BROKER) {
            CONFIG.MQTT.BROKER = CONFIG.SETTINGS.preferredBroker;
        }
        
        // Set up auto-save if enabled
        if (CONFIG.SYSTEM.AUTO_SAVE) {
            window.addEventListener('beforeunload', () => {
                saveCurrentSettings();
            });
            
            // Also save on page hide (for mobile)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    saveCurrentSettings();
                }
            });
        }
        
        console.log('✅ Configuration initialized successfully');
        console.log('📱 Settings loaded:', Object.keys(CONFIG.SETTINGS).length, 'items');
        
        // Log browser compatibility
        const browserInfo = CONFIG.UTILS.getBrowserInfo();
        const supported = CONFIG.UTILS.isBrowserSupported();
        console.log(`🌐 Browser: ${browserInfo.browser} ${browserInfo.version} (${supported ? '✅ Supported' : '⚠️ Not fully supported'})`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error initializing configuration:', error);
        
        // Fallback to defaults on error
        CONFIG.SETTINGS = CONFIG.UTILS.deepClone(CONFIG.DEFAULTS);
        
        // Try to save defaults
        try {
            CONFIG.UTILS.saveToStorage(CONFIG.SYSTEM.STORAGE_KEY, CONFIG.SETTINGS);
        } catch (e) {
            console.error('Could not save default settings:', e);
        }
        
        return false;
    }
}

/**
 * Save current settings to storage
 */
function saveCurrentSettings() {
    try {
        const success = CONFIG.UTILS.saveToStorage(
            CONFIG.SYSTEM.STORAGE_KEY,
            CONFIG.SETTINGS
        );
        
        if (success && CONFIG.SYSTEM.LOG_LEVEL === 'debug') {
            console.log('💾 Settings saved successfully');
        }
        
        return success;
        
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
    try {
        CONFIG.SETTINGS = CONFIG.UTILS.deepClone(CONFIG.DEFAULTS);
        CONFIG.UTILS.clearStorage(CONFIG.SYSTEM.STORAGE_KEY);
        
        // Update MQTT broker back to default
        CONFIG.MQTT.BROKER = CONFIG.DEFAULTS.PREFERRED_BROKER;
        
        console.log('🔄 Settings reset to defaults');
        
        // Show notification
        CONFIG.UTILS.showNotification('ESP32 Smart Clock', {
            body: 'Settings have been reset to defaults',
            icon: '/favicon.ico'
        });
        
        return true;
        
    } catch (error) {
        console.error('Error resetting settings:', error);
        return false;
    }
}

/**
 * Update a specific setting
 */
function updateSetting(key, value) {
    try {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid setting key');
        }
        
        // Special handling for broker change
        if (key === 'preferredBroker' && value) {
            CONFIG.MQTT.BROKER = value;
        }
        
        // Deep merge for nested objects
        if (CONFIG.UTILS.isObject(value) && CONFIG.UTILS.isObject(CONFIG.SETTINGS[key])) {
            CONFIG.SETTINGS[key] = CONFIG.UTILS.deepMerge(CONFIG.SETTINGS[key], value);
        } else {
            CONFIG.SETTINGS[key] = value;
        }
        
        // Auto-save if enabled
        if (CONFIG.SYSTEM.AUTO_SAVE) {
            saveCurrentSettings();
        }
        
        if (CONFIG.SYSTEM.LOG_LEVEL === 'debug') {
            console.log(`⚙️ Setting updated: ${key} =`, value);
        }
        
        return true;
        
    } catch (error) {
        console.error(`Error updating setting ${key}:`, error);
        return false;
    }
}

/**
 * Get a specific setting
 */
function getSetting(key, defaultValue = null) {
    try {
        const keys = key.split('.');
        let value = CONFIG.SETTINGS;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
        
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return defaultValue;
    }
}

/**
 * Export configuration for use in other files
 */
function exportConfig() {
    return {
        // Core config (read-only)
        MQTT: CONFIG.MQTT,
        WEBSOCKET: CONFIG.WEBSOCKET,
        HTTP: CONFIG.HTTP,
        UI: CONFIG.UI,
        ALARM: CONFIG.ALARM,
        BUTTONS: CONFIG.BUTTONS,
        SYSTEM: CONFIG.SYSTEM,
        COMMANDS: CONFIG.COMMANDS,
        MODES: CONFIG.MODES,
        DEFAULTS: CONFIG.DEFAULTS,
        
        // Utility functions
        UTILS: CONFIG.UTILS,
        
        // Settings (read/write via functions)
        get SETTINGS() { return CONFIG.UTILS.deepClone(CONFIG.SETTINGS); },
        
        // Management functions
        initialize: initializeConfig,
        save: saveCurrentSettings,
        reset: resetSettings,
        update: updateSetting,
        get: getSetting,
        
        // Quick access helpers
        getAlarmTime: () => {
            return {
                hour: getSetting('alarmHour', CONFIG.ALARM.DEFAULT_HOUR),
                minute: getSetting('alarmMinute', CONFIG.ALARM.DEFAULT_MINUTE),
                sound: getSetting('alarmSound', 0),
                enabled: getSetting('alarmEnabled', false)
            };
        },
        
        getConnectionInfo: () => {
            return {
                mode: getSetting('connectionMode', 'mqtt'),
                broker: getSetting('preferredBroker', CONFIG.MQTT.BROKER),
                lastIP: getSetting('lastConnectedIP', ''),
                autoConnect: getSetting('autoConnect', true)
            };
        }
    };
}

// Initialize on load (only in browser)
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeConfig);
    } else {
        setTimeout(initializeConfig, 100);
    }
    
    // Export to global scope
    window.ESP32_CONFIG = exportConfig();
    console.log('🌐 ESP32 Configuration Module loaded');
}

// Export for Node.js/ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportConfig();
}

// Example usage:
/*
// 1. Access configuration
console.log('MQTT Broker:', ESP32_CONFIG.MQTT.BROKER);
console.log('Current theme:', ESP32_CONFIG.get('theme'));

// 2. Create commands
const alarmCommand = ESP32_CONFIG.COMMANDS.SET_ALARM(7, 30, 0, true);
console.log('Alarm command:', alarmCommand);

// 3. Update settings
ESP32_CONFIG.update('theme', 'dark');
ESP32_CONFIG.update('alarmHour', 8);

// 4. Quick access
const alarmTime = ESP32_CONFIG.getAlarmTime();
console.log('Alarm set for:', alarmTime.hour + ':' + alarmTime.minute);

// 5. Use utilities
const ip = await ESP32_CONFIG.UTILS.getClientIP();
console.log('Client IP:', ip);

// 6. Browser check
if (!ESP32_CONFIG.UTILS.isBrowserSupported()) {
    alert('Please update your browser for best experience');
}
*/
