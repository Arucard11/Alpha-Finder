

/*    <Leaderboard title="All-Time Leaderboard" category="allTime" />
</Grid>
<Grid item xs={12} md={6}>
  <Leaderboard title="90-Day Leaderboard" category="90d" />
</Grid>
<Grid item xs={12} md={6}>
  <Leaderboard title="30-Day Leaderboard" category="30d" />
</Grid>
<Grid item xs={12} md={6}>
  <Leaderboard title="7-Day Leaderboard" category="7d" />
</Grid>
*/
export default async function fetchLeaderboardData(category) {
 let endpoint 

 switch(category){
    case "allTime":
      endpoint = '/all-time'
      break
    case '90d':
      endpoint = '/90-day'
      break
    case '30d':
      endpoint = '/30-day'
        break
    case "7d":
      endpoint = '/7-day'
 }
  
 let res = await fetch(`localhost:5000/leaderboard${endpoint}`)
 let data = await res.json()
 return data.data
}
