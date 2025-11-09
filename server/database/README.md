# Database Setup for Chat History

## Steps to Set Up Chat History

1. **Create the minimal users table:**
   ```sql
   -- Run the SQL in create_users_table.sql
   ```

2. **Insert the default user:**
   The SQL file will automatically insert a default user with ID `00000000-0000-0000-0000-000000000000`

3. **Update the chats table foreign key:**
   The SQL file will also update the chats table to reference `public.users` instead of `auth.users`

## Database Schema

### public.users
- `id` (UUID, primary key)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### public.chats
- References `public.users(id)` via `user_id`
- All existing fields remain the same

### public.messages
- References `public.chats(id)` via `chat_id`
- All existing fields remain the same

## Default User

The system uses a hardcoded default user with ID: `00000000-0000-0000-0000-000000000000`

All chats and messages are associated with this single user. No authentication is required.

