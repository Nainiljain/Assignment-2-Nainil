/********************************************************************************* 
 * * ITE5315 – Assignment 2 
 * * I declare that this assignment is my own work in accordance with Humber Academic Policy. 
 * * No part of this assignment has been copied manually or electronically from any other source 
 * * (including web sites) or distributed to other students.
 * * Name: Thabotharan Balachandran
 * * Student ID: N01674899
 * * Date: 2025-10-29
 * ********************************************************************************/

// Importing required modules
const express = require('express'); // Express framework
const path = require('path'); // For handling file paths
const fs = require('fs').promises; // For async file operations
const { engine } = require('express-handlebars'); // Handlebars view engine
const { body, query, validationResult } = require('express-validator'); // For input validation
const port = process.env.PORT || 3000; // Corrected: process.env.PORT should be uppercase

const app = express(); // Creating an Express application

// Configure Handlebars with partials directory and custom helpers
app.engine('.hbs', engine({
    // Defining custom helpers
    helpers: {
        serviceFeeValue: function (fee) {
            if (!fee || fee.trim() === "") {
                return "0";
            }
            return fee;
        },
        highlightRow: function (fee) {
            if (!fee || fee.trim() === "") {
                return "background-color: beige; font-weight: bold;";
            }
            return '';
        },
        // ✅ Added 'eq' helper to fix the "Missing helper: eq" error
        eq: function (a, b) {
            return a === b;
        }
    },
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Load data before starting the server
let airbnbData = [];
let selectedData = [];

// Function to load data from remote URL
async function AirbnbData() {
    try {
        // ✅ Use the RAW GitHub link
        const base = "https://raw.githubusercontent.com/Nainiljain/Assignment-2-Nainil-Database/master/";
        const indexUrl = base + "index.json";

        // Fetch index.json
        const index = await (await fetch(indexUrl)).json();

        // Load all part files in parallel
        const parts = await Promise.all(
            index.parts.map((file) => fetch(base + file).then((r) => r.json()))
        );

        // Merge and return the full dataset
        return parts.flat();
    } catch (err) {
        console.error("❌ Failed to load Airbnb data:", err);
        return [];
    }
}

// =================== ROUTES =================== //

// Home Route
app.get('/', function(req, res) {
    res.render('index', { 
        title: 'Home - Express App',
        activePage: 'home',
        welcomeMessage: 'Welcome to our website!'
    });
});

// Example route for users
app.get('/users', function (req, res) {
    res.send('respond with a resource');
});

// JSON Data Routes
app.get('/data', async (req, res) => {
    try {
        selectedData = await AirbnbData();
        res.render('data', {
            title: 'JSON Data - Express App',
            activePage: 'data',
            message: 'JSON data is loaded and ready!',
            totalRecords: selectedData.length
        });
    } catch (error) {
        res.render('error', {
            title: 'Error - Data Load Failed',
            message: 'Error loading JSON data: ' + error.message
        });
    }
});

app.get('/data/:index', async (req, res) => {
    try {
        selectedData = await AirbnbData();
        const idx = Number(req.params.index);

        if (idx < 0 || idx >= selectedData.length) {
            return res.render('error', {
                title: 'Error - Invalid Index',
                message: `Invalid index: ${idx}. Please use index between 0 and ${selectedData.length - 1}`
            });
        }
        
        res.render('data-record', {
            title: `Record ${idx} - Express App`,
            activePage: 'data',
            record: data[idx],
            index: idx
        });
    } catch (error) {
        res.render('error', {
            title: 'Error - Data Load Failed',
            message: 'Error loading JSON data: ' + error.message
        });
    }
});

// Search Forms
app.get('/search/id', (req, res) => {
    res.render('search-id-form', {
        title: 'Search by ID - Express App',
        activePage: 'search'
    });
});

app.get('/search/name', (req, res) => {
    res.render('search-name-form', {
        title: 'Search by Name - Express App',
        activePage: 'search'
    });
});

// Search Results
app.get("/search/id/result", async (req, res) => {
    try {
        selectedData = await AirbnbData();
        const id = req.query.id;

        const record = selectedData.find((r) => String(r.id) === id);

        res.render('search-id-result', {
            title: 'Search Results - Express App',
            activePage: 'search',
            record: record,
            searchId: id,
            found: !!record
        });
    } catch (err) {
        console.error(err);
        res.render('error', {
            title: 'Error - Search Failed',
            message: 'Error reading JSON file: ' + err.message
        });
    }
});

app.get('/search/name/result', async (req, res) => {
    try {
        selectedData = await AirbnbData();
        const q = req.query.q.toLowerCase();
        const results = selectedData.filter(r => r.NAME && r.NAME.toLowerCase().includes(q));

        res.render('search-name-result', {
            title: 'Search Results - Express App',
            activePage: 'search',
            results: results,
            searchQuery: q,
            found: results.length > 0
        });
    } catch (error) {
        res.render('error', {
            title: 'Error - Search Failed',
            message: 'Error reading JSON file: ' + error.message
        });
    }
});

// View all Airbnb data
app.get('/viewData', async (req, res) => {
    selectedData = await AirbnbData();
    res.render('viewData', { title: 'View All Airbnb Filled Data', data: selectedData });
});

// Highlight rows with missing service fees
app.get('/viewDataClean', async (req, res) => {
    selectedData = await AirbnbData();
    res.render('viewDataClean', { title: 'View All Airbnb Highlighted Data', data: selectedData });
});

// Filter by price range
app.get('/viewPrice',
    [
        query("min")
            .notEmpty()
            .withMessage("Minimum price is required")
            .isNumeric()
            .withMessage("Minimum price must be a number")
            .trim()
            .escape(),
        query("max")
            .notEmpty()
            .withMessage("Maximum price is required")
            .isNumeric()
            .withMessage("Maximum price must be a number")
            .trim()
            .escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        let found = [];

        if (req.query.min && req.query.max && errors.isEmpty()) {
            const min = parseFloat(req.query.min);
            const max = parseFloat(req.query.max);
            selectedData = await AirbnbData();

            found = selectedData.filter((p) => {
                const price = parseFloat((p.price || "0").replace(/[^0-9.]/g, ""));
                return price >= min && price <= max;
            });
        }

        res.render("viewPrice", {
            title: "Search by Price Range",
            min: req.query.min || "",
            max: req.query.max || "",
            data: found,
            errors: errors.array(),
        });
    }
);

// 404 Handler
app.use(function(req, res) {
    res.render('error', { 
        title: 'Error - Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
