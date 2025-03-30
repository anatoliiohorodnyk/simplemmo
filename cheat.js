// ==UserScript==
// @name         Simple MMO Auto-Step
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add an auto-step overlay to Simple MMO
// @author       You
// @match        https://web.simple-mmo.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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
    header.textContent = 'SMMO Auto-Step';
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

    // Create checkbox container
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 12px;
    `;

    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'enable-auto-step';
    checkbox.style.marginRight = '8px';

    // Create label
    const label = document.createElement('label');
    label.htmlFor = 'enable-auto-step';
    label.textContent = 'Enable auto-step';
    label.style.cursor = 'pointer';

    // Add checkbox elements to container
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);
    contentContainer.appendChild(checkboxContainer);

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
        const logEntry = document.createElement('div');
        logEntry.textContent = text;
        logContainer.appendChild(logEntry);

        // Keep only last 5 log entries
        while(logContainer.children.length > 5) {
            logContainer.removeChild(logContainer.firstChild);
        }

        // Scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Variables for the auto-click functionality
    let autoClickInterval;
    let isRunning = false;

    // Function to update status
    function updateStatus(text, color = '#999') {
        statusIndicator.textContent = 'Status: ' + text;
        statusIndicator.style.color = color;
    }

    // Function to handle captcha
    async function handleCaptcha() {
        // Check if we're on the captcha page
        if (window.location.href.includes('/i-am-not-a-bot')) {
            addLog('На сторінці капчі');
            
            // Get the item we need to find
            const targetItemText = document.querySelector('.text-2xl.text-gray-800')?.textContent.trim();
            if (!targetItemText) {
                addLog('Не знайдено текст цілі');
                return;
            }
            addLog(`Шукаємо: ${targetItemText}`);

            // Wait for images to load
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get all buttons with images
            const buttons = document.querySelectorAll('button');
            
            // Try to find the correct button
            for (const button of buttons) {
                if (!button.disabled && !button.classList.contains('opacity-40')) {
                    const img = button.querySelector('img');
                    if (img) {
                        // Get image URL
                        const imgUrl = img.src;
                        addLog(`Перевіряємо зображення: ${imgUrl}`);

                        // Try to click if it's not disabled
                        try {
                            // Get the x-on:click attribute value
                            const clickHandler = button.getAttribute('x-on:click');
                            if (clickHandler && clickHandler.includes('chooseItem')) {
                                // Extract the item ID
                                const itemId = clickHandler.match(/chooseItem\('([^']+)'/)?.[1];
                                if (itemId) {
                                    // Call the chooseItem function directly
                                    addLog(`Спроба вибрати елемент з ID: ${itemId}`);
                                    window.chooseItem?.(itemId, false);
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            } else {
                                // Fallback to direct click
                                button.click();
                                addLog('Пряме натискання кнопки');
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (error) {
                            addLog(`Помилка кліку: ${error.message}`);
                        }
                    }
                }
            }
        } else {
            // Check for captcha link
            const captchaLink = document.querySelector('a[href*="/i-am-not-a-bot"]');
            if (captchaLink) {
                addLog('Знайдено посилання на капчу');
                // Open in new tab
                window.open(captchaLink.href, '_blank');
                addLog('Відкрито капчу в новій вкладці');
            }
        }
    }

    // Function to start auto-clicking
    function startAutoClick() {
        if (isRunning) return;

        const delay = parseInt(delayInput.value) || 200;
        updateStatus('Running', '#4CAF50');

        autoClickInterval = setInterval(async () => {
            // Check for captcha first
            await handleCaptcha();

            // Find the "Take a step" button
            const stepButton = findStepButton();

            if (stepButton && !stepButton.disabled && !stepButton.classList.contains('opacity-40')) {
                stepButton.click();
                updateStatus('Stepped', '#4CAF50');

                // Briefly change status to show feedback
                setTimeout(() => {
                    if (isRunning) {
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

    // Add event listener to checkbox
    checkbox.addEventListener('change', function() {
        const enabled = this.checked;
        console.log('Auto-step enabled:', enabled);

        // Save state to localStorage
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

    // Add event listener to delay input
    delayInput.addEventListener('change', function() {
        const delay = parseInt(this.value) || 200;
        console.log('Delay set to:', delay);

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

    const savedDelay = localStorage.getItem('smmoAutoStepDelay');
    if (savedDelay) {
        delayInput.value = savedDelay;
    }

    if (savedState) {
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
    document.body.appendChild(overlay);

    // Make the overlay draggable
    let isDragging = false;
    let offsetX, offsetY;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', function(e) {
        if (e.target === toggleButton) return;
        isDragging = true;
        offsetX = e.clientX - overlay.getBoundingClientRect().left;
        offsetY = e.clientY - overlay.getBoundingClientRect().top;
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        overlay.style.left = (e.clientX - offsetX) + 'px';
        overlay.style.top = (e.clientY - offsetY) + 'px';
        overlay.style.right = 'auto';
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });

    console.log('Simple MMO Auto-Step loaded!');
})();