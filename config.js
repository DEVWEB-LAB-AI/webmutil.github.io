// ESP32 Smart Clock Web Control Configuration
const CONFIG = {
    // Default ESP32 IP (will be overridden by user input)
    DEFAULT_IP: '',
    
    // MQTT Configuration (if using MQTT for remote control)
    MQTT_BROKER: 'broker.emqx.io',
    MQTT_PORT: 8084,
    MQTT_TOPICS: {
        COMMAND: 'smartclock/command',
        STATUS: 'smartclock/status',
        ALARM: 'smartclock/alarm',
        SENSORS: 'smartclock/sensors'
    },
    
    // WebSocket Configuration (alternative to HTTP)
    WEBSOCKET_PORT: 81,
    
    // API Endpoints on ESP32
    ENDPOINTS: {
        ROOT: '/',
        SET_ALARM: '/setAlarm',
        SET_ALARM_DIRECT: '/setAlarmDirect',
        BUTTON: '/button',
        SNOOZE: '/snooze',
        RESET: '/reset',
        RESET_SLEEP: '/resetSleepTimer'
    },
    
    // UI Configuration
    UI: {
        REFRESH_INTERVAL: 10000, // 10 seconds
        TOAST_DURATION: 3000,
        CONNECTION_TIMEOUT: 5000
    },
    
    // Alarm Sounds
    ALARM_SOUNDS: [
        { id: 0, name: '🔔 Beep', description: 'Tiếng bip đơn giản' },
        { id: 1, name: '🎵 Melody 1', description: 'Giai điệu nhẹ nhàng' },
        { id: 2, name: '🎶 Melody 2', description: 'Giai điệu vui nhộn' }
    ],
    
    // Button Mappings
    BUTTONS: {
        1: { name: 'Nút 1', color: 'green', action: 'Chọn/Enter' },
        2: { name: 'Nút 2', color: 'blue', action: 'Tăng giá trị' },
        3: { name: 'Nút 3', color: 'red', action: 'Giảm giá trị' }
    }
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
