// ==UserScript==
// @name         Simple MMO Auto-Step
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Add an auto-step overlay to Simple MMO with captcha detection
// @author       You
// @match        https://web.simple-mmo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.cloudflare.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

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

    // Cloudflare API configuration
    const CLOUDFLARE_ACCOUNT_ID = "id";
    const CLOUDFLARE_API_TOKEN = "id";
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

    // Debug flag - set to false for production
    const DEBUG = false;

    // Log tracking to prevent duplicates
    const recentLogs = new Set();
    const LOG_EXPIRY_TIME = 5000; // 5 seconds before a log can repeat

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'auto-step-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgba(0, 0, 0, 0.8);
        padding: 15px;
        border-radius: 5px;
        z-index: 9999;
        color: white;
        font-family: Arial, sans-serif;
        min-width: 200px;
    `;

    // Create header
    const header = document.createElement('div');
    header.textContent = 'SMMO Auto-Step v1.4';
    header.style.cssText = `
        font-weight: bold;
        margin-bottom: 10px;
        text-align: center;
        border-bottom: 1px solid #555;
        padding-bottom: 5px;
    `;
    overlay.appendChild(header);

    // Create content container
    const contentContainer = document.createElement('div');
    overlay.appendChild(contentContainer);

    // Create checkbox container for auto-step
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 12px;
    `;

    // Create checkbox for auto-step
    const checkbox = document.createElement('input');
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
    const captchaCheckbox = document.createElement('input');
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
    const delayInput = document.createElement('input');
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
    const statusIndicator = document.createElement('div');
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
    const logContainer = document.createElement('div');
    logContainer.id = 'auto-step-log';
    logContainer.style.cssText = `
        margin-top: 10px;
        font-size: 10px;
        color: #777;
        max-height: 60px;
        overflow-y: auto;
    `;
    contentContainer.appendChild(logContainer);

    // Function to add log entry
    function addLog(text) {
        // If the exact same text is already being logged, skip it
        if (recentLogs.has(text)) return;

        // If not in debug mode, filter out non-essential logs
        if (!DEBUG) {
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
        recentLogs.add(text);
        setTimeout(() => recentLogs.delete(text), LOG_EXPIRY_TIME);

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
        } else if (DEBUG) {
            // Only log other messages if in debug mode
            console.log("[SMMO Auto-Step] " + text);
        }
    }

    // Function to update status
    function updateStatus(text, color = '#999') {
        statusIndicator.textContent = 'Status: ' + text;
        statusIndicator.style.color = color;
    }

    // Check if we're on the captcha page
    function isCaptchaPage() {
        const isOnCaptchaUrl = window.location.href.includes('/i-am-not-a-bot');
        const hasCaptchaText = document.querySelector('.text-2xl.text-gray-800') !== null;
        const hasGrids = document.querySelectorAll('.grid.grid-cols-4').length > 0;

        if (isOnCaptchaUrl && DEBUG) {
            addLog(`Captcha detection: URL=${isOnCaptchaUrl}, Text=${hasCaptchaText}, Grids=${hasGrids}`);
        }

        return isOnCaptchaUrl && (hasCaptchaText || hasGrids);
    }

    // Check if the page has a link to the captcha
    function hasCaptchaLink() {
        // More specific check to avoid false positives
        const captchaLinks = Array.from(document.querySelectorAll('a')).filter(link =>
            link.href &&
            link.href.includes('/i-am-not-a-bot') &&
            (link.textContent.includes('verify') || link.textContent.includes('captcha'))
        );

        return captchaLinks.length > 0;
    }

    // Function to check for captcha presence and update status
    function checkCaptcha() {
        // First ensure our overlay is visible
        ensureOverlayExists();

        let newStatus = '';

        if (isCaptchaPage()) {
            // If we recently completed a captcha analysis, don't trigger another one right away
            if (recentlyCompletedCaptcha) {
                addLog("Skipping captcha analysis (cooldown active)");
                return;
            }

            isCaptchaDetected = true;
            newStatus = 'Captcha Detected';
            updateStatus(newStatus, '#FF9800');

            // Only trigger handleCaptcha if checkbox is checked and not already analyzing
            if (captchaCheckbox.checked && !captchaAnalysisInProgress) {
                // Use timeout to prevent immediate execution
                setTimeout(handleCaptcha, 1000);
            }
        } else if (hasCaptchaLink()) {
            isCaptchaDetected = true;
            newStatus = 'Captcha Required';
            updateStatus(newStatus, '#FF9800');
        } else {
            isCaptchaDetected = false;
            if (isRunning) {
                newStatus = 'Running';
                updateStatus(newStatus, '#4CAF50');
            } else {
                newStatus = 'Waiting';
                updateStatus(newStatus, '#999');
            }
        }

        // Only log if status changed
        if (newStatus !== lastCaptchaStatus) {
            lastCaptchaStatus = newStatus;
            if (newStatus) {
                addLog(`Status changed to: ${newStatus}`);
            }
        }
    }

    // Function to handle captcha page
    async function handleCaptcha() {
        // Check if already analyzing or checkbox is unchecked
        if (captchaAnalysisInProgress || !captchaCheckbox.checked) return;

        if (isCaptchaPage()) {
            try {
                // Set flag to prevent multiple simultaneous analyses
                captchaAnalysisInProgress = true;

                // Update UI to show analyzing state
                captchaLabel.textContent = 'Auto-solve captcha (analyzing...)';
                captchaLabel.style.color = '#fff';

                // Log the page structure to help debug
                const captchaGrid = document.querySelector('.grid.grid-cols-4:not(.opacity-0)');
                if (captchaGrid) {
                    const buttonCount = captchaGrid.querySelectorAll('button').length;
                    const imgCount = captchaGrid.querySelectorAll('img').length;
                    addLog(`Found captcha grid with ${buttonCount} buttons and ${imgCount} images`);
                } else {
                    addLog("Captcha grid not found, looking for alternatives");
                    const allGrids = document.querySelectorAll('.grid');
                    addLog(`Found ${allGrids.length} total grids on page`);
                }

                // Get the item we need to find
                const targetItemText = document.querySelector('.text-2xl.text-gray-800')?.textContent.trim();
                if (!targetItemText) {
                    addLog("Target item text not found");
                    captchaAnalysisInProgress = false;
                    return;
                }

                addLog(`Need to find: ${targetItemText}`);

                // Define the exact four captcha image URLs and find their buttons
                const captchaImageUrls = [
                    'https://web.simple-mmo.com/i-am-not-a-bot/generate_image?uid=0',
                    'https://web.simple-mmo.com/i-am-not-a-bot/generate_image?uid=1',
                    'https://web.simple-mmo.com/i-am-not-a-bot/generate_image?uid=2',
                    'https://web.simple-mmo.com/i-am-not-a-bot/generate_image?uid=3'
                ];

                // Track number of images successfully analyzed
                let analyzedCount = 0;
                const maxImagesToAnalyze = 4;

                // Array to store image descriptions
                const imageAnalyses = [];

                // Process each captcha image
                for (let i = 0; i < captchaImageUrls.length; i++) {
                    // Check if checkbox is still checked before continuing
                    if (!captchaCheckbox.checked) {
                        addLog("Captcha solving disabled, stopping analysis");
                        break;
                    }

                    // Check if we've analyzed enough images
                    if (analyzedCount >= maxImagesToAnalyze) {
                        addLog(`Already analyzed ${maxImagesToAnalyze} images, stopping`);
                        break;
                    }

                    const imageUrl = captchaImageUrls[i];

                    // Find button containing this image - use a flexible approach
                    // First try exact match
                    let imgElement = document.querySelector(`img[src="${imageUrl}"]`);
                    let button = null;

                    // If not found, try partial match (the URL might have additional parameters)
                    if (!imgElement) {
                        const allImages = document.querySelectorAll('img');
                        for (const img of allImages) {
                            if (img.src && img.src.includes(`generate_image?uid=${i}`)) {
                                imgElement = img;
                                break;
                            }
                        }
                    }

                    // If we found an image, get its button
                    if (imgElement && imgElement.parentElement && imgElement.parentElement.tagName === 'BUTTON') {
                        button = imgElement.parentElement;
                    } else {
                        // If still not found, try to find any button in the captcha grid
                        addLog(`Trying alternative method to find captcha image #${i+1}`);
                        const captchaGrid = document.querySelector('.grid.grid-cols-4:not(.opacity-0)');
                        if (captchaGrid) {
                            const allButtons = captchaGrid.querySelectorAll('button');
                            if (allButtons.length > i) {
                                // Just use the button at the corresponding index
                                button = allButtons[i];
                                addLog(`Found button for captcha #${i+1} using grid position`);
                            }
                        }
                    }

                    // If we couldn't find a button, skip this image
                    if (!button) {
                        addLog(`Captcha image #${i+1} not found or not in button`);
                        continue;
                    }

                    addLog(`Analyzing image ${i+1}/4...`);
                    addLog(`Analyzing image: ${imageUrl}`);

                    // Check if we've already analyzed this image
                    let result;
                    if (imageAnalysisCache.has(imageUrl)) {
                        result = imageAnalysisCache.get(imageUrl);
                        addLog(`Using cached analysis for image ${i+1}`);
                    } else {
                        // Use direct fetch to get the image bytes
                        try {
                            const response = await fetch(imageUrl);
                            const blob = await response.blob();
                            const arrayBuffer = await blob.arrayBuffer();
                            const imageBytes = [...new Uint8Array(arrayBuffer)];

                            // Skip empty or invalid images
                            if (!imageBytes || imageBytes.length < 100) {
                                addLog(`Image data for captcha #${i+1} too small or invalid`);
                                continue;
                            }

                            // Send to API for analysis
                            result = await new Promise((resolve) => {
                                // Only proceed if captcha solving is still enabled
                                if (!captchaCheckbox.checked) {
                                    addLog("Captcha solving disabled, canceling analysis");
                                    resolve(null);
                                    return;
                                }

                                GM_xmlhttpRequest({
                                    method: "POST",
                                    url: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`,
                                    headers: {
                                        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
                                        "Content-Type": "application/json"
                                    },
                                    data: JSON.stringify({
                                        image: imageBytes,
                                        prompt: "Identify what object is shown in this image in a few words",
                                        max_tokens: 100
                                    }),
                                    onload: function(response) {
                                        // Check again if captcha solving is still enabled
                                        if (!captchaCheckbox.checked) {
                                            addLog("Captcha solving disabled during API request");
                                            resolve(null);
                                            return;
                                        }

                                        try {
                                            const result = JSON.parse(response.responseText);
                                            if (result.success && result.result) {
                                                addLog("Analysis successful");
                                                resolve(result.result);
                                            } else {
                                                addLog("API error");
                                                resolve(null);
                                            }
                                        } catch (err) {
                                            addLog("Response parsing error");
                                            resolve(null);
                                        }
                                    },
                                    onerror: function() {
                                        addLog("Request error");
                                        resolve(null);
                                    },
                                    ontimeout: function() {
                                        addLog("Request timed out");
                                        resolve(null);
                                    }
                                });
                            });

                            // Cache the result if valid
                            if (result && result.description) {
                                imageAnalysisCache.set(imageUrl, result);
                            }
                        } catch (error) {
                            addLog(`Error processing captcha #${i+1}: ${error.message}`);
                            continue;
                        }
                    }

                    if (result && result.description) {
                        // Increment the counter for successful analyses
                        analyzedCount++;

                        imageAnalyses.push({
                            index: i,
                            button: button,
                            description: result.description || "No description"
                        });
                        addLog(`Image ${i+1} description: ${result.description}`);

                        // Check if the description mentions the target item
                        if (result.description.toLowerCase().includes(targetItemText.toLowerCase())) {
                            addLog(`Found match for ${targetItemText} in image ${i+1}!`);

                            // Update UI to show found state
                            captchaLabel.textContent = `Found ${targetItemText}!`;

                            // Auto-click the matching image to solve the captcha
                            button.click();

                            // Set cooldown after clicking
                            recentlyCompletedCaptcha = true;

                            break;
                        }
                    }

                    // Short delay between images
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // If no match was found, update UI
                if (captchaCheckbox.checked) {
                    if (imageAnalyses.length > 0 && !imageAnalyses.some(a => a.description.toLowerCase().includes(targetItemText.toLowerCase()))) {
                        captchaLabel.textContent = 'Auto-solve captcha (no match found)';
                        setTimeout(() => {
                            if (captchaCheckbox.checked) {
                                captchaLabel.textContent = 'Auto-solve captcha (enabled)';
                            }
                        }, 3000);
                    }
                }

                // Output analyses to console (only once and only if there are any)
                if (imageAnalyses.length > 0) {
                    console.log("Captcha image analyses:", imageAnalyses);
                }

                // Add a completion log
                addLog(`Captcha analysis completed. Analyzed ${analyzedCount}/${captchaImageUrls.length} images`);

                // Set the cooldown to prevent immediate re-analysis
                recentlyCompletedCaptcha = true;
                setTimeout(() => {
                    recentlyCompletedCaptcha = false;
                    addLog("Captcha cooldown ended, can analyze again if needed");
                }, CAPTCHA_COOLDOWN);

            } catch (error) {
                addLog(`Error in captcha handling: ${error.message}`);
            } finally {
                // Always reset the flag when done
                captchaAnalysisInProgress = false;

                // Update UI if still enabled
                if (captchaCheckbox.checked) {
                    captchaLabel.textContent = 'Auto-solve captcha (enabled)';
                }
            }
        }
    }

    // Function to find the "Take a step" button
    function findStepButton() {
        // Look for buttons with id containing "step_btn_" and "Take a step" text
        const buttons = document.querySelectorAll('button[id*="step_btn_"]');
        for (const button of buttons) {
            if (button.textContent.includes('Take a step')) {
                return button;
            }
        }

        // Alternative method: look for buttons with specific classes that contain the image
        const altButtons = document.querySelectorAll('button.items-center.w-64.border.justify-center');
        for (const button of altButtons) {
            if (button.innerHTML.includes('Take a step')) {
                return button;
            }
        }

        return null;
    }

    // Function to start auto-clicking
    function startAutoClick() {
        if (isRunning) return;

        const delay = parseInt(delayInput.value) || 200;
        updateStatus('Running', '#4CAF50');

        autoClickInterval = setInterval(() => {
            // Check for captcha first
            checkCaptcha();

            if (isCaptchaDetected) {
                return; // Don't proceed with stepping if captcha is detected
            }

            // Find the "Take a step" button
            const stepButton = findStepButton();

            if (stepButton && !stepButton.disabled && !stepButton.classList.contains('opacity-40')) {
                stepButton.click();
                updateStatus('Stepped', '#4CAF50');

                // Briefly change status to show feedback
                setTimeout(() => {
                    if (isRunning && !isCaptchaDetected) {
                        updateStatus('Running', '#4CAF50');
                    }
                }, 500);
            }
        }, delay);

        isRunning = true;
    }

    // Function to stop auto-clicking
    function stopAutoClick() {
        if (!isRunning) return;

        clearInterval(autoClickInterval);
        updateStatus('Stopped', '#999');
        isRunning = false;
    }

    // Function to ensure overlay exists and is visible
    function ensureOverlayExists() {
        if (!document.getElementById('auto-step-overlay')) {
            document.body.appendChild(overlay);
            console.log("Attached overlay to document");
        }
    }

    // Add event listener to checkbox
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

        // Update UI to reflect state
        if (enabled) {
            captchaLabel.style.color = '#fff';
            captchaLabel.textContent = 'Auto-solve captcha (enabled)';

            // If on a captcha page and we just enabled solving, try to solve
            if (isCaptchaDetected && !captchaAnalysisInProgress) {
                setTimeout(handleCaptcha, 1000); // Slight delay to ensure DOM is ready
            }
        } else {
            captchaLabel.style.color = '#999';
            captchaLabel.textContent = 'Auto-solve captcha (disabled)';
            captchaAnalysisInProgress = false; // Force reset the in-progress flag

            // Clear the analysis cache when disabled
            imageAnalysisCache.clear();
        }
    });

    // Add event listener to delay input
    delayInput.addEventListener('change', function() {
        const delay = parseInt(this.value) || 200;
        addLog('Delay set to: ' + delay + 'ms');

        // Save delay to localStorage
        localStorage.setItem('smmoAutoStepDelay', delay);

        // Restart auto-clicking if it's running
        if (isRunning) {
            stopAutoClick();
            startAutoClick();
        }
    });

    // Load saved state
    const savedState = localStorage.getItem('smmoAutoStepEnabled') === 'true';
    checkbox.checked = savedState;

    const savedCaptchaState = localStorage.getItem('smmoAutoCaptchaEnabled') === 'true';
    captchaCheckbox.checked = savedCaptchaState;
    if (savedCaptchaState) {
        captchaLabel.style.color = '#fff';
        captchaLabel.textContent = 'Auto-solve captcha (enabled)';
    }

    const savedDelay = localStorage.getItem('smmoAutoStepDelay');
    if (savedDelay) {
        delayInput.value = savedDelay;
    }

    // Check captcha state immediately
    checkCaptcha();

    if (savedState && !isCaptchaDetected) {
        overlay.style.backgroundColor = 'rgba(0, 100, 0, 0.8)';
        startAutoClick();
    }

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
    ensureOverlayExists();

    // Make sure overlay is visible on all pages by setting high z-index and fixed position
    overlay.style.zIndex = "9999999";

    // Add a small delay to ensure overlay is visible on all pages including popups
    setTimeout(ensureOverlayExists, 1000);

    // Add another check after 3 seconds for pages that load slower
    setTimeout(ensureOverlayExists, 3000);

    // Check for captcha every 15 seconds (reduced frequency to prevent repeated analysis)
    let captchaCheckInterval = setInterval(() => {
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

    // Add special check for the captcha page
    if (window.location.href.includes('i-am-not-a-bot')) {
        console.log("Detected captcha page, ensuring overlay visibility");
        // Try multiple times with increasing delays
        setTimeout(ensureOverlayExists, 500);
        setTimeout(ensureOverlayExists, 1500);
        setTimeout(ensureOverlayExists, 3000);
    }

    // Add a mutation observer to monitor URL changes (for SPA navigation)
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

    console.log('Simple MMO Auto-Step v1.4 loaded!');
})();