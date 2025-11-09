import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_HISTORY_KEY = '@healthbay_chat_history';
const MAX_STORED_CHATS = 50; // Keep last 50 chats

/**
 * Save a chat session to storage
 * @param {Object} chatSession - The chat session to save
 * @returns {Promise<string>} - The ID of the saved chat
 */
export async function saveChatSession(chatSession) {
  try {
    // Generate unique ID for this chat
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create chat record
    const chatRecord = {
      id: chatId,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: chatSession.messages,
      context: chatSession.context,
      injuryType: chatSession.context?.refinedDiagnosis?.name ||
                  chatSession.context?.currentDetails?.injury_name || 
                  (chatSession.context?.currentDetails?.body_part && chatSession.context?.currentDetails?.symptoms?.length > 0 
                    ? `${chatSession.context.currentDetails.body_part} ${chatSession.context.currentDetails.symptoms[0]}`
                    : `${chatSession.context?.currentDetails?.body_part || 'General'} Issue`),
      bodyPart: chatSession.context?.currentDetails?.body_part || 'Unknown',
      symptoms: chatSession.context?.currentDetails?.symptoms || [],
      summary: generateChatSummary(chatSession),
      // Refined diagnosis from tests (if available)
      refinedDiagnosis: chatSession.context?.refinedDiagnosis || null,
      confidenceLevel: chatSession.context?.confidenceLevel || null,
      testResults: chatSession.context?.testResults || null,
      completedTests: chatSession.context?.completedTests || false,
    };
    
    // Get existing chats
    const existingChats = await getChatHistory();
    
    // Add new chat at the beginning
    const updatedChats = [chatRecord, ...existingChats];
    
    // Keep only the most recent chats
    const trimmedChats = updatedChats.slice(0, MAX_STORED_CHATS);
    
    // Save to storage
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmedChats));
    
    console.log('✅ Chat saved successfully:', chatId);
    return chatId;
  } catch (error) {
    console.error('❌ Error saving chat:', error);
    throw error;
  }
}

/**
 * Get all saved chat sessions
 * @returns {Promise<Array>} - Array of chat sessions
 */
export async function getChatHistory() {
  try {
    const chatsJson = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
    if (!chatsJson) return [];
    
    const chats = JSON.parse(chatsJson);
    return chats;
  } catch (error) {
    console.error('❌ Error loading chat history:', error);
    return [];
  }
}

/**
 * Get a specific chat session by ID
 * @param {string} chatId - The chat ID to retrieve
 * @returns {Promise<Object|null>} - The chat session or null
 */
export async function getChatById(chatId) {
  try {
    const chats = await getChatHistory();
    return chats.find(chat => chat.id === chatId) || null;
  } catch (error) {
    console.error('❌ Error loading chat:', error);
    return null;
  }
}

/**
 * Delete a chat session
 * @param {string} chatId - The chat ID to delete
 */
export async function deleteChatSession(chatId) {
  try {
    const chats = await getChatHistory();
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updatedChats));
    console.log('✅ Chat deleted:', chatId);
  } catch (error) {
    console.error('❌ Error deleting chat:', error);
    throw error;
  }
}

/**
 * Clear all chat history
 */
export async function clearAllChats() {
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
    console.log('✅ All chats cleared');
  } catch (error) {
    console.error('❌ Error clearing chats:', error);
    throw error;
  }
}

/**
 * Generate a summary of the chat for display
 * @param {Object} chatSession - The chat session
 * @returns {string} - Summary text
 */
