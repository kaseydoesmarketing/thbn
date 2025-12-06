/**
 * ThumbnailBuilder Global Layout Component
 *
 * This module provides consistent header and footer across all pages.
 * Include this script in any HTML page to automatically inject the
 * branded header and footer with the ThumbnailBuilder.app logo.
 *
 * Usage: <script src="/components/global-layout.js"></script>
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        logoPath: '/assets/logo.svg',
        logoIconPath: '/assets/logo-icon.svg',
        brandName: 'ThumbnailBuilder',
        homeUrl: '/',
        navLinks: [
            { href: '/index.html', label: 'Dashboard', requiresAuth: true },
            { href: '/create.html', label: 'Create', requiresAuth: true },
            { href: '/library.html', label: 'Library', requiresAuth: true },
            { href: '/presets.html', label: 'Presets', requiresAuth: true },
            { href: '/account.html', label: 'Account', requiresAuth: true }
        ],
        publicNavLinks: [
            { href: '/home.html', label: 'Home' },
            { href: '/login.html', label: 'Login' }
        ]
    };

    // Check if user is authenticated (has token)
    function isAuthenticated() {
        return !!localStorage.getItem('token');
    }

    // Get current page path
    function getCurrentPage() {
        return window.location.pathname;
    }

    // Create the logo HTML (inline SVG for best performance)
    function createLogoSVG(size = 'default') {
        const width = size === 'small' ? 24 : 32;
        const height = size === 'small' ? 24 : 32;

        return `
            <svg width="${width}" height="${height}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="tbPlayGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#8B5CF6"/>
                        <stop offset="100%" style="stop-color:#3B82F6"/>
                    </linearGradient>
                    <filter id="tbGlow">
                        <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#tbPlayGradient)"/>
                <path d="M12 8L24 16L12 24V8Z" fill="white"/>
                <g fill="#FFD700" filter="url(#tbGlow)">
                    <circle cx="26" cy="6" r="2"/>
                    <path d="M26 2L26.5 5L29 4L26.5 5.5L28 8L26 6L24 8L25.5 5.5L23 4L25.5 5L26 2Z" fill="#FFD700"/>
                </g>
            </svg>
        `;
    }

    // Create Header HTML
    function createHeader() {
        const currentPage = getCurrentPage();
        const isLoggedIn = isAuthenticated();
        const navLinks = isLoggedIn ? CONFIG.navLinks : CONFIG.publicNavLinks;

        // Determine active link
        const navLinksHTML = navLinks.map(link => {
            const isActive = currentPage.includes(link.href.replace('.html', '')) ||
                           (link.href === '/index.html' && (currentPage === '/' || currentPage === '/index.html'));
            return `<a href="${link.href}" class="tb-nav-link ${isActive ? 'active' : ''}">${link.label}</a>`;
        }).join('');

        return `
            <header class="tb-global-header">
                <nav class="tb-nav">
                    <a href="${CONFIG.homeUrl}" class="tb-logo">
                        ${createLogoSVG()}
                        <span class="tb-logo-text">
                            <span class="tb-logo-primary">Thumbnail</span><span class="tb-logo-accent">Builder</span><span class="tb-logo-domain">.app</span>
                        </span>
                    </a>

                    <div class="tb-nav-links">
                        ${navLinksHTML}
                    </div>

                    <button class="tb-mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false">
                        <span class="tb-hamburger"></span>
                    </button>
                </nav>

                <div class="tb-mobile-menu">
                    ${navLinksHTML}
                </div>
            </header>
        `;
    }

    // Create Footer HTML
    function createFooter() {
        const year = new Date().getFullYear();

        return `
            <footer class="tb-global-footer">
                <div class="tb-footer-content">
                    <a href="${CONFIG.homeUrl}" class="tb-footer-logo">
                        ${createLogoSVG('small')}
                        <span class="tb-footer-logo-text">
                            <span class="tb-logo-primary">Thumbnail</span><span class="tb-logo-accent">Builder</span><span class="tb-logo-domain">.app</span>
                        </span>
                    </a>

                    <div class="tb-footer-links">
                        <a href="/home.html">Home</a>
                        <a href="/login.html">Login</a>
                    </div>

                    <p class="tb-footer-copyright">
                        &copy; ${year} ThumbnailBuilder.app. All rights reserved.
                    </p>
                </div>
            </footer>
        `;
    }

    // Inject styles
    function injectStyles() {
        const styles = `
            /* ThumbnailBuilder Global Layout Styles */

            /* Header */
            .tb-global-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                background: rgba(15, 15, 20, 0.95);
                backdrop-filter: blur(12px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .tb-nav {
                display: flex;
                align-items: center;
                justify-content: space-between;
                max-width: 1400px;
                margin: 0 auto;
                padding: 0.75rem 1.5rem;
            }

            .tb-logo {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                text-decoration: none;
                transition: opacity 0.2s;
            }

            .tb-logo:hover {
                opacity: 0.9;
            }

            .tb-logo-text {
                font-size: 1.125rem;
                font-weight: 700;
                letter-spacing: -0.02em;
            }

            .tb-logo-primary {
                color: #fff;
            }

            .tb-logo-accent {
                color: #8B5CF6;
            }

            .tb-logo-domain {
                color: #6B7280;
                font-size: 0.875rem;
                font-weight: 500;
            }

            .tb-nav-links {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .tb-nav-link {
                padding: 0.5rem 1rem;
                color: #9CA3AF;
                text-decoration: none;
                font-size: 0.875rem;
                font-weight: 500;
                border-radius: 8px;
                transition: color 0.2s, background 0.2s;
            }

            .tb-nav-link:hover {
                color: #fff;
                background: rgba(139, 92, 246, 0.1);
            }

            .tb-nav-link.active {
                color: #8B5CF6;
                background: rgba(139, 92, 246, 0.15);
            }

            /* Mobile menu button */
            .tb-mobile-menu-btn {
                display: none;
                padding: 0.5rem;
                background: none;
                border: none;
                cursor: pointer;
            }

            .tb-hamburger {
                display: block;
                width: 24px;
                height: 2px;
                background: #fff;
                position: relative;
                transition: background 0.2s;
            }

            .tb-hamburger::before,
            .tb-hamburger::after {
                content: '';
                position: absolute;
                left: 0;
                width: 24px;
                height: 2px;
                background: #fff;
                transition: transform 0.2s;
            }

            .tb-hamburger::before {
                top: -7px;
            }

            .tb-hamburger::after {
                top: 7px;
            }

            .tb-mobile-menu-btn[aria-expanded="true"] .tb-hamburger {
                background: transparent;
            }

            .tb-mobile-menu-btn[aria-expanded="true"] .tb-hamburger::before {
                transform: translateY(7px) rotate(45deg);
            }

            .tb-mobile-menu-btn[aria-expanded="true"] .tb-hamburger::after {
                transform: translateY(-7px) rotate(-45deg);
            }

            /* Mobile menu */
            .tb-mobile-menu {
                display: none;
                flex-direction: column;
                padding: 1rem;
                background: rgba(15, 15, 20, 0.98);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .tb-mobile-menu.open {
                display: flex;
            }

            .tb-mobile-menu .tb-nav-link {
                padding: 0.75rem 1rem;
                font-size: 1rem;
            }

            /* Footer */
            .tb-global-footer {
                background: rgba(15, 15, 20, 0.95);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding: 2rem 1.5rem;
                margin-top: auto;
            }

            .tb-footer-content {
                max-width: 1400px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1.5rem;
            }

            .tb-footer-logo {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                text-decoration: none;
            }

            .tb-footer-logo-text {
                font-size: 0.875rem;
                font-weight: 600;
            }

            .tb-footer-links {
                display: flex;
                gap: 2rem;
            }

            .tb-footer-links a {
                color: #9CA3AF;
                text-decoration: none;
                font-size: 0.875rem;
                transition: color 0.2s;
            }

            .tb-footer-links a:hover {
                color: #8B5CF6;
            }

            .tb-footer-copyright {
                color: #6B7280;
                font-size: 0.75rem;
                text-align: center;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .tb-nav-links {
                    display: none;
                }

                .tb-mobile-menu-btn {
                    display: block;
                }

                .tb-logo-text {
                    font-size: 1rem;
                }

                .tb-logo-domain {
                    display: none;
                }

                .tb-footer-content {
                    text-align: center;
                }

                .tb-footer-links {
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 1rem;
                }
            }

            /* Add padding to body for fixed header */
            body.tb-has-header {
                padding-top: 64px;
            }

            /* Ensure main content has minimum height for footer positioning */
            body.tb-has-footer {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }

            body.tb-has-footer main,
            body.tb-has-footer .main-content,
            body.tb-has-footer .app-container {
                flex: 1;
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'tb-global-layout-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    // Initialize mobile menu toggle
    function initMobileMenu() {
        const btn = document.querySelector('.tb-mobile-menu-btn');
        const menu = document.querySelector('.tb-mobile-menu');

        if (btn && menu) {
            btn.addEventListener('click', () => {
                const isOpen = btn.getAttribute('aria-expanded') === 'true';
                btn.setAttribute('aria-expanded', !isOpen);
                menu.classList.toggle('open', !isOpen);
            });
        }
    }

    // Initialize the global layout
    function init() {
        // Check if we should skip (for pages that opt out)
        if (document.body.hasAttribute('data-no-global-layout')) {
            return;
        }

        // Check if already initialized
        if (document.querySelector('.tb-global-header')) {
            return;
        }

        // Inject styles first
        injectStyles();

        // Determine what to inject based on data attributes
        const injectHeader = !document.body.hasAttribute('data-no-header');
        const injectFooter = !document.body.hasAttribute('data-no-footer');

        // Inject header
        if (injectHeader) {
            document.body.insertAdjacentHTML('afterbegin', createHeader());
            document.body.classList.add('tb-has-header');
        }

        // Inject footer
        if (injectFooter) {
            document.body.insertAdjacentHTML('beforeend', createFooter());
            document.body.classList.add('tb-has-footer');
        }

        // Initialize mobile menu
        initMobileMenu();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
