// Auto-Stepper Module for Simple MMO Auto-Step
(function() {
    'use strict';
    
    // Function to find the "Take a step" button
    window.findStepButton = function() {
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
    };
    
    // Function to start auto-clicking
    window.startAutoClick = function() {
        const smmo = window.smmoAutoStep;
        if (smmo.state.isRunning) return;
        
        const delay = parseInt(document.getElementById('step-delay').value) || 200;
        updateStatus('Running', '#4CAF50');
        
        const clickInterval = setInterval(() => {
            // Check for captcha first
            checkCaptcha();
            
            if (smmo.state.isCaptchaDetected) {
                return; // Don't proceed with stepping if captcha is detected
            }
            
            // Find the "Take a step" button
            const stepButton = findStepButton();
            
            if (stepButton && !stepButton.disabled && !stepButton.classList.contains('opacity-40')) {
                stepButton.click();
                updateStatus('Stepped', '#4CAF50');
                
                // Briefly change status to show feedback
                setTimeout(() => {
                    if (smmo.state.isRunning && !smmo.state.isCaptchaDetected) {
                        updateStatus('Running', '#4CAF50');
                    }
                }, 500);
            }
        }, delay);
        
        smmo.state.setAutoClickInterval(clickInterval);
        smmo.state.setIsRunning(true);
    };
    
    // Function to stop auto-clicking
    window.stopAutoClick = function() {
        const smmo = window.smmoAutoStep;
        if (!smmo.state.isRunning) return;
        
        clearInterval(smmo.state.autoClickInterval);
        updateStatus('Stopped', '#999');
        smmo.state.setIsRunning(false);
    };
})();