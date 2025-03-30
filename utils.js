// Utilities Module for Simple MMO Auto-Step
(function() {
    'use strict';
    
    // This module contains various utility functions that don't fit into the other categories
    
    // Function to check if the current page has any important action buttons
    window.hasActionButtons = function() {
        // Check for various action buttons that might be present on pages
        const battleButton = document.querySelector('a[href*="/battle/"]');
        const collectButton = document.querySelector('button[onclick*="collect"]');
        const gatherButton = document.querySelector('button[onclick*="gather"]');
        
        return battleButton || collectButton || gatherButton;
    };
    
    // Function to handle special page types
    window.handleSpecialPages = function() {
        const currentUrl = window.location.href;
        
        // Handle different special pages
        if (currentUrl.includes('/i-am-not-a-bot')) {
            // Captcha page, handled by captcha-solver module
            return true;
        }
        
        if (currentUrl.includes('/travel') || currentUrl.includes('/menu')) {
            // Don't auto-step on travel or menu pages
            return true;
        }
        
        // Check if we're on a page with action buttons
        if (hasActionButtons()) {
            addLog('Action buttons detected on page');
            return true;
        }
        
        return false;
    };
    
    // Function to detect game events from the page
    window.detectGameEvents = function() {
        // Look for notification elements
        const notificationElements = document.querySelectorAll('.notification, .alert');
        
        for (const element of notificationElements) {
            const text = element.textContent.toLowerCase();
            
            // Check for various events
            if (text.includes('found item') || text.includes('received item')) {
                addLog('Item found event detected');
            }
            
            if (text.includes('level up') || text.includes('leveled up')) {
                addLog('Level up event detected');
            }
            
            if (text.includes('battle')) {
                addLog('Battle event detected');
            }
        }
    };
    
    // Function to extract player info from the page
    window.extractPlayerInfo = function() {
        // This is a placeholder for potential future functionality
        // Extracting player level, gold, etc. from the page
        
        const playerInfo = {
            level: null,
            gold: null,
            steps: null
        };
        
        // Try to find level
        const levelElement = document.querySelector('[data-level]');
        if (levelElement) {
            playerInfo.level = levelElement.getAttribute('data-level');
        }
        
        // Try to find gold
        const goldElement = document.querySelector('[data-gold]');
        if (goldElement) {
            playerInfo.gold = goldElement.getAttribute('data-gold');
        }
        
        // Try to find steps
        const stepsElement = document.querySelector('[data-steps]');
        if (stepsElement) {
            playerInfo.steps = stepsElement.getAttribute('data-steps');
        }
        
        return playerInfo;
    };
})();