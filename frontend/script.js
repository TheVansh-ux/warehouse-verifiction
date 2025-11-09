/**
 * Frontend JavaScript for the Warehouse Verification App.
 * Includes Audio Cues, Toasts, Screen Flash, and Stats Dashboard.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const API_BASE_URL = 'https://warehouse-verification.onrender.com/'; 
    const REFRESH_INTERVAL_MS = 10000;

    // --- Audio Cue Setup ---
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

    // --- NEW: Stats Selectors ---
    const statTotalEl = document.getElementById('stat-total');
    const statPassedEl = document.getElementById('stat-passed');
    const statFailedEl = document.getElementById('stat-failed');
    const pieChartCanvas = document.getElementById('stats-pie-chart');
    
    // --- NEW: Chart.js global variable ---
    let statsPieChart = null; // We'll store the chart object here

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
            // --- NEW: Refresh stats after a scan ---
            await fetchAndRenderStats();
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
            triggerScreenFlash('success');
            passSound.play(); 
        } else {
            showToast('❌ Fail!', 'error');
            triggerScreenFlash('fail');
            failSound.play(); 
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
                const timestamp = new Date(scan.created_at).toLocaleString('sv-SE').replace(' ', ' - ');
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

    // --- NEW: Function to get and render stats ---
    async function fetchAndRenderStats() {
        try {
            const cleanApiBaseUrl = API_BASE_URL.replace(/\/$/, "");
            const response = await fetch(`${cleanApiBaseUrl}/api/stats`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const stats = await response.json();
            
            // Update the stat boxes
            statTotalEl.textContent = stats.total_scans;
            statPassedEl.textContent = stats.total_passed;
            statFailedEl.textContent = stats.total_failed;
            
            // Render the pie chart
            renderPieChart(stats);
            
        } catch (error) {
            console.error('Error fetching stats:', error);
            statTotalEl.textContent = 'E';
            statPassedEl.textContent = 'E';
            statFailedEl.textContent = 'E';
        }
    }

    // --- NEW: Function to draw the pie chart ---
    function renderPieChart(stats) {
        const ctx = pieChartCanvas.getContext('2d');
        
        // Get CSS colors for the chart
        const passColor = getComputedStyle(document.documentElement).getPropertyValue('--success-color');
        const failColor = getComputedStyle(document.documentElement).getPropertyValue('--error-color');

        const data = {
            labels: [
                'Passed',
                'Failed'
            ],
            datasets: [{
                label: 'Scan Stats',
                data: [stats.total_passed, stats.total_failed],
                backgroundColor: [
                    passColor,
                    failColor
                ],
                hoverOffset: 4
            }]
        };

        // If the chart already exists, destroy it before drawing a new one
        if (statsPieChart) {
            statsPieChart.destroy();
        }

        // Create the new chart
        statsPieChart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed;
                                }
                                return label;
                            }
                        }
                    }
                }
            },
        });
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    function showToast(message, type = 'success') {
        const tC = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.classList.add('toast', `toast-${type}`);
        t.innerHTML = message;
        tC.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => {
            t.classList.remove('show');
            t.addEventListener('transitionend', () => t.remove(), { once: true });
        }, 3000);
    }
    
    function triggerScreenFlash(type) {
        flashOverlay.classList.remove('flash-success', 'flash-fail', 'flash-active');
        const c = (type === 'success') ? 'flash-success' : 'flash-fail';
        flashOverlay.classList.add(c);
        setTimeout(() => {
            flashOverlay.classList.add('flash-active');
            setTimeout(() => flashOverlay.classList.remove('flash-active'), 150);
        }, 10);
    }

    // --- Initialization ---
    function initializeApp() {
        fetchScans(); // Load the table
        fetchAndRenderStats(); // <-- NEW: Load the stats on page load
        setInterval(fetchScans, REFRESH_INTERVAL_MS); // Keep table refreshing
    }

    initializeApp();
});