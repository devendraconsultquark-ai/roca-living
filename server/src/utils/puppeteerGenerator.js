import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Checks and installs Puppeteer dependencies on Linux environments automatically
 */
export const ensurePuppeteerDependencies = async () => {
  if (process.platform !== 'linux') {
    return; // Only run on Linux servers
  }
  
  console.log('[PuppeteerGenerator] Checking if Puppeteer can launch successfully...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('[PuppeteerGenerator] Puppeteer check passed: Browser launched successfully.');
  } catch (launchError) {
    console.error('[PuppeteerGenerator] Puppeteer launch test failed:', launchError.message);
    console.log('[PuppeteerGenerator] Attempting to install missing Chromium dependencies...');
    
    try {
      console.log('[PuppeteerGenerator] Running: npx puppeteer browsers install chrome --install-deps');
      const { stdout, stderr } = await execPromise('npx puppeteer browsers install chrome --install-deps');
      console.log('[PuppeteerGenerator] Installation stdout:', stdout);
      if (stderr) {
        console.error('[PuppeteerGenerator] Installation stderr:', stderr);
      }
      
      console.log('[PuppeteerGenerator] Retrying Puppeteer launch after dependency installation...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[PuppeteerGenerator] Puppeteer successfully launched after installation!');
    } catch (installError) {
      console.error('[PuppeteerGenerator] Failed to install/run Puppeteer dependencies automatically:', installError);
      
      try {
        console.log('[PuppeteerGenerator] Trying manual apt-get dependency installation fallback...');
        const aptCmd = `apt-get update && apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 libnss3 libnspr4`;
        const { stdout, stderr } = await execPromise(aptCmd);
        console.log('[PuppeteerGenerator] Apt-get stdout:', stdout);
        if (stderr) console.error('[PuppeteerGenerator] Apt-get stderr:', stderr);
        
        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('[PuppeteerGenerator] Puppeteer successfully launched after fallback apt-get installation!');
      } catch (fallbackError) {
        console.error('[PuppeteerGenerator] Fallback apt-get installation also failed:', fallbackError);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Compiles a self-contained HTML page into a Portrait PDF buffer using Puppeteer
 * @param {String} htmlContent Complete HTML content string
 * @returns {Promise<Buffer>} Binary PDF buffer
 */
export const generatePortraitPDFWithPuppeteer = async (htmlContent) => {
  let browser;
  try {
    console.log('[PuppeteerGenerator] Launching headless browser...');
    browser = await puppeteer.launch({
      headless: 'new', // compatible with puppeteer v20+ 
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    console.log('[PuppeteerGenerator] Setting page HTML content...');
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    console.log('[PuppeteerGenerator] Printing Portrait PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('[PuppeteerGenerator] Portrait compilation failed:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('[PuppeteerGenerator] Closing browser...');
      await browser.close();
    }
  }
};
