# ESP32 Smart Clock Web Control

Giao diện web điều khiển ESP32 Smart Clock từ xa qua Internet.

## 🌐 Live Demo
Truy cập:  https://devweb-lab-ai.github.io/esp32-smart-clock-control


## 🚀 Tính năng

### 1. **Điều khiển báo thức**
- Cài đặt giờ/phút báo thức
- Chọn âm thanh báo thức (3 loại)
- Bật/tắt báo thức
- Xem trạng thái báo thức

### 2. **Nút điều khiển ảo**
- Mô phỏng 3 nút vật lý trên ESP32
- Nút 1 (Xanh): Chọn/Enter
- Nút 2 (Lam): Tăng giá trị
- Nút 3 (Đỏ): Giảm giá trị
- Nút tắt chuông: Tạm dừng báo thức

### 3. **Thông tin hệ thống**
- Trạng thái kết nối ESP32
- Nhiệt độ & độ ẩm
- Cường độ WiFi
- Thời gian hoạt động (Uptime)
- Bộ nhớ còn trống

### 4. **Quản lý hệ thống**
- Khởi động lại ESP32 từ xa
- Reset timer auto-sleep
- Cập nhật thông tin thời gian thực

## 📋 Cài đặt

### **Bước 1: Upload code ESP32**
1. Upload code ESP32 Smart Clock lên board
2. Mở Serial Monitor để lấy địa chỉ IP

### **Bước 2: Deploy web lên GitHub**
1. Fork repository này
2. Vào Settings → Pages
3. Chọn branch `main` và folder `/ (root)`
4. Save và chờ deploy hoàn tất

### **Bước 3: Cấu hình**
1. Mở trang web đã deploy
2. Nhập địa chỉ IP ESP32 (ví dụ: 192.168.1.100)
3. Nhấn "Kết nối"

## 🔧 Cấu hình ESP32

### **1. Kích hoạt CORS (nếu cần)**
Trong code ESP32, thêm header CORS:

```cpp
server.enableCORS(true);
