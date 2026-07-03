// ============================================
// Initialize Supabase client using config
// ============================================
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

// ============================================
// DOM Elements
// ============================================
const yearSlider = document.getElementById('yearSlider');
const yearTabs = document.getElementById('yearTabs');
const showDataBtn = document.getElementById('showDataBtn');
const btnText = showDataBtn.querySelector('.btn-text');
const btnLoader = showDataBtn.querySelector('.btn-loader');
const dataContainer = document.getElementById('dataContainer');
const errorContainer = document.getElementById('errorContainer');
const tableTitle = document.getElementById('tableTitle');
const summaryTable = document.getElementById('summaryTable');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const tableFooter = document.getElementById('tableFooter');

let isDataVisible = false;
let availableYears = [];
let selectedYear = null;
let allData = [];

// ============================================
// COLUMNS TO HIDE FROM UI
// Add any column names here to exclude them from the table
// ============================================
const HIDDEN_COLUMNS = ['parent_category'];

// ============================================
// Initialize: Load years on page load
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    await loadYears();
});

async function loadYears() {
    setLoading(true);
    hideError();

    try {
        const { data, error } = await supabaseClient
            .from('yearly_summary')
            .select('*');

        if (error) throw error;

        if (!data || data.length === 0) {
            showError('No data found in yearly_summary view.');
            populateYearSlider([]);
            return;
        }

        allData = data;

        // Extract unique years and sort descending
        availableYears = [...new Set(data.map(row => row.year))]
            .filter(y => y !== null && y !== undefined)
            .sort((a, b) => b - a);

        populateYearSlider(availableYears);

        // Enable button once years are loaded
        showDataBtn.disabled = availableYears.length === 0;

    } catch (err) {
        console.error('Error loading data:', err);
        showError(`Failed to load data: ${err.message || 'Unknown error'}`);
        populateYearSlider([]);
        showDataBtn.disabled = true;
    } finally {
        setLoading(false);
    }
}

function populateYearSlider(years) {
    yearTabs.innerHTML = '';

    if (years.length === 0) {
        yearSlider.classList.add('hidden');
        return;
    }

    yearSlider.classList.remove('hidden');

    years.forEach((year, index) => {
        const tab = document.createElement('button');
        tab.className = 'year-tab';
        tab.textContent = year;
        tab.dataset.year = year;
        
        if (index === 0) {
            tab.classList.add('active');
            selectedYear = year;
        }

        tab.addEventListener('click', function() {
            document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            selectedYear = parseInt(this.dataset.year);
            
            if (isDataVisible) {
                hideData();
            }
            hideError();
        });

        yearTabs.appendChild(tab);
    });
}

// ============================================
// Event Listener
// ============================================
showDataBtn.addEventListener('click', async function() {
    if (isDataVisible) {
        hideData();
        return;
    }

    if (!selectedYear) {
        showError('Please select a year first.');
        return;
    }

    setLoading(true);
    hideError();

    try {
        const yearData = allData.filter(row => row.year === selectedYear);

        if (!yearData || yearData.length === 0) {
            showError(`No data found for year ${selectedYear}.`);
            setLoading(false);
            return;
        }

        renderTable(yearData, selectedYear);
        showData();
    } catch (err) {
        console.error('Error:', err);
        showError(`Failed to load data: ${err.message || 'Unknown error'}`);
    } finally {
        setLoading(false);
    }
});

// ============================================
// Table Rendering
// ============================================
function renderTable(data, year) {
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    tableFooter.innerHTML = '';

    tableTitle.textContent = `Yearly Cumulative Summary - ${year}`;

    // Get all columns from first row, then filter out hidden ones
    const allColumns = Object.keys(data[0]);
    const columns = allColumns.filter(col => !HIDDEN_COLUMNS.includes(col.toLowerCase()));

    // Identify special columns from visible columns only
    const categoryCol = columns.find(c => 
        c.toLowerCase().includes('category') || 
        c.toLowerCase().includes('name') ||
        c.toLowerCase().includes('type')
    ) || columns[0];

    const monthCols = columns.filter(c => {
        const lower = c.toLowerCase();
        return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].some(m => lower.includes(m));
    });

    const totalCol = columns.find(c => 
        c.toLowerCase().includes('total') || 
        c.toLowerCase().includes('sum')
    );

    const otherCols = columns.filter(c => 
        c !== categoryCol && 
        !monthCols.includes(c) && 
        c !== totalCol &&
        c.toLowerCase() !== 'year'
    );

    // Build ordered columns: Category, Months, Others, Total
    const orderedCols = [categoryCol, ...monthCols, ...otherCols];
    if (totalCol) orderedCols.push(totalCol);

    // Render header
    orderedCols.forEach(col => {
        const th = document.createElement('th');
        th.textContent = formatColumnName(col);
        if (col === totalCol) th.classList.add('total-col');
        tableHeader.appendChild(th);
    });

    // Calculate column totals (only for visible columns)
    const colTotals = {};
    orderedCols.forEach(col => {
        if (col !== categoryCol) {
            colTotals[col] = data.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
        }
    });

    // Render data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        orderedCols.forEach(col => {
            const td = document.createElement('td');
            const value = row[col];
            const formatted = formatValue(value, col);
            
            td.textContent = formatted.text;
            if (formatted.className) {
                td.classList.add(formatted.className);
            }
            if (col === totalCol) {
                td.classList.add('total-cell');
            }
            
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });

    // Render TOTAL row
    const totalRow = document.createElement('tr');
    totalRow.classList.add('grand-total-row');
    
    orderedCols.forEach(col => {
        const td = document.createElement('td');
        
        if (col === categoryCol) {
            td.textContent = 'TOTAL';
            td.classList.add('total-label');
        } else {
            const totalValue = colTotals[col];
            td.textContent = totalValue !== 0 ? totalValue.toLocaleString() : '-';
            td.classList.add('total-value');
        }
        
        totalRow.appendChild(td);
    });
    
    tableBody.appendChild(totalRow);

    tableFooter.textContent = `${data.length} categories • Year ${year}`;
}

// ============================================
// Value Formatting
// ============================================
function isYearColumn(colName) {
    const yearPatterns = ['year', 'yr', 'fiscal_year', 'calendar_year', 'report_year'];
    const lower = colName.toLowerCase();
    return yearPatterns.some(p => lower.includes(p));
}

function isYearValue(value) {
    return Number.isInteger(value) && value >= 1000 && value <= 9999;
}

function formatValue(value, colName) {
    if (value === null || value === undefined) {
        return { text: '-', className: 'null-value' };
    }
    
    if (typeof value === 'boolean') {
        return { text: value ? 'Yes' : 'No', className: null };
    }
    
    if (typeof value === 'number') {
        if (isYearValue(value) || isYearColumn(colName)) {
            return { text: String(value), className: null };
        }
        return { text: value.toLocaleString(), className: 'number-value' };
    }
    
    return { text: String(value), className: null };
}

function formatColumnName(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

// ============================================
// UI Helpers
// ============================================
function showData() {
    dataContainer.classList.remove('hidden');
    btnText.textContent = 'Hide Data';
    showDataBtn.classList.add('active');
    isDataVisible = true;
}

function hideData() {
    dataContainer.classList.add('hidden');
    btnText.textContent = 'Show Data';
    showDataBtn.classList.remove('active');
    isDataVisible = false;
}

function setLoading(loading) {
    if (loading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        showDataBtn.disabled = true;
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        showDataBtn.disabled = false;
    }
}

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}

function hideError() {
    errorContainer.classList.add('hidden');
}
