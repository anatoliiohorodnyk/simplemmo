// ==UserScript==
// @name         Simple MMO Auto-Step Core
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Core functionality for Simple MMO Auto-Step
// @author       You
// @match        https://web.simple-mmo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.cloudflare.com
// @run-at       document-end
// @require      https://github.com/anatoliiohorodnyk/simplemmo/raw/refs/heads/master/ui.js
// @require      https://github.com/anatoliiohorodnyk/simplemmo/raw/refs/heads/master/3-captcha-solver.js
// @require      https://github.com/anatoliiohorodnyk/simplemmo/raw/refs/heads/master/4-auto-stepper.js
// @require      https://github.com/anatoliiohorodnyk/simplemmo/raw/refs/heads/master/5-utils.js
// ==/UserScript==

(function() {
    'use strict';
    
    // Debug flag - configurable through UI - declared first so it's available to all functions
    let DEBUG = false;
    
    // Cloudflare API configuration
    const CLOUDFLARE_ACCOUNT_ID = "7a342880dca3edfec5a40d32e8282348";
    const CLOUDFLARE_API_TOKEN = "Lo1AmHbobGI6NEszB0_9J0xvt1WfYDpXkKFvMK6Q";
    const MODEL = "@cf/llava-hf/llava-1.5-7b-hf";
    
    // Constants
    const CAPTCHA_COOLDOWN = 30000; // 30 seconds cooldown
    
    // Variables for state tracking
    let isRunning = false;
    let isCaptchaDetected = false;
    let captchaAnalysisInProgress = false;
    let autoClickInterval;
    let lastCaptchaStatus = '';
    let lastUrl = window.location.href;
    let recentlyCompletedCaptcha = false;
    const imageAnalysisCache = new Map();
    
    // Log tracking to prevent duplicates
    const recentLogs = new Set();
    const LOG_EXPIRY_TIME = 5000; // 5 seconds before a log can repeat
    
    // Add global styles to ensure overlay is visible on all pages
    GM_addStyle(`
        #auto-step-overlay {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background-color: rgba(0, 0, 0, 0.8) !important;
            padding: 15px !important;
            border-radius: 5px !important;
            z-index: 9999999 !important;
            color: white !important;
            font-family: Arial, sans-serif !important;
            min-width: 200px !important;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
    `);
    
    // Load DEBUG setting from localStorage right away
    try {
        DEBUG = localStorage.getItem('smmoDebugEnabled') === 'true';
    } catch (e) {
        // Ignore errors when accessing localStorage
    }
    
    // Initialize the app once DOM is loaded
    function initApp() {
        // Create and add UI to the page
        createUI();
        
        // Initialize event listeners
        initEventListeners();
        
        // Load saved states
        loadSavedStates();
        
        // Check captcha state immediately
        checkCaptcha();
        
        // Start auto-stepping if it was enabled in saved state
        const savedState = localStorage.getItem('smmoAutoStepEnabled') === 'true';
        if (savedState && !isCaptchaDetected) {
            document.getElementById('auto-step-overlay').style.backgroundColor = 'rgba(0, 100, 0, 0.8)';
            startAutoClick();
        }
        
        // Set up URL change observer
        setupUrlObserver();
        
        // Set up captcha check interval
        setupCaptchaCheckInterval();
        
        console.log('Simple MMO Auto-Step v1.7 loaded!');
    }
    
    // Set up observer for URL changes
    function setupUrlObserver() {
        const urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                // Reset captcha status when URL changes
                lastCaptchaStatus = '';
                // Immediate check when URL changes, if not already analyzing
                if (!captchaAnalysisInProgress) {
                    checkCaptcha();
                }
            }
        });
        
        // Start observing URL changes
        urlObserver.observe(document, { subtree: true, childList: true });
    }
    
    // Set up interval to check for captcha
    function setupCaptchaCheckInterval() {
        setInterval(() => {
            try {
                // Only run if not already analyzing and not recently completed
                if (!captchaAnalysisInProgress && !recentlyCompletedCaptcha) {
                    checkCaptcha();
                }
                
                // Make sure overlay is always present
                ensureOverlayExists();
            } catch (error) {
                console.error("[SMMO Auto-Step] Error in interval check:", error);
            }
        }, 15000);
    }
    
    // Initialize the app when the DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
    
    // Expose necessary variables and functions to global scope for other modules
    window.smmoAutoStep = {
        debug: DEBUG,
        setDebug: (value) => { DEBUG = value; },
        cloudflareConfig: {
            accountId: CLOUDFLARE_ACCOUNT_ID,
            apiToken: CLOUDFLARE_API_TOKEN,
            model: MODEL
        },
        captchaCooldown: CAPTCHA_COOLDOWN,
        state: {
            isRunning,
            setIsRunning: (value) => { isRunning = value; },
            isCaptchaDetected,
            setIsCaptchaDetected: (value) => { isCaptchaDetected = value; },
            captchaAnalysisInProgress,
            setCaptchaAnalysisInProgress: (value) => { captchaAnalysisInProgress = value; },
            autoClickInterval,
            setAutoClickInterval: (value) => { autoClickInterval = value; },
            lastCaptchaStatus,
            setLastCaptchaStatus: (value) => { lastCaptchaStatus = value; },
            recentlyCompletedCaptcha,
            setRecentlyCompletedCaptcha: (value) => { recentlyCompletedCaptcha = value; },
            imageAnalysisCache
        },
        logs: {
            recentLogs,
            logExpiryTime: LOG_EXPIRY_TIME
        }
    };
})();