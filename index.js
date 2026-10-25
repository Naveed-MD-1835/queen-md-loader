const YAHAN_APNA_TOKEN_PASTE_KARO = "YAHAN_APNA_TOKEN_PASTE_KARO";
const REPO_OWNER = "Naveed-MD-1835";
const REPO_NAME = "Queen-Md";
const BRANCH = "main";
const GITHUB_TOKEN = YAHAN_APNA_TOKEN_PASTE_KARO;

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const axios = require("axios");

const zipPath = path.join(__dirname, "repo.zip");
const extractPath = path.join(__dirname, "repo_extracted");

async function downloadRepo() {
    const downloadUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/zipball/${BRANCH}`;
    const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json"
        }
    });
    fs.writeFileSync(zipPath, response.data);
}

function extractZipWithAdmZip() {
    fs.rmSync(extractPath, { recursive: true, force: true });
    fs.mkdirSync(extractPath, { recursive: true });
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(zipPath);
}

function findRootIndexJs() {
    const entries = fs.readdirSync(extractPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length !== 1) return null;
    const root = path.join(extractPath, dirs[0].name);
    const indexPath = path.join(root, "index.js");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) return indexPath;
    return null;
}

function findAlternativeIndexJs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (["data", "Data", "DATA"].includes(entry.name)) continue;
            const found = findAlternativeIndexJs(path.join(dir, entry.name));
            if (found) return found;
        } else if (entry.name === "index.js") {
            return path.join(dir, entry.name);
        }
    }
    return null;
}

function runIndexJs(indexPath) {
    const child = exec(`node "${indexPath}"`, { cwd: path.dirname(indexPath) });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on("exit", (code) => {
        console.log(`Bot exited with code ${code}`);
    });
}

async function main() {
    try {
        await downloadRepo();
        extractZipWithAdmZip();
        let indexPath = findRootIndexJs();
        if (indexPath) {
            runIndexJs(indexPath);
            return;
        }
        const alternative = findAlternativeIndexJs(extractPath);
        if (alternative) {
            console.log("we need root index.js, not from data/ folder!");
            return;
        }
        console.log("index.js not found in repo root");
    } catch (e) {
        console.error(e);
    }
}

main();
