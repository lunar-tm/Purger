<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=260&color=0:0d0d0d,25:1a0033,50:330066,75:660099,100:9900cc&text=Lunar%20Purger&fontColor=ffffff&fontSize=48&fontAlignY=40"/>

<br>

<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=24&pause=1000&color=9900cc&center=true&vCenter=true&width=850&lines=Advanced+Discord+Cleanup+Engine;Smart+Rate-Limit+Handling;Auto-Retry+System;Rich+Statistics+Dashboard"/>

<br><br>

<img src="https://img.shields.io/badge/STATUS-ACTIVE-purple?style=for-the-badge&labelColor=0d0d0d">
<img src="https://img.shields.io/badge/VERSION-v0.5-9900cc?style=for-the-badge&labelColor=0d0d0d">
<img src="https://img.shields.io/badge/PRIVATE-PROJECT-purple?style=for-the-badge&labelColor=0d0d0d">
<img src="https://img.shields.io/badge/MAINTAINED-YES-9900cc?style=for-the-badge&labelColor=0d0d0d">

<br><br>

<img src="https://skillicons.dev/icons?i=linux,windows,nodejs,git" height="60">

<br><br>

# 💨 Lunar Purger v0.5

### ⚡ Advanced Discord Cleanup Utility

### 🛡️ Smart Rate-Limit Protection

### 🎮 Rich Dashboard & Statistics

<br>

