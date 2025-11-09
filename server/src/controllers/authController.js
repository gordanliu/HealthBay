import { supabase } from "../config/db.js";

export async function handleLogin(req, res) {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: data.user,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleLogout(req, res) {
  try {
    // Just let the client delete tokens from AsyncStorage
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleSignup(req, res) {
    const { email, password, name, age, gender } = req.body;
  
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, age, gender } },
      });
  
      if (error) return res.status(400).json({ error: error.message });
  
      // Return tokens and user in JSON
      return res.status(200).json({
        message: "User created successfully",
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: data.user,
      });
    } catch (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

export async function handleRefreshToken(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(400).json({ error: "Missing refresh token" });

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ error: "Invalid or expired refresh token" });

    return res.status(200).json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: data.session.user,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}