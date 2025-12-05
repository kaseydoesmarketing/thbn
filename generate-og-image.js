const puppeteer = require('puppeteer');
const path = require('path');

async function generateOgImage() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1200, height: 630 });
    
    const htmlPath = path.join(__dirname, 'og-image.html');
    await page.goto('file://' + htmlPath);
    
    await page.screenshot({
        path: path.join(__dirname, 'og-image.png'),
        type: 'png'
    });
    
    await browser.close();
    console.log('OG image generated: og-image.png');
}

generateOgImage().catch(console.error);
