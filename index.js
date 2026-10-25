const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const axios = require('axios');

// ================= CONFIG =================
// >>> YAHAN APNA GITHUB TOKEN LAGAO <<<
// Neeche wali line me 'your_github_token_here' ki jagah apna GitHub token likh do,
// phir is file ko lock (obfuscate) karke public loader repo me daal do.
const GITHUB_TOKEN = 'your_github_token_here';
const REPO_OWNER = 'naveedahmed35581-arch';
const REPO_NAME = 'Queen-Md';
const BRANCH = 'main';
// ===========================================

const TOKEN_PLACEHOLDER = 'your_github_token_here';
const zipPath = path.join(__dirname, 'repo.zip');
const extractPath = path.join(__dirname, 'repo_extracted');

let botChild = null;
let restartDelay = 5000;

const status = {
  bot: 'stopped',
  pid: null,
  restarts: 0,
  lastDownload: null,
  lastError: null,
  startedAt: new Date().toISOString(),
  repo: `${REPO_OWNER}/${REPO_NAME}@${BRANCH}`
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Config resolution (env = fallback / override) ----------
function resolveToken() {
  if (GITHUB_TOKEN && GITHUB_TOKEN !== TOKEN_PLACEHOLDER) return { token: GITHUB_TOKEN, fromEnv: false };
  if (process.env.GITHUB_TOKEN) {
    console.log('ℹ️ Token file me nahi mila — environment variable GITHUB_TOKEN se liya ja raha hai.');
    return { token: process.env.GITHUB_TOKEN, fromEnv: true };
  }
  return { token: '', fromEnv: false };
}

function resolveRepo() {
  let owner = REPO_OWNER;
  let name = REPO_NAME;
  let branch = BRANCH;
  if (process.env.QUEEN_MAIN_REPO) {
    const raw = String(process.env.QUEEN_MAIN_REPO).trim().replace(/\/$/, '');
    const atParts = raw.split('@');
    const slashParts = atParts[0].split('/');
    if (slashParts.length >= 2) {
      owner = slashParts[0];
      name = slashParts[1];
      console.log(`ℹ️ Repo environment se liya ja raha hai: ${owner}/${name}`);
    }
    if (atParts[1]) {
      branch = atParts[1];
      console.log(`ℹ️ Branch environment se li ja rahi hai: ${branch}`);
    }
  }
  if (process.env.QUEEN_MAIN_BRANCH) {
    branch = String(process.env.QUEEN_MAIN_BRANCH).trim();
  }
  return { owner, name, branch };
}

// ---------- Status server (Heroku web dyno ke liye) ----------
function startStatusServer() {
  let express;
  try {
    express = require('express');
  } catch {
    console.log('⚠️ express nahi mila — status page band rahega. Pehle `npm install` chalao.');
    return;
  }
  const app = express();
  app.get('/', (req, res) => {
    const dot = status.bot === 'running' ? '🟢' : '🔴';
    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="15">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Queen MD Loader</title>
<style>body{font-family:system-ui,sans-serif;background:#1c0a2e;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:28px;max-width:420px;width:90%}
h1{font-size:22px;margin:0 0 6px}.gold{color:#ffd166}
.row{margin:10px 0;font-size:15px}.small{opacity:.7;font-size:12px;margin-top:16px}</style>
</head><body><div class="card">
<h1>👑 Queen MD Loader <span class="gold">is running</span></h1>
<div class="row">${dot} <b>Bot:</b> ${status.bot}${status.pid ? ' (PID ' + status.pid + ')' : ''}</div>
<div class="row">📦 <b>Repo:</b> ${status.repo}</div>
<div class="row">🔄 <b>Restarts:</b> ${status.restarts}</div>
<div class="row">📥 <b>Last download:</b> ${status.lastDownload || 'abhi tak nahi'}</div>
<div class="row">❗ <b>Last error:</b> ${status.lastError || 'koi nahi'}</div>
<div class="small">Status har 15 second me refresh hota hai. JSON ke liye <a style="color:#ffd166" href="/status">/status</a> kholo.</div>
</div></body></html>`);
  });
  app.get('/status', (req, res) => {
    res.json({ status: true, loader: 'queen-md-loader', ...status });
  });
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`🌐 Loader status page: http://localhost:${port}/`);
  });
  server.on('error', (e) => {
    console.log(`⚠️ Status server port ${port} par nahi khula: ${e.message} (loader phir bhi chalega)`);
  });
}

// ---------- Download / extract / find ----------
function cleanupOld() {
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch {}
  try {
    if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
  } catch {}
}

async function downloadRepo(url, token) {
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    timeout: 120000,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Queen-MD-Loader'
    }
  });

  const writer = fs.createWriteStream(zipPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function downloadWithRetry(url, token, attempts) {
  let delay = 3000;
  for (let i = 1; i <= attempts; i++) {
    try {
      console.log(`📥 Download koshish ${i}/${attempts}...`);
      await downloadRepo(url, token);
      console.log('✅ Download mukammal!');
      return true;
    } catch (e) {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch {}
      const code = e.response ? e.response.status : null;
      console.error(`❌ Download fail (koshish ${i}): ${code ? 'HTTP ' + code + ' ' : ''}${e.message}`);
      if (code === 401 || code === 403) {
        console.error('❌ Token ghalat hai ya is ko repo parhne ki permission nahi hai — read-only token dobara check karo.');
        break;
      }
      if (code === 404) {
        console.error('❌ Repo ya branch nahi mili — REPO_OWNER, REPO_NAME aur BRANCH dobara check karo.');
        break;
      }
      if (i < attempts) {
        console.log(`⏳ ${delay / 1000} second baad dobara koshish...`);
        await sleep(delay);
        delay *= 2;
      }
    }
  }
  return false;
}

async function extractZip() {
  if (fs.existsSync(extractPath)) {
    fs.rmSync(extractPath, { recursive: true, force: true });
  }
  fs.mkdirSync(extractPath, { recursive: true });

  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractPath }))
    .promise();

  fs.unlinkSync(zipPath);
}

