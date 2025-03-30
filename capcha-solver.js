// Captcha Solver Module for Simple MMO Auto-Step
(function() {
    'use strict';
    
    // Check if the page has a link to the captcha
    window.hasCaptchaLink = function() {
        // More specific check to avoid false positives
        const captchaLinks = Array.from(document.querySelectorAll('a')).filter(link =>
            link.href &&
            link.href.includes('/i-am-not-a-bot') &&
            (link.textContent.includes('verify') || link.textContent.includes('captcha'))
        );
        
        return captchaLinks.length > 0;
    };
    
    // Function to check if current page is a captcha page
    window.isCaptchaPage = function() {
        // Check URL first (most reliable)
        if (window.location.href.includes('i-am-not-a-bot')) {
            return true;
        }
        
        // Check for captcha-specific elements
        const captchaTitle = document.querySelector('.text-2xl.text-gray-800');
        if (captchaTitle && captchaTitle.textContent.includes('Select the image')) {
            return true;
        }
        
        // Check for captcha grid
        const captchaGrid = document.querySelector('.grid.grid-cols-4:not(.opacity-0)');
        if (captchaGrid && captchaGrid.querySelectorAll('button').length >= 4) {
            return true;
        }
        
        // Not a captcha page
        return false;
    };
    
    // Function to check for captcha presence and update status
    window.checkCaptcha = function() {
        // First ensure our overlay is visible
        ensureOverlayExists();
        
        const smmo = window.smmoAutoStep;
        let newStatus = '';
        
        if (isCaptchaPage()) {
            // If we recently completed a captcha analysis, don't trigger another one right away
            if (smmo.state.recentlyCompletedCaptcha) {
                addLog("Skipping captcha analysis (cooldown active)");
                return;
            }
            
            smmo.state.setIsCaptchaDetected(true);
            newStatus = 'Captcha Detected';
            updateStatus(newStatus, '#FF9800');
            
            // Only trigger handleCaptcha if checkbox is checked and not already analyzing
            if (document.getElementById('enable-captcha-solving').checked && !smmo.state.captchaAnalysisInProgress) {
                // Use timeout to prevent immediate execution
                setTimeout(handleCaptcha, 1000);
            }
        } else if (hasCaptchaLink()) {
            smmo.state.setIsCaptchaDetected(true);
            newStatus = 'Captcha Required';
            updateStatus(newStatus, '#FF9800');
        } else {
            smmo.state.setIsCaptchaDetected(false);
            if (smmo.state.isRunning) {
                newStatus = 'Running';
                updateStatus(newStatus, '#4CAF50');
            } else {
                newStatus = 'Waiting';
                updateStatus(newStatus, '#999');
            }
        }
        
        // Only log if status changed
        if (newStatus !== smmo.state.lastCaptchaStatus) {
            smmo.state.setLastCaptchaStatus(newStatus);
            if (newStatus) {
                addLog(`Status changed to: ${newStatus}`);
            }
        }
    };
    
    // Function to let AI decide which image matches the target
    async function askAIForDecision(targetItem, imageDescriptions) {
        try {
            const smmo = window.smmoAutoStep;
            // Create a prompt for the AI to decide which image matches
            const prompt = `I'm trying to solve a captcha where I need to identify a "${targetItem}" among 4 images. Here are descriptions of the images:
            1: ${imageDescriptions[0] || "No description"}
            2: ${imageDescriptions[1] || "No description"}
            3: ${imageDescriptions[2] || "No description"}
            4: ${imageDescriptions[3] || "No description"}

            Please tell me which image number (1, 2, 3, or 4) most likely contains the "${targetItem}". Only respond with the image number, nothing else.`;
            
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: `https://api.cloudflare.com/client/v4/accounts/${smmo.cloudflareConfig.accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
                    headers: {
                        "Authorization": `Bearer ${smmo.cloudflareConfig.apiToken}`,
                        "Content-Type": "application/json"
                    },
                    data: JSON.stringify({
                        prompt: prompt,
                        max_tokens: 10
                    }),
                    onload: function(response) {
                        try {
                            const result = JSON.parse(response.responseText);
                            if (result.success && result.result) {
                                // Extract just the number from the response
                                const responseText = result.result.response.trim();
                                const match = responseText.match(/[1-4]/);
                                if (match) {
                                    const chosenNumber = parseInt(match[0]);
                                    addLog(`AI chose image ${chosenNumber} for "${targetItem}"`);
                                    resolve(chosenNumber);
                                } else {
                                    addLog("AI couldn't determine which image to choose");
                                    resolve(null);
                                }
                            } else {
                                addLog("AI decision error");
                                resolve(null);
                            }
                        } catch (err) {
                            addLog("Error parsing AI decision");
                            resolve(null);
                        }
                    },
                    onerror: function() {
                        addLog("AI decision request error");
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            addLog("Error asking AI for decision: " + error.message);
            return null;
        }
    }
    
    // Function to handle captcha page
    window.handleCaptcha = async function() {
        const smmo = window.smmoAutoStep;
        // Check if already analyzing or checkbox is unchecked
        if (smmo.state.captchaAnalysisInProgress || !document.getElementById('enable-captcha-solving').checked) return;
        
        if (isCaptchaPage()) {
            try {
                // Set flag to prevent multiple simultaneous analyses
                smmo.state.setCaptchaAnalysisInProgress(true);
                
                // Update UI to show analyzing state
                const captchaLabel = document.querySelector('label[for="enable-captcha-solving"]');
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
                    smmo.state.setCaptchaAnalysisInProgress(false);
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
                    if (!document.getElementById('enable-captcha-solving').checked) {
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
                    if (smmo.state.imageAnalysisCache.has(imageUrl)) {
                        result = smmo.state.imageAnalysisCache.get(imageUrl);
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
                                if (!document.getElementById('enable-captcha-solving').checked) {
                                    addLog("Captcha solving disabled, canceling analysis");
                                    resolve(null);
                                    return;
                                }
                                
                                GM_xmlhttpRequest({
                                    method: "POST",
                                    url: `https://api.cloudflare.com/client/v4/accounts/${smmo.cloudflareConfig.accountId}/ai/run/${smmo.cloudflareConfig.model}`,
                                    headers: {
                                        "Authorization": `Bearer ${smmo.cloudflareConfig.apiToken}`,
                                        "Content-Type": "application/json"
                                    },
                                    data: JSON.stringify({
                                        image: imageBytes,
                                        prompt: "Identify what object is shown in this image in a few words",
                                        max_tokens: 100
                                    }),
                                    onload: function(response) {
                                        // Check again if captcha solving is still enabled
                                        if (!document.getElementById('enable-captcha-solving').checked) {
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
                                smmo.state.imageAnalysisCache.set(imageUrl, result);
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
                    }
                    
                    // Short delay between images
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Only proceed with the decision step if we have analyzed all images
                if (imageAnalyses.length === 4) {
                    // Extract only the descriptions in order
                    const descriptions = Array(4).fill("No description");
                    for (const analysis of imageAnalyses) {
                        descriptions[analysis.index] = analysis.description;
                    }
                    
                    // Now, let's ask the AI which image matches our target
                    addLog(`Asking AI to choose the correct image for "${targetItemText}"`);
                    const chosenImageNumber = await askAIForDecision(targetItemText, descriptions);
                    
                    if (chosenImageNumber && chosenImageNumber >= 1 && chosenImageNumber <= 4) {
                        // Convert to 0-based index
                        const index = chosenImageNumber - 1;
                        // Find the matching button
                        const matchingAnalysis = imageAnalyses.find(a => a.index === index);
                        
                        if (matchingAnalysis) {
                            addLog(`AI chose image ${chosenImageNumber} (${descriptions[index]})`);
                            
                            // Update UI to show found state
                            captchaLabel.textContent = `AI chose image ${chosenImageNumber}!`;
                            
                            // Auto-click the matching image to solve the captcha
                            matchingAnalysis.button.click();
                            
                            // Set cooldown after clicking
                            smmo.state.setRecentlyCompletedCaptcha(true);
                        } else {
                            addLog(`AI chose image ${chosenImageNumber} but couldn't find matching button`);
                        }
                    } else {
                        addLog("AI couldn't determine which image to choose");
                    }
                } else {
                    // If we couldn't analyze all images, fallback to simple matching
                    addLog(`Only analyzed ${imageAnalyses.length}/4 images, attempting direct match`);
                    
                    // Check if any description directly mentions the target item
                    const matchingAnalysis = imageAnalyses.find(analysis =>
                        analysis.description.toLowerCase().includes(targetItemText.toLowerCase())
                    );
                    
                    if (matchingAnalysis) {
                        addLog(`Found direct match for ${targetItemText} in image ${matchingAnalysis.index+1}!`);
                        
                        // Update UI to show found state
                        captchaLabel.textContent = `Found ${targetItemText}!`;
                        
                        // Auto-click the matching image to solve the captcha
                        matchingAnalysis.button.click();
                        
                        // Set cooldown after clicking
                        smmo.state.setRecentlyCompletedCaptcha(true);
                    } else {
                        // No direct match found
                        captchaLabel.textContent = 'Auto-solve captcha (no match found)';
                        setTimeout(() => {
                            if (document.getElementById('enable-captcha-solving').checked) {
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
                smmo.state.setRecentlyCompletedCaptcha(true);
                setTimeout(() => {
                    smmo.state.setRecentlyCompletedCaptcha(false);
                    addLog("Captcha cooldown ended, can analyze again if needed");
                }, smmo.captchaCooldown);
                
            } catch (error) {
                addLog(`Error in captcha handling: ${error.message}`);
            } finally {
                // Always reset the flag when done
                smmo.state.setCaptchaAnalysisInProgress(false);
                
                // Update UI if still enabled
                if (document.getElementById('enable-captcha-solving').checked) {
                    const captchaLabel = document.querySelector('label[for="enable-captcha-solving"]');
                    captchaLabel.textContent = 'Auto-solve captcha (enabled)';
                }
            }
        }
    };
})();