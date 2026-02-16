# 🔑 Getting API Keys

This guide will help you get free API keys for Henrik API and Tracker.gg.

## Why You Need API Keys

While the app works without API keys, you'll hit rate limits very quickly. With free API keys:
- **Henrik API**: 30 requests/minute → 300 requests/minute
- **Tracker.gg**: 10 requests/minute → 100 requests/minute

**Recommendation:** Get both keys! Takes 5 minutes total.

---

## 1. Henrik API Key (Free) 🌐

Henrik API is used for:
- Finding hidden player names
- Getting player PUUIDs
- Match history data
- MMR/Rank information

### Steps to Get Henrik API Key:

1. **Join Henrik Dev Discord**
   - Go to: https://discord.gg/X3GaVkX2YN
   - Click "Join Server"

2. **Request API Key**
   - Once in the Discord, go to the `#get-key` channel
   - Follow the bot instructions (usually just click a button)
   - You'll receive your API key via DM from the bot
   - It looks like: `HDEV-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

3. **Add to .env File**
   ```env
   HENRIK_API_KEY=HDEV-a1b2c3d4-e5f6-7890-abcd-ef1234567890
   ```

**Rate Limits (Free Tier):**
- 300 requests per minute
- 20,000 requests per day
- More than enough for personal use!

---

## 2. Tracker.gg API Key (Free) 📊

Tracker.gg API is used for:
- Detailed player statistics
- K/D ratios
- Headshot percentages
- Win rates
- Agent-specific stats
- Rank/RR information

### Steps to Get Tracker.gg API Key:

1. **Go to Tracker Network Developers**
   - Visit: https://tracker.gg/developers
   - Click "Sign In" or "Sign Up"

2. **Create Account**
   - Sign up with email or social login
   - Verify your email if required

3. **Request API Access**
   - Go to: https://tracker.gg/developers/docs/titles/valorant
   - Click "Applications" in the top menu
   - Click "Create New Application"
   - Fill in the form:
     - **Application Name:** "Personal Valorant Tracker"
     - **Description:** "Personal use tracker for VALORANT matches"
     - **Application URL:** http://localhost:3000 (or leave blank)
   - Submit the application

4. **Get Your API Key**
   - Once approved (usually instant), go to "Applications"
   - Click on your application
   - Copy your API key
   - It looks like: `a1b2c3d4-e5f6-7890-1234-567890abcdef`

5. **Add to .env File**
   ```env
   TRACKER_API_KEY=a1b2c3d4-e5f6-7890-1234-567890abcdef
   ```

**Rate Limits (Free Tier):**
- 100 requests per minute
- 10,000 requests per day
- Perfect for personal trackers!

---

## 3. Setup Your .env File

Create `backend/.env` file:

```env
PORT=3000

# Henrik API Key (get from Discord: https://discord.gg/X3GaVkX2YN)
HENRIK_API_KEY=HDEV-your-key-here

# Tracker.gg API Key (get from: https://tracker.gg/developers)
TRACKER_API_KEY=your-key-here
```

**Important Notes:**
- Never commit `.env` to Git (it's in .gitignore)
- Keep your keys private
- Don't share your keys publicly
- Regenerate if accidentally exposed

---

## 4. Test Your API Keys

Start your backend:
```bash
cd backend
npm run dev
```

You should see:
```
✓ Server started successfully
✓ CORS enabled
✓ Waiting for requests...
```

No errors = your keys are working! 🎉

---

## Troubleshooting

### "Invalid API Key" Error
- Double-check you copied the full key
- Make sure there are no spaces before/after the key
- Verify the key in your Discord DMs / Tracker dashboard
- Try regenerating the key

### "Rate Limit Exceeded"
- You're making too many requests
- Wait 1 minute and try again
- The app caches data to minimize requests
- Consider increasing cache times in code

### "API Key Not Found"
- Make sure your `.env` file is in the `backend/` folder
- Restart your backend server after adding keys
- Check file is named exactly `.env` (not `.env.txt`)

### Henrik API Not Working
- Make sure you're in the Henrik Discord server
- Check your DMs for the key from the bot
- Try requesting a new key in `#get-key`
- Contact support in `#support` channel

### Tracker.gg Not Working
- Verify your application was approved
- Check you're using the correct API key (not client ID)
- Make sure you're hitting the right endpoints
- Check Tracker.gg status page

---

## Rate Limit Best Practices

The app already implements:
- ✅ Response caching (10 seconds for match data, 10 minutes for stats)
- ✅ Request deduplication
- ✅ Exponential backoff on errors

You can further optimize by:
- Reducing auto-refresh frequency
- Increasing cache TTL values
- Disabling certain features

---

## Alternative: Run Without API Keys

The app works without keys but with severe limitations:
- Henrik: ~30 req/min → You'll hit limits with 2-3 players
- Tracker: ~10 req/min → Can't load stats for full lobby

**Not recommended for actual use!**

---

## Need Help?

- Henrik API: Discord support in `#support`
- Tracker.gg: Email developers@tracker.gg
- This project: Create a GitHub issue

---

## Summary

✅ **Do this:**
1. Join Henrik Discord → Get key (2 min)
2. Register on Tracker.gg → Get key (3 min)
3. Add both to `backend/.env`
4. Start backend → Test it works
5. Enjoy unlimited tracking! 🎮

**Total time: ~5 minutes**
**Cost: $0 (completely free)**
**Worth it: 100% YES** ✨