**Developed By [Lunar Team](https://github.com/lunar-tm) | [Visit Website](https://lunar-team.vercel.app)**

</div>

---

# 🧠 About

> Lunar Purger is a powerful and lightweight Discord account cleanup utility designed for advanced message management, intelligent rate-limit handling, rich statistics, and smooth execution across Termux, Linux, and Windows. Features auto-retry system, selective operations, and streaming RPC status.

---

# ✨ Key Features

<div align="center">

| Feature | Description |
|:--|:--|
| ⚡ **Optimized Engine** | Fast asynchronous cleanup system with auto-retry (3x) |
| 🛡️ **Smart Protection** | Intelligent rate-limit handling with progressive backoff |
| 📊 **Rich Statistics** | Server & DM analytics dashboard |
| 🔄 **Auto-Retry System** | Failed deletions automatically retry (up to 3 times) |
| 🎮 **Streaming RPC** | Purple streaming Discord status with custom buttons |
| 📋 **Operation History** | Track last 5 operations performed |
| 👥 **Selective Friends** | Remove specific friends instead of all at once |
| 🌊 **Deep Cleanup** | Scan and clean DM messages efficiently |
| 🌐 **Server Management** | Leave/purge servers with permission checks |
| 📱 **Mobile Ready** | Fully optimized for Android & Termux |
| 🖥️ **Desktop Support** | Compatible with Linux & Windows |
| 🎯 **Target System** | Cleanup messages from selected IDs |

</div>

---

# 📥 Installation

<div align="center">

## 📱 Termux

</div>

```bash
pkg update -y && pkg upgrade -y && pkg install nodejs git -y
git clone https://github.com/lunar-tm/purge.git
cd purge
npm install discord.js-selfbot-v13 readline-sync
node lunar_purger.js
```

---

<div align="center">

## 🐧 Linux

</div>

```bash
sudo apt update && sudo apt upgrade -y && sudo apt install nodejs npm git -y
git clone https://github.com/lunar-tm/purge.git
cd purge
npm install discord.js-selfbot-v13 readline-sync
node lunar_purger.js
```

---

<div align="center">

## 🪟 Windows (PowerShell)

</div>

```powershell
# Install Node.js using winget or download from nodejs.org
winget install OpenJS.NodeJS

# Clone and setup
git clone https://github.com/lunar-tm/purge.git
cd purge
npm install discord.js-selfbot-v13 readline-sync
node lunar_purger.js
```

---

# 🎮 Menu Options (v0.5)

<div align="center">

| Option | Action | Description |
|:--|:--|:--|
| `[1]` | 👤 Friends | Remove all friends safely |
| `[2]` | 🌐 Servers | Leave all non-owned servers |
| `[3]` | 🌊 Deep Cleanup | Scan and clean all DM messages |
| `[4]` | 🎯 Target Purge | Cleanup messages from selected user/guild |
| `[5]` | 📘 All Servers | Purge messages from all joined servers |
| `[6]` | 🗑️ Clear Skipped | Reset skipped users list |
| `[7]` | 📊 Server Stats | View detailed server statistics & info |
| `[8]` | 💬 DM Stats | View all DM conversations & status |
| `[9]` | 👥 Selective Friends | Remove specific friends (choose which ones) |
| `[10]` | 📋 History | View last 5 operations performed |
| `[0]` | 🚪 Exit | Close the utility safely |

</div>

---

# 🔑 Authentication

<div align="center">

> Enter your Discord token when prompted by the utility.
>
> **Get Your Token:**
> 1. Open Discord and press `Ctrl+Shift+I` (DevTools)
> 2. Go to `Application` tab → `Storage` → `Local Storage` → `https://discord.com`
> 3. Find `token` key and copy the value (without quotes)
> 4. Paste when prompted

</div>

---

# 🎯 Usage Examples

### **[7] Server Statistics**
```
📊 Server Statistics:

1. My Server 1           | 15 channels | 250 members
2. My Server 2           | 8 channels  | 120 members
3. My Server 3           | 25 channels | 500 members

Total: 3 servers | 48 total channels | 870 total members
```

### **[8] DM Statistics**
```
💬 Direct Message Statistics:

Name                 | Type              | Status
─────────────────────────────────────────────────
friend#1234          | User              | Active
bot#5678             | Bot               | Active
friend#9012          | User              | Skipped

Total: 10 DM conversations
```

### **[9] Selective Friend Removal**
```
👥 Your Friends:

[1] friend#1234
[2] friend#5678
[3] friend#9012
[4] friend#3456

[all] Remove all

[?] Enter numbers to remove (comma-separated): 1,3
[!] Remove 2 friend(s)? (y/n): y

[✔] Removed 2 friend(s).
```

### **[10] Operation History**
```
📋 Recent Operations:

1. DM Purge - friend#1234
   Result: Purged 45 messages in 2m 15s
   Time: 14:32:10

2. Friend Removal
   Result: Removed 8 friends
   Time: 14:20:45

3. Server Leaving
   Result: Left 5 servers
   Time: 14:10:30
```

---

# ⚙️ Configuration

The RPC (Rich Presence) is locked by the developer and cannot be modified by users:

```javascript
const RPC_CONFIG = {
    enabled: true,
    name: 'Lunar Purger v0.5',
    state: 'Cleaning up Discord',
    details: 'Purging messages...',
    button1Text: 'GitHub',
    button1URL: 'https://github.com/lunar-tm/purge',
    button2Text: 'Discord',
    button2URL: 'https://discord.com'
};
```

**Purple Streaming Status** with custom buttons displayed on your Discord profile!

---

# 🔧 Advanced Features

### **Auto-Retry System**
- Failed message deletions automatically retry up to 3 times
- Progressive backoff: 100ms → 200ms → 300ms delays
- Shows both successful and failed deletion counts

### **Operation Timers**
- Real-time operation tracking
- Compares actual time with ETA
- Shows: Deleted | Failed | Time taken

### **Smart Rate Limiting**
- Adaptive batch sizes (15 messages per batch)
- Progressive delays on errors
- Respects Discord API rate limits

### **Selective Operations**
- Choose which friends to remove
- Skip specific users
- Reset skipped list anytime

---

# 📊 Performance

- ✅ **Fast**: Processes 100+ messages per minute
- ✅ **Safe**: Multiple permission checks per operation
- ✅ **Reliable**: Auto-retry on failed deletions
- ✅ **Efficient**: Optimized memory usage
- ✅ **Smart**: Respects Discord rate limits

---

# ⚠️ Security Warning

```diff
- Never share your token with anyone
- Anyone with access to your token can access your account
- Keep your credentials private and secure at all times
- This tool uses your token to perform operations
- Use only on accounts you own
```

---

# 📌 Important Notice

```diff
- This project is private and not open-source
- Forking, redistribution, or re-uploading is not allowed
- Unauthorized modifications or public mirrors are prohibited
- Use responsibly and at your own risk
```

---

# 🛡️ Disclaimer

> This project is provided for educational and account management purposes only.

The developer is **NOT** responsible for:

- Misuse of the tool
- Account restrictions or bans
- Data loss or corruption
- Violations of Discord Terms of Service
- Any damages caused by improper usage

**Use responsibly and at your own risk.**

---

# 📝 Version History

| Version | Changes |
|:--|:--|
| **v0.5** | Added statistics, selective operations, history, auto-retry |
| **v0.4** | Immutable RPC config, locked settings |
| **v0.3** | Custom RPC with streaming status |
| **v0.2** | Major bug fixes, error handling |
| **v0.1** | Initial release |

---

# 🔗 Links

<div align="center">

<a href="https://lunar-team.vercel.app">
<img src="https://img.shields.io/badge/Website-0d0d0d?style=for-the-badge&logo=vercel&logoColor=white">
</a>

<a href="https://github.com/lunar-tm/purge">
<img src="https://img.shields.io/badge/GitHub-0d0d0d?style=for-the-badge&logo=github&logoColor=white">
</a>

<a href="https://discord.com">
<img src="https://img.shields.io/badge/Discord-0d0d0d?style=for-the-badge&logo=discord&logoColor=white">
</a>

</div>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:0d0d0d,50:330066,100:9900cc"/>

### 💨 Lunar Purger v0.5 — Advanced Discord Cleanup Utility

**Developed By [Lunar Team](https://github.com/lunar-tm) | [Visit Website](https://lunar-team.vercel.app)**

</div>
