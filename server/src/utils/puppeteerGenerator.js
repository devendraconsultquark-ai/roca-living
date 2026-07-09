import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';

import logger from "./logger.js";

const execPromise = promisify(exec);

/**
 * Checks and installs Puppeteer dependencies on Linux environments automatically
 */
export const ensurePuppeteerDependencies = async () => {
  if (process.platform !== 'linux') {
    return; // Only run on Linux servers
  }
  
  logger.info('[PuppeteerGenerator] Checking if Puppeteer can launch successfully...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    logger.info('[PuppeteerGenerator] Puppeteer check passed: Browser launched successfully.');
  } catch (launchError) {
    logger.error('[PuppeteerGenerator] Puppeteer launch test failed:', launchError.message);
    logger.info('[PuppeteerGenerator] Attempting to install missing Chromium dependencies...');
    
    try {
      logger.info('[PuppeteerGenerator] Running: npx puppeteer browsers install chrome --install-deps');
      const { stdout, stderr } = await execPromise('npx puppeteer browsers install chrome --install-deps');
      logger.info('[PuppeteerGenerator] Installation stdout:', stdout);
      if (stderr) {
        logger.error('[PuppeteerGenerator] Installation stderr:', stderr);
      }
      
      logger.info('[PuppeteerGenerator] Retrying Puppeteer launch after dependency installation...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      logger.info('[PuppeteerGenerator] Puppeteer successfully launched after installation!');
    } catch (installError) {
      logger.error('[PuppeteerGenerator] Failed to install/run Puppeteer dependencies automatically:', installError);
      
      try {
        logger.info('[PuppeteerGenerator] Trying manual apt-get dependency installation fallback...');
        const aptCmd = `apt-get update && apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 libnss3 libnspr4`;
        const { stdout, stderr } = await execPromise(aptCmd);
        logger.info('[PuppeteerGenerator] Apt-get stdout:', stdout);
        if (stderr) logger.error('[PuppeteerGenerator] Apt-get stderr:', stderr);
        
        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        logger.info('[PuppeteerGenerator] Puppeteer successfully launched after fallback apt-get installation!');
      } catch (fallbackError) {
        logger.error('[PuppeteerGenerator] Fallback apt-get installation also failed:', fallbackError);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

let sharedBrowser = null;

const getSharedBrowser = async () => {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch (e) {}
    sharedBrowser = null;
  }
  logger.info('[PuppeteerGenerator] Launching shared headless browser...');
  sharedBrowser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  sharedBrowser.on('disconnected', () => {
    logger.info('[PuppeteerGenerator] Shared browser disconnected.');
    sharedBrowser = null;
  });

  return sharedBrowser;
};

const closeSharedBrowser = async () => {
  if (sharedBrowser) {
    logger.info('[PuppeteerGenerator] Closing shared browser on shutdown...');
    try {
      await sharedBrowser.close();
    } catch (e) {}
    sharedBrowser = null;
  }
};

process.on('SIGINT', async () => {
  await closeSharedBrowser();
});
process.on('SIGTERM', async () => {
  await closeSharedBrowser();
});

/**
 * Compiles a self-contained HTML page into a Portrait PDF buffer using Puppeteer
 * @param {String} htmlContent Complete HTML content string
 * @returns {Promise<Buffer>} Binary PDF buffer
 */
export const generatePortraitPDFWithPuppeteer = async (htmlContent) => {
  let page = null;
  try {
    const browser = await getSharedBrowser();
    logger.info('[PuppeteerGenerator] Creating new page from shared browser...');
    page = await browser.newPage();
    
    logger.info('[PuppeteerGenerator] Setting page HTML content...');
    // 'load' is sufficient for self-contained HTML and avoids the 500ms networkidle0 idle wait.
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });

    logger.info('[PuppeteerGenerator] Printing Portrait PDF...');
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
    logger.error('[PuppeteerGenerator] Portrait compilation failed:', error);
    throw error;
  } finally {
    if (page) {
      logger.info('[PuppeteerGenerator] Closing page...');
      try {
        await page.close();
      } catch (err) {
        logger.error('[PuppeteerGenerator] Error closing page:', err.message);
      }
    }
  }
};
