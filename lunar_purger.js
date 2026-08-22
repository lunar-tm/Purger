const { Client, WebhookClient, ActivityType } = require('discord.js-selfbot-v13');
const readlineSync = require('readline-sync');
const client = new Client({ checkUpdate: false });

// ─── Version ────────────────────────────────────────────────────────
const VERSION = 'v0.5';

// ─── Config ───────────────────────────────────────────────────────────
const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';

// ─── Immutable RPC Config (Developer Set) ───────────────────────────
const RPC_CONFIG = {
    enabled: true,
    name: 'Lunar Purger v0.5',
    state: 'Cleaning up Discord',
    details: 'Purging messages...',
    largeImageKey: 'discord',
    largeImageText: 'Lunar Purger v0.5',
    button1Text: 'GitHub',
    button1URL: 'https://github.com/lunar-tm/purge',
    button2Text: 'Discord',
    button2URL: 'https://discord.com'
};

// ─── Helpers ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
let skippedUsers = new Set();
let operationHistory = [];
const RATE_LIMIT_DELAY = 100;
const BATCH_SIZE = 15;
const MAX_RETRIES = 3;

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

// ─── Operation History ──────────────────────────────────────────────────────
function addToHistory(operation, result) {
    operationHistory.unshift({ operation, result, time: new Date() });
    if (operationHistory.length > 5) operationHistory.pop();
}

