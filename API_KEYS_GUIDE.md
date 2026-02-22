 getting api keys

this guide will help you get free api keys for henrik api and tracker.gg.

why you need api keys

while the app works without api keys, you'll hit rate limits very quickly. with free api keys:
henrik api: 30 requests/minute  300 requests/minute
tracker.gg: 10 requests/minute  100 requests/minute

recommendation: get both keys! takes 5 minutes total.



henrik api key (free) 

henrik api is used for:
finding hidden player names
getting player puuids
match history data
mmr/rank information

steps to get henrik api key:

join henrik dev discord
go to: https://discord.gg/x3gavkx2yn
click "join server"

request api key
once in the discord, go to the #get-key channel
follow the bot instructions (usually just click a button)
you'll receive your api key via dm from the bot
it looks like: hdev-a1b2c3d4-e5f6-7890-abcd-ef1234567890

add to .env file
   henrikapikey=hdev-a1b2c3d4-e5f6-7890-abcd-ef1234567890

rate limits (free tier):
300 requests per minute
20,000 requests per day
more than enough for personal use!



tracker.gg api key (free) 

tracker.gg api is used for:
detailed player statistics
k/d ratios
headshot percentages
win rates
agent-specific stats
rank/rr information

steps to get tracker.gg api key:

go to tracker network developers
visit: https://tracker.gg/developers
click "sign in" or "sign up"

create account
sign up with email or social login
verify your email if required

request api access
go to: https://tracker.gg/developers/docs/titles/valorant
click "applications" in the top menu
click "create new application"
fill in the form:
application name: "personal valorant tracker"
description: "personal use tracker for valorant matches"
application url: http://localhost:3000 (or leave blank)
submit the application

get your api key
once approved (usually instant), go to "applications"
click on your application
copy your api key
it looks like: a1b2c3d4-e5f6-7890-1234-567890abcdef

add to .env file
   trackerapikey=a1b2c3d4-e5f6-7890-1234-567890abcdef

rate limits (free tier):
100 requests per minute
10,000 requests per day
perfect for personal trackers!



setup your .env file

create backend/.env file:

port=3000

henrik api key (get from discord: https://discord.gg/x3gavkx2yn)
henrikapikey=hdev-your-key-here

tracker.gg api key (get from: https://tracker.gg/developers)
trackerapikey=your-key-here

important notes:
never commit .env to git (it's in .gitignore)
keep your keys private
don't share your keys publicly
regenerate if accidentally exposed



test your api keys

start your backend:
cd backend
npm run dev

you should see:
 server started successfully
 cors enabled
 waiting for requests...

no errors = your keys are working! 



troubleshooting

"invalid api key" error
double-check you copied the full key
make sure there are no spaces before/after the key
verify the key in your discord dms / tracker dashboard
try regenerating the key

"rate limit exceeded"
you're making too many requests
wait 1 minute and try again
the app caches data to minimize requests
consider increasing cache times in code

"api key not found"
make sure your .env file is in the backend/ folder
restart your backend server after adding keys
check file is named exactly .env (not .env.txt)

henrik api not working
make sure you're in the henrik discord server
check your dms for the key from the bot
try requesting a new key in #get-key
contact support in #support channel

tracker.gg not working
verify your application was approved
check you're using the correct api key (not client id)
make sure you're hitting the right endpoints
check tracker.gg status page



rate limit best practices

the app already implements:
 response caching (10 seconds for match data, 10 minutes for stats)
 request deduplication
 exponential backoff on errors

you can further optimize by:
reducing auto-refresh frequency
increasing cache ttl values
disabling certain features



alternative: run without api keys

the app works without keys but with severe limitations:
henrik: ~30 req/min  you'll hit limits with 2-3 players
tracker: ~10 req/min  can't load stats for full lobby

not recommended for actual use!



need help?

henrik api: discord support in #support
tracker.gg: email developers@tracker.gg
this project: create a github issue



summary

 do this:
join henrik discord  get key (2 min)
register on tracker.gg  get key (3 min)
add both to backend/.env
start backend  test it works
enjoy unlimited tracking! 

total time: ~5 minutes
cost: $0 (completely free)
worth it: 100% yes 

