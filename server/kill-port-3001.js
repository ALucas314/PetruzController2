/**
 * Libera a porta 3001 no Windows (mata o processo que está escutando nela).
 * Uso: node kill-port-3001.js
 * Quando o servidor falhar com EADDRINUSE :3001, rode: npm run kill-port
 */
import { execSync } from "child_process";

try {
  const out = execSync("netstat -ano", { encoding: "utf8" });
  const lines = out.split(/\r?\n/);
  const pids = new Set();
  for (const line of lines) {
    // LISTENING em :3001 (IPv4 ou IPv6)
    if ((line.includes(":3001") || line.includes("[::]:3001")) && line.includes("LISTENING")) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0" && /^\d+$/.test(pid)) pids.add(pid);
    }
  }
  if (pids.size === 0) {
    console.log("Nenhum processo usando a porta 3001.");
    process.exit(0);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "inherit" });
      console.log("Porta 3001 liberada (PID " + pid + " encerrado).");
    } catch (e) {
      console.warn("Não foi possível encerrar PID " + pid + ":", e.message);
    }
  }
} catch (e) {
  console.error("Erro ao verificar a porta:", e.message);
  process.exit(1);
}
