const { getBasicRunnerInfo, getRunnerLaunchStats } = require('../DB/querys');

exports.getRunnerStats = async (req, res) => {
  try {
    // Get both data sources
    const [basicInfo, launchStats] = await Promise.all([
      getBasicRunnerInfo(),
      getRunnerLaunchStats()
    ]);

    // Ensure we have data before sending response
    if (!basicInfo || !launchStats) {
      throw new Error('Failed to fetch required data');
    }

    // Structure the response data
    const response = {
      runners: basicInfo || [],
      stats: {
        peak_hours: launchStats?.peak_hours || [],
        top_days: launchStats?.top_days || [],
        athmc_stats: launchStats?.athmc_stats || { median: 0, p25: 0, p75: 0 },
        month_distribution: launchStats?.month_distribution || {
          early: 0,
          late: 0
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching runner statistics:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      success: false 
    });
  }
};
