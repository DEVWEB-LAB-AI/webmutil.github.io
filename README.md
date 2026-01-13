<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trang Web Đơn Giản</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background-color: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Header */
        header {
            background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            color: white;
            padding: 2rem 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .logo {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }
        
        .logo i {
            color: #ffdd40;
        }
        
        .tagline {
            font-size: 1.2rem;
            opacity: 0.9;
            max-width: 600px;
            margin: 0 auto;
        }
        
        /* Navigation */
        nav {
            background-color: white;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .nav-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 0;
        }
        
        .nav-links {
            display: flex;
            list-style: none;
            gap: 2rem;
        }
        
        .nav-links a {
            text-decoration: none;
            color: #444;
            font-weight: 500;
            padding: 0.5rem 0;
            transition: color 0.3s;
            position: relative;
        }
        
        .nav-links a:hover {
            color: #2575fc;
        }
        
        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0;
            height: 2px;
            background-color: #2575fc;
            transition: width 0.3s;
        }
        
        .nav-links a:hover::after {
            width: 100%;
        }
        
        .mobile-toggle {
            display: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #444;
        }
        
        /* Main Content */
        main {
            padding: 3rem 0;
        }
        
        .section-title {
            text-align: center;
            margin-bottom: 2.5rem;
            color: #2c3e50;
        }
        
        .section-title h2 {
            font-size: 2.2rem;
            margin-bottom: 0.5rem;
        }
        
        .section-title p {
            color: #7f8c8d;
            max-width: 700px;
            margin: 0 auto;
        }
        
        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        
        .card {
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
        }
        
        .card-icon {
            background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            color: white;
            padding: 1.5rem;
            text-align: center;
            font-size: 2.5rem;
        }
        
        .card-content {
            padding: 1.5rem;
        }
        
        .card-content h3 {
            margin-bottom: 0.8rem;
            color: #2c3e50;
        }
        
        .card-content p {
            color: #666;
            margin-bottom: 1.2rem;
        }
        
        /* Features */
        .features {
            background-color: #f8f9fa;
            padding: 3rem 0;
            margin: 3rem 0;
            border-radius: 10px;
        }
        
        .feature-list {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 2rem;
        }
        
        .feature-item {
            flex: 1;
            min-width: 250px;
            text-align: center;
            padding: 1.5rem;
        }
        
        .feature-item i {
            font-size: 2.5rem;
            color: #2575fc;
            margin-bottom: 1rem;
        }
        
        /* Button */
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            color: white;
            padding: 0.8rem 1.8rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(37, 117, 252, 0.2);
        }
        
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(37, 117, 252, 0.3);
        }
        
        /* Counter Section */
        .counter-section {
            background-color: #2c3e50;
            color: white;
            padding: 3rem 0;
            text-align: center;
            border-radius: 10px;
            margin: 3rem 0;
        }
        
        .counter-container {
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 2rem;
        }
        
        .counter-item {
            padding: 1rem;
        }
        
        .counter-number {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: #ffdd40;
        }
        
        /* Form */
        .form-section {
            background-color: white;
            padding: 2.5rem;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
            max-width: 600px;
            margin: 0 auto;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #2c3e50;
        }
        
        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 0.8rem 1rem;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
            transition: border 0.3s;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #2575fc;
        }
        
        .form-group textarea {
            min-height: 150px;
            resize: vertical;
        }
        
        /* Footer */
        footer {
            background-color: #2c3e50;
            color: white;
            padding: 3rem 0 1.5rem;
            text-align: center;
        }
        
        .footer-content {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .footer-section {
            flex: 1;
            min-width: 250px;
        }
        
        .footer-section h3 {
            margin-bottom: 1.2rem;
            color: #ffdd40;
        }
        
        .social-links {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-top: 1.5rem;
        }
        
        .social-links a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            color: white;
            text-decoration: none;
            transition: background-color 0.3s, transform 0.3s;
        }
        
        .social-links a:hover {
            background-color: #2575fc;
            transform: translateY(-3px);
        }
        
        .copyright {
            padding-top: 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .nav-links {
                display: none;
                flex-direction: column;
                position: absolute;
                top: 100%;
                left: 0;
                width: 100%;
                background-color: white;
                padding: 1rem 0;
                box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
            }
            
            .nav-links.active {
                display: flex;
            }
            
            .mobile-toggle {
                display: block;
            }
            
            .logo {
                font-size: 2rem;
            }
            
            .section-title h2 {
                font-size: 1.8rem;
            }
            
            .counter-number {
                font-size: 2.5rem;
            }
        }
        
        @media (max-width: 480px) {
            .card-grid {
                grid-template-columns: 1fr;
            }
            
            .form-section {
                padding: 1.5rem;
            }
            
            .btn {
                padding: 0.7rem 1.5rem;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header>
        <div class="container">
            <div class="logo">
                <i class="fas fa-code"></i>
                <span>WEB MASTER</span>
            </div>
            <p class="tagline">Thiết kế và phát triển trang web hiện đại, responsive với HTML, CSS và JavaScript</p>
        </div>
    </header>

    <!-- Navigation -->
    <nav>
        <div class="container nav-container">
            <div class="logo-small">WEB</div>
            <ul class="nav-links">
                <li><a href="#"><i class="fas fa-home"></i> Trang chủ</a></li>
                <li><a href="#"><i class="fas fa-info-circle"></i> Giới thiệu</a></li>
                <li><a href="#"><i class="fas fa-th"></i> Dịch vụ</a></li>
                <li><a href="#"><i class="fas fa-images"></i> Portfolio</a></li>
                <li><a href="#"><i class="fas fa-envelope"></i> Liên hệ</a></li>
            </ul>
            <div class="mobile-toggle" id="mobileToggle">
                <i class="fas fa-bars"></i>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container">
        <!-- Introduction Section -->
        <section class="section-title">
            <h2>Chào mừng đến với trang web của chúng tôi</h2>
            <p>Chúng tôi cung cấp các giải pháp thiết kế web hiện đại, tối ưu và thân thiện với người dùng. Khám phá các dịch vụ của chúng tôi bên dưới.</p>
        </section>

        <!-- Cards Section -->
        <section class="card-grid">
            <div class="card">
                <div class="card-icon">
                    <i class="fas fa-paint-brush"></i>
                </div>
                <div class="card-content">
                    <h3>Thiết kế UI/UX</h3>
                    <p>Thiết kế giao diện người dùng hiện đại, trực quan và thân thiện, tối ưu trải nghiệm người dùng trên mọi thiết bị.</p>
                    <a href="#" class="btn">Tìm hiểu thêm</a>
                </div>
            </div>
            
            <div class="card">
                <div class="card-icon">
                    <i class="fas fa-laptop-code"></i>
                </div>
                <div class="card-content">
                    <h3>Phát triển Web</h3>
                    <p>Phát triển trang web responsive, tối ưu tốc độ tải và tương thích với mọi trình duyệt và thiết bị.</p>
                    <a href="#" class="btn">Tìm hiểu thêm</a>
                </div>
            </div>
            
            <div class="card">
                <div class="card-icon">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="card-content">
                    <h3>Ứng dụng Di động</h3>
                    <p>Phát triển ứng dụng di động đa nền tảng với hiệu năng cao và trải nghiệm người dùng vượt trội.</p>
                    <a href="#" class="btn">Tìm hiểu thêm</a>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section class="features">
            <div class="section-title">
                <h2>Tại sao chọn chúng tôi?</h2>
                <p>Với nhiều năm kinh nghiệm và đội ngũ chuyên gia, chúng tôi cam kết mang lại giá trị tốt nhất cho khách hàng.</p>
            </div>
            
            <div class="container">
                <div class="feature-list">
                    <div class="feature-item">
                        <i class="fas fa-rocket"></i>
                        <h3>Giao hàng nhanh</h3>
                        <p>Hoàn thành dự án đúng hẹn với chất lượng cao nhất.</p>
                    </div>
                    
                    <div class="feature-item">
                        <i class="fas fa-headset"></i>
                        <h3>Hỗ trợ 24/7</h3>
                        <p>Đội ngũ hỗ trợ luôn sẵn sàng giải đáp mọi thắc mắc.</p>
                    </div>
                    
                    <div class="feature-item">
                        <i class="fas fa-shield-alt"></i>
                        <h3>Bảo mật tối đa</h3>
                        <p>Đảm bảo an toàn dữ liệu và thông tin khách hàng.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Counter Section -->
        <section class="counter-section">
            <div class="section-title">
                <h2>Thành tích của chúng tôi</h2>
                <p>Những con số nói lên chất lượng và kinh nghiệm của chúng tôi</p>
            </div>
            
            <div class="counter-container">
                <div class="counter-item">
                    <div class="counter-number" id="projectCount">0</div>
                    <p>Dự án đã hoàn thành</p>
                </div>
                
                <div class="counter-item">
                    <div class="counter-number" id="clientCount">0</div>
                    <p>Khách hàng hài lòng</p>
                </div>
                
                <div class="counter-item">
                    <div class="counter-number" id="experienceCount">0</div>
                    <p>Năm kinh nghiệm</p>
                </div>
                
                <div class="counter-item">
                    <div class="counter-number" id="awardCount">0</div>
                    <p>Giải thưởng đạt được</p>
                </div>
            </div>
        </section>

        <!-- Contact Form -->
        <section>
            <div class="section-title">
                <h2>Liên hệ với chúng tôi</h2>
                <p>Hãy để lại thông tin, chúng tôi sẽ liên hệ lại với bạn trong thời gian sớm nhất</p>
            </div>
            
            <div class="form-section">
                <form id="contactForm">
                    <div class="form-group">
                        <label for="name">Họ và tên:</label>
                        <input type="text" id="name" required placeholder="Nhập họ và tên của bạn">
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" required placeholder="Nhập địa chỉ email">
                    </div>
                    
                    <div class="form-group">
                        <label for="message">Lời nhắn:</label>
                        <textarea id="message" required placeholder="Nhập nội dung lời nhắn của bạn"></textarea>
                    </div>
                    
                    <button type="submit" class="btn">Gửi thông tin</button>
                </form>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="footer-section">
                    <h3>WEB MASTER</h3>
                    <p>Chuyên thiết kế và phát triển website chuyên nghiệp, hiện đại và tối ưu trải nghiệm người dùng.</p>
                    <div class="social-links">
                        <a href="#"><i class="fab fa-facebook-f"></i></a>
                        <a href="#"><i class="fab fa-twitter"></i></a>
                        <a href="#"><i class="fab fa-instagram"></i></a>
                        <a href="#"><i class="fab fa-linkedin-in"></i></a>
                    </div>
                </div>
                
                <div class="footer-section">
                    <h3>Liên kết nhanh</h3>
                    <ul style="list-style: none;">
                        <li><a href="#" style="color: white; text-decoration: none;">Trang chủ</a></li>
                        <li><a href="#" style="color: white; text-decoration: none;">Giới thiệu</a></li>
                        <li><a href="#" style="color: white; text-decoration: none;">Dịch vụ</a></li>
                        <li><a href="#" style="color: white; text-decoration: none;">Liên hệ</a></li>
                    </ul>
                </div>
                
                <div class="footer-section">
                    <h3>Liên hệ</h3>
                    <p><i class="fas fa-map-marker-alt"></i> 123 Đường ABC, Quận 1, TP.HCM</p>
                    <p><i class="fas fa-phone"></i> (0123) 456 789</p>
                    <p><i class="fas fa-envelope"></i> info@webmaster.com</p>
                </div>
            </div>
            
            <div class="copyright">
                <p>&copy; 2023 WEB MASTER. Tất cả các quyền được bảo lưu.</p>
            </div>
        </div>
    </footer>

    <script>
        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobileToggle');
        const navLinks = document.querySelector('.nav-links');
        
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileToggle.innerHTML = navLinks.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
            });
        });
        
        // Counter animation
        const counters = document.querySelectorAll('.counter-number');
        const speed = 200;
        
        const animateCounters = () => {
            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target') || 
                    (counter.id === 'projectCount' ? 250 :
                     counter.id === 'clientCount' ? 180 :
                     counter.id === 'experienceCount' ? 12 :
                     counter.id === 'awardCount' ? 28 : 0));
                
                const count = parseInt(counter.innerText);
                const increment = target / speed;
                
                if (count < target) {
                    counter.innerText = Math.ceil(count + increment);
                    setTimeout(animateCounters, 10);
                } else {
                    counter.innerText = target;
                }
            });
        };
        
        // Start counter animation when scrolled into view
        const observerOptions = {
            threshold: 0.5
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Set initial values
                    document.getElementById('projectCount').innerText = '0';
                    document.getElementById('projectCount').setAttribute('data-target', '250');
                    
                    document.getElementById('clientCount').innerText = '0';
                    document.getElementById('clientCount').setAttribute('data-target', '180');
                    
                    document.getElementById('experienceCount').innerText = '0';
                    document.getElementById('experienceCount').setAttribute('data-target', '12');
                    
                    document.getElementById('awardCount').innerText = '0';
                    document.getElementById('awardCount').setAttribute('data-target', '28');
                    
                    animateCounters();
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        observer.observe(document.querySelector('.counter-section'));
        
        // Form submission
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;
            
            // Simple validation
            if (name && email && message) {
                // In a real application, you would send this data to a server
                // For this demo, we'll just show an alert
                alert(`Cảm ơn ${name}! Thông tin của bạn đã được gửi thành công. Chúng tôi sẽ liên hệ với bạn qua email: ${email} trong thời gian sớm nhất.`);
                
                // Reset form
                document.getElementById('contactForm').reset();
            } else {
                alert('Vui lòng điền đầy đủ thông tin vào tất cả các trường.');
            }
        });
        
        // Add some interactivity to cards
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                const icon = card.querySelector('.card-icon i');
                if (icon) {
                    icon.style.transform = 'scale(1.2)';
                    icon.style.transition = 'transform 0.3s ease';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                const icon = card.querySelector('.card-icon i');
                if (icon) {
                    icon.style.transform = 'scale(1)';
                }
            });
        });
    </script>
</body>
</html>
