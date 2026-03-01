# Firebase Cloud Sync Setup Guide

This guide will help you set up Firebase Realtime Database so your finance tracker syncs across all your devices.

## 📱 What You'll Get

- **Phone changes** → Instantly syncs to web and other devices
- **Web changes** → Instantly syncs to phone and other devices
- **Offline support** → Changes saved locally, sync when back online
- **Real-time** → See changes from other devices within seconds

---

## 🚀 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `bryan-finance-tracker`
4. Click **Continue**
5. Disable Google Analytics (not needed) or enable if you want
6. Click **Create project**
7. Wait for project to be created
8. Click **Continue** when done

---

## 🔧 Step 2: Set Up Realtime Database

1. In Firebase Console, click **"Realtime Database"** in left sidebar
2. Click **"Create Database"**
3. Select location: Choose closest to you (e.g., `us-central1` for US, `asia-southeast1` for Asia)
4. Click **Next**
5. Select **"Start in test mode"** (we'll secure it later)
6. Click **Enable**

---

## 🔐 Step 3: Configure Security Rules

1. In Realtime Database page, click **"Rules"** tab
2. Replace the default rules with this:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

3. Click **"Publish"**

> **Note:** These rules ensure only authenticated users can access their own data.

---

## 🔑 Step 4: Get Firebase Config

1. In Firebase Console, click ⚙️ **Settings** (gear icon) → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click **Web icon** `</>` (if no apps yet, click "Add app" → "Web")
4. Register app name: `Bryan Finance Web`
5. Click **"Register app"**
6. Copy the `firebaseConfig` object (looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. Copy this entire object - you'll need it in the next step

---

## ⚙️ Step 5: Add Config to Your App

### Option A: Via Settings Page (Easiest)

1. Open your finance tracker app
2. Go to **Settings** view (gear icon in sidebar)
3. Look for **"Cloud Sync Configuration"** section
4. Paste your Firebase config JSON
5. Click **"Save Config"**
6. Reload the app

### Option B: Via Code

1. Open `public/js/sync.js`
2. Find the `_getFirebaseConfig()` function
3. Replace the `return null;` with your config:

```javascript
_getFirebaseConfig() {
  return {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };
}
```

---

## ✅ Step 6: Test the Sync

1. **On your phone:**
   - Open the finance tracker
   - Add a new bill or expense
   - Wait 2-3 seconds

2. **On your computer:**
   - Open the finance tracker
   - You should see a notification: "🔄 bills synced from another device"
   - The bill you added on phone should appear!

3. **Try the reverse:**
   - On computer, add a bill
   - On phone, it should appear automatically

---

## 🔍 Troubleshooting

### Sync not working?

**Check browser console for errors:**
1. Press `F12` (or right-click → Inspect)
2. Go to **Console** tab
3. Look for `[Sync]` messages

**Common issues:**

| Issue | Solution |
|-------|----------|
| "Firebase not loaded" | Check internet connection, Firebase SDK should load from CDN |
| "No Firebase config found" | Add config via Settings or code |
| "No user ID - sync disabled" | Make sure you're logged in first |
| "Permission denied" | Check Firebase security rules are correct |

### Check if sync is enabled:

Open browser console and type:
```javascript
CloudSync.isEnabled
```

Should return `true`.

### View your data in Firebase:

1. Go to Firebase Console
2. Click **Realtime Database**
3. Click **Data** tab
4. You should see `users/user_xxx/bills`, `incomes`, etc.

---

## 🔒 Security Notes

- Each user's data is isolated (you can't see other users' data)
- Data is identified by a hash of your username
- All data is encrypted in transit (HTTPS)
- Firebase rules prevent unauthorized access

---

## 💡 How It Works

### When you make a change:

1. **Saved to localStorage** (instant, works offline)
2. **Pushed to Firebase** (if online)
3. **Other devices listening** receive the update
4. **Other devices update** their localStorage and refresh views
5. **You see notification** "🔄 synced from another device"

### When you're offline:

1. Changes saved to localStorage
2. When back online, next change triggers a full sync
3. All devices catch up

### Conflict resolution:

- **Last write wins** - newest change overwrites older ones
- Timestamps used to determine which is newer

---

## 🎯 What Gets Synced

✅ **Bills** - All bills and their statuses
✅ **Income** - All income sources
✅ **Expenses** - Daily expenses
✅ **Banks** - Account balances

❌ **Not synced:**
- Chat history (stays local)
- Settings (stays local)
- Session data (stays local)

---

## 🚀 Next Steps

Once set up, your data will sync automatically across:
- 📱 Your iPhone
- 💻 Your laptop
- 🖥️ Your desktop
- 📱 Your tablet
- Any device where you login!

No more manual data entry on multiple devices! 🎉

---

## 📞 Need Help?

If you run into issues:
1. Check browser console for errors
2. Verify Firebase config is correct
3. Check Firebase console to see if data is being saved
4. Make sure you're logged in with the same account on all devices

---

**Happy syncing!** ☁️✨
