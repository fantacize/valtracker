 rank icons & rr progress bar feature

 what's new

your tracker now displays beautiful rank icons and an animated rr progress bar for each player!

 visual features

rank icon
64x64px animated rank badge
floating animation (subtle up/down movement)
glowing shadow effect
supports all ranks from iron 1 to radiant

rr progress bar
shows current rr out of 100
green gradient fill (00ff88  00cc66)
animated fill with smooth transitions
text overlay showing "xx / 100 rr"
glowing effect on the filled portion

 supported ranks

all 23 competitive ranks are supported:

radiant
radiant_rank.png

immortal
immortal_1_rank.png
immortal_2_rank.png
immortal_3_rank.png

ascendant
ascendant_1_rank.png
ascendant_2_rank.png
ascendant_3_rank.png

diamond
diamond_1_rank.png
diamond_2_rank.png
diamond_3_rank.png

platinum
platinum_1_rank.png
platinum_2_rank.png
platinum_3_rank.png

gold
gold_1_rank.png
gold_2_rank.png
gold_3_rank.png

silver
silver_1_rank.png
silver_2_rank.png
silver_3_rank.png

bronze
bronze_1_rank.png
bronze_2_rank.png
bronze_3_rank.png

iron
iron_1_rank.png
iron_2_rank.png
iron_3_rank.png

 file structure

frontend/
 public/
    ranks/
        radiant_rank.png
        immortal_1_rank.png
        immortal_2_rank.png
        ... (all 23 rank icons)
        iron_1_rank.png
 src/
     components/
         playercard.jsx (displays rank icon & rr bar)
         playercard.css (styles for icon & bar)

 how it works

rank icon mapping
the getrankicon() function maps rank tier names to icon filenames:

getrankicon("diamond 3")
// returns: "/ranks/diamond_3_rank.png"

getrankicon("radiant")
// returns: "/ranks/radiant_rank.png"

rr progress bar
the progress bar calculates width based on rr percentage:

// if player has 72 rr
<div style={{ width: '72%' }}>  // 72% filled
  <span>72 / 100 rr</span>
</div>

 display example


   [rank icon]            animated 64x64 icon
   rank                
   diamond 3              rank name in red
    
       rr progress bar (72%)
     72 / 100 rr        centered text
    


 rr progress bar colors

background: dark transparent (rgba(0, 0, 0, 0.4))
fill: green gradient (#00ff88  #00cc66)
border: subtle white (rgba(255, 255, 255, 0.2))
glow: green shadow (rgba(0, 255, 136, 0.5))
text: white with dark shadow for readability

 animations

rank icon float
@keyframes float {
  0%, 100% { transform: translatey(0px); }
  50% { transform: translatey(-5px); }
}
duration: 3 seconds
easing: ease-in-out
infinite loop

rr bar fill
transition: width 0.5s ease;
smooth expansion when rr changes
0.5 second duration

 live demo

check out the valoranttrackerdemo artifact to see:
 rank icons for all players
 animated rr progress bars
 floating rank badges
 glowing effects

 customization

change icon size
edit playercard.css:
.rank-icon {
  width: 80px;  /* larger icon */
  height: 80px;
}

change rr bar height
edit playercard.css:
.rr-bar-wrapper {
  height: 30px;  /* taller bar */
}

change bar colors
edit playercard.css:
.rr-bar-fill {
  background: linear-gradient(90deg, #ff4655 0%, #ff8787 100%);
  /* red gradient instead of green */
}

 data requirements

from tracker.gg api, you need:
rank.tier - e.g., "diamond 3", "radiant"
rank.rr - number between 0-100

example api response:
{
  "rank": {
    "tier": "diamond 3",
    "tiernumber": 20,
    "rr": 72,
    "peakrank": "ascendant 1"
  }
}

 troubleshooting

rank icons not showing
check /frontend/public/ranks/ folder exists
verify all 23 png files are present
check browser console for 404 errors
make sure rank tier name matches exactly

rr bar not displaying
ensure playerstats.rank.rr is a number (0-100)
check css is loaded properly
verify element isn't being hidden

icons look blurry
icons are 64x64px by default
don't scale them too large (max 128px recommended)
ensure source pngs are high quality

 future enhancements

ideas for improving the rank display:

rank up animation
flash effect when player ranks up
confetti or particle effects

interactive tooltip
hover to see rank history
show rr change from last game

rank comparison
highlight rank differences
show average lobby rank

win/loss streaks
visual indicator of hot/cold streaks
predict rr gain/loss

rank distribution graph
mini chart showing rank spread in lobby
team average vs enemy average

 summary

your tracker now has:
 beautiful animated rank icons
 rr progress bars (0-100)
 glowing effects and smooth animations
 support for all 23 competitive ranks
 professional, polished appearance

the rank icons add personality and make it instantly clear what rank everyone is! 

