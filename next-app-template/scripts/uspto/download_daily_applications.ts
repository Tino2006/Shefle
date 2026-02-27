import fs from "fs";
import path from "path";
import https from "https";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PORTAL_BASE = "https://data.uspto.gov/ui/datasets/products/files/TRTDXFAP/";
const API_BASE = "https://data.uspto.gov/bulkdata/datasets/trtdxfap";

function getFileNameForDate(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `apc${yy}${mm}${dd}.zip`;
}

function getTodayFileName(): string {
  return getFileNameForDate(new Date());
}

function getYesterdayFileName(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getFileNameForDate(yesterday);
}

async function getSignedUrl(fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiUrl = `${API_BASE}/${fileName}`;

    const options = {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    };

    https
      .request(apiUrl, options, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const location = response.headers.location;
          if (location) {
            console.log(`Found redirect URL`);
            resolve(location);
          } else {
            reject(new Error("Redirect without location header"));
          }
        } else if (response.statusCode === 200) {
          resolve(apiUrl);
        } else {
          reject(
            new Error(
              `Failed to get download URL. Status: ${response.statusCode}`
            )
          );
        }
      })
      .on("error", (err) => {
        reject(err);
      })
      .end();
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const curlCommand = `curl -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" --compressed -o "${dest}" "${url}"`;
  
  try {
    await execAsync(curlCommand);
    
    const stats = fs.statSync(dest);
    if (stats.size < 100000) {
      const content = fs.readFileSync(dest, 'utf8');
      if (content.includes('<!doctype') || content.includes('<html')) {
        throw new Error('Downloaded HTML instead of ZIP file - file may not be available yet');
      }
    }
  } catch (err) {
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    throw err;
  }
}

async function runImporter(zipPath: string) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", [
      "tsx",
      "scripts/uspto/import_daily_applications.ts",
      `--zip=${zipPath}`,
    ], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`Importer exited with code ${code}`));
    });
  });
}

async function downloadWithFallback(): Promise<{ fileName: string; filePath: string }> {
  const downloadsDir = path.resolve("./downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  const filesToTry = [getTodayFileName(), getYesterdayFileName()];

  for (const fileName of filesToTry) {
    const filePath = path.join(downloadsDir, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`✓ File already exists: ${fileName}`);
      return { fileName, filePath };
    }

    try {
      console.log(`Attempting to download: ${fileName}`);
      const signedUrl = await getSignedUrl(fileName);
      await downloadFile(signedUrl, filePath);
      console.log(`✓ Download complete: ${fileName}`);
      return { fileName, filePath };
    } catch (err: any) {
      console.log(`✗ Failed to download ${fileName}: ${err.message}`);
      if (fileName === filesToTry[filesToTry.length - 1]) {
        throw new Error(`All download attempts failed. Last error: ${err.message}`);
      }
      console.log("Trying previous day...");
    }
  }

  throw new Error("No files available to download");
}

async function main() {
  console.log("🔍 USPTO Daily Applications Downloader\n");

  const { fileName, filePath } = await downloadWithFallback();

  console.log("\n📊 Running importer...");
  await runImporter(filePath);
  console.log("\n✅ Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
