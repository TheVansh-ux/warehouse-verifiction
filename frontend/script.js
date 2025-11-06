/**
 * Frontend JavaScript for the Warehouse Verification App.
 * Handles API calls and DOM manipulation.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const API_BASE_URL = 'http://127.0.0.1:8000';
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

    // Handle form submission
    scanForm.addEventListener('submit', handleVerificationSubmit);

    // Add 'Enter' key listeners for a faster scanning workflow
    barcode1Input.addEventListener('keypress', handleEnterKey);
    barcode2Input.addEventListener('keypress', handleEnterKey);

    // --- Core Functions ---

    /**
     * Handles the 'Enter' key press on input fields.
     * If 'Enter' is pressed, it prevents form submission and clicks the verify button.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    function handleEnterKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();

            // If user presses Enter on first input, move to second
            if (document.activeElement === barcode1Input) {
                barcode2Input.focus();
            } else {
                // If on second input, trigger verification
                verifyBtn.click();
            }
        }
    }

    /**
     * Handles the verification form submission.
     * @param {Event} e - The form submit event.
     */
    async function handleVerificationSubmit(e) {
        e.preventDefault(); // Prevent default form submission

        const barcode1 = barcode1Input.value.trim();
        const barcode2 = barcode2Input.value.trim();

        // Basic validation
        if (!barcode1 || !barcode2) {
            alert('❌ Error: Please enter both barcodes.');
            return;
        }

        // Disable button to prevent double-submission
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...'; // Add spinner icon

        try {
            await submitScan(barcode1, barcode2);
        } catch (error) {
            console.error('Submission failed:', error);
            alert(`❌ Error: Could not connect to server or server error. ${error.message || ''}`);
        } finally {
            // Re-enable button and reset text
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Verify Product';

            // Clear inputs and refocus on the first one for the next scan
            barcode1Input.value = '';
            barcode2Input.value = '';
            barcode1Input.focus();
        }
    }

    /**
     * Submits the two barcodes to the backend API.
     * @param {string} barcode1 - The first barcode string.
     * @param {string} barcode2 - The second barcode string.
     */
    async function submitScan(barcode1, barcode2) {
        const response = await fetch(`${API_BASE_URL}/api/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ barcode1, barcode2 }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown server error' })); // Parse error or provide default
            throw new Error(errorData.detail || 'Failed to submit scan');
        }

        const data = await response.json();

        // Show a simple alert as requested
        if (data.result === 'Match') {
            alert('✅ Match!');
        } else {
            alert('❌ No Match!');
        }

        // After successful submission, refresh the dashboard immediately
        await fetchScans();
    }

    /**
     * Fetches the last 10 scans from the backend API.
     */
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
            // Show an empty state if fetching fails, or if there are no scans
            renderScansTable([]);
        }
    }

    /**
     * Renders the fetched scan data into the dashboard table.
     * @param {Array} scans - An array of scan objects from the API.
     */
    function renderScansTable(scans) {
        // Clear existing table body
        scansTbody.innerHTML = '';

        if (scans.length === 0) {
            // Show "no scans" message and hide table
            noScansMessage.style.display = 'flex'; // Use flex to center icon/text
            scansTable.style.display = 'none';
        } else {
            // Hide "no scans" message and show table
            noScansMessage.style.display = 'none';
            scansTable.style.display = 'table';

            // Populate table rows
            scans.forEach(scan => {
                const tr = document.createElement('tr');

                const resultText = scan.result === 1 ? 'Match' : 'No Match';
                const resultIcon = scan.result === 1 ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
                const resultClass = scan.result === 1 ? 'result-match' : 'result-no-match';

                // Format the timestamp for readability (e.g., "2025-11-06 14:25:30")
                const timestamp = new Date(scan.created_at).toLocaleString('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).replace(' ', ' - '); // Optional: change date-time separator

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

    /**
     * Utility function to escape HTML to prevent XSS.
     * @param {string} str - The string to escape.
     * @returns {string} - The escaped string.
     */
    function escapeHTML(str) {
        if (typeof str !== 'string') return ''; // Handle non-string inputs gracefully
        return str.replace(/[&<>"']/g, (match) => {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return map[match];
        });
    }

    // --- Initialization ---

    /**
     * Initial function to load data and set up intervals.
     */
    function initializeApp() {
        // Fetch initial data on page load
        fetchScans();

        // Set up auto-refresh for the dashboard
        setInterval(fetchScans, REFRESH_INTERVAL_MS);
    }

    initializeApp();
});