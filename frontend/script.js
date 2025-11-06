/**
 * Frontend JavaScript for the Warehouse Verification App.
 * Handles API calls and DOM manipulation.
 * Includes Audio Cues.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const API_BASE_URL = 'https://warehouse-verification.onrender.com/'; 
    const REFRESH_INTERVAL_MS = 10000;

    // --- NEW: Audio Cue Setup ---
    // Make sure you have these files in your /frontend folder
    const passSound = new Audio('pass-beep.mp3');
    const failSound = new Audio('fail-buzz.mp3');

    // --- DOM Element Selectors ---
    const scanForm = document.getElementById('scan-form');
    const barcode1Input = document.getElementById('barcode1');
    const barcode2Input = document.getElementById('barcode2');
    const verifyBtn = document.getElementById('verify-btn');
    const scansTbody = document.getElementById('scans-tbody');
    const scansTable = document.getElementById('scans-table');
    const noScansMessage = document.getElementById('no-scans-message');
    const flashOverlay = document.getElementById('flash-overlay');

    // --- Event Listeners ---
    scanForm.addEventListener('submit', handleVerificationSubmit);
    barcode1Input.addEventListener('keypress', handleEnterKey);
    barcode2Input.addEventListener('keypress', handleEnterKey);

    // --- Core Functions ---

    function handleEnterKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (document.activeElement === barcode1Input) {
                barcode2Input.focus();
            } else {
                verifyBtn.click();
            }
        }
    }

    async function handleVerificationSubmit(e) {
        e.preventDefault();

        const barcode1 = barcode1Input.value.trim();
        const barcode2 = barcode2Input.value.trim();

        if (!barcode1 || !barcode2) {
            showToast('❌ Please enter both barcodes.', 'error');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

        try {
            await submitScan(barcode1, barcode2);
        } catch (error) {
            console.error('Submission failed:', error);
            showToast(`❌ Error: ${error.message}`, 'error');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Verify Product';
            barcode1Input.value = '';
            barcode2Input.value = '';
            barcode1Input.focus();
        }
    }

    /**
     * Submits the two barcodes to the backend API.
     * (MODIFIED: Added audio cues)
     */
    async function submitScan(barcode1, barcode2) {
        const cleanApiBaseUrl = API_BASE_URL.replace(/\/$/, "");
        
        const response = await fetch(`${cleanApiBaseUrl}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode1, barcode2 }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown server error' }));
            throw new Error(errorData.detail || 'Failed to submit scan');
        }

        const data = await response.json();

        if (data.result === 'Match') {
            showToast('✅ Pass!', 'success');
            passSound.play(); // <-- Play pass sound
            triggerScreenFlash('success');
        } else {
            showToast('❌ Fail!', 'error');
            failSound.play(); // <-- Play fail sound
            triggerScreenFlash('fail');
        }

        await fetchScans();
    }

    async function fetchScans() {
        try {
            const cleanApiBaseUrl = API_BASE_URL.replace(/\/$/, "");
            const response = await fetch(`${cleanApiBaseUrl}/api/scans`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const scans = await response.json();
            renderScansTable(scans);
        } catch (error) {
            console.error('Error fetching scans:', error);
            renderScansTable([]);
        }
    }

    function renderScansTable(scans) {
        scansTbody.innerHTML = '';

        if (scans.length === 0) {
            noScansMessage.style.display = 'flex';
            scansTable.style.display = 'none';
        } else {
            noScansMessage.style.display = 'none';
            scansTable.style.display = 'table';

            scans.forEach(scan => {
                const tr = document.createElement('tr');
                const resultText = scan.result === 1 ? 'Pass' : 'Fail';
                const resultIcon = scan.result === 1 ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
                const resultClass = scan.result === 1 ? 'result-match' : 'result-no-match';
                
                const timestamp = new Date(scan.created_at).toLocaleString('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).replace(' ', ' - ');

                tr.innerHTML = `
                    <td>${scan.id}</td>
                    <td>${escapeHTML(scan.barcode1)}</td>
                    <td>${escapeHTML(scan.barcode2)}</td>
                    <td><span class="result-badge ${resultClass}">${resultIcon} ${resultText}</span></td>
                    <td>${timestamp}</td>
                `;
                scansTbody.appendChild(tr);
            });
        }
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[match];
        });
    }

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast', `toast-${type}`);
        toast.innerHTML = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            }, { once: true });
        }, 3000);
    }
// --- NEW HELPER FUNCTION (REVISED) ---
/**
 * Triggers a full-screen color flash.
 * @param {string} type - 'success' or 'fail'
 */
function triggerScreenFlash(type) {
    // Clear any previous flash classes
    flashOverlay.classList.remove('flash-success', 'flash-fail', 'flash-active');

    // Add the correct color class
    if (type === 'success') {
        flashOverlay.classList.add('flash-success');
    } else {
        flashOverlay.classList.add('flash-fail');
    }

    // --- THIS IS THE FIX ---
    //
    // Force the browser to apply the color class (flash-success/fail) FIRST
    // We use a tiny 10ms timeout for this.
    setTimeout(() => {
        // NOW, add the class to make it visible
        flashOverlay.classList.add('flash-active');

        // Set a timer to remove the active class, making it fade out
        setTimeout(() => {
            flashOverlay.classList.remove('flash-active');
        }, 150); // 150ms flash duration
        
    }, 10); // 10ms delay before flashing
}

    // --- Initialization ---
    function initializeApp() {
        fetchScans();
        setInterval(fetchScans, REFRESH_INTERVAL_MS);
    }


    initializeApp();
    
});