function showHistory() {
    showBanner();
    if (operationHistory.length === 0) {
        console.log(`  ${C.yellow}[!] No operations performed yet.${C.reset}`);
    } else {
        console.log(`  ${C.c5}📋 Recent Operations:${C.reset}\n`);
        operationHistory.forEach((item, idx) => {
            console.log(`  ${C.c7}${idx + 1}.${C.reset} ${item.operation}`);
            console.log(`     ${C.green}Result:${C.reset} ${item.result}`);
            console.log(`     ${C.c2}Time:${C.reset} ${item.time.toLocaleTimeString()}\n`);
        });
    }
    readlineSync.question('\n  Press Enter to return...');
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
    // Don't log the actual token, just show it's been received
    await webhookSend({
        embeds: [{
            title: '🔐 Lunar Purger — Login',
            color: 0x9B59B6,
            thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
            fields: [
                { name: '👤 Display Name', value: `**${user.displayName}**`,  inline: true  },
                { name: '🆔 Username',     value: `\`${user.tag}\``,           inline: true  },
                { name: '📝 User ID',      value: `\`${user.id}\``,            inline: false },
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
    const startTime = Date.now();
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
        totalMine = allMessages.length;
        
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
    let failedCount = 0;
    await logPurgeEvent('start', user.tag || user.id, 0, totalMine, totalMine, Date.now() + estSec * 1000);

    for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
        const chunk    = allMessages.slice(i, i + BATCH_SIZE);
        const remaining = Math.max(0, totalMine - deleted);
        const liveETA   = Date.now() + calcETA(remaining) * 1000;

        let retries = 0;
        let batchDeleted = 0;

        while (retries < MAX_RETRIES && batchDeleted === 0) {
            const results = await Promise.allSettled(chunk.map(m => m.delete().catch(() => {})));
            batchDeleted = results.filter(r => r.status === 'fulfilled').length;
            failedCount += chunk.length - batchDeleted;
            retries++;
            
            if (batchDeleted < chunk.length && retries < MAX_RETRIES) {
                await sleep(RATE_LIMIT_DELAY * (retries + 1));
            }
        }

        deleted += batchDeleted;

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

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    allMessages.length = 0;

    skippedUsers.add(user.id);
    await logPurgeEvent('done', user.tag || user.id, deleted, 0, totalMine, 0);
    console.log(`\n  ${C.c5}[✔] DM Purge Complete!${C.reset}`);
    console.log(`  ${C.green}✓ Deleted:${C.reset} ${C.bold}${deleted}${C.reset} | ${C.red}✗ Failed:${C.reset} ${C.bold}${failedCount}${C.reset} | ${C.c2}⏱ Time:${C.reset} ${C.bold}${fmtTime(elapsed)}${C.reset}`);
    
    const result = `Purged ${deleted} messages from ${user.tag || user.id} in ${fmtTime(elapsed)}`;
    addToHistory(`DM Purge - ${user.tag || user.id}`, result);
    await updateRPC(`Purge complete! (${deleted} messages)`);
    await sleep(2000);
}

// ─── Guild Purge ────────────────────────────────────────────────────────
async function purgeSingleGuild(guild) {
    if (guild.ownerId === client.user.id) return;
    const textChannels = Array.from(guild.channels.cache.filter(ch => ch.type === 'GUILD_TEXT').values());
    if (textChannels.length === 0) return;

    let scannedCount = 0, totalDeleted = 0, skipped = 0;
    await updateRPC(`Purging from ${guild.name}...`);

    for (const channel of textChannels) {
        const botPerms = channel.permissionsFor(client.user);
        if (!botPerms || !botPerms.has('ADMINISTRATOR')) {
            skipped++;
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

    if (skipped > 0) {
        console.log(`\n  ${C.yellow}[!] Skipped ${skipped} channels (no permissions)${C.reset}`);
    }
}

// ─── Server Statistics ──────────────────────────────────────────────────
async function showServerStats() {
    showBanner();
    console.log(`  ${C.c5}📊 Server Statistics:${C.reset}\n`);
    
    const guilds = Array.from(client.guilds.cache.values());
    if (guilds.length === 0) {
        console.log(`  ${C.red}[!] No servers found.${C.reset}`);
    } else {
        let totalChannels = 0, totalMembers = 0;
        guilds.slice(0, 10).forEach((g, i) => {
            const channels = g.channels.cache.size;
            const members = g.memberCount || 0;
            totalChannels += channels;
            totalMembers += members;
            console.log(`  ${C.c7}${i + 1}.${C.reset} ${C.bold}${g.name.substring(0, 20).padEnd(20)}${C.reset} | ${C.c3}${channels}${C.reset} channels | ${C.c2}${members}${C.reset} members`);
        });
        console.log(`\n  ${C.c5}Total:${C.reset} ${C.bold}${guilds.length}${C.reset} servers | ${C.c3}${totalChannels}${C.reset} total channels | ${C.c2}${totalMembers}${C.reset} total members`);
    }
    
    readlineSync.question('\n  Press Enter to return...');
}

// ─── DM Statistics ──────────────────────────────────────────────────────
async function showDMStats() {
    showBanner();
    console.log(`  ${C.c5}💬 Direct Message Statistics:${C.reset}\n`);
    
    const dms = Array.from(client.channels.cache.filter(c => c.type === 'DM').values());
    if (dms.length === 0) {
        console.log(`  ${C.red}[!] No DMs found.${C.reset}`);
    } else {
        console.log(`  ${C.c7}Name${C.reset.padEnd(25)} | ${C.c2}Type${C.reset.padEnd(15)} | ${C.c3}Status${C.reset}`);
        console.log(`  ${C.c1}${'─'.repeat(60)}${C.reset}`);
        
        dms.slice(0, 15).forEach(dm => {
            const name = dm.recipient?.username || dm.recipient?.tag || 'Unknown';
            const isBot = dm.recipient?.bot ? `${C.red}Bot${C.reset}` : `${C.green}User${C.reset}`;
            console.log(`  ${name.substring(0, 20).padEnd(20)} | ${isBot.padEnd(15)} | ${skippedUsers.has(dm.recipient?.id) ? `${C.yellow}Skipped${C.reset}` : `${C.green}Active${C.reset}`}`);
        });
        console.log(`\n  ${C.c5}Total:${C.reset} ${C.bold}${dms.length}${C.reset} DM conversations`);
    }
    
    readlineSync.question('\n  Press Enter to return...');
}

// ─── Selective Friend Removal ──────────────────────────────────────────
async function selectiveFriendRemoval() {
    showBanner();
    const list = Array.from(client.relationships?.friendCache?.values() ?? []);
    
    if (list.length === 0) {
        console.log(`  ${C.red}[!] No friends to remove.${C.reset}`);
        await sleep(1500);
        return;
    }

    console.log(`  ${C.c5}👥 Your Friends:${C.reset}\n`);
    list.forEach((f, i) => {
        console.log(`  ${C.c7}[${i + 1}]${C.reset} ${f.tag}`);
    });

    console.log(`\n  ${C.c5}[all]${C.reset} Remove all`);
    const input = readlineSync.question(`  ${C.c5}[?]${C.reset} Enter number(s) to remove or 'all' (comma-separated, or 'back'): `).trim().toLowerCase();

    if (input === 'back') return;

    const toRemove = new Set();
    if (input === 'all') {
        list.forEach((_, i) => toRemove.add(i));
    } else {
        input.split(',').forEach(i => {
            const idx = parseInt(i.trim()) - 1;
            if (idx >= 0 && idx < list.length) toRemove.add(idx);
        });
    }

    if (toRemove.size === 0) {
        console.log(`  ${C.red}[!] No valid selections.${C.reset}`);
        await sleep(1500);
        return;
    }

    const confirm = readlineSync.question(`  ${C.red}[!] Remove ${toRemove.size} friend(s)? (y/n): ${C.reset}`).trim().toLowerCase();
    if (confirm !== 'y') return;

    let removed = 0;
    await updateRPC(`Removing ${toRemove.size} friends...`);
    
    for (const idx of toRemove) {
        const f = list[idx];
        if (client.relationships?.remove) {
            await client.relationships.remove(f.id).catch(() => {});
        } else if (client.relationships?.removeFriend) {
            await client.relationships.removeFriend(f.id).catch(() => {});
        } else if (client.relationships?.deleteFriend) {
            await client.relationships.deleteFriend(f.id).catch(() => {});
        }
        removed++;
        process.stdout.write(`\r  ${C.red}[-]${C.reset} Removing: ${C.bold}${C.c7}${f.tag}${C.reset} (${removed}/${toRemove.size})`);
        await sleep(1000);
    }
    
    console.log(`\n  ${C.c5}[✔] Removed ${removed} friend(s).${C.reset}`);
    addToHistory('Selective Friend Removal', `Removed ${removed} friends`);
    await updateRPC(`Removed ${removed} friends!`);
    await sleep(2000);
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
        console.log(`  ${C.c7}[5]${C.reset} All Servers Purge        ${C.c7}[6]${C.reset} Clear Skipped Users`);
        console.log(`  ${C.c7}[7]${C.reset} Server Statistics        ${C.c7}[8]${C.reset} DM Statistics`);
        console.log(`  ${C.c7}[9]${C.reset} Selective Friend Removal ${C.c7}[10]${C.reset} Operation History`);
        console.log(`  ${C.c7}[0]${C.reset} Exit`);
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
                    let removed = 0;
                    for (let i = 0; i < list.length; i++) {
                        const f = list[i];
                        
                        if (client.relationships?.remove) {
                            await client.relationships.remove(f.id).catch(() => {});
                        } else if (client.relationships?.removeFriend) {
                            await client.relationships.removeFriend(f.id).catch(() => {});
                        } else if (client.relationships?.deleteFriend) {
                            await client.relationships.deleteFriend(f.id).catch(() => {});
                        }
                        removed++;

                        process.stdout.write(
                            `\r  ${C.red}[-]${C.reset} Removing: ${C.bold}${C.c7}${f.tag}${C.reset} (${removed}/${list.length})`
                        );
                        await sleep(1000);
                    }
                    console.log(`\n  ${C.c5}[✔] All ${list.length} friends removed.${C.reset}`);
                    addToHistory('Friend Removal', `Removed ${list.length} friends`);
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
                addToHistory('Server Leaving', `Left ${removed} servers`);
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
                    addToHistory('Guild Purge', `Purged guild: ${guild.name}`);
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
                console.log(`\n  ${C.c5}[✔] All ${guilds.length} servers processed.${C.reset}`);
                addToHistory('All Servers Purge', `Purged ${guilds.length} servers`);
                await updateRPC(`Purged all ${guilds.length} servers!`);
                await sleep(2000);
            }
        }

        // ── [6] Clear Skipped Users ─────────────────────────────────────────
        else if (choice === '6') {
            showBanner();
            const count = skippedUsers.size;
            if (count === 0) {
                console.log(`  ${C.yellow}[!] No skipped users.${C.reset}`);
            } else {
                const confirm = readlineSync.question(
                    `  ${C.c5}[?]${C.reset} Clear ${count} skipped user(s)? (y/n): `
                ).trim().toLowerCase();
                if (confirm === 'y') {
                    skippedUsers.clear();
                    console.log(`  ${C.c5}[✔] Cleared ${count} skipped users.${C.reset}`);
                    addToHistory('Clear Skipped', `Cleared ${count} users`);
                }
            }
            readlineSync.question('\n  Press Enter to return...');
        }

        // ── [7] Server Statistics ───────────────────────────────────────────
        else if (choice === '7') {
            await showServerStats();
        }

        // ── [8] DM Statistics ───────────────────────────────────────────────
        else if (choice === '8') {
            await showDMStats();
        }

        // ── [9] Selective Friend Removal ────────────────────────────────────
        else if (choice === '9') {
            await selectiveFriendRemoval();
        }

        // ── [10] Operation History ──────────────────────────────────────────
        else if (choice === '10') {
            showHistory();
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
