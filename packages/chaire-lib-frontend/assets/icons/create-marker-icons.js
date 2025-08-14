#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const ICONS_BASE_PATH = __dirname;
const ROUND_TRANSFORM = 'translate(240, 120) scale(0.4)';
const SQUARE_TRANSFORM = 'translate(120, 75) scale(0.7)';

// Marker templates
const ROUND_MARKER_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg class="svg-icon-marker_round-{CATEGORY}-{ICON_NAME} svg-icon-marker_round svg-icon-marker_round-{CATEGORY}" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 800 800">
    <defs>
        <style>
            .svg-icon-marker-background { fill: #fff; }
{ADDITIONAL_STYLES}
        </style>
    </defs>
    <path class="svg-icon-marker-marker_round" d="M678.058,289.282c.01-.256.02-.513.029-.769.044-1.27.087-2.539.113-3.813.046-1.971.075-3.946.075-5.925C678.276,125.068,553.208,0,399.501,0S120.726,125.068,120.726,278.775h0c0,.007,0,.015,0,.022,0,1.966.03,3.927.075,5.886.027,1.301.071,2.597.116,3.893.008.218.016.436.025.654,1.311,35.36,9.235,69.057,22.578,99.889,66.594,165.882,256.216,300.297,256.216,410.756l.133-7.452.133,7.452c0-110.815,190.349-245.74,256.184-412.361,12.919-30.379,20.579-63.506,21.873-98.232Z"/>
    <path class="svg-icon-marker-background" d="M168.817,278.775c0-127.191,103.493-230.684,230.684-230.684s230.684,103.493,230.684,230.684-103.493,230.684-230.684,230.684-230.684-103.493-230.684-230.684h0Z"/>
    <g class="svg-icon-content" transform="${ROUND_TRANSFORM}">
{ICON_CONTENT}
    </g>
</svg>`;

const SQUARE_MARKER_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg class="svg-icon-marker_square-{CATEGORY}-{ICON_NAME} svg-icon-marker_square svg-icon-marker_square-{CATEGORY}" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 800 800">
    <defs>
        <style>
            .svg-icon-marker-background { fill: #fff; }
{ADDITIONAL_STYLES}
        </style>
    </defs>
    <path class="svg-icon-marker-marker_square" d="M678.707,0H121.24C79.611,0,45.744,33.867,45.744,75.496v557.467c0,41.629,33.867,75.496,75.496,75.496h130.099c148.693,5.043,148.635,91.541,148.635,91.541,0,0-.058-86.499,148.636-91.541h130.097c41.629,0,75.496-33.867,75.496-75.496V75.496C754.203,33.868,720.336,0,678.707,0h0Z"/>
    <path class="svg-icon-marker-background" d="M139.566,48.525h520.814c25.017,0,45.297,20.28,45.297,45.297v520.814c0,25.017-20.28,45.297-45.297,45.297H139.566c-25.017,0-45.297-20.28-45.297-45.297V93.822c0-25.017,20.28-45.297,45.297-45.297Z"/>
    <g class="svg-icon-content" transform="${SQUARE_TRANSFORM}">
{ICON_CONTENT}
    </g>
</svg>`;

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        category: null,
        iconName: null,
        force: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-h':
            case '--help':
                options.help = true;
                break;
            case '-f':
            case '--force':
                options.force = true;
                break;
            case '-c':
            case '--category':
                options.category = args[++i];
                break;
            case '-i':
            case '--icon':
                options.iconName = args[++i];
                break;
            default:
                if (!options.category) {
                    options.category = arg;
                } else if (!options.iconName) {
                    options.iconName = arg;
                }
        }
    }

    return options;
}

function showHelp() {
    console.log(`
Create Marker Icons Script
=========================

Automatically generate round and square marker variants from existing plain icons.

Usage:
  node create-marker-icons.js [options] <category> [icon-name]

Arguments:
  category     Icon category (activities, modes, interface)
  icon-name    Specific icon name (optional, processes all if omitted)

Options:
  -f, --force  Overwrite existing marker files
  -h, --help   Show this help message

Examples:
  # Create markers for all icons in activities category
  node create-marker-icons.js activities

  # Create markers for specific icon
  node create-marker-icons.js activities home

  # Force overwrite existing markers
  node create-marker-icons.js -f activities home_secondary

Categories:
  - activities: Trip destination activity icons
  - modes: Transport mode icons  
  - interface: UI interface icons
`);
}

function findPlainIcons(categoryPath, iconName = null) {
    const icons = [];
    
    function scanDirectory(dir, subPath = '') {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.join(subPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Skip sources subdirectories - they contain original files for credits only
                if (item === 'sources') {
                    continue;
                }
                scanDirectory(fullPath, relativePath);
            } else if (item.endsWith('.svg') && !item.includes('-marker_') && !item.includes('_marker_')) {
                const name = path.basename(item, '.svg');
                
                // Skip if specific icon requested and this isn't it
                if (iconName && name !== iconName) continue;
                
                icons.push({
                    name,
                    filePath: fullPath,
                    relativePath,
                    directory: path.dirname(fullPath)
                });
            }
        }
    }
    
    scanDirectory(categoryPath);
    return icons;
}

