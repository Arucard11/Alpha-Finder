// src/api.js

const BASE_URL = "http://localhost:5000";

/**
 * Fetch leaderboard data from the backend API using a POST request.
 *
 * For the "allTime" category, the request body includes:
 *    { offset: <number> }
 *
 * For day-based leaderboards (e.g., "7-day", "30-day", "90-day"), the request body includes:
 *    { days: <number>, offset: <number>, sort: <string> }
 *
 * @param {string} category - The leaderboard category ('allTime' or e.g. '7-day', '30-day', '90-day').
 * @param {number} offset - The pagination offset.
 * @param {string} sort - The sort parameter ('highestConfidence', 'mostRunners', 'mostProfit').
 * @returns {Promise<Array>} - A promise that resolves with the data array.
 */
export async function fetchLeaderboardData(category, offset, sort) {
  let endpoint = "";
  let bodyData = {};

  if (category === "allTime") {
    endpoint = `${BASE_URL}/leaderboard/all-time`;
    bodyData = { offset };
  } else {
    // Expect category in the format "X-day" (e.g., "7-day", "30-day", "90-day")
    const daysParam = parseInt(category.split("d")[0], 10) || 90;
    endpoint = `${BASE_URL}/leaderboard/day`;
    bodyData = { days: daysParam, offset, sort };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    throw error;
  }
}
