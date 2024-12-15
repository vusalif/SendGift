// Add QR code library to index.html
document.head.innerHTML += '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js"></script>';

// Premium features management
let isPremium = false;
const VALID_TOKENS = ['PREMIUM123', 'GIFT2024', 'SPECIAL99']; // Example tokens
const MAX_IMAGES = 20;


// Global variables for image editing
let currentImageIndex = -1;
let imageFiles = [];
let imageStates = new Map(); // Store editing states for each image

// Function to compress image
async function compressImage(dataUrl, maxWidth = 800) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Always resize to reduce file size
            const maxSize = 800;
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.5)); // Increased compression
        };
        img.src = dataUrl;
    });
}

// Image preview handling
document.getElementById('giftImage').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    const previewContainer = document.getElementById('imagePreviewContainer');
    
    if (files.length + imageFiles.length > MAX_IMAGES) {
        alert(`You can only upload up to ${MAX_IMAGES} images total`);
        return;
    }

    for (const file of files) {
        if (imageFiles.length >= MAX_IMAGES) return;
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            const compressedDataUrl = await compressImage(e.target.result);
            const preview = document.createElement('div');
            preview.className = 'image-preview';
            preview.innerHTML = `
                <img src="${compressedDataUrl}" alt="Preview">
                <button type="button" class="remove-image" onclick="removeImage(this)">×</button>
            `;
            preview.querySelector('img').addEventListener('click', function() {
                document.querySelectorAll('.image-preview').forEach(p => p.classList.remove('selected'));
                preview.classList.add('selected');
                editSelectedImage();
            });
            previewContainer.appendChild(preview);
            imageFiles.push({
                file: file,
                dataUrl: compressedDataUrl
            });
        };
        reader.readAsDataURL(file);
    }
});

function removeImage(button) {
    const preview = button.parentElement;
    const index = Array.from(preview.parentElement.children).indexOf(preview);
    imageFiles.splice(index, 1);
    preview.remove();
}

// Form submission
document.getElementById('giftForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const message = document.getElementById('message').value;
        const selectedPattern = document.querySelector('.scratch-option.selected');
        if (!selectedPattern) {
            alert('Please select a scratch pattern');
            return;
        }
        const pattern = selectedPattern.querySelector('img').src;
        
        // Create gift data
        const giftData = {
            message: message,
            pattern: selectedPattern.querySelector('img').getAttribute('src'),
            images: imageFiles.map(img => ({
                dataUrl: img.dataUrl,
                file: img.file.name
            }))
        };

        // Try to clean up old data if storage is full
        try {
            const keys = Object.keys(localStorage);
            if (keys.length > 20) {
                keys.slice(0, -20).forEach(key => localStorage.removeItem(key));
            }
        } catch (error) {
            console.warn('Error cleaning storage:', error);
        }

        // Generate unique ID and save data
        const giftId = Math.random().toString(36).substr(2, 9);
        try {
            localStorage.setItem(giftId, JSON.stringify(giftData));
        } catch (storageError) {
            // If storage is full, try to compress images further
            const compressedImages = await Promise.all(
                imageFiles.map(async img => ({
                    ...img,
                    dataUrl: await compressImage(img.dataUrl, 400)
                }))
            );
            giftData.images = compressedImages.map(img => img.dataUrl);
            
            try {
                localStorage.setItem(giftId, JSON.stringify(giftData));
            } catch (finalError) {
                alert('Storage is full. Please try with fewer or smaller images.');
                return;
            }
        }
        
        // Generate share link
        const shareLink = `${window.location.origin}/reveal.html?gift=${giftId}`;
        
        // Generate QR code
        const qrcodeElement = document.getElementById('qrcode');
        qrcodeElement.innerHTML = ''; // Clear previous QR code
        
        // Create a new QR code
        new QRCode(qrcodeElement, {
            text: shareLink,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        document.getElementById('shareLink').value = shareLink;
        document.getElementById('giftLink').classList.remove('hidden');
    } catch (error) {
        console.error('Error creating gift:', error);
        alert('There was an error creating your gift. Please try again with fewer or smaller images.');
    }
});

