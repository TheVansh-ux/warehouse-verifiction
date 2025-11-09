/**
 * Frontend JavaScript for the Warehouse Verification App.
 * Includes Audio Cues, Toasts, Screen Flash, Stats Dashboard, and Shift Chart.
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
    
    // Stats (Pie Chart) Selectors
    const statTotalEl = document.getElementById('stat-total');
    const statPassedEl = document.getElementById('stat-passed');
    const statFailedEl = document.getElementById('stat-failed');
    const pieChartCanvas = document.getElementById('stats-pie-chart');
    
    // Shift (Bar Chart) Selectors
    const barChartCanvas = document.getElementById('shift-bar-chart');
    
    // Chart.js global variables
    let statsPieChart = null; 
    let shiftBarChart = null;

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
            // Refresh both charts after a scan
            await fetchAndRenderStats();
            await fetchAndRenderShiftStats(); 
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
            if (!response.ok) throw new Error('Network response was not ok');
            const scans = await response.json();
            renderScansTable(scans);
        } catch (error) {
            console.error('Error fetching scans:', error);
            renderScansTable([]);
        }
    }

    function renderScansTable(scans) {
        // Ensure tbody exists before trying to clear it
        if (!scansTbody) return; 
        
        scansTbody.innerHTML = '';
        if (scans.length === 0) {
            if(noScansMessage) noScansMessage.style.display = 'flex';
            if(scansTable) scansTable.style.display = 'none';
        } else {
            if(noScansMessage) noScansMessage.style.display = 'none';
            if(scansTable) scansTable.style.display = 'table';
            
            scans.forEach(scan => {
                const tr = document.createElement('tr');
                const resultText = scan.result === 1 ? 'Pass' : 'Fail';
                const resultIcon = scan.result === 1 ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
                const resultClass = scan.result === 1 ? 'result-match' : 'result-no-match';
                const timestamp = new Date(scan.created_at).toLocaleString('sv-SE', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
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

    async function fetchAndRenderStats() {
        // Check if all elements exist before fetching
        if (!statTotalEl || !statPassedEl || !statFailedEl || !pieChartCanvas) {
            console.log("Stats elements not found, skipping render.");
            return;
        }
        
        try {
            const cleanApiBaseUrl = API_BASE_URL.replace(/\/$/, "");
            const response = await fetch(`${cleanApiBaseUrl}/api/stats`);
            if (!response.ok) throw new Error(`Stats endpoint failed (${response.status})`);
            const stats = await response.json();
            
            statTotalEl.textContent = stats.total_scans;
            statPassedEl.textContent = stats.total_passed;
            statFailedEl.textContent = stats.total_failed;
            
            renderPieChart(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
            statTotalEl.textContent = 'E';
            statPassedEl.textContent = 'E';
            statFailedEl.textContent = 'E';
        }
    }

    function renderPieChart(stats) {
        const ctx = pieChartCanvas.getContext('2d');
        const passColor = getComputedStyle(document.documentElement).getPropertyValue('--success-color');
        const failColor = getComputedStyle(document.documentElement).getPropertyValue('--error-color');

        const data = {
            labels: [ 'Passed', 'Failed' ],
            datasets: [{
                label: 'Scan Stats',
                data: [stats.total_passed, stats.total_failed],
                backgroundColor: [ passColor, failColor ],
                hoverOffset: 4
            }]
        };

        if (statsPieChart) statsPieChart.destroy();
        statsPieChart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: { responsive: true, plugins: { legend: { position: 'top' } } },
        });
    }
    
    async function fetchAndRenderShiftStats() {
        // Check if bar chart canvas exists
        if (!barChartCanvas) {
            console.log("Shift chart canvas not found, skipping render.");
            return;
        }

        try {
            const cleanApiBaseUrl = API_BASE_URL.replace(/\/$/, "");
            const response = await fetch(`${cleanApiBaseUrl}/api/stats/shifts`);
            if (!response.ok) throw new Error(`Shift stats endpoint failed (${response.status})`);
            const data = await response.json();
            
            renderBarChart(data.shifts);
        } catch (error) {
            console.error('Error fetching shift stats:', error);
        }
    }
    
    function renderBarChart(shiftData) {
        const ctx = barChartCanvas.getContext('2d');
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');

        const labels = shiftData.map(s => s.shift_name.replace(' (', '\n('));
        const counts = shiftData.map(s => s.scan_count);

        const data = {
            labels: labels,
            datasets: [{
                label: 'Total Scans',
                data: counts,
                backgroundColor: primaryColor,
                borderColor: primaryColor,
                borderWidth: 1,
                borderRadius: 4
            }]
        };

        if (shiftBarChart) shiftBarChart.destroy();
        shiftBarChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: borderColor }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
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
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.classList.add('toast', `toast-${type}`);
        toast.innerHTML = message;
        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 3000);
    }
    
    function triggerScreenFlash(type) {
        if (!flashOverlay) return;
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
        fetchScans();
        fetchAndRenderStats();
        fetchAndRenderShiftStats();
        
        setInterval(fetchScans, REFRESH_INTERVAL_MS); 
    }

    initializeApp();
});