import { supabase } from "../config/db.js";

export async function handleGetInjuryHistory(req, res) {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from("user_injuries")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching injury history:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Server error fetching injury history:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}