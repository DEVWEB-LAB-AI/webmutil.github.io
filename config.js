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
            password: 'public'
        },
        TOPICS: {
            COMMAND: 'smartclock/command',
            STATUS: 'smartclock/status',
            ALARM: 'smartclock/alarm',
            SENSORS: 'smartclock/sensors',
            TEST: 'smartclock/test'
        }
    },
    
    // WebSocket Configuration (Direct connection to ESP32 - optional)
    WEBSOCKET: {
        PORT: 81,
        RECONNECT_DELAY: 3000,
        PING_INTERVAL: 30000
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
            SERVICE_WORKER: '/sw.js'
        },
        TIMEOUT: 5000,
        RETRY_COUNT: 3
    },
    
    // UI Configuration
    UI: {
        REFRESH_INTERVAL: 10000, // 10 seconds for MQTT updates
        TOAST_DURATION: 3000,
        CONNECTION_TIMEOUT: 5000,
        AUTO_CONNECT_DELAY: 1000,
        DEBOUNCE_DELAY: 300,
        ANIMATION_DURATION: 300
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
        SNOOZE_MINUTES: 5
    },
    
    // Button Mappings
    BUTTONS: {
        1: { name: 'Nút 1', color: 'green', action: 'Chọn/Enter', icon: '🟢' },
        2: { name: 'Nút 2', color: 'blue', action: 'Tăng giá trị', icon: '🔵' },
        3: { name: 'Nút 3', color: 'red', action: 'Giảm giá trị', icon: '🔴' }
    },
    
    // System Configuration
    SYSTEM: {
        AUTO_SAVE: true,
        STORAGE_KEY: 'esp32_smart_clock_config',
        STORAGE_PREFIX: 'esp32_',
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        MAX_LOG_ENTRIES: 100,
        VERSION: '1.0.0'
    },
    
    // MQTT Command Templates
    COMMANDS: {
        SET_ALARM: (hour, minute, sound, enabled) => ({
            command: 'setAlarm',
            data: {
                hour: parseInt(hour) || 0,
                minute: parseInt(minute) || 0,
                sound: parseInt(sound) || 0,
                enable: enabled ? 1 : 0
            },
            timestamp: Date.now()
        }),
        
        BUTTON: (button) => ({
            command: 'button',
            data: { 
                btn: parseInt(button) || 1 
            },
            timestamp: Date.now()
        }),
        
        SNOOZE: () => ({
            command: 'snooze',
            data: {},
            timestamp: Date.now()
        }),
        
        RESET: () => ({
            command: 'reset',
            data: {},
            timestamp: Date.now()
        }),
        
        GET_STATUS: () => ({
            command: 'get_status',
            data: {},
            timestamp: Date.now()
        }),
        
        TEST: (message) => ({
            command: 'test',
            data: { 
                message: message || 'Test from web client' 
            },
            timestamp: Date.now()
        }),
        
        SET_TIME: (hour, minute, second) => ({
            command: 'set_time',
            data: {
                hour: parseInt(hour) || 0,
                minute: parseInt(minute) || 0,
                second: parseInt(second) || 0
            },
            timestamp: Date.now()
        })
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
        alarmEnabled: false,
        theme: 'light', // 'light', 'dark', 'auto'
        language: 'vi',
        notifications: true,
        autoConnect: true,
        soundVolume: 80,
        lastConnectedIP: '',
        alarmHour: 7,
        alarmMinute: 30,
        alarmSound: 0
    },
    
    // Default Values (Fallback if settings not found)
    DEFAULTS: {
        CONNECTION_MODE: 'mqtt',
        ALARM_ENABLED: false,
        THEME: 'light',
        LANGUAGE: 'vi',
        NOTIFICATIONS: true,
        AUTO_CONNECT: true,
        SOUND_VOLUME: 80
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
                        const keysToKeep = [CONFIG.SYSTEM.STORAGE_KEY];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && !keysToKeep.includes(key) && key.startsWith(CONFIG.SYSTEM.STORAGE_PREFIX)) {
                                localStorage.removeItem(key);
                            }
                        }
                        // Try again
                        return CONFIG.UTILS.saveToStorage(key, value);
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
            
            if (this.isObject(target) && this.isObject(source)) {
                Object.keys(source).forEach(key => {
                    if (this.isObject(source[key])) {
                        if (!(key in target)) {
                            Object.assign(output, { [key]: source[key] });
                        } else {
                            output[key] = this.deepMerge(target[key], source[key]);
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
        if (!CONFIG.SETTINGS.connectionMode) {
            CONFIG.SETTINGS.connectionMode = CONFIG.DEFAULTS.CONNECTION_MODE;
        }
        
        if (typeof CONFIG.SETTINGS.alarmEnabled === 'undefined') {
            CONFIG.SETTINGS.alarmEnabled = CONFIG.DEFAULTS.ALARM_ENABLED;
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
        console.log('📱 Settings:', CONFIG.SETTINGS);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error initializing configuration:', error);
        
        // Fallback to defaults on error
        CONFIG.SETTINGS = CONFIG.UTILS.deepClone(CONFIG.DEFAULTS);
        
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
        
        if (success) {
            console.log('💾 Settings saved successfully');
        } else {
            console.warn('⚠️ Failed to save settings');
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
        
        console.log('🔄 Settings reset to defaults');
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
        
        console.log(`⚙️ Setting updated: ${key} =`, value);
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
        get: getSetting
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
    console.log('🌐 ESP32 Configuration loaded');
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

// 2. Update settings
ESP32_CONFIG.update('theme', 'dark');
ESP32_CONFIG.update('alarmHour', 8);

// 3. Save manually (auto-save is enabled by default)
ESP32_CONFIG.save();

// 4. Reset to defaults
ESP32_CONFIG.reset();

// 5. Use utility functions
const clientId = ESP32_CONFIG.UTILS.generateClientId();
const formattedTime = ESP32_CONFIG.UTILS.formatTime(9, 5);
*/