// Image editing functions
function editSelectedImage() {
    const selectedImage = document.querySelector('.image-preview.selected img');
    if (!selectedImage) {
        alert('Please select an image to edit');
        return;
    }

    const modal = document.getElementById('imageEditorModal');
    const imageToEdit = document.getElementById('imageToEdit');
    const imageId = selectedImage.getAttribute('data-image-id') || `img_${Date.now()}`;
    
    // Set ID if not exists
    if (!selectedImage.getAttribute('data-image-id')) {
        selectedImage.setAttribute('data-image-id', imageId);
    }

    // Initialize or get image state
    if (!imageStates.has(imageId)) {
        imageStates.set(imageId, {
            original: selectedImage.src,
            current: selectedImage.src,
            filters: []
        });
    }

    const imageState = imageStates.get(imageId);
    imageToEdit.src = imageState.current;
    imageToEdit.setAttribute('data-image-id', imageId);
    modal.classList.remove('hidden');

    // Destroy cropper if it exists
    if (window.cropper) {
        window.cropper.destroy();
        window.cropper = null;
        document.querySelector('button[onclick="applyCrop()"]').textContent = 'Crop';
    }
}

function applyCrop() {
    const imageToEdit = document.getElementById('imageToEdit');
    
    // If cropper is not active, initialize it
    if (!window.cropper) {
        window.cropper = new Cropper(imageToEdit, {
            aspectRatio: 1,
            viewMode: 2,
            responsive: true,
            restore: true,
            autoCrop: true,
            movable: true,
            rotatable: true,
            scalable: true,
            zoomable: true,
            cropBoxMovable: true,
            cropBoxResizable: true,
        });
        
        // Change button text to "Apply Crop"
        document.querySelector('button[onclick="applyCrop()"]').textContent = 'Apply Crop';
    } else {
        // If cropper is active, apply the crop and destroy the cropper
        const croppedCanvas = window.cropper.getCroppedCanvas();
        const croppedImage = croppedCanvas.toDataURL('image/jpeg', 0.9);
        const imageId = imageToEdit.getAttribute('data-image-id');
        
        if (imageId && imageStates.has(imageId)) {
            const imageState = imageStates.get(imageId);
            imageState.current = croppedImage;
            imageStates.set(imageId, imageState);
            
            updateSelectedImage(croppedImage);
            imageToEdit.src = croppedImage;
        }
        
        // Destroy cropper
        window.cropper.destroy();
        window.cropper = null;
        
        // Reset button text
        document.querySelector('button[onclick="applyCrop()"]').textContent = 'Crop';
    }
}

function applyFilter(filterType) {
    const imageToEdit = document.getElementById('imageToEdit');
    const imageId = imageToEdit.getAttribute('data-image-id');
    
    // Destroy cropper if it exists
    if (window.cropper) {
        window.cropper.destroy();
        window.cropper = null;
        document.querySelector('button[onclick="applyCrop()"]').textContent = 'Crop';
    }
    
    if (!imageId || !imageStates.has(imageId)) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = imageToEdit.naturalWidth;
    canvas.height = imageToEdit.naturalHeight;
    ctx.drawImage(imageToEdit, 0, 0);

    switch(filterType) {
        case 'grayscale':
            applyGrayscale(ctx, canvas.width, canvas.height);
            break;
        case 'sepia':
            applySepia(ctx, canvas.width, canvas.height);
            break;
        case 'brightness':
            applyBrightness(ctx, canvas.width, canvas.height);
            break;
    }

    const filteredImage = canvas.toDataURL('image/jpeg', 0.9);
    const imageState = imageStates.get(imageId);
    imageState.current = filteredImage;
    imageState.filters.push(filterType);
    imageStates.set(imageId, imageState);
    
    imageToEdit.src = filteredImage;
}

