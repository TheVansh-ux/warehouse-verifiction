/**
 * Frontend JavaScript for the Warehouse Verification App.
 * Handles API calls and DOM manipulation.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    // Make sure this is your LIVE backend URL
    const API_BASE_URL = 'https://warehouse-backend.onrender.com'; 
    const REFRESH_INTERVAL_MS = 10000; // 10 seconds

    // --- DOM Element Selectors ---
    const scanForm = document.getElementById('scan-form');
    const barcode1Input = document.getElementById('barcode1');
    const barcode2Input = document.getElementById('barcode2');
    const verifyBtn = document.getElementById('verify-btn');
    const scansTbody = document.getElementById('scans-tbody');
    const scansTable = document.getElementById('scans-table');
    const noScansMessage = document.getElementById('no-scans-message');

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
            // Use toast for validation error
            showToast('❌ Please enter both barcodes.', 'error');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

        try {
            await submitScan(barcode1, barcode2);
        } catch (error) {
            console.error('Submission failed:', error);
            // Use toast for server error
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
     * (MODIFIED: Replaced alert() with showToast())
     */
    async function submitScan(barcode1, barcode2) {
        const response = await fetch(`${API_BASE_URL}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode1, barcode2 }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown server error' }));
            throw new Error(errorData.detail || 'Failed to submit scan');
        }

        const data = await response.json();

        // --- REPLACED ALERT ---
        if (data.result === 'Match') {
            showToast('✅ Match!', 'success');
        } else {
            showToast('❌ No Match!', 'error');
        }

        await fetchScans();
    }

    async function fetchScans() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/scans`);
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
                const resultText = scan.result === 1 ? 'Match' : 'No Match';
                const resultIcon = scan.result === 1 ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
                const resultClass = scan.result === 1 ? 'result-match' : 'result-no-match';
                const timestamp = new Date(scan.created.at).toLocaleString('sv-SE', {
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

    // --- NEW HELPER FUNCTION ---
    /**
     * Shows a toast notification at the corner of the screen.
     * @param {string} message - The text to display.
     * @param {string} type - 'success' or 'error' to control the color.
     */
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');

        // Create the toast element
        const toast = document.createElement('div');
        toast.classList.add('toast', `toast-${type}`);
        toast.innerHTML = message; // Using innerHTML to render icons like ✅

        // Add to container
        toastContainer.appendChild(toast);

        // --- Animation ---
        // 1. Trigger the "show" transition
        setTimeout(() => {
            toast.classList.add('show');
        }, 10); // A small delay to allow the element to be in the DOM first

        // 2. Set timer to remove the toast
        setTimeout(() => {
            toast.classList.remove('show'); // Trigger "hide" animation

            // 3. Remove from DOM after animation finishes
            toast.addEventListener('transitionend', () => {
                toast.remove();
            }, { once: true });

        }, 3000); // Toast stays for 3 seconds
    }

    // --- Initialization ---
    function initializeApp() {
        fetchScans();
        setInterval(fetchScans, REFRESH_INTERVAL_MS);
    }

    initializeApp();
});