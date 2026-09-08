/* Enrique Alabort — personal site */
(function () {
    'use strict';

    var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var prefersReducedMotion = function () { return reduceMotionQuery.matches; };

    /* ===== Footer year ===== */
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* ===== Smooth scrolling for in-page links ===== */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({
                behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                block: 'start'
            });
        });
    });

    /* ===== Scroll indicator ===== */
    var scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function () {
            var about = document.querySelector('#about');
            if (about) {
                about.scrollIntoView({
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                    block: 'start'
                });
            }
        });
    }

    /* ===== Scroll-driven UI: nav visibility + scroll indicator fade ===== */
    var siteNav = document.getElementById('siteNav');
    var scrollTicking = false;

    function onScrollFrame() {
        scrollTicking = false;
        var y = window.scrollY;
        var vh = window.innerHeight;

        if (siteNav) siteNav.classList.toggle('is-visible', y > vh * 0.75);

        if (scrollIndicator) {
            var hidden = y > vh * 0.1;
            scrollIndicator.style.opacity = hidden ? '0' : '1';
            scrollIndicator.style.pointerEvents = hidden ? 'none' : 'auto';
        }
    }

    window.addEventListener('scroll', function () {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(onScrollFrame);
    }, { passive: true });
    onScrollFrame();

    /* ===== Active nav link ===== */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav-links a'));
    if (navLinks.length && 'IntersectionObserver' in window) {
        var linkById = {};
        navLinks.forEach(function (link) { linkById[link.getAttribute('href').slice(1)] = link; });

        var sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var link = linkById[entry.target.id];
                if (link) link.classList.toggle('is-active', entry.isIntersecting);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        Object.keys(linkById).forEach(function (id) {
            var section = document.getElementById(id);
            if (section) sectionObserver.observe(section);
        });
    }

    /* ===== Rotating words in the hero ===== */
    (function () {
        var dynamicWords = document.querySelectorAll('.dynamic-word');
        if (!dynamicWords.length || prefersReducedMotion()) return;

        dynamicWords.forEach(function (el, index) {
            var words;
            try {
                words = JSON.parse(el.getAttribute('data-words'));
            } catch (err) {
                return;
            }
            if (!Array.isArray(words) || words.length < 2) return;

            var currentIndex = 0;
            var timer = null;

            function rotate() {
                if (document.hidden) return;
                el.style.opacity = '0';
                el.style.transform = 'translateY(-10px)';
                setTimeout(function () {
                    currentIndex = (currentIndex + 1) % words.length;
                    el.textContent = words[currentIndex];
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 400);
            }

            setTimeout(function () {
                timer = setInterval(rotate, 3000);
            }, 3000 + index * 1500);

            reduceMotionQuery.addEventListener('change', function (e) {
                if (e.matches && timer) {
                    clearInterval(timer);
                    timer = null;
                }
            });
        });
    })();

    /* ===== Hero particle network ===== */
    (function () {
        var canvas = document.getElementById('heroCanvas');
        if (!canvas || prefersReducedMotion()) return;

        var ctx = canvas.getContext('2d');
        var particles = [];
        var rafId = null;
        var running = false;
        var inView = true;
        var width = 0;
        var height = 0;

        var MAX_DISTANCE = 180;
        var MAX_DISTANCE_SQ = MAX_DISTANCE * MAX_DISTANCE;

        function resize() {
            var dpr = window.devicePixelRatio || 1;
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function initParticles() {
            particles = [];
            var count = Math.min(Math.floor((width * height) / 10000), 120);
            for (var i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    r: Math.random() * 2 + 1
                });
            }
        }

        function frame() {
            ctx.clearRect(0, 0, width, height);

            var i, j, p;
            for (i = 0; i < particles.length; i++) {
                p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;
                p.x = Math.max(0, Math.min(width, p.x));
                p.y = Math.max(0, Math.min(height, p.y));

                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.lineWidth = 0.8;
            for (i = 0; i < particles.length; i++) {
                for (j = i + 1; j < particles.length; j++) {
                    var dx = particles[i].x - particles[j].x;
                    var dy = particles[i].y - particles[j].y;
                    var distSq = dx * dx + dy * dy;
                    if (distSq >= MAX_DISTANCE_SQ) continue;
                    var opacity = (1 - Math.sqrt(distSq) / MAX_DISTANCE) * 0.25;
                    ctx.strokeStyle = 'rgba(0, 0, 0, ' + opacity + ')';
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }

            rafId = window.requestAnimationFrame(frame);
        }

        function start() {
            if (running) return;
            running = true;
            rafId = window.requestAnimationFrame(frame);
        }

        function stop() {
            if (!running) return;
            running = false;
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }

        function sync() {
            if (inView && !document.hidden && !prefersReducedMotion()) start();
            else stop();
        }

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                resize();
                initParticles();
            }, 150);
        });

        document.addEventListener('visibilitychange', sync);
        reduceMotionQuery.addEventListener('change', sync);

        // Only animate while the hero is actually on screen.
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                inView = entries[0].isIntersecting;
                sync();
            }, { threshold: 0 }).observe(canvas);
        }

        resize();
        initParticles();
        sync();
    })();

    /* ===== Reveal on scroll ===== */
    (function () {
        var items = document.querySelectorAll('.timeline-item, .expertise-item, .research-area');
        if (!items.length) return;

        if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
            items.forEach(function (item) { item.classList.add('in-view'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        items.forEach(function (item) {
            item.style.opacity = '0';
            item.style.transform = 'translateY(30px)';
            item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(item);
        });
    })();
})();
