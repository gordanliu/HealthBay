import { supabase } from "../config/db.js";
import { DEFAULT_USER_ID } from "../config/constants.js";

/**
 * Get all chats for the default user
 */
export async function getChats(req, res) {
  try {
    const userId = DEFAULT_USER_ID;
    
    const { data: chats, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("last_activity", { ascending: false });

    if (error) {
      console.error("❌ Error fetching chats:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch chats",
      });
    }

    res.json({
      success: true,
      data: chats || [],
    });
  } catch (err) {
    console.error("❌ Error in getChats:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch chats",
    });
  }
}

/**
 * Get messages for a specific chat
 */
export async function getChatMessages(req, res) {
  try {
    const { chatId } = req.params;
    const userId = DEFAULT_USER_ID;

    // First verify the chat belongs to the user
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Get all messages for this chat
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true });

    if (messagesError) {
      console.error("❌ Error fetching messages:", messagesError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch messages",
      });
    }

    res.json({
      success: true,
      data: messages || [],
    });
  } catch (err) {
    console.error("❌ Error in getChatMessages:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
}

/**
 * Create a new chat
 */
export async function createChat(req, res) {
  try {
    const userId = DEFAULT_USER_ID;
    const { title } = req.body;

    const { data: chat, error } = await supabase
      .from("chats")
      .insert({
        user_id: userId,
        title: title || "New Consultation",
        status: "active",
        context_summary: "",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating chat:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create chat",
      });
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (err) {
    console.error("❌ Error in createChat:", err);
    res.status(500).json({
      success: false,
      error: "Failed to create chat",
    });
  }
}

/**
 * Update chat status (e.g., mark as resolved)
 */
export async function updateChat(req, res) {
  try {
    const { chatId } = req.params;
    const userId = DEFAULT_USER_ID;
    const { status, title } = req.body;

    // Verify the chat belongs to the user
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (title) updateData.title = title;

    const { data: updatedChat, error: updateError } = await supabase
      .from("chats")
      .update(updateData)
      .eq("id", chatId)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating chat:", updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update chat",
      });
    }

    res.json({
      success: true,
      data: updatedChat,
    });
  } catch (err) {
    console.error("❌ Error in updateChat:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update chat",
    });
  }
}

/**
 * Delete a chat
 */
export async function deleteChat(req, res) {
  try {
    const { chatId } = req.params;
    const userId = DEFAULT_USER_ID;

    // Verify the chat belongs to the user
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Delete chat (messages will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId);

    if (deleteError) {
      console.error("❌ Error deleting chat:", deleteError);
      return res.status(500).json({
        success: false,
        error: "Failed to delete chat",
      });
    }

    res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (err) {
    console.error("❌ Error in deleteChat:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete chat",
    });
  }
}

