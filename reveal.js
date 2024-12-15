const canvas = document.getElementById('scratchCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let revealed = false;
let currentImageIndex = 0;
const scratchSounds = [
    new Audio('sounds/scratch1.wav'),
    new Audio('sounds/scratch2.wav'),
    new Audio('sounds/scratch3.wav')
];
const winSound = new Audio('sounds/win.wav');
let lastSoundPlayed = Date.now();
let currentScratchSound = null;

function playScratchSound() {
    if (!isDrawing) return;
    
    const randomSound = scratchSounds[Math.floor(Math.random() * scratchSounds.length)];
    
    // If there's a current sound playing, continue with it
    if (currentScratchSound && !currentScratchSound.ended) {
        return;
    }
    
    // Start new sound
    currentScratchSound = randomSound;
    currentScratchSound.volume = 0.7;
    currentScratchSound.play().catch(e => console.log('Sound play prevented'));
}

function initializeCanvas() {
    // Make canvas size relative to the viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Adjust canvas size on orientation change
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            if (!revealed) {
                drawInitialPattern();
            }
        }, 200);
    });
    
    // Get gift data and pattern
    const giftId = new URLSearchParams(window.location.search).get('gift');
    const giftData = JSON.parse(localStorage.getItem(giftId));
    
    if (giftData && giftData.pattern) {
        const img = new Image();
        img.onload = function() {
            // Draw pattern as background
            const pattern = ctx.createPattern(img, 'repeat');
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Add a semi-transparent overlay
            ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw some visual indicators for scratching
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            for(let i = 0; i < 40; i++) { // More scratch indicators for larger area
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.moveTo(x - 10, y - 10);
                ctx.lineTo(x + 10, y + 10);
                ctx.stroke();
            }
        };
        img.src = giftData.pattern;
    } else {
        // Fallback if no pattern is provided
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function scratch(e) {
    if(!isDrawing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if(e.touches) {
        // Handle multi-touch
        Array.from(e.touches).forEach(touch => {
            x = touch.clientX - rect.left;
            y = touch.clientY - rect.top;
            drawScratch(x, y);
        });
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
        drawScratch(x, y);
    }
    
    checkReveal();
}

function drawScratch(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    
    // Main scratch circle
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    
    // Add some randomness to the scratch effect
    for(let i = 0; i < 3; i++) {
        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

function checkReveal() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;
    
    for(let i = 3; i < pixels.length; i += 4) {
        if(pixels[i] < 128) transparent++;
    }
    
    const percentRevealed = transparent / (pixels.length / 4);
    if(percentRevealed > 0.25) { // Lower threshold for mobile
        revealed = true;
        revealGift();
    }
}

function revealGift() {
    canvas.style.display = 'none';
    document.getElementById('giftContent').classList.remove('hidden');
    
    // Play win sound
    winSound.volume = 0.7;
    winSound.loop = false;
    winSound.play().catch(e => console.log('Sound play prevented'));
    
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
    
    const giftId = new URLSearchParams(window.location.search).get('gift');
    const giftData = JSON.parse(localStorage.getItem(giftId));
    
    if(giftData) {
        // Set message
        document.getElementById('giftMessage').textContent = giftData.message;
        
        // Handle images
        const imageContainer = document.querySelector('.gift-images');
        const imageSlider = document.querySelector('.image-slider');
        const dotsContainer = document.querySelector('.image-dots');
        const prevBtn = document.querySelector('.nav-btn.prev');
        const nextBtn = document.querySelector('.nav-btn.next');

        // Clear previous content
        imageSlider.innerHTML = '';
        dotsContainer.innerHTML = '';

        if(giftData.images && giftData.images.length > 0) {
            // Show image container
            imageContainer.style.display = 'block';

            // Add each image
            giftData.images.forEach((imageData, index) => {
                // Create and add image
                const img = document.createElement('img');
                img.src = imageData.dataUrl || imageData; // Handle both formats
                img.alt = `Gift Image ${index + 1}`;
                img.className = index === 0 ? 'active' : '';
                imageSlider.appendChild(img);

                // Create and add dot
                const dot = document.createElement('span');
                dot.className = `dot ${index === 0 ? 'active' : ''}`;
                dot.onclick = () => showImage(index);
                dotsContainer.appendChild(dot);
            });

            // Show/hide navigation buttons
            if (giftData.images.length > 1) {
                prevBtn.style.display = 'block';
                nextBtn.style.display = 'block';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
        } else {
            // Hide image container if no images
            imageContainer.style.display = 'none';
        }
    }
}

function showImage(index) {
    const images = document.querySelectorAll('.image-slider img');
    const dots = document.querySelectorAll('.dot');
    
    if (index >= images.length) index = 0;
    if (index < 0) index = images.length - 1;
    
    images.forEach(img => img.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    images[index].classList.add('active');
    dots[index].classList.add('active');
    currentImageIndex = index;
}

function thankPerson() {
    // Add a nice animation before redirecting
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6b6b', '#ff8787', '#ffa8a8']
    });
    
    // Redirect to main page after a short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Event listeners
canvas.addEventListener('mousedown', () => {
    isDrawing = true;
    playScratchSound();
});
canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        playScratchSound();
    }
    scratch(e);
});
canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    if (currentScratchSound) {
        currentScratchSound.pause();
    }
});
canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
    if (currentScratchSound) {
        currentScratchSound.pause();
    }
});

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
    isDrawing = true;
    playScratchSound();
    scratch(e);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    if (isDrawing) {
        playScratchSound();
    }
    scratch(e);
}, { passive: false });
canvas.addEventListener('touchend', () => {
    isDrawing = false;
    if (currentScratchSound) {
        currentScratchSound.pause();
    }
});
canvas.addEventListener('touchcancel', () => {
    isDrawing = false;
    if (currentScratchSound) {
        currentScratchSound.pause();
    }
});

// Add event listeners for navigation buttons
document.querySelector('.nav-btn.prev')?.addEventListener('click', () => showImage(currentImageIndex - 1));
document.querySelector('.nav-btn.next')?.addEventListener('click', () => showImage(currentImageIndex + 1));

// Initialize
window.addEventListener('load', () => {
    initializeCanvas();
    initializeSounds();
});
window.addEventListener('resize', initializeCanvas); 

function initializeSounds() {
    // Pre-load sounds
    scratchSounds.forEach(sound => {
        sound.load();
        sound.preload = 'auto';
    });
    winSound.load();
    winSound.preload = 'auto';
    
    // Enable sounds on first user interaction
    document.addEventListener('click', function enableSound() {
        scratchSounds.forEach(sound => {
            sound.play().then(() => {
                sound.pause();
                sound.currentTime = 0;
            }).catch(e => console.log('Sound play prevented'));
        });
        winSound.play().then(() => {
            winSound.pause();
            winSound.currentTime = 0;
        }).catch(e => console.log('Sound play prevented'));
        document.removeEventListener('click', enableSound);
    }, { once: true });
}
  