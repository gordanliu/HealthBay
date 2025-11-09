# Chat History Setup Guide

## Overview
Chat history is now fully implemented with a hardcoded single user. All conversations are automatically saved and can be viewed in the History tab.

## Database Setup

### 1. Run the SQL Script
Execute the SQL in `server/database/create_users_table.sql`:

```sql
-- This will:
-- 1. Create a minimal public.users table
-- 2. Insert a default user with ID: 00000000-0000-0000-0000-000000000000
-- 3. Update the chats table to reference public.users instead of auth.users
```

### 2. Verify the Setup
- Check that the `public.users` table exists
- Verify that the default user was inserted
- Confirm that the `chats` table foreign key was updated

## Backend Changes

### New Files
- `server/src/config/constants.js` - Contains DEFAULT_USER_ID constant
- `server/src/controllers/chatHistoryController.js` - Handles chat history operations
- `server/src/routes/chatHistoryRoutes.js` - Chat history API routes

### Updated Files
- `server/src/controllers/chatController.js` - Now saves full context in metadata and includes chatId in responses
- `server/src/app.js` - Added chat history routes at `/api/chats`

### API Endpoints
- `GET /api/chats` - Get all chats for the user
- `GET /api/chats/:chatId/messages` - Get messages for a specific chat
- `POST /api/chats` - Create a new chat
- `PATCH /api/chats/:chatId` - Update a chat
- `DELETE /api/chats/:chatId` - Delete a chat

## Frontend Changes

### New Files
- `client/src/api/chatHistoryApi.js` - API client for chat history operations

### Updated Files
- `client/src/api/chatApi.js` - Now accepts `chatId` parameter
- `client/src/screens/ChatScreen.js` - Now loads existing chats and passes chatId
- `client/src/screens/HistoryScreen.js` - Now displays and navigates to chats
- `client/src/navigation/ChatStack.js` - Now accepts chatId parameter

## Features

### Automatic Chat Saving
- All conversations are automatically saved to the database
- Each message includes full context in metadata for restoration
- Chat titles are automatically generated from diagnosis names or injury details

### Chat History Display
- View all past conversations in the History tab
- See chat title, message count, last activity time, and summary
- Tap a chat to continue the conversation
- Delete chats with confirmation

### Context Restoration
- When loading an existing chat, the full context is restored from metadata
- This includes:
  - Current stage (GATHERING_INFO, DIAGNOSIS_LIST, etc.)
  - Diagnosis information
  - Test results and analysis
  - Treatment plans
  - Current details (symptoms, body part, etc.)

## Usage

### Starting a New Chat
1. Navigate to the Home tab
2. Click "Start New Consultation"
3. Start chatting - the chat is automatically saved

### Viewing Chat History
1. Navigate to the History tab
2. See all your past conversations
3. Tap a chat to continue the conversation
4. Swipe or tap the × button to delete (with confirmation)

### Continuing a Conversation
1. From History, tap on a chat
2. The chat loads with all previous messages
3. Continue the conversation - context is fully restored
4. All new messages are saved to the same chat

## Technical Details

### User Management
- Single hardcoded user: `00000000-0000-0000-0000-000000000000`
- No authentication required
- All chats belong to this user

### Context Storage
- Context is stored in the `metadata` field of AI messages (JSONB)
- Includes stage, diagnosis info, test results, treatment plans, etc.
- Allows full conversation restoration

### Chat Management
- New chats are created automatically when sending the first message
- Chats are updated with the latest title and activity time
- Message count is tracked and updated
- Chats can be deleted (cascades to messages)

## Testing

1. Start a new consultation
2. Send some messages
3. Navigate to History tab
4. Verify the chat appears in the list
5. Tap the chat to continue
6. Verify messages and context are restored
7. Test deleting a chat

## Notes

- The system uses a single hardcoded user for simplicity
- No authentication is required
- All conversations are saved automatically
- Context is fully restored when loading existing chats
- Chat titles are auto-generated from diagnosis or injury details