function extractIconContent(svgContent) {
    // Extract content between <svg> tags, excluding the svg tag itself
    const svgMatch = svgContent.match(/<svg[^>]*>(.*)<\/svg>/s);
    if (!svgMatch) return null;
    
    let content = svgMatch[1].trim();
    
    // Extract additional styles from defs if present
    let additionalStyles = '';
    const defsMatch = content.match(/<defs>\s*<style[^>]*>(.*?)<\/style>\s*<\/defs>/s);
    if (defsMatch) {
        additionalStyles = defsMatch[1].trim();
        // Remove the defs section from content
        content = content.replace(/<defs>.*?<\/defs>/s, '').trim();
    }
    
    // Add proper indentation to content
    content = content.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        return '        ' + trimmed;
    }).filter(line => line.trim() !== '').join('\n');
    
    return {
        content,
        additionalStyles
    };
}

function generateMarkerIcon(template, iconData, category, iconName) {
    const additionalStylesFormatted = iconData.additionalStyles 
        ? iconData.additionalStyles.split('\n').map(line => line.trim() ? `            ${line.trim()}` : '').join('\n')
        : '';
    
    return template
        .replace(/\{CATEGORY\}/g, category)
        .replace(/\{ICON_NAME\}/g, iconName)
        .replace(/\{ICON_CONTENT\}/g, iconData.content)
        .replace(/\{ADDITIONAL_STYLES\}/g, additionalStylesFormatted);
}

function createMarkerFiles(icon, category, force) {
    console.log(`Processing: ${icon.name}`);
    
    // Read the original icon
    const svgContent = fs.readFileSync(icon.filePath, 'utf8');
    const iconData = extractIconContent(svgContent);
    
    if (!iconData) {
        console.error(`  ❌ Failed to parse SVG content for ${icon.name}`);
        return;
    }
    
    // Generate marker file paths
    const roundMarkerPath = path.join(icon.directory, `${icon.name}-marker_round.svg`);
    const squareMarkerPath = path.join(icon.directory, `${icon.name}-marker_square.svg`);
    
    // Check if files exist and force flag
    if (!force) {
        if (fs.existsSync(roundMarkerPath)) {
            console.log(`  ⏭️  Round marker already exists: ${path.basename(roundMarkerPath)}`);
        }
        if (fs.existsSync(squareMarkerPath)) {
            console.log(`  ⏭️  Square marker already exists: ${path.basename(squareMarkerPath)}`);
        }
        if (fs.existsSync(roundMarkerPath) && fs.existsSync(squareMarkerPath)) {
            return;
        }
    }
    
    // Generate marker icons
    const roundMarker = generateMarkerIcon(ROUND_MARKER_TEMPLATE, iconData, category, icon.name);
    const squareMarker = generateMarkerIcon(SQUARE_MARKER_TEMPLATE, iconData, category, icon.name);
    
    // Write files
    if (force || !fs.existsSync(roundMarkerPath)) {
        fs.writeFileSync(roundMarkerPath, roundMarker);
        console.log(`  ✅ Created: ${path.basename(roundMarkerPath)}`);
    }
    
    if (force || !fs.existsSync(squareMarkerPath)) {
        fs.writeFileSync(squareMarkerPath, squareMarker);
        console.log(`  ✅ Created: ${path.basename(squareMarkerPath)}`);
    }
}

function main() {
    const options = parseArgs();
    
    if (options.help) {
        showHelp();
        return;
    }
    
    if (!options.category) {
        console.error('Error: Category is required');
        showHelp();
        process.exit(1);
    }
    
    const validCategories = ['activities', 'modes', 'interface'];
    if (!validCategories.includes(options.category)) {
        console.error(`Error: Invalid category '${options.category}'. Valid categories: ${validCategories.join(', ')}`);
        process.exit(1);
    }
    
    const categoryPath = path.join(ICONS_BASE_PATH, options.category);
    
    if (!fs.existsSync(categoryPath)) {
        console.error(`Error: Category path does not exist: ${categoryPath}`);
        process.exit(1);
    }
    
    console.log(`\n🔍 Scanning ${options.category} icons...`);
    const icons = findPlainIcons(categoryPath, options.iconName);
    
    if (icons.length === 0) {
        if (options.iconName) {
            console.log(`❌ No icon found with name '${options.iconName}' in category '${options.category}'`);
        } else {
            console.log(`❌ No plain icons found in category '${options.category}'`);
        }
        return;
    }
    
    console.log(`📦 Found ${icons.length} icon(s) to process\n`);
    
    let processed = 0;
    for (const icon of icons) {
        try {
            createMarkerFiles(icon, options.category, options.force);
            processed++;
        } catch (error) {
            console.error(`❌ Error processing ${icon.name}:`, error.message);
        }
    }
    
    console.log(`\n✨ Processed ${processed}/${icons.length} icons`);
    console.log(`📁 Marker icons created in: ${categoryPath}`);
}

if (require.main === module) {
    main();
}

module.exports = {
    findPlainIcons,
    extractIconContent,
    generateMarkerIcon
};
