// ESP32 Smart Clock Web Control Configuration
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
        DEBOUNCE_DELAY: 300
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
        MAX_MINUTE: 59
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
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        MAX_LOG_ENTRIES: 100
    },
    
    // MQTT Command Templates
    COMMANDS: {
        SET_ALARM: (hour, minute, sound, enabled) => ({
            command: 'setAlarm',
            data: {
                hour: parseInt(hour),
                minute: parseInt(minute),
                sound: parseInt(sound),
                enable: enabled ? 1 : 0
            },
            timestamp: Date.now()
        }),
        
        BUTTON: (button) => ({
            command: 'button',
            data: { btn: parseInt(button) },
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
            data: { message: message || 'Test from web client' },
            timestamp: Date.now()
        })
    },
    
    // Connection Modes
    MODES: {
        MQTT: 'mqtt',
        HTTP: 'http',
        WEBSOCKET: 'websocket',
        AUTO: 'auto'
    },
    
    // Default Settings
    DEFAULTS: {
        CONNECTION_MODE: 'mqtt',
        ALARM_ENABLED: false,
        THEME: 'light', // 'light', 'dark', 'auto'
        LANGUAGE: 'vi',
        NOTIFICATIONS: true
    },
    
    // Utility Functions
    UTILS: {
        // Generate random client ID
        generateClientId: () => {
            return 'web_' + Math.random().toString(16).substr(2, 8);
        },
        
        // Format time (HH:MM)
        formatTime: (hour, minute) => {
            return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        },
        
        // Validate IP address
        isValidIP: (ip) => {
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(ip)) return false;
            
            const parts = ip.split('.');
            return parts.every(part => {
                const num = parseInt(part);
                return num >= 0 && num <= 255;
            });
        },
        
        // Save to localStorage
        saveToStorage: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Error saving to storage:', error);
                return false;
            }
        },
        
        // Load from localStorage
        loadFromStorage: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Error loading from storage:', error);
                return defaultValue;
            }
        },
        
        // Show notification
        showNotification: (title, options = {}) => {
            if (!("Notification" in window)) {
                console.log("This browser does not support notifications");
                return;
            }
            
            if (Notification.permission === "granted") {
                new Notification(title, options);
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification(title, options);
                    }
                });
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
        }
    }
};

// Initialize default settings on first load
(function init() {
    // Set default client ID
    CONFIG.MQTT.OPTIONS.clientId = CONFIG.UTILS.generateClientId();
    
    // Load saved settings
    const savedSettings = CONFIG.UTILS.loadFromStorage(CONFIG.SYSTEM.STORAGE_KEY, {});
    
    // Merge with defaults
    CONFIG.DEFAULTS = { ...CONFIG.DEFAULTS, ...savedSettings };
    
    // Auto-save if enabled
    if (CONFIG.SYSTEM.AUTO_SAVE) {
        window.addEventListener('beforeunload', () => {
            CONFIG.UTILS.saveToStorage(CONFIG.SYSTEM.STORAGE_KEY, CONFIG.DEFAULTS);
        });
    }
})();

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