function findIndexJs(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return null;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const result = findIndexJs(fullPath);
      if (result) return result;
    } else if (file === 'index.js') {
      return fullPath;
    }
  }
  return null;
}

function installDeps(botDir) {
  try {
    execSync('npm install --omit=dev', { cwd: botDir, stdio: 'inherit' });
    console.log('✅ Packages install ho gaye.');
  } catch (e) {
    console.log('⚠️ npm install me masla aaya, phir bhi bot start kar raha hu...');
  }
}

function runIndexJs(filePath, botDir) {
  status.bot = 'running';
  const child = spawn('node', [filePath], {
    cwd: botDir,
    env: process.env,
    stdio: 'inherit'
  });
  botChild = child;
  status.pid = child.pid;
  console.log(`▶️ Bot chal raha hai (PID ${child.pid})`);

  const settleTimer = setTimeout(() => {
    if (status.bot === 'running' && botChild === child) restartDelay = 5000;
  }, 60000);
  settleTimer.unref?.();

  child.on('exit', (code, signal) => {
    clearTimeout(settleTimer);
    if (botChild === child) botChild = null;
    status.bot = 'stopped';
    status.pid = null;
    status.restarts += 1;
    const wait = restartDelay;
    restartDelay = Math.min(restartDelay * 2, 60000);
    console.log(`⚠️ Bot band ho gaya (code ${code}${signal ? ', signal ' + signal : ''}). ${wait / 1000} second me dobara start... (restart #${status.restarts})`);
    setTimeout(() => runIndexJs(filePath, botDir), wait);
  });

  child.on('error', (err) => {
    clearTimeout(settleTimer);
    if (botChild === child) botChild = null;
    status.bot = 'stopped';
    status.pid = null;
    status.lastError = err.message;
    console.error(`❌ Bot start nahi ho saka: ${err.message}`);
    const wait = restartDelay;
    restartDelay = Math.min(restartDelay * 2, 60000);
    setTimeout(() => runIndexJs(filePath, botDir), wait);
  });
}

function shutdown(signal) {
  console.log(`🛑 ${signal} mila — bot band kar raha hu...`);
  try {
    if (botChild && !botChild.killed) botChild.kill('SIGTERM');
  } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------- Main ----------
async function main() {
  startStatusServer();

  const { token } = resolveToken();
  const { owner, name, branch } = resolveRepo();
  status.repo = `${owner}/${name}@${branch}`;

  if (!token) {
    console.error('❌ GITHUB_TOKEN nahi mila!');
    console.error('   → index.js ke upar CONFIG me GITHUB_TOKEN wali line par apna token lagao,');
    console.error('   → ya phir environment variable GITHUB_TOKEN set karo.');
    console.error('   → Status page phir bhi chal raha hai, lekin bot download nahi hoga.');
    status.lastError = 'GITHUB_TOKEN missing';
    return;
  }

  if (!owner || !name || !branch) {
    console.error('❌ REPO_OWNER, REPO_NAME ya BRANCH khaali hai — CONFIG dobara check karo.');
    status.lastError = 'repo config missing';
    return;
  }

  const downloadUrl = `https://api.github.com/repos/${owner}/${name}/zipball/${branch}`;
  console.log(`📥 Repository download kar raha hu: ${owner}/${name} (${branch})...`);

  cleanupOld();
  const ok = await downloadWithRetry(downloadUrl, token, 3);
  if (!ok) {
    console.error('❌ Download 3 koshishon ke baad bhi nahi ho saka. Token/repo check karke dobara chalao.');
    status.lastError = 'download failed after 3 attempts';
    return;
  }
  status.lastDownload = new Date().toISOString();

  console.log('📦 Zip extract kar raha hu...');
  try {
    await extractZip();
  } catch (e) {
    console.error(`❌ Extract fail: ${e.message}`);
    status.lastError = 'extract failed: ' + e.message;
    return;
  }

  console.log('🔍 index.js dhoond raha hu...');
  const indexPath = findIndexJs(extractPath);

  if (indexPath) {
    const botDir = path.dirname(indexPath);
    console.log('📦 Bot ke packages install kar raha hu...');
    installDeps(botDir);
    console.log(`▶️ index.js run kar raha hu: ${indexPath}`);
    runIndexJs(indexPath, botDir);
  } else {
    console.log('❌ index.js nahi mila! Repo me bot ki index.js maujood honi chahiye.');
    status.lastError = 'index.js not found in repo';
  }
}

main();
