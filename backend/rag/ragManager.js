/**
 * RAG Process Manager
 * Spawns and manages the lifecycle of the Python retrieval service (FastAPI on port 5001).
 */

const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

let ragProcess = null;

/**
 * Checks if a specific TCP port is currently open and accepting connections.
 * 
 * @param {number} [port=5001] - Target port to check
 * @param {string} [host="127.0.0.1"] - Target host address
 * @returns {Promise<boolean>} True if the port is in use, false if available
 */
function isPortInUse(port = 5001, host = "127.0.0.1") {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);

        socket.on("connect", () => {
            socket.destroy();
            resolve(true); // Port is in use / connected
        });

        socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
        });

        socket.on("error", () => {
            socket.destroy();
            resolve(false); // Port is free / connection refused
        });

        socket.connect(port, host);
    });
}

/**
 * Performs an HTTP health check on the specified port.
 * 
 * @param {number} [port=5001] - Port to test for HTTP health
 * @returns {Promise<boolean>} True if the HTTP service is responding, false otherwise
 */
async function checkServiceHealth(port = 5001) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`http://localhost:${port}/`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        return res.ok || res.status === 404; // 200 or 404 means the HTTP server is alive
    } catch (e) {
        return false;
    }
}

/**
 * Starts the Python FastAPI retrieval service as a child process if port 5001 is available.
 * 
 * @returns {Promise<import('child_process').ChildProcess|null>} Spawned child process or null if already running
 */
async function startRagService() {
    if (ragProcess) {
        console.log("[RAG] Servis zaten bu process tarafından yönetiliyor.");
        return ragProcess;
    }

    const port = 5001;

    // 1. Port dolu mu kontrol et (TCP socket ile)
    const portBusy = await isPortInUse(port);
    if (portBusy) {
        console.log(`[RAG] Port ${port} zaten kullanımda, muhtemelen önceki bir servis çalışıyor, yeniden başlatma atlanıyor.`);

        // 2. Servis sağlıklı mı kontrol et
        const isHealthy = await checkServiceHealth(port);
        if (isHealthy) {
            console.log(`[RAG] Port ${port} üzerindeki mevcut servis yanıt veriyor (Sağlık kontrolü: OK).`);
        } else {
            console.warn(`[RAG UYARI] Port ${port} meşgul ancak HTTP sağlık kontrolüne yanıt vermedi! Çökmüş/zombi bir process olabilir.`);
        }
        return null;
    }

    const scriptPath = path.join(__dirname, "retrieval.py");
    const pythonExecutable = process.platform === "win32" ? "python" : "python3";

    console.log(`[RAG] Retrieval servisi başlatılıyor (${pythonExecutable} ${scriptPath})...`);

    ragProcess = spawn(pythonExecutable, [scriptPath], {
        cwd: path.join(__dirname, ".."),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
    });

    ragProcess.stdout.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        lines.forEach(line => {
            if (line.trim()) console.log(`[RAG] ${line.trim()}`);
        });
    });

    ragProcess.stderr.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            const lower = trimmed.toLowerCase();
            const isActualError = lower.includes("error") || lower.includes("exception") || lower.includes("traceback") || lower.includes("failed");

            if (isActualError) {
                console.error(`[RAG ERROR] ${trimmed}`);
            } else {
                console.log(`[RAG] ${trimmed}`);
            }
        });
    });

    ragProcess.on("close", (code) => {
        console.log(`[RAG] Retrieval servisi kapandı (Exit code: ${code})`);
        ragProcess = null;
    });

    ragProcess.on("error", (err) => {
        console.error(`[RAG] Process başlatılamadı:`, err.message);
        ragProcess = null;
    });

    return ragProcess;
}

/**
 * Gracefully terminates the running Python retrieval service process.
 * 
 * @returns {void}
 */
function stopRagService() {
    if (ragProcess && !ragProcess.killed) {
        console.log("[RAG] Retrieval servisi durduruluyor...");
        try {
            if (process.platform === "win32" && ragProcess.pid) {
                const { execSync } = require("child_process");
                try {
                    execSync(`taskkill /pid ${ragProcess.pid} /T /F`, { stdio: "ignore" });
                } catch (e) {
                    ragProcess.kill();
                }
            } else {
                ragProcess.kill("SIGTERM");
            }
        } catch (err) {
            console.error("[RAG] Durdurma hatası:", err.message);
        }
        ragProcess = null;
    }
}

// Node process kapanırken RAG'ı da kapat
process.on("exit", () => stopRagService());
process.on("SIGINT", () => {
    stopRagService();
    process.exit(0);
});
process.on("SIGTERM", () => {
    stopRagService();
    process.exit(0);
});

module.exports = {
    startRagService,
    stopRagService,
    isPortInUse,
    checkServiceHealth
};