function updateSelectedImage(newSrc) {
    const selectedPreview = document.querySelector('.image-preview.selected img');
    if (selectedPreview) {
        selectedPreview.src = newSrc;
        const index = Array.from(selectedPreview.parentElement.parentElement.children)
            .indexOf(selectedPreview.parentElement);
        if (index !== -1) {
            imageFiles[index].dataUrl = newSrc;
        }
    }
}

// Filter functions
function applyGrayscale(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;     // Red
        data[i + 1] = avg; // Green
        data[i + 2] = avg; // Blue
        // data[i + 3] is alpha (the fourth component)
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applySepia(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));     // Red
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)); // Green
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131)); // Blue
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applyBrightness(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const brightness = 50; // Increased brightness value
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + brightness);     // Red
        data[i + 1] = Math.min(255, data[i + 1] + brightness); // Green
        data[i + 2] = Math.min(255, data[i + 2] + brightness); // Blue
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Modal handling
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageEditorModal');
    const closeBtn = modal.querySelector('.close-modal');
    
    closeBtn.onclick = function() {
        modal.classList.add('hidden');
        if (window.cropper) {
            window.cropper.destroy();
        }
    }
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.classList.add('hidden');
            if (window.cropper) {
                window.cropper.destroy();
            }
        }
    }
});

// Share functions
function shareGift(platform) {
    const shareLink = document.getElementById('shareLink').value;
    const message = encodeURIComponent("I've sent you a digital gift! Open it here: ");
    
    let shareUrl;
    switch(platform) {
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${message}${encodeURIComponent(shareLink)}`;
            break;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${message}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=${encodeURIComponent("A Digital Gift for You!")}&body=${message}${encodeURIComponent(shareLink)}`;
            break;
    }
    
    window.open(shareUrl, '_blank');
}

function copyLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');
    
    // Show feedback
    const originalText = shareLink.nextElementSibling.textContent;
    shareLink.nextElementSibling.textContent = 'Copied!';
    setTimeout(() => {
        shareLink.nextElementSibling.textContent = originalText;
    }, 2000);
}

// Utility functions
function showSuccessMessage(message) {
    // Implement your preferred notification method
    alert(message);
}

function showErrorMessage(message) {
    // Implement your preferred notification method
    alert(message);
}
// Add this function to script.js
function saveEditedImage() {
    const imageToEdit = document.getElementById('imageToEdit');
    const imageId = imageToEdit.getAttribute('data-image-id');
    
    if (imageId && imageStates.has(imageId)) {
        const editedImageData = imageToEdit.src;
        updateSelectedImage(editedImageData);
        
        // Update the stored state
        const imageState = imageStates.get(imageId);
        imageState.current = editedImageData;
        imageStates.set(imageId, imageState);
    }
    
    const modal = document.getElementById('imageEditorModal');
    modal.classList.add('hidden');
    
    if (window.cropper) {
        window.cropper.destroy();
    }
}

function resetImage() {
    const imageToEdit = document.getElementById('imageToEdit');
    const imageId = imageToEdit.getAttribute('data-image-id');
    
    if (imageId && imageStates.has(imageId)) {
        const imageState = imageStates.get(imageId);
        
        // Destroy cropper if it exists
        if (window.cropper) {
            window.cropper.destroy();
            window.cropper = null;
            document.querySelector('button[onclick="applyCrop()"]').textContent = 'Crop';
        }
        
        // Reset to original state
        imageState.current = imageState.original;
        imageState.filters = [];
        imageStates.set(imageId, imageState);
        
        imageToEdit.src = imageState.original;
    }
}

// Add scratch pattern selection handling
document.querySelectorAll('.scratch-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.scratch-option').forEach(opt => 
            opt.classList.remove('selected'));
        this.classList.add('selected');
    });
});
  