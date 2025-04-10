const { getBasicRunnerInfo, getRunnerLaunchStats } = require('../DB/querys');

exports.getRunnerStats = async (req, res) => {
  try {
    const [basicInfo, launchStats] = await Promise.all([
      getBasicRunnerInfo(),
      getRunnerLaunchStats()
    ]);

    res.json({
      runners: basicInfo,
      stats: launchStats
    });
  } catch (error) {
    console.error('Error fetching runner statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
