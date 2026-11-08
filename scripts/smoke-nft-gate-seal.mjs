/**
 * Solo smoke: Seal crypto + broker (in-process). No live HTTP required.
 * Run: node --experimental-strip-types scripts/smoke-nft-gate-seal.mjs
 * or:  npx tsx scripts/smoke-nft-gate-seal.mjs
 */
import { deriveNftSealWrapKeyRaw } from "../src/shared/nft-gate-seal-crypto.ts";
import {
  issueNftSealWrapKey,
  issueNftSealUnwrapKey,
  isNftGateSealBrokerReady,
  loadOrCreateNftGateSealMaster,
} from "../src/nft-gate-seal-broker.ts";

function ok(label, pass, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  return pass;
}

let fails = 0;
const master = loadOrCreateNftGateSealMaster();
fails += ok("broker-ready", isNftGateSealBrokerReady()) ? 0 : 1;
fails += ok(
  "master-loaded",
  master instanceof Uint8Array && master.length === 32,
  `len=${master?.length}`
) ? 0 : 1;

const oid = "0x" + "11".repeat(32);
const wallet = "0x" + "aa".repeat(32);
const a = await deriveNftSealWrapKeyRaw(master, oid);
const b = await deriveNftSealWrapKeyRaw(master, oid);
const c = await deriveNftSealWrapKeyRaw(master, oid, wallet);
fails += ok("derive-32-bytes", a.length === 32) ? 0 : 1;
fails += ok("derive-deterministic", Buffer.from(a).equals(Buffer.from(b))) ? 0 : 1;
fails += ok("derive-wallet-diverges", !Buffer.from(a).equals(Buffer.from(c))) ? 0 : 1;

const wrap = await issueNftSealWrapKey({ nftObjectId: oid });
fails += ok("broker-wrap", wrap.ok === true, wrap.ok ? `b64len=${wrap.wrapKeyB64?.length}` : wrap.error) ? 0 : 1;

const unwrap = await issueNftSealUnwrapKey({ nftObjectId: oid, requesterAddress: wallet });
const denyExpected =
  !unwrap.ok && /AddressOwner|Besitz|Owner|object|nicht|denied|fail|RPC|404|404|found/i.test(unwrap.error || "");
fails += ok("broker-unwrap-deny-fake-nft", denyExpected, unwrap.error || "unexpected ok") ? 0 : 1;

const wrapBad = await issueNftSealWrapKey({ nftObjectId: "not-an-id" });
fails += ok("broker-wrap-rejects-bad-id", wrapBad.ok === false, wrapBad.error) ? 0 : 1;

console.log(fails === 0 ? "\nSOLO SEAL SMOKE: ALL PASS" : `\nSOLO SEAL SMOKE: ${fails} FAIL(S)`);
process.exit(fails === 0 ? 0 : 1);