function generateChatSummary(chatSession) {
  const { context, messages } = chatSession;
  const details = context?.currentDetails || {};
  const refinedDiagnosis = context?.refinedDiagnosis;
  
  const bodyPart = details.body_part || 'General';
  const injuryName = details.injury_name || refinedDiagnosis?.name || '';
  const symptoms = details.symptoms || [];
  
  // Create a meaningful title based on injury/diagnosis with better nuance
  let title = '';
  
  if (refinedDiagnosis && refinedDiagnosis.name) {
    // Use refined diagnosis from completed tests
    title = refinedDiagnosis.name;
    
    // Add severity if available
    if (refinedDiagnosis.severity) {
      const severityMap = {
        'mild': '(Mild)',
        'moderate': '(Moderate)',
        'severe': '(Severe)',
        'critical': '(Critical)',
      };
      const severityLabel = severityMap[refinedDiagnosis.severity.toLowerCase()] || '';
      if (severityLabel) {
        title = `${title} ${severityLabel}`;
      }
    }
  } else if (injuryName && injuryName !== 'Unknown' && injuryName !== 'Not specified') {
    // Use injury name if available
    title = injuryName;
  } else if (bodyPart && bodyPart !== 'Unknown' && bodyPart !== 'Not specified') {
    // Create descriptive title from body part + symptoms
    if (symptoms.length > 0) {
      // Get the primary symptom and make it more descriptive
      const primarySymptom = symptoms[0];
      
      // Check for common patterns and create better descriptions
      if (primarySymptom.toLowerCase().includes('pain')) {
        // Determine pain type if other symptoms provide context
        const hasSwelling = symptoms.some(s => s.toLowerCase().includes('swell'));
        const hasStiffness = symptoms.some(s => s.toLowerCase().includes('stiff'));
        const hasWeakness = symptoms.some(s => s.toLowerCase().includes('weak'));
        
        if (hasSwelling && hasStiffness) {
          title = `${bodyPart} Pain with Swelling & Stiffness`;
        } else if (hasSwelling) {
          title = `${bodyPart} Pain with Swelling`;
        } else if (hasStiffness) {
          title = `${bodyPart} Pain & Stiffness`;
        } else if (hasWeakness) {
          title = `${bodyPart} Pain & Weakness`;
        } else {
          title = `${bodyPart} Pain`;
        }
      } else if (primarySymptom.toLowerCase().includes('swell')) {
        title = `${bodyPart} Swelling`;
      } else if (primarySymptom.toLowerCase().includes('stiff')) {
        title = `${bodyPart} Stiffness`;
      } else {
        // Default to body part + symptom
        title = `${bodyPart} ${primarySymptom}`;
      }
      
      // Add count if multiple symptoms
      if (symptoms.length > 2) {
        title = `${title} (+${symptoms.length - 1} more)`;
      }
    } else {
      // Just body part with generic issue
      title = `${bodyPart} Issue`;
    }
  } else if (symptoms.length > 0) {
    // Just use symptoms with better formatting
    if (symptoms.length === 1) {
      title = symptoms[0];
    } else if (symptoms.length === 2) {
      title = `${symptoms[0]} & ${symptoms[1]}`;
    } else {
      title = `${symptoms[0]}, ${symptoms[1]} & ${symptoms.length - 2} more`;
    }
  } else {
    // Fallback - check if it's a completed diagnostic session
    if (context?.completedTests) {
      title = 'Diagnostic Test Session';
    } else {
      title = 'Health Consultation';
    }
  }
  
  // Count user messages to gauge conversation length
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  
  return `${title} (${userMessageCount} messages)`;
}

/**
 * Get relevant past injuries for context
 * Helps AI understand user's medical history
 * @param {string} currentBodyPart - Current injury body part
 * @returns {Promise<Array>} - Array of relevant past injuries
 */
export async function getRelevantPastInjuries(currentBodyPart) {
  try {
    const chats = await getChatHistory();
    
    // Filter for similar body parts or related areas
    const relevantChats = chats
      .filter(chat => {
        const bodyPart = chat.bodyPart?.toLowerCase() || '';
        const current = currentBodyPart?.toLowerCase() || '';
        
        // Exact match
        if (bodyPart === current) return true;
        
        // Related body parts (e.g., lower back and upper back)
        if (bodyPart.includes('back') && current.includes('back')) return true;
        if (bodyPart.includes('knee') && current.includes('leg')) return true;
        if (bodyPart.includes('shoulder') && current.includes('arm')) return true;
        
        return false;
      })
      .slice(0, 3) // Get up to 3 most recent relevant chats
      .map(chat => ({
        date: chat.date,
        bodyPart: chat.bodyPart,
        symptoms: chat.symptoms,
        summary: chat.summary,
      }));
    
    return relevantChats;
  } catch (error) {
    console.error('❌ Error getting relevant past injuries:', error);
    return [];
  }
}

/**
 * Format past injuries for AI context
 * @param {Array} pastInjuries - Array of past injury records
 * @returns {string} - Formatted text for AI
 */
export function formatPastInjuriesForAI(pastInjuries) {
  if (!pastInjuries || pastInjuries.length === 0) {
    return null;
  }
  
  const formatted = pastInjuries.map((injury, index) => {
    return `${index + 1}. ${injury.date} - ${injury.bodyPart}: ${injury.symptoms.join(', ')}`;
  }).join('\n');
  
  return `\n\nPast Medical History (from previous chats):\n${formatted}\n\nNote: Consider this history when providing recommendations, but focus primarily on the current injury.`;
}
