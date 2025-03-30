// UI Module for Simple MMO Auto-Step
(function() {
    'use strict';
    
    // Variables for UI elements
    let overlay, contentContainer, header;
    let checkbox, captchaCheckbox, debugCheckbox, delayInput;
    let statusIndicator, logContainer;
    
    // Function to create the UI
    window.createUI = function() {
        // Create overlay container
        overlay = document.createElement('div');
        overlay.id = 'auto-step-overlay';
        
        // Create header
        header = document.createElement('div');
        header.textContent = 'SMMO Auto-Step v1.7';
        header.style.cssText = `
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
            border-bottom: 1px solid #555;
            padding-bottom: 5px;
        `;
        overlay.appendChild(header);
        
        // Create content container
        contentContainer = document.createElement('div');
        overlay.appendChild(contentContainer);
        
        // Create checkbox container for auto-step
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 12px;
        `;
        
        // Create checkbox for auto-step
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'enable-auto-step';
        checkbox.style.marginRight = '8px';
        
        // Create label for auto-step
        const label = document.createElement('label');
        label.htmlFor = 'enable-auto-step';
        label.textContent = 'Enable auto-step';
        label.style.cursor = 'pointer';
        
        // Add checkbox elements to container
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        contentContainer.appendChild(checkboxContainer);
        
        // Create checkbox container for captcha solving
        const captchaCheckboxContainer = document.createElement('div');
        captchaCheckboxContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 12px;
        `;
        
        // Create checkbox for captcha solving
        captchaCheckbox = document.createElement('input');
        captchaCheckbox.type = 'checkbox';
        captchaCheckbox.id = 'enable-captcha-solving';
        captchaCheckbox.style.marginRight = '8px';
        
        // Create label for captcha solving
        const captchaLabel = document.createElement('label');
        captchaLabel.htmlFor = 'enable-captcha-solving';
        captchaLabel.textContent = 'Auto-solve captcha (disabled)';
        captchaLabel.style.cursor = 'pointer';
        captchaLabel.style.color = '#999';
        
        // Add captcha checkbox elements to container
        captchaCheckboxContainer.appendChild(captchaCheckbox);
        captchaCheckboxContainer.appendChild(captchaLabel);
        contentContainer.appendChild(captchaCheckboxContainer);
        
        // Create debug mode checkbox container
        const debugCheckboxContainer = document.createElement('div');
        debugCheckboxContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 12px;
        `;
        
        // Create checkbox for debug mode
        debugCheckbox = document.createElement('input');
        debugCheckbox.type = 'checkbox';
        debugCheckbox.id = 'enable-debug-mode';
        debugCheckbox.style.marginRight = '8px';
        
        // Create label for debug mode
        const debugLabel = document.createElement('label');
        debugLabel.htmlFor = 'enable-debug-mode';
        debugLabel.textContent = 'Debug mode (verbose logs)';
        debugLabel.style.cursor = 'pointer';
        debugLabel.style.color = '#999';
        
        // Add debug checkbox elements to container
        debugCheckboxContainer.appendChild(debugCheckbox);
        debugCheckboxContainer.appendChild(debugLabel);
        contentContainer.appendChild(debugCheckboxContainer);
        
        // Create delay input container
        const delayContainer = document.createElement('div');
        delayContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            justify-content: space-between;
        `;
        
        // Create delay label
        const delayLabel = document.createElement('label');
        delayLabel.htmlFor = 'step-delay';
        delayLabel.textContent = 'Delay (ms):';
        delayLabel.style.marginRight = '8px';
        
        // Create delay input
        delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.id = 'step-delay';
        delayInput.min = '100';
        delayInput.value = '200';
        delayInput.style.cssText = `
            width: 70px;
            background-color: rgba(30, 30, 30, 0.8);
            color: white;
            border: 1px solid #555;
            border-radius: 3px;
            padding: 2px 5px;
        `;
        
        // Add delay elements to container
        delayContainer.appendChild(delayLabel);
        delayContainer.appendChild(delayInput);
        contentContainer.appendChild(delayContainer);
        
        // Create status indicator
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'auto-step-status';
        statusIndicator.style.cssText = `
            margin-top: 10px;
            font-size: 12px;
            text-align: center;
            color: #999;
        `;
        statusIndicator.textContent = 'Status: Waiting';
        contentContainer.appendChild(statusIndicator);
        
        // Create log container (for debugging)
        logContainer = document.createElement('div');
        logContainer.id = 'auto-step-log';
        logContainer.style.cssText = `
            margin-top: 10px;
            font-size: 10px;
            color: #777;
            max-height: 60px;
            overflow-y: auto;
        `;
        contentContainer.appendChild(logContainer);
        
        // Add minimize/maximize functionality
        const toggleButton = document.createElement('div');
        toggleButton.textContent = '−';
        toggleButton.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            cursor: pointer;
            font-weight: bold;
            font-size: 16px;
        `;
        
        let minimized = false;
        
        toggleButton.addEventListener('click', function() {
            minimized = !minimized;
            contentContainer.style.display = minimized ? 'none' : 'block';
            toggleButton.textContent = minimized ? '+' : '−';
            overlay.style.padding = minimized ? '5px' : '15px';
            if (minimized) {
                header.style.marginBottom = '0';
                header.style.borderBottom = 'none';
                header.style.paddingBottom = '0';
            } else {
                header.style.marginBottom = '10px';
                header.style.borderBottom = '1px solid #555';
                header.style.paddingBottom = '5px';
            }
        });
        
        header.appendChild(toggleButton);
        
        // Add the overlay to the page
        document.body.appendChild(overlay);
        
        // Make sure overlay is visible on all pages by setting high z-index and fixed position
        overlay.style.zIndex = "9999999";
        
        // Store references to UI elements for use in other modules
        window.uiElements = {
            overlay,
            contentContainer,
            header,
            checkbox,
            captchaCheckbox,
            debugCheckbox,
            delayInput,
            statusIndicator,
            logContainer,
            captchaLabel
        };
    };
    
    // Function to ensure overlay exists and is visible
    window.ensureOverlayExists = function() {
        if (!document.getElementById('auto-step-overlay')) {
            document.body.appendChild(overlay);
            console.log("Attached overlay to document");
        }
    };
    
    // Function to update status
    window.updateStatus = function(text, color = '#999') {
        statusIndicator.textContent = 'Status: ' + text;
        statusIndicator.style.color = color;
    };
    
    // Function to add log entry
    window.addLog = function(text) {
        const smmo = window.smmoAutoStep;
        
        // If the exact same text is already being logged, skip it
        if (smmo.logs.recentLogs.has(text)) return;
        
        // If not in debug mode, filter out non-essential logs
        if (!smmo.debug) {
            // Skip verbose logs about analyzing etc.
            if (text.includes("Analyzing ") && !text.includes("successful") && !text.includes("Found match")) {
                return;
            }
            // Skip other common verbose logs
            if (text.includes("API error") ||
                text.includes("Request ") ||
                text.includes("canceled") ||
                text.includes("disabled") ||
                text.includes("Skipping")) {
                return;
            }
        }
        
        // Add to recent logs with timeout to remove
        smmo.logs.recentLogs.add(text);
        setTimeout(() => smmo.logs.recentLogs.delete(text), smmo.logs.logExpiryTime);
        
        // Add to UI
        const logEntry = document.createElement('div');
        logEntry.textContent = text;
        logContainer.appendChild(logEntry);
        
        // Keep only last 5 log entries
        while(logContainer.children.length > 5) {
            logContainer.removeChild(logContainer.firstChild);
        }
        
        // Scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Always log to console for important logs
        if (text.includes("Found match") ||
            text.includes("Need to find") ||
            text.includes("successful") ||
            text.includes("Error")) {
            console.log("[SMMO Auto-Step] " + text);
        } else if (smmo.debug) {
            // Only log other messages if in debug mode
            console.log("[SMMO Auto-Step] " + text);
        }
    };
    
    // Function to initialize event listeners
    window.initEventListeners = function() {
        // Add event listener to auto-step checkbox
        checkbox.addEventListener('change', function() {
            const enabled = this.checked;
            addLog('Auto-step ' + (enabled ? 'enabled' : 'disabled'));
            localStorage.setItem('smmoAutoStepEnabled', enabled);
            
            // Start or stop auto-clicking
            if (enabled) {
                overlay.style.backgroundColor = 'rgba(0, 100, 0, 0.8)';
                startAutoClick();
            } else {
                overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                stopAutoClick();
            }
        });
        
        // Add event listener to captcha checkbox
        captchaCheckbox.addEventListener('change', function() {
            const enabled = this.checked;
            addLog('Captcha solving ' + (enabled ? 'enabled' : 'disabled'));
            localStorage.setItem('smmoAutoCaptchaEnabled', enabled);
            
            const smmo = window.smmoAutoStep;
            const captchaLabel = document.querySelector('label[for="enable-captcha-solving"]');
            
            // Update UI to reflect state
            if (enabled) {
                captchaLabel.style.color = '#fff';
                captchaLabel.textContent = 'Auto-solve captcha (enabled)';
                
                // If on a captcha page and we just enabled solving, try to solve
                if (smmo.state.isCaptchaDetected && !smmo.state.captchaAnalysisInProgress) {
                    setTimeout(handleCaptcha, 1000); // Slight delay to ensure DOM is ready
                }
            } else {
                captchaLabel.style.color = '#999';
                captchaLabel.textContent = 'Auto-solve captcha (disabled)';
                smmo.state.setCaptchaAnalysisInProgress(false); // Force reset the in-progress flag
                
                // Clear the analysis cache when disabled
                smmo.state.imageAnalysisCache.clear();
            }
        });
        
        // Add event listener to debug checkbox
        debugCheckbox.addEventListener('change', function() {
            const enabled = this.checked;
            const smmo = window.smmoAutoStep;
            
            smmo.setDebug(enabled);
            localStorage.setItem('smmoDebugEnabled', enabled);
            
            const debugLabel = document.querySelector('label[for="enable-debug-mode"]');
            
            // Update UI to reflect state
            if (enabled) {
                debugLabel.style.color = '#fff';
                addLog('Debug mode enabled - verbose logging activated');
            } else {
                debugLabel.style.color = '#999';
                addLog('Debug mode disabled');
            }
        });
        
        // Add event listener to delay input
        delayInput.addEventListener('change', function() {
            const delay = parseInt(this.value) || 200;
            addLog('Delay set to: ' + delay + 'ms');
            
            // Save delay to localStorage
            localStorage.setItem('smmoAutoStepDelay', delay);
            
            // Restart auto-clicking if it's running
            if (window.smmoAutoStep.state.isRunning) {
                stopAutoClick();
                startAutoClick();
            }
        });
    };
    
    // Function to load saved states
    window.loadSavedStates = function() {
        const savedState = localStorage.getItem('smmoAutoStepEnabled') === 'true';
        checkbox.checked = savedState;
        
        const savedCaptchaState = localStorage.getItem('smmoAutoCaptchaEnabled') === 'true';
        captchaCheckbox.checked = savedCaptchaState;
        
        const captchaLabel = document.querySelector('label[for="enable-captcha-solving"]');
        if (savedCaptchaState) {
            captchaLabel.style.color = '#fff';
            captchaLabel.textContent = 'Auto-solve captcha (enabled)';
        }
        
        const savedDebugState = localStorage.getItem('smmoDebugEnabled') === 'true';
        debugCheckbox.checked = savedDebugState;
        window.smmoAutoStep.setDebug(savedDebugState);
        
        const debugLabel = document.querySelector('label[for="enable-debug-mode"]');
        if (savedDebugState) {
            debugLabel.style.color = '#fff';
        }
        
        const savedDelay = localStorage.getItem('smmoAutoStepDelay');
        if (savedDelay) {
            delayInput.value = savedDelay;
        }
    };
})();